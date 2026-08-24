import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import type { BaselineSource, EacMethod } from "@prisma/client";

// ── Types ──

export type BaselineEntryData = {
  taskId: string;
  startDate: Date | null;
  endDate: Date | null;
  percentComplete: number | null;
  budgetLineMinor: number;
};

export type BaselineData = {
  id: string;
  projectId: string;
  name: string;
  source: BaselineSource;
  isCurrent: boolean;
  capturedBy: string;
  capturedAt: Date;
  entries: BaselineEntryData[];
};

export type EvmMetrics = {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  eac: number;
  vac: number;
  tcpi: number;
  eacMethod: EacMethod;
  currency: string;
};

export type EvmSeriesPoint = {
  date: string;
  pv: number;
  ev: number;
  ac: number;
  bac: number;
};

// ── Capture a baseline ──

export async function captureBaseline(
  projectId: string,
  name: string,
  userId: string,
  source: BaselineSource = "MANUAL",
): Promise<BaselineData> {
  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      startDate: true,
      dueDate: true,
      progress: true,
      estimatedHours: true,
      spentHours: true,
      status: true,
    },
  });

  const entries: BaselineEntryData[] = tasks.map((t) => ({
    taskId: t.id,
    startDate: t.startDate,
    endDate: t.dueDate,
    percentComplete: t.progress,
    budgetLineMinor: Math.round((Number(t.estimatedHours) || 0) * 100),
  }));

  const snapshot = { tasks: entries, capturedAt: new Date().toISOString() };

  return prisma.$transaction(async (tx) => {
    // Demote any existing current baseline
    await tx.projectBaseline.updateMany({
      where: { projectId, isCurrent: true },
      data: { isCurrent: false },
    });

    const baseline = await tx.projectBaseline.create({
      data: {
        projectId,
        teamId: projectId, // denormalized; same as project for now
        name,
        source,
        isCurrent: true,
        snapshot: snapshot as never,
        capturedBy: userId,
      },
    });

    // Create entries in bulk
    if (entries.length > 0) {
      await tx.baselineEntry.createMany({
        data: entries.map((e) => ({
          baselineId: baseline.id,
          taskId: e.taskId,
          startDate: e.startDate,
          endDate: e.endDate,
          percentComplete: e.percentComplete,
          budgetLineMinor: e.budgetLineMinor,
        })),
      });
    }

    await logAudit({
      actorUserId: userId,
      action: "updated",
      entityType: "project" as never,
      entityId: projectId,
      after: { baselineId: baseline.id, name, entryCount: entries.length } as never,
    });

    return {
      id: baseline.id,
      projectId: baseline.projectId,
      name: baseline.name,
      source: baseline.source,
      isCurrent: baseline.isCurrent,
      capturedBy: baseline.capturedBy,
      capturedAt: baseline.capturedAt,
      entries,
    };
  });
}

// ── Activate a baseline ──

export async function activateBaseline(baselineId: string, projectId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.projectBaseline.updateMany({
      where: { projectId, isCurrent: true },
      data: { isCurrent: false },
    });
    await tx.projectBaseline.update({
      where: { id: baselineId },
      data: { isCurrent: true },
    });
  });
}

// ── EVM computation ──

export async function computeEvm(
  projectId: string,
  asOf: Date = new Date(),
  eacMethod: EacMethod = "CPI_BASED",
  currency: string = "USD",
): Promise<EvmMetrics> {
  const baseline = await prisma.projectBaseline.findFirst({
    where: { projectId, isCurrent: true },
    include: { entries: true },
  });

  if (!baseline) {
    return {
      bac: 0, pv: 0, ev: 0, ac: 0, cv: 0, sv: 0,
      cpi: 0, spi: 0, eac: 0, vac: 0, tcpi: 0,
      eacMethod, currency,
    };
  }

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, progress: true, estimatedHours: true, spentHours: true },
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const entries = baseline.entries;

  // BAC = total budget at completion
  const bac = entries.reduce((sum, e) => sum + e.budgetLineMinor, 0);

  // PV = planned value (linear interpolation of baseline progress up to asOf)
  const projectStart = entries.reduce(
    (min, e) => (e.startDate && e.startDate < min ? e.startDate : min),
    new Date(),
  );
  const projectEnd = entries.reduce(
    (max, e) => (e.endDate && e.endDate > max ? e.endDate : max),
    new Date(0),
  );

  let pv = 0;
  if (projectStart < projectEnd) {
    const totalDuration = projectEnd.getTime() - projectStart.getTime();
    const elapsed = Math.max(0, asOf.getTime() - projectStart.getTime());
    const progressRatio = Math.min(1, elapsed / totalDuration);
    pv = bac * progressRatio;
  }

  // EV = earned value (weighted by budget)
  let ev = 0;
  for (const entry of entries) {
    const task = taskMap.get(entry.taskId);
    if (!task) continue;
    const progress = Number(task.progress) || 0;
    ev += (progress / 100) * entry.budgetLineMinor;
  }

  // AC = actual cost (sum of spent hours converted to minor units)
  let ac = 0;
  for (const entry of entries) {
    const task = taskMap.get(entry.taskId);
    if (!task) continue;
    const spent = Number(task.spentHours) || 0;
    ac += spent * 100; // hours × 100 minor units per hour
  }

  const cv = ev - ac; // cost variance
  const sv = ev - pv; // schedule variance
  const cpi = ac > 0 ? ev / ac : 0; // cost performance index
  const spi = pv > 0 ? ev / pv : 0; // schedule performance index

  // EAC = estimate at completion
  let eac = bac;
  if (eacMethod === "CPI_BASED") {
    eac = cpi > 0 ? ac + (bac - ev) / cpi : bac;
  } else if (eacMethod === "SPI_BASED") {
    eac = spi > 0 ? ac + (bac - ev) / spi : bac;
  } else {
    // TCPI-based: remaining work / remaining budget
    const remainingBudget = bac - ac;
    const remainingWork = bac - ev;
    const tcpi = remainingBudget > 0 ? remainingWork / remainingBudget : 1;
    eac = tcpi > 0 ? ac + (bac - ev) / tcpi : bac;
  }

  const vac = bac - eac; // variance at completion
  const remainingWork = bac - ev;
  const remainingBudget = bac - ac;
  const tcpi = remainingBudget > 0 ? remainingWork / remainingBudget : 1;

  return {
    bac: Math.round(bac),
    pv: Math.round(pv),
    ev: Math.round(ev),
    ac: Math.round(ac),
    cv: Math.round(cv),
    sv: Math.round(sv),
    cpi: Math.round(cpi * 1000) / 1000,
    spi: Math.round(spi * 1000) / 1000,
    eac: Math.round(eac),
    vac: Math.round(vac),
    tcpi: Math.round(tcpi * 1000) / 1000,
    eacMethod,
    currency,
  };
}

