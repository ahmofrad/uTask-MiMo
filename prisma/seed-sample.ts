import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { LOCAL_SEED_PASSWORD } from "../src/lib/auth/seed-defaults";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── Users ──
  const owner = await prisma.user.upsert({
    where: { email: "owner@utask.local" },
    update: { displayName: "مدیر سیستم", locale: "fa_IR" },
    create: {
      email: "owner@utask.local",
      displayName: "مدیر سیستم",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@utask.local" },
    update: { displayName: "مدیر ارشد", locale: "fa_IR" },
    create: {
      email: "admin@utask.local",
      displayName: "مدیر ارشد",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@utask.local" },
    update: { displayName: "سرپرست تیم", locale: "fa_IR" },
    create: {
      email: "manager@utask.local",
      displayName: "سرپرست تیم",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const member1 = await prisma.user.upsert({
    where: { email: "sara@utask.local" },
    update: { displayName: "سارا محمدی", locale: "fa_IR" },
    create: {
      email: "sara@utask.local",
      displayName: "سارا محمدی",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: "ali@utask.local" },
    update: { displayName: "علی رضایی", locale: "fa_IR" },
    create: {
      email: "ali@utask.local",
      displayName: "علی رضایی",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@utask.local" },
    update: { displayName: "عضو تیم", locale: "fa_IR" },
    create: {
      email: "member@utask.local",
      displayName: "عضو تیم",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const guest = await prisma.user.upsert({
    where: { email: "guest@utask.local" },
    update: { displayName: "مهمان", locale: "fa_IR" },
    create: {
      email: "guest@utask.local",
      displayName: "مهمان",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "fa_IR",
      status: "active",
    },
  });

  const englishUser = await prisma.user.upsert({
    where: { email: "john@utask.local" },
    update: { displayName: "John Smith", locale: "en_US" },
    create: {
      email: "john@utask.local",
      displayName: "John Smith",
      passwordHash: hashPassword(LOCAL_SEED_PASSWORD),
      locale: "en_US",
      status: "active",
    },
  });

  const users = { owner, admin, manager, member1, member2, member, guest, englishUser };

  // ── Roles ──
  const roleData = [
    { userId: owner.id, type: "owner" as const, scopeType: "global" as const },
    { userId: admin.id, type: "admin" as const, scopeType: "global" as const },
    { userId: manager.id, type: "manager" as const, scopeType: "global" as const },
    { userId: member1.id, type: "member" as const, scopeType: "global" as const },
    { userId: member2.id, type: "member" as const, scopeType: "global" as const },
    { userId: member.id, type: "member" as const, scopeType: "global" as const },
    { userId: guest.id, type: "guest" as const, scopeType: "global" as const },
    { userId: englishUser.id, type: "member" as const, scopeType: "global" as const },
  ];

  for (const r of roleData) {
    const existing = await prisma.role.findFirst({
      where: { userId: r.userId, type: r.type, scopeType: r.scopeType, scopeId: null },
    });
    if (!existing) {
      await prisma.role.create({ data: { ...r, scopeId: null, grantedBy: owner.id } });
    }
  }

  // ── Departments ──
  const deptEngineering = await prisma.department.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { name: "Engineering" },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Engineering",
      managerUserId: manager.id,
    },
  });

  const deptProduct = await prisma.department.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: { name: "Product" },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Product",
      parentId: deptEngineering.id,
      managerUserId: admin.id,
    },
  });

  const deptFinance = await prisma.department.upsert({
    where: { id: "00000000-0000-4000-8000-000000000003" },
    update: { name: "Finance" },
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Finance",
    },
  });

  // ── AD Sync Group (drives an LDAP department + memberships) ──
  const engGroup = await prisma.ldapSyncGroup.upsert({
    where: { dn: "cn=engineering-team,dc=company,dc=local" },
    update: { name: "Engineering Team", deletedAt: null },
    create: {
      name: "Engineering Team",
      dn: "cn=engineering-team,dc=company,dc=local",
      lastSyncedAt: new Date(),
    },
  });

  const existingLinkedDept = await prisma.department.findFirst({
    where: { ldapSyncGroupId: engGroup.id },
  });
  if (!existingLinkedDept) {
    await prisma.department.create({
      data: {
        name: "Engineering Team",
        source: "ldap",
        ldapSyncGroupId: engGroup.id,
        managerUserId: admin.id,
        managerSource: "manual",
      },
    });
  }

  for (const groupUser of [users.member1, users.member2, users.englishUser, users.manager]) {
    await prisma.ldapGroupMembership.upsert({
      where: {
        userId_ldapSyncGroupId: { userId: groupUser.id, ldapSyncGroupId: engGroup.id },
      },
      update: {},
      create: { userId: groupUser.id, ldapSyncGroupId: engGroup.id },
    });
  }

  // ── Manual Group (created in-app; no AD source) ──
  const manualGroup = await prisma.ldapSyncGroup.upsert({
    where: { id: "00000000-0000-4000-8000-000000000021" },
    update: { name: "Design Team", deletedAt: null },
    create: {
      id: "00000000-0000-4000-8000-000000000021",
      name: "Design Team",
      dn: null,
      source: "manual",
      ownerDepartmentId: deptProduct.id,
    },
  });

  for (const groupUser of [users.member, users.englishUser]) {
    await prisma.ldapGroupMembership.upsert({
      where: {
        userId_ldapSyncGroupId: { userId: groupUser.id, ldapSyncGroupId: manualGroup.id },
      },
      update: {},
      create: { userId: groupUser.id, ldapSyncGroupId: manualGroup.id },
    });
  }

  // ── Projects ──
  const projectWork = await prisma.project.upsert({
    where: { id: "00000000-0000-4000-8000-000000000010" },
    update: { name: "Work" },
    create: {
      id: "00000000-0000-4000-8000-000000000010",
      name: "Work",
      description: "Work-related tasks and projects",
      color: "#2563eb",
      ownerId: owner.id,
      departmentId: deptEngineering.id,
      visibility: "org",
    },
  });

  const projectPersonal = await prisma.project.upsert({
    where: { id: "00000000-0000-4000-8000-000000000011" },
    update: { name: "Personal" },
    create: {
      id: "00000000-0000-4000-8000-000000000011",
      name: "Personal",
      description: "Personal tasks and side projects",
      color: "#16a34a",
      ownerId: owner.id,
      visibility: "private",
    },
  });

  const productLaunch = await prisma.project.upsert({
    where: { id: "00000000-0000-4000-8000-000000000012" },
    update: { name: "Product Launch" },
    create: {
      id: "00000000-0000-4000-8000-000000000012",
      name: "Product Launch",
      description: "Q4 product launch coordination",
      color: "#ea580c",
      ownerId: admin.id,
      departmentId: deptProduct.id,
      visibility: "department",
    },
  });

  // ── Project Members ──
  const projectMemberData = [
    { projectId: projectWork.id, userId: owner.id, projectRole: "lead" as const, addedBy: owner.id },
    { projectId: projectWork.id, userId: manager.id, projectRole: "lead" as const, addedBy: owner.id },
    { projectId: projectWork.id, userId: member1.id, projectRole: "contributor" as const, addedBy: owner.id },
    { projectId: projectWork.id, userId: member2.id, projectRole: "contributor" as const, addedBy: owner.id },
    { projectId: projectWork.id, userId: guest.id, projectRole: "viewer" as const, addedBy: owner.id },
    { projectId: projectPersonal.id, userId: owner.id, projectRole: "lead" as const, addedBy: owner.id },
    { projectId: productLaunch.id, userId: admin.id, projectRole: "lead" as const, addedBy: admin.id },
    { projectId: productLaunch.id, userId: manager.id, projectRole: "contributor" as const, addedBy: admin.id },
    { projectId: productLaunch.id, userId: member1.id, projectRole: "contributor" as const, addedBy: admin.id },
  ];

  for (const pm of projectMemberData) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: pm.projectId, userId: pm.userId } },
      update: {},
      create: pm,
    });
  }

  // ── Custom Fields ──
  const cfStoryPoints = await prisma.customField.upsert({
    where: { projectId_key: { projectId: projectWork.id, key: "story_points" } },
    update: {},
    create: {
      projectId: projectWork.id,
      name: "Story Points",
      key: "story_points",
      type: "number",
      required: false,
      orderIndex: 0,
      configJson: { min: 1, max: 21, step: 1 },
    },
  });

  const cfComponent = await prisma.customField.upsert({
    where: { projectId_key: { projectId: projectWork.id, key: "component" } },
    update: {},
    create: {
      projectId: projectWork.id,
      name: "Component",
      key: "component",
      type: "select",
      required: false,
      orderIndex: 1,
      configJson: {
        options: [
          { value: "backend", label: "Backend", color: "#0284c7" },
          { value: "frontend", label: "Frontend", color: "#ea580c" },
          { value: "infra", label: "Infrastructure", color: "#94a3b8" },
        ],
      },
    },
  });

  const cfQaUrl = await prisma.customField.upsert({
    where: { projectId_key: { projectId: projectWork.id, key: "qa_url" } },
    update: {},
    create: {
      projectId: projectWork.id,
      name: "QA URL",
      key: "qa_url",
      type: "url",
      required: false,
      orderIndex: 2,
    },
  });

  const cfSeverity = await prisma.customField.upsert({
    where: { projectId_key: { projectId: productLaunch.id, key: "severity" } },
    update: {},
    create: {
      projectId: productLaunch.id,
      name: "Severity",
      key: "severity",
      type: "select",
      required: true,
      orderIndex: 0,
      configJson: {
        options: [
          { value: "blocker", label: "Blocker", color: "#dc2626" },
          { value: "critical", label: "Critical", color: "#ea580c" },
          { value: "minor", label: "Minor", color: "#eab308" },
        ],
      },
    },
  });

  // ── Tags ──
  const tags = await Promise.all(
    [
      { name: "bug", color: "#dc2626", projectId: projectWork.id },
      { name: "feature", color: "#16a34a", projectId: projectWork.id },
      { name: "docs", color: "#0284c7", projectId: projectWork.id },
      { name: "design", color: "#8b5cf6", projectId: projectWork.id },
      { name: "urgent", color: "#dc2626", projectId: projectWork.id },
    ].map((t) =>
      prisma.tag.upsert({
        where: { name_projectId: { name: t.name, projectId: t.projectId } },
        update: {},
        create: t,
      }),
    ),
  );

  const tagBug = tags[0]!;
  const tagFeature = tags[1]!;
  const tagDocs = tags[2]!;
  const tagDesign = tags[3]!;
  const tagUrgent = tags[4]!;

  // ── Tasks ──
  const now = new Date();
  const day = (d: number) => new Date(now.getTime() + d * 86400000);

  const taskData = [
    {
      id: "00000000-0000-4000-8000-000000000100",
      projectId: projectWork.id,
      title: "Fix login page SSL error",
      description: "The login page throws a 500 error when the SSL certificate is expired. Need to add better error handling.",
      status: "in_progress" as const,
      priority: "high" as const,
      dueDate: day(2),
      assigneeIds: [member1.id],
      reporterId: owner.id,
      createdById: owner.id,
      estimatedHours: 4,
      orderIndex: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000101",
      projectId: projectWork.id,
      title: "Design new dashboard layout",
      description: "Create wireframes for the new analytics dashboard with charts and KPIs.",
      status: "open" as const,
      priority: "med" as const,
      dueDate: day(5),
      assigneeIds: [member2.id],
      reporterId: owner.id,
      createdById: manager.id,
      estimatedHours: 8,
      orderIndex: 2,
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      projectId: projectWork.id,
      title: "Update API documentation",
      description: "Document all new REST API endpoints for v2 release.",
      status: "done" as const,
      priority: "low" as const,
      dueDate: day(-1),
      assigneeIds: [member1.id],
      reporterId: manager.id,
      createdById: manager.id,
      estimatedHours: 3,
      orderIndex: 3,
      completedAt: day(-1),
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      projectId: projectWork.id,
      title: "Investigate database connection pool leak",
      description: "Production DB connections are not being released properly after queries.",
      status: "open" as const,
      priority: "urgent" as const,
      dueDate: day(1),
      assigneeIds: [manager.id],
      reporterId: owner.id,
      createdById: owner.id,
      estimatedHours: 6,
      orderIndex: 4,
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      projectId: projectWork.id,
      title: "Set up staging environment",
      description: "Provision a staging server that mirrors production for pre-release testing.",
      status: "cancelled" as const,
      priority: "med" as const,
      reporterId: manager.id,
      createdById: manager.id,
      estimatedHours: 12,
      orderIndex: 5,
    },
    {
      id: "00000000-0000-4000-8000-000000000105",
      projectId: projectWork.id,
      title: "Implement dark mode toggle",
      description: "Add a theme switcher that persists user preference and respects system settings.",
      status: "open" as const,
      priority: "med" as const,
      dueDate: day(7),
      assigneeIds: [member2.id],
      reporterId: member1.id,
      createdById: member1.id,
      estimatedHours: 5,
      orderIndex: 6,
    },
    {
      id: "00000000-0000-4000-8000-000000000106",
      projectId: projectWork.id,
      title: "Write unit tests for auth module",
      description: "Achieve > 80% code coverage on the authentication module.",
      status: "open" as const,
      priority: "high" as const,
      dueDate: day(10),
      assigneeIds: [member1.id],
      reporterId: manager.id,
      createdById: manager.id,
      estimatedHours: 8,
      orderIndex: 7,
    },
    {
      id: "00000000-0000-4000-8000-000000000107",
      projectId: projectWork.id,
      title: "Code review: PR #234",
      description: "Review the new file upload implementation.",
      status: "in_progress" as const,
      priority: "med" as const,
      dueDate: day(3),
      assigneeIds: [member1.id],
      reporterId: member2.id,
      createdById: member2.id,
      estimatedHours: 2,
      orderIndex: 8,
    },
    {
      id: "00000000-0000-4000-8000-000000000108",
      projectId: projectWork.id,
      title: "Optimize image loading for task list",
      description: "Implement lazy loading and responsive image sizes for attachment thumbnails.",
      status: "open" as const,
      priority: "low" as const,
      dueDate: day(14),
      assigneeIds: [member2.id],
      reporterId: owner.id,
      createdById: owner.id,
      estimatedHours: 3,
      orderIndex: 9,
    },
    {
      id: "00000000-0000-4000-8000-000000000109",
      projectId: projectPersonal.id,
      title: "Plan weekend trip",
      description: "Research destinations, book flights and hotel.",
      status: "open" as const,
      priority: "low" as const,
      dueDate: day(7),
      assigneeIds: [owner.id],
      reporterId: owner.id,
      createdById: owner.id,
      orderIndex: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000110",
      projectId: productLaunch.id,
      title: "Finalize launch checklist",
      description: "Review all items on the pre-launch checklist and mark completed items.",
      status: "in_progress" as const,
      priority: "high" as const,
      dueDate: day(3),
      assigneeIds: [admin.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 4,
      orderIndex: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000111",
      projectId: productLaunch.id,
      title: "Prepare marketing materials",
      description: "Create social media posts, blog announcements, and email newsletters.",
      status: "open" as const,
      priority: "high" as const,
      dueDate: day(7),
      assigneeIds: [member1.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 16,
      orderIndex: 2,
    },
    {
      id: "00000000-0000-4000-8000-000000000112",
      projectId: productLaunch.id,
      title: "Coordinate with PR team",
      description: "Schedule meeting with PR agency to align messaging.",
      status: "done" as const,
      priority: "med" as const,
      dueDate: day(-2),
      assigneeIds: [manager.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 2,
      orderIndex: 3,
      completedAt: day(-2),
    },
    {
      id: "00000000-0000-4000-8000-000000000113",
      projectId: productLaunch.id,
      title: "Security audit sign-off",
      description: "Get final sign-off from the security team before launch.",
      status: "open" as const,
      priority: "urgent" as const,
      dueDate: day(1),
      assigneeIds: [manager.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 1,
      orderIndex: 4,
    },
    {
      id: "00000000-0000-4000-8000-000000000114",
      projectId: productLaunch.id,
      title: "Set up monitoring dashboards",
      description: "Configure Grafana dashboards for launch day monitoring.",
      status: "open" as const,
      priority: "med" as const,
      dueDate: day(5),
      assigneeIds: [member2.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 6,
      orderIndex: 5,
    },
    {
      id: "00000000-0000-4000-8000-000000000115",
      projectId: productLaunch.id,
      title: "Fix critical login bug",
      description: "Hotfix: Users cannot log in after the latest SAML configuration change.",
      status: "done" as const,
      priority: "urgent" as const,
      dueDate: day(-1),
      assigneeIds: [member1.id],
      reporterId: admin.id,
      createdById: admin.id,
      estimatedHours: 3,
      orderIndex: 6,
      completedAt: day(-1),
    },
  ];

  const createdTasks = [];
  for (const data of taskData) {
    const { assigneeIds, ...createData } = data;
    const task = await prisma.task.upsert({
      where: { id: data.id },
      update: {},
      create: {
        ...createData,
        assignees: {
          create: (assigneeIds ?? []).map((userId) => ({ userId })),
        },
      },
    });
    createdTasks.push(task);
  }

  // ── Task Tags ──
  const taskTagsData = [
    { taskId: "00000000-0000-4000-8000-000000000100", tagId: tagBug.id },
    { taskId: "00000000-0000-4000-8000-000000000100", tagId: tagUrgent.id },
    { taskId: "00000000-0000-4000-8000-000000000101", tagId: tagDesign.id },
    { taskId: "00000000-0000-4000-8000-000000000102", tagId: tagDocs.id },
    { taskId: "00000000-0000-4000-8000-000000000103", tagId: tagBug.id },
    { taskId: "00000000-0000-4000-8000-000000000103", tagId: tagUrgent.id },
    { taskId: "00000000-0000-4000-8000-000000000105", tagId: tagFeature.id },
    { taskId: "00000000-0000-4000-8000-000000000115", tagId: tagBug.id },
    { taskId: "00000000-0000-4000-8000-000000000115", tagId: tagUrgent.id },
  ];

  for (const tt of taskTagsData) {
    await prisma.taskTag.upsert({
      where: { taskId_tagId: tt },
      update: {},
      create: tt,
    });
  }

  // ── Custom Field Values ──
  const cfValuesData = [
    { taskId: "00000000-0000-4000-8000-000000000100", customFieldId: cfStoryPoints.id, valueNumber: 5 },
    { taskId: "00000000-0000-4000-8000-000000000100", customFieldId: cfComponent.id, valueJson: "backend" },
    { taskId: "00000000-0000-4000-8000-000000000101", customFieldId: cfStoryPoints.id, valueNumber: 8 },
    { taskId: "00000000-0000-4000-8000-000000000101", customFieldId: cfComponent.id, valueJson: "frontend" },
    { taskId: "00000000-0000-4000-8000-000000000103", customFieldId: cfStoryPoints.id, valueNumber: 3 },
    { taskId: "00000000-0000-4000-8000-000000000103", customFieldId: cfComponent.id, valueJson: "backend" },
    { taskId: "00000000-0000-4000-8000-000000000105", customFieldId: cfComponent.id, valueJson: "frontend" },
    { taskId: "00000000-0000-4000-8000-000000000107", customFieldId: cfStoryPoints.id, valueNumber: 2 },
    { taskId: "00000000-0000-4000-8000-000000000107", customFieldId: cfComponent.id, valueJson: "backend" },
    { taskId: "00000000-0000-4000-8000-000000000107", customFieldId: cfQaUrl.id, valueText: "https://staging.example.com/pr-234" },
    { taskId: "00000000-0000-4000-8000-000000000110", customFieldId: cfSeverity.id, valueJson: "critical" },
    { taskId: "00000000-0000-4000-8000-000000000113", customFieldId: cfSeverity.id, valueJson: "blocker" },
    { taskId: "00000000-0000-4000-8000-000000000115", customFieldId: cfSeverity.id, valueJson: "blocker" },
  ];

  for (const cfv of cfValuesData) {
    const existing = await prisma.customFieldValue.findFirst({
      where: { taskId: cfv.taskId, customFieldId: cfv.customFieldId },
    });
    if (!existing) {
      await prisma.customFieldValue.create({
        data: {
          taskId: cfv.taskId,
          customFieldId: cfv.customFieldId,
          ...(cfv.valueNumber !== undefined && { valueNumber: cfv.valueNumber }),
          ...(cfv.valueJson !== undefined && { valueJson: cfv.valueJson }),
          ...(cfv.valueText !== undefined && { valueText: cfv.valueText }),
        },
      });
    }
  }

  // ── Comments ──
  const commentsData = [
    {
      id: "00000000-0000-4000-8000-000000000200",
      taskId: "00000000-0000-4000-8000-000000000100",
      authorId: member1.id,
      bodyMarkdown: "I think the issue is in the nginx config. Let me check the SSL certificate paths.",
    },
    {
      id: "00000000-0000-4000-8000-000000000201",
      taskId: "00000000-0000-4000-8000-000000000100",
      authorId: manager.id,
      bodyMarkdown: "Confirmed. The certificate expired yesterday. I've uploaded the new one, please verify.",
      parentCommentId: "00000000-0000-4000-8000-000000000200",
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      taskId: "00000000-0000-4000-8000-000000000103",
      authorId: owner.id,
      bodyMarkdown: "This is blocking the deployment pipeline. @manager please prioritize.",
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      taskId: "00000000-0000-4000-8000-000000000110",
      authorId: admin.id,
      bodyMarkdown: "Please review the checklist at https://docs.google.com/spreadsheets/launch-checklist",
    },
    {
      id: "00000000-0000-4000-8000-000000000204",
      taskId: "00000000-0000-4000-8000-000000000115",
      authorId: member1.id,
      bodyMarkdown: "Fixed in commit abc123. The SAML assertion validation was missing a null check.",
    },
  ];

  for (const c of commentsData) {
    await prisma.comment.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }

  // ── Subtasks ──
  const subtaskData = [
    {
      id: "00000000-0000-4000-8000-000000000300",
      projectId: projectWork.id,
      parentTaskId: "00000000-0000-4000-8000-000000000100",
      title: "Check certificate expiry date",
      status: "done" as const,
      priority: "high" as const,
      assigneeIds: [member1.id],
      reporterId: owner.id,
      createdById: member1.id,
      orderIndex: 1.0,
    },
    {
      id: "00000000-0000-4000-8000-000000000301",
      projectId: projectWork.id,
      parentTaskId: "00000000-0000-4000-8000-000000000100",
      title: "Deploy new certificate to production",
      status: "in_progress" as const,
      priority: "high" as const,
      assigneeIds: [member1.id],
      reporterId: owner.id,
      createdById: member1.id,
      orderIndex: 2.0,
    },
  ];

  for (const st of subtaskData) {
    const { assigneeIds, ...createData } = st;
    await prisma.task.upsert({
      where: { id: st.id },
      update: {},
      create: {
        ...createData,
        assignees: {
          create: (assigneeIds ?? []).map((userId) => ({ userId })),
        },
      },
    });
  }

  // ── Watchers ──
  const watcherData = [
    { taskId: "00000000-0000-4000-8000-000000000100", userId: owner.id },
    { taskId: "00000000-0000-4000-8000-000000000100", userId: manager.id },
    { taskId: "00000000-0000-4000-8000-000000000103", userId: owner.id },
    { taskId: "00000000-0000-4000-8000-000000000103", userId: member1.id },
    { taskId: "00000000-0000-4000-8000-000000000110", userId: manager.id },
  ];

  for (const w of watcherData) {
    await prisma.watcher.upsert({
      where: { taskId_userId: w },
      update: {},
      create: w,
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   Users: ${Object.keys(users).length}`);
  console.log(`   Departments: 3`);
  console.log(`   Projects: 3`);
  console.log(`   Tasks: ${createdTasks.length + subtaskData.length}`);
  console.log(`   Custom Fields: 4`);
  console.log(`   Custom Field Values: ${cfValuesData.length}`);
  console.log(`   Comments: ${commentsData.length}`);
  console.log(`   Tags: ${tags.length}`);
  console.log(`   Watchers: ${watcherData.length}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
