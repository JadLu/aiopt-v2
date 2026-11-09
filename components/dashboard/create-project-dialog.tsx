"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Upload, Sparkles, Link2 } from "lucide-react";
import { importProduct } from "@/lib/import-product-client";
import { useAuth } from "@/lib/contexts/auth-context";
import { createProject, updateProject } from "@/lib/firebase/projects";
import { uploadProductImage } from "@/lib/cloudinary";
import { startMarketingPlan } from "@/lib/marketing-plan-client";
import { joinCountryNames } from "@/lib/countries";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { CountryPicker } from "./country-picker";
import { LiquidButton } from "@/components/ui/liquid-button";
import { InsufficientCreditsModal } from "@/components/credits/InsufficientCreditsModal";

const MAX_DESCRIPTION = 500;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Step = "" | "creating" | "uploading" | "starting";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const router = useRouter();
  const { user, credits } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // "Start from a product link"
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [importedImageUrl, setImportedImageUrl] = useState<string | null>(null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  // Steps are resumable: once the project exists a retry never creates a second one.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const uploadedUrl = useRef<string | null>(null);
  const [creditModal, setCreditModal] = useState<{ required: number; balance: number; goTo: string | null } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const busy = step !== "";
  const locked = busy || createdId !== null;

  // Release the object URL of the preview when it changes or the dialog unmounts.
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  // Escape closes (unless a request is running).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  function resetForm() {
    setName(""); setDescription(""); setCountries([]);
    setImageFile(null); setImagePreview("");
    setNameError(null); setMarketsError(null); setPhotoError(null); setFormError(null);
    setStep(""); setUploadProgress(0); setCreatedId(null);
    setImportUrl(""); setImporting(false); setImportError(null); setImportNote(null); setImportedImageUrl(null);
    uploadedUrl.current = null;
  }

  async function handleImport() {
    const link = importUrl.trim();
    if (!link || importing || locked) return;
    setImporting(true);
    setImportError(null);
    setImportNote(null);
    const result = await importProduct(link);
    setImporting(false);
    if (!result.ok) { setImportError(result.message); return; }

    const { data } = result;
    // Never overwrite what the user already typed.
    if (!name.trim() && data.name) { setName(data.name); setNameError(null); }
    if (!description.trim() && data.description) setDescription(data.description.slice(0, MAX_DESCRIPTION));
    if (data.imageUrl && !imageFile) {
      setImportedImageUrl(data.imageUrl);
      uploadedUrl.current = null;
      setPhotoError(null);
    }
    setImportNote(`Imported from ${data.host}. Check the details before you continue.${data.imageNote ? ` ${data.imageNote}` : ""}`);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { setPhotoError("Use a PNG, JPG or WebP image."); return; }
    if (file.size > MAX_IMAGE_BYTES) { setPhotoError("That image is over 10 MB. Choose a smaller one."); return; }
    setPhotoError(null);
    uploadedUrl.current = null;
    setImportedImageUrl(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
    setImportedImageUrl(null);
    setPhotoError(null);
    uploadedUrl.current = null;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!locked) pickImage(e.dataTransfer.files?.[0]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || busy) return;

    const trimmed = name.trim();
    const nameProblem = trimmed ? null : "Give your product a name.";
    const marketsProblem = countries.length > 0 ? null : "Pick at least one market";
    setNameError(nameProblem);
    setMarketsError(marketsProblem);
    setFormError(null);
    if (nameProblem || marketsProblem) return;

    // Don't create anything the plan can't be paid for.
    if (credits !== null && credits < CREDIT_COSTS.MARKETING_PLAN) {
      setCreditModal({ required: CREDIT_COSTS.MARKETING_PLAN, balance: credits, goTo: createdId });
      return;
    }

    const countryNames = joinCountryNames(countries);
    let id = createdId;

    try {
      if (!id) {
        setStep("creating");
        id = await createProject(user.uid, {
          name: trimmed,
          description: description.trim(),
          country: countryNames,
          countries,
        });
        setCreatedId(id);
      }

      let photoUrl = uploadedUrl.current;
      if (!photoUrl && !imageFile && importedImageUrl) {
        // Already on our Cloudinary (copied by the server); just attach it.
        try {
          await updateProject(user.uid, id, { productImageUrl: importedImageUrl });
          photoUrl = importedImageUrl;
          uploadedUrl.current = photoUrl;
        } catch {
          setFormError("Couldn't attach the imported photo. Try again, or remove the photo to continue.");
          return;
        }
      }
      if (imageFile && !photoUrl) {
        setStep("uploading");
        setUploadProgress(0);
        try {
          photoUrl = await uploadProductImage(user.uid, id, imageFile, setUploadProgress);
          await updateProject(user.uid, id, { productImageUrl: photoUrl });
          uploadedUrl.current = photoUrl;
        } catch (err) {
          setFormError(`Photo upload failed${err instanceof Error ? ` — ${err.message}` : ""}. Try again, or remove the photo to continue.`);
          return;
        }
      }

      setStep("starting");
      const result = await startMarketingPlan({
        id,
        name: trimmed,
        description: description.trim(),
        emoji: "📦",
        status: "in-draft",
        country: countryNames,
        countries,
        lastActivity: "just now",
        createdAt: new Date().toISOString().split("T")[0],
        productImageUrl: photoUrl ?? undefined,
      });

      if (!result.ok) {
        if (result.kind === "credits") {
          setCreditModal({ required: result.required, balance: result.balance, goTo: id });
        } else {
          setFormError(`The project was created, but the plan couldn't start: ${result.message}`);
        }
        return;
      }

      resetForm();
      onClose();
      router.push(`/projects/${id}`);
    } catch {
      setFormError(id
        ? "Something went wrong. Your project is saved, so you can try again."
        : "Failed to create the project. Please try again.");
    } finally {
      setStep("");
    }
  }

  function closeCreditModal() {
    const goTo = creditModal?.goTo ?? null;
    setCreditModal(null);
    if (goTo) {
      resetForm();
      onClose();
      router.push(`/projects/${goTo}`);
    }
  }

  const creditsModal = creditModal && (
    <InsufficientCreditsModal open onClose={closeCreditModal} required={creditModal.required} balance={creditModal.balance} />
  );

  if (!open) return creditsModal || null;

  const submitLabel =
    step === "creating" ? "Creating…"
    : step === "uploading" ? `Uploading${uploadProgress > 0 ? ` ${uploadProgress}%` : "…"}`
    : step === "starting" ? "Starting plan…"
    : "Create & generate plan";

  return (
    <>
      <div
        className="dialog-overlay tall"
        onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) handleClose(); }}
      >
        <form
          className="glass dialog-glass"
          role="dialog"
          aria-modal="true"
          aria-labelledby="np-title"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Header */}
          <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="logo-tile" style={{ width: 48, height: 48, borderRadius: 16 }} aria-hidden>
                <Plus size={22} strokeWidth={2.2} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h1 id="np-title" style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>New project</h1>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  Tell us about the product and where you’ll sell it
                </span>
              </div>
            </div>
            <button
              type="button"
              className="glass-inner icon-chip"
              aria-label="Close"
              disabled={busy}
              onClick={handleClose}
              style={{ width: 40, height: 40, borderRadius: 14, color: "var(--text-primary)" }}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </header>

          {/* Start from a product link */}
          <section className="import-panel" aria-labelledby="np-import-title">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span id="np-import-title" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
                <Link2 size={18} strokeWidth={2} style={{ color: "var(--accent-primary)" }} aria-hidden />
                Start from a product link
              </span>
              <span className="import-badge">Fastest</span>
            </div>
            <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
              Paste an AliExpress, Amazon or Shopify link. We’ll fill in the name, description and photo for you to check.
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <input
                className="input-well"
                type="url"
                inputMode="url"
                aria-label="Product link"
                aria-invalid={importError ? true : undefined}
                placeholder="https://"
                dir="ltr"
                disabled={locked || importing}
                value={importUrl}
                onChange={(e) => { setImportUrl(e.target.value); if (importError) setImportError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleImport(); } }}
                style={{ flex: "1 1 280px", minHeight: 48, borderRadius: 16, fontSize: 14.5 }}
              />
              <LiquidButton
                type="button"
                loading={importing}
                disabled={locked || importing || !importUrl.trim()}
                onClick={() => void handleImport()}
                style={{ minHeight: 48, borderRadius: 16 }}
              >
                {importing ? "Reading page…" : "Import"}
              </LiquidButton>
            </div>
            {importError && <span className="field-error" role="alert">{importError}</span>}
            {importNote && !importError && <span className="field-hint" role="status">{importNote}</span>}
          </section>

          <div className="or-divider" aria-hidden>Or fill in manually</div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="field-label">Product name</span>
              <input
                className="input-well"
                type="text"
                maxLength={80}
                autoFocus
                dir="auto"
                disabled={locked}
                placeholder="e.g. Wireless Earbuds Pro"
                value={name}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "np-name-err" : undefined}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
                style={{ minHeight: 52, borderRadius: 18, fontSize: 15 }}
              />
              {nameError && <span id="np-name-err" className="field-error">{nameError}</span>}
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="field-label">Description</span>
                <span className="tabular field-hint">{description.length} / {MAX_DESCRIPTION}</span>
              </span>
              <textarea
                className="input-well"
                rows={3}
                maxLength={MAX_DESCRIPTION}
                dir="auto"
                disabled={locked}
                placeholder="What it does, who it’s for, and what makes it different"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ borderRadius: 18, padding: "14px 16px" }}
              />
              <span className="field-hint">The AI uses this to write your marketing plan. Arabic or English both work.</span>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="field-label">
                Product photo <span style={{ letterSpacing: 0, fontWeight: 400, textTransform: "none", opacity: 0.8 }}>· optional</span>
              </span>

              {imagePreview || importedImageUrl ? (
                <div className="glass-inner" style={{ display: "flex", alignItems: "center", gap: 16, padding: 12, borderRadius: 20 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview || importedImageUrl || ""} alt="Product preview" style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover" }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {imageFile?.name ?? "Imported photo"}
                  </span>
                  <button type="button" className="btn-secondary" style={{ width: "auto" }} disabled={locked} onClick={removeImage}>
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="dropzone"
                  data-over={dragOver}
                  disabled={locked}
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <span className="glass-inner icon-chip" style={{ width: 52, height: 52, borderRadius: 16 }} aria-hidden>
                    <Upload size={22} strokeWidth={1.8} />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      Drop a photo or <span style={{ color: "var(--accent-primary)" }}>browse</span>
                    </span>
                    <span className="field-hint">PNG, JPG or WebP, up to 10 MB. Helps the AI match your product in creatives.</span>
                  </span>
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                hidden
                onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }}
              />
              {photoError && <span className="field-error" role="alert">{photoError}</span>}
            </div>
          </div>

          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--hairline), transparent)" }} />

          <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <CountryPicker
              value={countries}
              onChange={(c) => { setCountries(c); if (marketsError) setMarketsError(null); }}
              error={marketsError}
            />
          </fieldset>

          {formError && <p className="field-error" role="alert" style={{ margin: 0 }}>{formError}</p>}

          {/* Footer */}
          <footer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, paddingTop: 4 }}>
            <span className="field-hint" style={{ flex: "1 1 240px" }}>
              Your plan starts writing right away ({CREDIT_COSTS.MARKETING_PLAN} credits). You can leave while it runs.
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn-secondary glass-inner" style={{ width: "auto", minHeight: 48, padding: "0 22px" }} disabled={busy} onClick={handleClose}>
                Cancel
              </button>
              <LiquidButton type="submit" loading={busy} icon={busy ? undefined : <Sparkles size={16} fill="currentColor" />} style={{ minHeight: 48, borderRadius: 16 }}>
                {submitLabel}
              </LiquidButton>
            </div>
          </footer>
        </form>
      </div>
      {creditsModal}
    </>
  );
}