// ── Snapshot an EVM point ──

export async function snapshotEvm(
  projectId: string,
  eacMethod: EacMethod = "CPI_BASED",
  currency: string = "USD",
): Promise<EvmMetrics> {
  const metrics = await computeEvm(projectId, new Date(), eacMethod, currency);

  const snapshot = await prisma.evmSnapshot.create({
    data: {
      projectId,
      snapshotDate: new Date(),
      ...metrics,
    },
  });

  return {
    bac: snapshot.bac,
    pv: snapshot.pv,
    ev: snapshot.ev,
    ac: snapshot.ac,
    cv: snapshot.cv,
    sv: snapshot.sv,
    cpi: snapshot.cpi,
    spi: snapshot.spi,
    eac: snapshot.eac,
    vac: snapshot.vac,
    tcpi: snapshot.tcpi,
    eacMethod: snapshot.eacMethod,
    currency: snapshot.currency,
  };
}

// ── S-curve series ──

export async function getEvmSeries(projectId: string): Promise<EvmSeriesPoint[]> {
  const snapshots = await prisma.evmSnapshot.findMany({
    where: { projectId },
    orderBy: { snapshotDate: "asc" },
    select: { snapshotDate: true, pv: true, ev: true, ac: true, bac: true },
  });

  return snapshots.map((s) => ({
    date: s.snapshotDate.toISOString(),
    pv: s.pv,
    ev: s.ev,
    ac: s.ac,
    bac: s.bac,
  }));
}

// ── Variance report ──

export async function getVarianceReport(projectId: string) {
  const baseline = await prisma.projectBaseline.findFirst({
    where: { projectId, isCurrent: true },
    include: { entries: true },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, title: true, progress: true, estimatedHours: true, spentHours: true, startDate: true, dueDate: true },
  });

  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const entries = baseline?.entries ?? [];
  const variances = entries.map((e) => {
    const task = taskMap.get(e.taskId);
    if (!task) return null;
    const planned = e.budgetLineMinor;
    const actual = Math.round((Number(task.spentHours) || 0) * 100);
    const earned = ((Number(task.progress) || 0) / 100) * planned;
    return {
      taskId: task.id,
      title: task.title,
      planned,
      actual,
      earned: Math.round(earned),
      costVariance: Math.round(earned - actual),
      scheduleVariance: Math.round(earned - planned),
    };
  }).filter(Boolean);

  return {
    baselineId: baseline?.id ?? null,
    baselineName: baseline?.name ?? null,
    variances,
  };
}

// ── Compare baselines ──

export async function compareBaselines(projectId: string) {
  const baselines = await prisma.projectBaseline.findMany({
    where: { projectId },
    orderBy: { capturedAt: "desc" },
    take: 2,
    include: { entries: true },
  });

  if (baselines.length === 0) return { current: null, previous: null };

  const current = baselines.find((b) => b.isCurrent) ?? baselines[0]!;
  const previous = baselines.find((b) => b.id !== current.id) ?? null;

  return {
    current: current ? { id: current.id, name: current.name, capturedAt: current.capturedAt, entryCount: current.entries.length } : null,
    previous: previous ? { id: previous.id, name: previous.name, capturedAt: previous.capturedAt, entryCount: previous.entries.length } : null,
  };
}
