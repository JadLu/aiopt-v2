import type { ProjectStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  "in-draft": "In Draft",
  testing: "Testing",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

/** Project status pill. Colours come from `.status-badge.<status>` in globals.css. */
export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span className={cn("status-badge", status, className)}>
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }}
      />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
