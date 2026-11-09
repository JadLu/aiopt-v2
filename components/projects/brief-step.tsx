import { MapPin, Calendar, ImageIcon } from "lucide-react";
import type { Project } from "@/lib/mock-data";
import { projectCountryCodes, countryName, voiceLabel } from "@/lib/countries";

/** Read-only summary of what the user told us when creating the project. */
export function BriefStep({ project }: { project: Project }) {
  const codes = projectCountryCodes(project);
  const voice = voiceLabel(project);

  return (
    <section aria-label="Brief" className="glass" style={{ padding: 24, display: "flex", flexWrap: "wrap", gap: 24, borderRadius: "var(--r-card-lg)" }}>
      <div className="project-media" style={{ flex: "0 1 240px", height: 240, minWidth: 180 }}>
        {project.productImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.productImageUrl} alt={project.name} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
            <ImageIcon size={30} strokeWidth={1.4} aria-hidden />
            <span style={{ fontSize: 13 }}>No product photo</span>
          </div>
        )}
      </div>

      <div style={{ flex: "999 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="field-label">Product</span>
          <span dir="auto" style={{ fontSize: 20, fontWeight: 700 }}>{project.name}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="field-label">Description</span>
          <p dir="auto" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: project.description ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
            {project.description || "No description yet."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="field-label">Target markets</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {codes.length > 0
              ? codes.map((code) => (
                  <span key={code} className="stat-chip">
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary)" }}>{code}</span>
                    {countryName(code)}
                  </span>
                ))
              : <span className="stat-chip"><MapPin size={12} aria-hidden />{project.country}</span>}
            {voice && <span className="stat-chip">{voice}</span>}
          </div>
        </div>

        <span className="page-sub" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} aria-hidden /> Created {project.createdAt}
        </span>
      </div>
    </section>
  );
}
