"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileText, Trash2 } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, truncate } from "@/lib/utils";

interface Props {
  collectionId: string;
  userId: string;
  organizationId: string | null;
}

const ACCEPT = [
  ".pdf",
  ".docx",
  ".pptx",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
].join(",");
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file

// Extensions whose contents are plain UTF-8 text — we read them in the
// browser and store the text in knowledge_items.content so the retrieval
// layer can keyword-match against the actual body, not just the title.
const PLAIN_TEXT_EXTS = new Set(["md", "txt", "csv", "json"]);

async function maybeReadAsText(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!PLAIN_TEXT_EXTS.has(ext)) return null;
  try {
    const text = await file.text();
    // Trim very long content so we don't blow past Postgres TOAST limits.
    return text.length > 200_000 ? text.slice(0, 200_000) : text;
  } catch {
    return null;
  }
}

export function KnowledgeUploadCard({ collectionId, userId, organizationId }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  function pickFiles(picked: FileList | null) {
    if (!picked) return;
    const next: File[] = [];
    for (const f of Array.from(picked)) {
      if (f.size > MAX_BYTES) {
        setError(`Skipped ${f.name}: larger than 15 MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next]);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    pickFiles(e.dataTransfer.files);
  }

  function uploadOne(file: File): Promise<{
    fileId: string;
    storagePath: string;
  } | null> {
    return new Promise(async (resolve) => {
      const supabase = getSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${userId}/${collectionId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("knowledge")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) {
        setError(`Upload failed (${file.name}): ${upErr.message}`);
        resolve(null);
        return;
      }
      const { data, error: rowErr } = await supabase
        .from("uploaded_files")
        .insert({
          user_id: userId,
          organization_id: organizationId,
          bucket: "knowledge",
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          source_module: "knowledge",
        })
        .select("id")
        .single();
      if (rowErr || !data) {
        setError(`Metadata failed (${file.name}): ${rowErr?.message ?? ""}`);
        resolve(null);
        return;
      }
      resolve({ fileId: data.id, storagePath: path });
    });
  }

  function submit() {
    setError(null);
    setInfo(null);
    if (files.length === 0) {
      setError("Drop files here or click to choose at least one.");
      return;
    }
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      let ok = 0;
      let extracted = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(
          `Uploading ${i + 1}/${files.length}: ${truncate(file.name, 28)}`
        );
        const result = await uploadOne(file);
        if (!result) continue;

        // Pull text content for the formats we can read directly. PDF/DOCX/
        // PPTX stay as binaries — retrieval matches on title until we add a
        // server-side parser (deferred).
        const textContent = await maybeReadAsText(file);
        if (textContent !== null) extracted++;

        const { error: itemErr } = await supabase
          .from("knowledge_items")
          .insert({
            collection_id: collectionId,
            user_id: userId,
            organization_id: organizationId,
            title: file.name,
            content: textContent,
            source_type: "file",
            source_uri: null,
            file_id: result.fileId,
            metadata: {
              storage_bucket: "knowledge",
              storage_path: result.storagePath,
              mime_type: file.type,
              size_bytes: file.size,
              extracted_text: textContent !== null,
            },
          });
        if (itemErr) {
          setError(
            `Linking knowledge item failed (${file.name}): ${itemErr.message}`
          );
          continue;
        }
        ok++;
      }
      setProgress(null);
      if (ok > 0) {
        setInfo(
          `Uploaded ${ok} file${ok === 1 ? "" : "s"} to this collection${
            extracted > 0
              ? ` (${extracted} indexed for keyword search)`
              : ""
          }.`
        );
        setFiles([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="card-padded space-y-3">
      <div>
        <p className="label">Upload files</p>
        <p className="mt-1 text-[11px] text-ink-300">
          PDF, DOCX, PPTX, TXT, MD, CSV, JSON, PNG, JPG, JPEG, WEBP. Up to
          15 MB each. Text from .md / .txt / .csv / .json is indexed for
          Atlas keyword retrieval; binaries stay searchable by filename.
        </p>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-ink-900/40 p-6 text-center transition",
          dragOver
            ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
            : "border-ink-700 text-ink-300 hover:border-ink-500"
        )}
      >
        <CloudUpload size={22} />
        <p className="mt-2 text-sm font-medium text-ink-100">
          Drop files here or click to choose
        </p>
        <p className="text-[11px] text-ink-300">
          Multiple files supported.
        </p>
        <input
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          onChange={(e) => pickFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1 text-xs">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-2 py-1.5"
            >
              <span className="flex items-center gap-2">
                <FileText size={12} className="text-ink-300" />
                <span className="text-ink-100">{truncate(f.name, 40)}</span>
                <span className="text-[10px] text-ink-300">
                  {Math.round(f.size / 1024)} KB
                </span>
              </span>
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-ink-300 hover:text-status-err"
              >
                <Trash2 size={10} />
              </button>
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
      {progress && (
        <p className="rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-xs text-status-info">
          {progress}
        </p>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        onClick={submit}
        disabled={isPending || files.length === 0}
      >
        <CloudUpload size={14} />
        {isPending ? "Uploading…" : `Upload ${files.length || ""} file(s)`}
      </button>

      <p className="text-[11px] text-ink-300">
        Retrieval indexing (embeddings, vector search) is coming next pass. For
        now the file content is browseable but not yet embedded.
      </p>
    </div>
  );
}
