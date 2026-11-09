"use client";

import { authFetch } from "@/lib/auth-fetch";

/**
 * Signed Cloudinary uploads. The browser asks /api/upload-signature (auth
 * required) for a signature scoped to users/{uid}/projects/{projectId}/…,
 * allowed formats and a timestamp, then uploads directly to Cloudinary.
 * There is no unsigned upload preset any more.
 */

type Purpose = "product" | "clips" | "lp-photos" | "lp-gifs" | "renders";

interface SignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  publicId: string;
  allowedFormats: string;
  resourceType: "image" | "video";
  maxBytes: number;
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

function formatBytes(n: number): string {
  return `${Math.round(n / (1024 * 1024))} MB`;
}

async function signedUpload(
  projectId: string,
  purpose: Purpose,
  kind: "image" | "video",
  file: Blob,
  filename: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const sigRes = await authFetch("/api/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, projectId, purpose }),
  });
  if (!sigRes.ok) {
    throw new Error(`Could not authorise upload (${sigRes.status})`);
  }
  const sig = (await sigRes.json()) as SignatureResponse;

  // Cloudinary can't enforce size from a signature, so check before sending.
  if (file.size > sig.maxBytes) {
    throw new Error(`File is too large — the limit is ${formatBytes(sig.maxBytes)}.`);
  }

  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("api_key", sig.apiKey);
  formData.append("timestamp", String(sig.timestamp));
  formData.append("signature", sig.signature);
  formData.append("public_id", sig.publicId);
  formData.append("allowed_formats", sig.allowedFormats);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText) as { secure_url: string };
          resolve(data.secure_url);
        } catch {
          reject(new Error("Upload failed: unexpected response"));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

// `uid` is kept in each signature for caller compatibility; the server derives
// the real owner from the ID token.

export async function uploadProductImage(
  _uid: string,
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const blob = await compressImage(file);
  return signedUpload(projectId, "product", "image", blob, "product.jpg", onProgress);
}

export async function uploadVideoClip(
  _uid: string,
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return signedUpload(projectId, "clips", "video", file, file.name, onProgress);
}

export async function uploadLandingPagePhoto(
  _uid: string,
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const blob = await compressImage(file);
  return signedUpload(projectId, "lp-photos", "image", blob, "lp-photo.jpg", onProgress);
}

export async function uploadLandingPageGif(
  _uid: string,
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Upload raw — no compression, preserve animation frames
  return signedUpload(projectId, "lp-gifs", "image", file, "lp-gif.gif", onProgress);
}

export async function uploadRenderedVideo(
  _uid: string,
  projectId: string,
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  return signedUpload(projectId, "renders", "video", blob, `render-${Date.now()}.${ext}`, onProgress);
}
