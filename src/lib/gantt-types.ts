export type GanttRow = {
  id: string;
  title: string;
  wbsCode: string;
  parentTaskId: string | null;
  depth: number;
  isSummary: boolean;
  isMilestone: boolean;
  status: string;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  critical?: boolean;
  summaryStart?: string | null;
  summaryEnd?: string | null;
};

export type GanttLink = {
  id: string;
  source: string;
  target: string;
  type: string;
  lag: number;
  lagUnit: string;
};

export type GanttReport = {
  tasks: GanttRow[];
  links: GanttLink[];
  criticalChain: string[];
  scheduleVersion: number;
  project: { start: string | null; end: string | null };
  /** Whether the current user may edit tasks (and thus link/unlink) in this project. */
  canEdit?: boolean;
};
