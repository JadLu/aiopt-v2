"use client";

import { useState } from "react";
import { X, Loader2, Globe, Upload } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { createProject, updateProject } from "@/lib/firebase/projects";
import { uploadProductImage } from "@/lib/cloudinary";

const MENA_COUNTRIES = [
  "UAE", "Saudi Arabia", "Egypt", "Morocco", "Kuwait",
  "Qatar", "Bahrain", "Oman", "Jordan", "Tunisia", "Algeria", "Libya",
];

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const { user } = useAuth();
  const [loadingStep, setLoadingStep] = useState<"" | "creating" | "uploading">("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    countries: [] as string[],
    targetCpa: "",
    targetRoas: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  if (!open) return null;

  const loading = loadingStep !== "";

  function toggleCountry(c: string) {
    setForm((f) => ({
      ...f,
      countries: f.countries.includes(c)
        ? f.countries.filter((x) => x !== c)
        : [...f.countries, c],
    }));
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
  }

  function resetForm() {
    setForm({ name: "", description: "", countries: [], targetCpa: "", targetRoas: "" });
    setError(null);
    clearImage();
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!user) return;
    if (form.countries.length === 0) {
      setError("Please select at least one country.");
      return;
    }

    setError(null);
    try {
      setLoadingStep("creating");
      const projectId = await createProject(user.uid, {
        name: form.name,
        description: form.description,
        country: form.countries[0],
        targetCpa: parseFloat(form.targetCpa) || 0,
        targetRoas: parseFloat(form.targetRoas) || 0,
      });

      if (imageFile) {
        setLoadingStep("uploading");
        setUploadProgress(0);
        let url: string;
        try {
          url = await uploadProductImage(user.uid, projectId, imageFile, setUploadProgress);
        } catch (err) {
          setError(`Image upload failed — ${err instanceof Error ? err.message : "unknown error"}`);
          return;
        }
        await updateProject(user.uid, projectId, { productImageUrl: url });
      }

      resetForm();
      onClose();
    } catch {
      setError("Failed to create project. Please try again.");
    } finally {
      setLoadingStep("");
    }
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && !loading && handleClose()}>
      <div className="dialog-panel fade-up">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>New Project</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>Enter your product details to get started</p>
          </div>
          <button onClick={handleClose} disabled={loading} style={{ border: "none", background: "none", cursor: loading ? "not-allowed" : "pointer", color: "var(--text-tertiary)", display: "flex", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Product name */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>PRODUCT NAME</label>
            <input
              type="text" required
              className="auth-input"
              placeholder="e.g. Wireless Earbuds Pro"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>PRODUCT DESCRIPTION</label>
            <textarea
              className="auth-input"
              placeholder="Brief description of your product and marketing angle..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ resize: "vertical", minHeight: 80 }}
            />
          </div>

          {/* Product image */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>
              PRODUCT IMAGE{" "}
              <span style={{ fontWeight: 400, textTransform: "none", color: "var(--text-tertiary)", letterSpacing: 0 }}>— optional, helps AI understand your product</span>
            </label>

            {imagePreview ? (
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", height: 160, background: "var(--bg-subtle)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Product preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <button
                  type="button"
                  onClick={clearImage}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "rgba(0,0,0,0.6)", border: "none",
                    borderRadius: 6, cursor: "pointer", color: "#fff",
                    display: "flex", padding: 5, lineHeight: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <label
                  htmlFor="product-image-upload"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", gap: 8, height: 100,
                    border: "1px dashed var(--border-default)", borderRadius: 10,
                    cursor: "pointer", color: "var(--text-tertiary)", fontSize: 13,
                    background: "var(--bg-subtle)", transition: "border-color 0.13s, background 0.13s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)"; (e.currentTarget as HTMLElement).style.background = "rgba(90,200,214,0.04)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)"; }}
                >
                  <Upload size={20} strokeWidth={1.5} />
                  <span>Click to upload product photo</span>
                </label>
                <input
                  id="product-image-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    clearImage();
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          {/* Countries */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>
              <Globe size={11} style={{ display: "inline", marginRight: 5 }} />
              TARGET COUNTRIES (MENA)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MENA_COUNTRIES.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => toggleCountry(c)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: `1px solid ${form.countries.includes(c) ? "var(--accent-primary)" : "var(--border-default)"}`,
                    background: form.countries.includes(c) ? "rgba(90,200,214,0.12)" : "var(--bg-elevated)",
                    color: form.countries.includes(c) ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: form.countries.includes(c) ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.13s",
                    fontFamily: "inherit",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Targets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>TARGET CPA ($)</label>
              <input
                type="number" min="0" step="0.01"
                className="auth-input"
                placeholder="e.g. 15.00"
                value={form.targetCpa}
                onChange={(e) => setForm((f) => ({ ...f, targetCpa: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.04em" }}>TARGET ROAS</label>
              <input
                type="number" min="0" step="0.1"
                className="auth-input"
                placeholder="e.g. 3.0"
                value={form.targetRoas}
                onChange={(e) => setForm((f) => ({ ...f, targetRoas: e.target.value }))}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={loading} style={{ width: "auto", flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading && <Loader2 size={15} className="spinner" />}
              {loadingStep === "uploading"
                ? `Uploading${uploadProgress > 0 ? ` ${uploadProgress}%` : "…"}`
                : loadingStep === "creating" ? "Creating…" : "Create Project"}
            </button>
          </div>

          {/* Upload progress bar */}
          {loadingStep === "uploading" && (
            <div style={{ height: 3, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden", marginTop: -8 }}>
              <div style={{
                height: "100%",
                width: `${uploadProgress}%`,
                background: "linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))",
                borderRadius: 2,
                transition: "width 0.25s ease",
              }} />
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
