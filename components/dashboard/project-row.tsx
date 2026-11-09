"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Clock, ImageIcon, ClipboardList, Sparkles } from "lucide-react";
import type { Project } from "@/lib/mock-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { marketsLabel } from "@/lib/countries";
import { GeneratePlanDialog } from "./generate-plan-dialog";
import { ProjectMenu } from "./project-menu";

export function ProjectRow({ project, uid, delay = 0 }: { project: Project; uid: string; delay?: number }) {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);
  const href = `/projects/${project.id}`;

  return (
    <>
      <article className="glass row-card lift rise" style={{ animationDelay: `${delay}ms` }}>
        <span className="row-thumb" aria-hidden={project.productImageUrl ? undefined : true}>
          {project.productImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.productImageUrl} alt="" />
          ) : (
            <ImageIcon size={26} strokeWidth={1.5} />
          )}
        </span>

        <div style={{ flex: "999 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Link href={href} dir="auto" className="row-link">{project.name}</Link>
            <StatusBadge status={project.status} className="flex-none" />
          </div>
          <div className="project-meta">
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={13} strokeWidth={2} aria-hidden />{marketsLabel(project)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={13} strokeWidth={2} aria-hidden />Updated {project.lastActivity}
            </span>
          </div>
        </div>

        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
          <div className="glass-inner row-actions">
            <button
              type="button"
              onClick={() => (project.status === "in-draft" ? setPlanOpen(true) : router.push(href))}
            >
              <ClipboardList size={15} strokeWidth={1.8} aria-hidden />Plan
            </button>
            <button type="button" onClick={() => router.push(href)}>
              <Sparkles size={15} strokeWidth={1.8} aria-hidden />Creative
            </button>
          </div>
          <ProjectMenu project={project} uid={uid} size={48} />
        </div>
      </article>

      {planOpen && (
        <GeneratePlanDialog open onClose={() => setPlanOpen(false)} uid={uid} project={project} />
      )}
    </>
  );
}
