import { cn } from "@/lib/cn";

export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: { displayName: string };
  performedAt: string;
  details?: Record<string, unknown> | null;
};

type AuditTimelineProps = {
  events: AuditEvent[];
  className?: string;
};

export function AuditTimeline({ events, className }: AuditTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-fg-muted text-center py-8">No audit events</p>;
  }

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, i) => (
        <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < events.length - 1 && (
            <div className="absolute start-[7px] top-4 bottom-0 w-px bg-border" />
          )}
          <div className="shrink-0 w-[15px] h-[15px] mt-1.5 rounded-full border-2 border-accent bg-bg-surface" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-fg">
              <span className="font-medium">{event.performedBy.displayName}</span>
              {" "}{event.action.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-fg-subtle mt-0.5">
              {new Date(event.performedAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
