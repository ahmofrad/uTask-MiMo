"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";

type SidebarProps = {
  isAdmin: boolean;
  canManageGroups: boolean;
};

export function Sidebar({ isAdmin, canManageGroups }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  }

  function isActive(href: string) {
    const base = `/${locale}${href === "/" ? "" : href}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  }

  return (
    <nav
      aria-label={t("primaryNavigation")}
      className={`hidden md:flex flex-col shrink-0 border-e border-border bg-bg-secondary shadow-sm transition-[width] duration-200 ${
        collapsed ? "w-16 items-center py-4 px-2" : "w-48 py-4 px-3"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} mb-6 w-full`}>
        {!collapsed && <Logo size={24} showWordmark />}
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-fg-muted hover:bg-bg-tertiary hover:text-fg transition-colors"
          title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      <div className="space-y-1 w-full">
        <NavItem href="/" icon={<HomeIcon />} collapsed={collapsed} active={isActive("/")}>
          {t("home")}
        </NavItem>
        <NavItem href="/workspace" icon={<WorkspaceIcon />} collapsed={collapsed} active={isActive("/workspace")}>
          {t("workspace")}
        </NavItem>
        <NavItem href="/projects" icon={<ProjectIcon />} collapsed={collapsed} active={isActive("/projects")}>
          {t("projects")}
        </NavItem>
        <NavItem href="/calendar" icon={<CalendarIcon />} collapsed={collapsed} active={isActive("/calendar")}>
          {t("calendar")}
        </NavItem>
        <NavItem href="/settings" icon={<SettingsIcon />} collapsed={collapsed} active={isActive("/settings")}>
          {t("settings")}
        </NavItem>
        {isAdmin && (
          <NavItem href="/admin/users" icon={<AdminIcon />} collapsed={collapsed} active={isActive("/admin")}>
            {t("admin")}
          </NavItem>
        )}
        {!isAdmin && canManageGroups && (
          <NavItem href="/admin/groups" icon={<GroupsIcon />} collapsed={collapsed} active={isActive("/admin/groups")}>
            {t("groups")}
          </NavItem>
        )}
      </div>
    </nav>
  );
}

function NavItem({
  href,
  icon,
  collapsed,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  collapsed: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md border-s-2 text-sm transition-colors ${
        collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
      } ${
        active
          ? "border-accent bg-accent-bg text-accent font-medium"
          : "border-transparent text-fg-muted hover:bg-bg-tertiary hover:text-fg"
      }`}
      title={collapsed ? String(children) : undefined}
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
      <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
