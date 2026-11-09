"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ImageIcon, ClipboardList, Sparkles } from "lucide-react";
import type { Project } from "@/lib/mock-data";
import { STATUS_LABELS } from "@/components/ui/status-badge";
import { marketsLabel } from "@/lib/countries";
import { GeneratePlanDialog } from "./generate-plan-dialog";
import { ProjectMenu } from "./project-menu";

export function ProjectCard({ project, uid, delay = 0 }: { project: Project; uid: string; delay?: number }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const actions = [
    { label: "Plan",     Icon: ClipboardList, href: `/projects/${project.id}` },
    { label: "Creative", Icon: Sparkles,      href: `/projects/${project.id}` },
  ];

  return (
    <>
      <article
        className="glass project-tile lift rise"
        style={{ animationDelay: `${delay}ms` }}
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        {/* ── Media ── */}
        <div className="project-media">
          {project.productImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.productImageUrl} alt={project.name} />
          ) : (
            <>
              <div className="glass" style={{ width: 86, height: 86, borderRadius: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }} aria-hidden>
                <ImageIcon size={34} strokeWidth={1.4} />
              </div>
              <Link
                href={`/projects/${project.id}`}
                onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", bottom: 12, fontSize: 12.5, fontWeight: 600, color: "var(--accent-primary)" }}
              >
                Add product photo
              </Link>
            </>
          )}

          <div className="project-media-top">
            <span className={`status-pill ${project.status}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>

            <ProjectMenu project={project} uid={uid} />
          </div>
        </div>

        {/* ── Body ── */}
        <div className="project-body">
          <h3 className="project-name" dir="auto">{project.name}</h3>
          <div className="project-meta">
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={13} strokeWidth={1.8} aria-hidden />{marketsLabel(project)}
            </span>
            <span>Updated {project.lastActivity}</span>
          </div>
        </div>

        <div className="glass-inner action-pair">
          {actions.map(({ label: actionLabel, Icon, href }) => (
            <button
              key={actionLabel}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (actionLabel === "Plan" && project.status === "in-draft") {
                  setDialogOpen(true);
                } else {
                  router.push(href);
                }
              }}
            >
              <Icon size={15} strokeWidth={1.8} aria-hidden />
              {actionLabel}
            </button>
          ))}
        </div>
      </article>

      <GeneratePlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        uid={uid}
        project={project}
      />
    </>
  );
}
