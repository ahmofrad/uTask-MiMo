export type WorkspaceTile = {
  href: string;
  icon: string;
  titleKey: string;
  descKey: string;
  adminOnly?: boolean;
};

const TILES: WorkspaceTile[] = [
  { href: "/", icon: "LayoutDashboard", titleKey: "dashboard", descKey: "dashboardDesc" },
  { href: "/my-tasks", icon: "Check", titleKey: "myTasks", descKey: "myTasksDesc" },
  { href: "/projects", icon: "FolderOpen", titleKey: "projects", descKey: "projectsDesc" },
  { href: "/calendar", icon: "Calendar", titleKey: "calendar", descKey: "calendarDesc" },
  { href: "/all", icon: "List", titleKey: "allTasks", descKey: "allTasksDesc" },
  { href: "/admin/insights", icon: "BarChart3", titleKey: "insights", descKey: "insightsDesc", adminOnly: true },
  { href: "/settings", icon: "Settings", titleKey: "settings", descKey: "settingsDesc" },
];

/** Module tiles visible in the workspace shell, with admin-only entries gated out. */
export function buildWorkspaceTiles(isAdmin: boolean): WorkspaceTile[] {
  return TILES.filter((tile) => !tile.adminOnly || isAdmin);
}
