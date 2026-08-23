"use client";

import { useTranslations } from "next-intl";
import { ProjectTabBar } from "@/components/project/project-tab-bar";

export type ProjectTab = "board" | "timeline" | "calendar" | "gantt" | "wbs" | "tasks";

const TAB_ICONS: Record<ProjectTab, React.ReactNode> = {
  board: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m6-10a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7m10 0a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7" />,
  timeline: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  gantt: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />,
  wbs: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h12M4 14h8M4 18h4" />,
  tasks: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
};

type Props = {
  activeTab: ProjectTab;
  canCreate: boolean;
  onCreate: () => void;
  onTabChange: (_tab: ProjectTab) => void;
};

export function ProjectTabs({ activeTab, canCreate, onCreate, onTabChange }: Props) {
  const taskT = useTranslations("task");

  const tabs: { key: ProjectTab; label: string; icon: React.ReactNode }[] = [
    { key: "board", label: taskT("board"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.board}</svg> },
    { key: "timeline", label: taskT("timeline"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.timeline}</svg> },
    { key: "calendar", label: taskT("calendar"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.calendar}</svg> },
    { key: "gantt", label: taskT("gantt"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.gantt}</svg> },
    { key: "wbs", label: taskT("wbs"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.wbs}</svg> },
    { key: "tasks", label: taskT("title"), icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{TAB_ICONS.tasks}</svg> },
  ];

  return (
    <ProjectTabBar
      tabs={tabs}
      activeTab={activeTab}
      canCreate={canCreate}
      onCreate={onCreate}
      onTabChange={onTabChange}
    />
  );
}