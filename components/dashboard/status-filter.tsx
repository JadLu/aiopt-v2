"use client";

import type { ProjectStatus } from "@/lib/mock-data";

const FILTERS: { label: string; value: "all" | ProjectStatus }[] = [
  { label: "All",       value: "all" },
  { label: "Active",    value: "active" },
  { label: "In Draft",  value: "in-draft" },
  { label: "Testing",   value: "testing" },
  { label: "Scaling",   value: "scaling" },
  { label: "Completed", value: "completed" },
  { label: "Archived",  value: "archived" },
];

interface StatusFilterProps {
  active: "all" | ProjectStatus;
  onChange: (value: "all" | ProjectStatus) => void;
}

export function StatusFilter({ active, onChange }: StatusFilterProps) {
  return (
    <div className="filter-tabs" style={{ overflowX: "auto" }}>
      {FILTERS.map(({ label, value }) => (
        <button
          key={value}
          className={`filter-tab${active === value ? " active" : ""}`}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
