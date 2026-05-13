"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, X } from "lucide-react";

import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "logo", label: "Logo" },
  { value: "background", label: "Background" },
  { value: "team_photo", label: "Team photo" },
  { value: "social_image", label: "Social image" },
  { value: "image_studio_reference", label: "Image Studio reference" },
  { value: "document", label: "Document" },
  { value: "video", label: "Video" },
] as const;

const ALLOWED_EXTS = [
  // images
  "png",
  "jpg",
  "jpeg",
  "webp",
  // docs
  "pdf",
  "docx",
  "pptx",
  "md",
  "txt",
  "csv",
  "json",
  // videos
  "mp4",
  "mov",
  "webm",
];

interface PendingUpload {
  file: File;
  status: "queued" | "uploading" | "ok" | "error";
  message?: string;
}

export function AssetUploadCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [category, setCategory] = useState<string>("social_image");
  const [visibility, setVisibility] = useState<"team_shared" | "owner_only">(
    "team_shared"
  );
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming: PendingUpload[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTS.includes(ext)) {
        incoming.push({
          file: f,
          status: "error",
          message: `Unsupported type .${ext}`,
        });
      } else if (f.size > 50 * 1024 * 1024) {
        incoming.push({
          file: f,
          status: "error",
          message: "File over 50 MB",
        });
      } else {
        incoming.push({ file: f, status: "queued" });
      }
    }
    setPending((prev) => [...prev, ...incoming]);
  }

  function clear() {
    setPending([]);
    setError(null);
    setInfo(null);
  }

  async function uploadOne(item: PendingUpload, idx: number): Promise<void> {
    if (item.status !== "queued") return;
    setPending((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, status: "uploading" } : p))
    );
    const fd = new FormData();
    fd.set("file", item.file);
    fd.set("category", category);
    fd.set("visibility", visibility);
    if (label) fd.set("label", label);
    if (description) fd.set("description", description);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "POST",
        body: fd,
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setPending((prev) =>
          prev.map((p, i) =>
            i === idx
              ? {
                  ...p,
                  status: "error",
                  message:
                    res.status === 401
                      ? "Session expired"
                      : "Server returned non-JSON",
                }
              : p
          )
        );
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setPending((prev) =>
          prev.map((p, i) =>
            i === idx
              ? { ...p, status: "error", message: data.message ?? data.error }
              : p
          )
        );
        return;
      }
      setPending((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, status: "ok" } : p))
      );
    } catch (e) {
      setPending((prev) =>
        prev.map((p, i) =>
          i === idx
            ? {
                ...p,
                status: "error",
                message: e instanceof Error ? e.message : "Upload failed",
              }
            : p
        )
      );
    }
  }

  function uploadAll() {
    setError(null);
    setInfo(null);
    if (pending.filter((p) => p.status === "queued").length === 0) {
      setError("Pick at least one file to upload.");
      return;
    }
    startTransition(async () => {
      const tasks = pending.map((p, i) => uploadOne(p, i));
      await Promise.all(tasks);
      const okCount = pending.filter((p) => p.status !== "error").length;
      setInfo(`Uploaded ${okCount} file${okCount === 1 ? "" : "s"}.`);
      // Refresh so the server-rendered listing picks up the new rows.
      router.refresh();
    });
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>Upload assets</h2>
          <p>
            Images (png/jpg/webp), documents (pdf/docx/pptx/md/txt/csv/json),
            videos (mp4/mov/webm). Up to 50 MB each.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Category</span>
          <select
            className="input mt-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Visibility</span>
          <select
            className="input mt-1"
            value={visibility}
            onChange={(e) =>
              setVisibility(
                e.target.value === "owner_only" ? "owner_only" : "team_shared"
              )
            }
          >
            <option value="team_shared">Team shared (everyone)</option>
            <option value="owner_only">Owner only (just me)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Label (optional)</span>
          <input
            className="input mt-1"
            placeholder="e.g. New 2026 brand logo"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
          />
        </label>
        <label>
          <span className="label">Description (optional)</span>
          <input
            className="input mt-1"
            placeholder="Short note for the team"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </label>
      </div>

      <div
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition",
          dragOver
            ? "border-accent-gold/60 bg-accent-gold/5"
            : "border-ink-700 bg-ink-900/30 hover:border-ink-600"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <CloudUpload size={28} className="mx-auto text-ink-300" />
        <p className="mt-2 text-sm text-ink-100">
          Drop files here, or{" "}
          <span className="text-accent-gold underline">browse</span>
        </p>
        <p className="mt-0.5 text-[11px] text-ink-300">
          Multi-file OK · up to 50 MB each
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={ALLOWED_EXTS.map((e) => `.${e}`).join(",")}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {pending.length > 0 && (
        <ul className="space-y-1">
          {pending.map((p, i) => (
            <li
              key={`${p.file.name}-${i}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[11px]",
                p.status === "ok"
                  ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
                  : p.status === "error"
                  ? "border-status-err/30 bg-status-err/10 text-status-err"
                  : p.status === "uploading"
                  ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-700 bg-ink-900/40 text-ink-200"
              )}
            >
              <span className="truncate">
                {p.file.name}
                {p.message && ` — ${p.message}`}
              </span>
              <span className="shrink-0 uppercase tracking-[0.18em]">
                {p.status}
              </span>
              {p.status === "queued" && (
                <button
                  type="button"
                  className="text-ink-300 hover:text-status-err"
                  onClick={() =>
                    setPending((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove"
                >
                  <X size={11} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
          {info}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={uploadAll}
          disabled={isPending || pending.filter((p) => p.status === "queued").length === 0}
        >
          <CloudUpload size={14} />
          Upload {pending.filter((p) => p.status === "queued").length} file
          {pending.filter((p) => p.status === "queued").length === 1 ? "" : "s"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={clear}
          disabled={isPending || pending.length === 0}
        >
          Clear
        </button>
      </div>
    </section>
  );
}
