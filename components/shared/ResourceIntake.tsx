"use client";

import { useState, useTransition } from "react";
import {
  CloudUpload,
  FileText,
  Link2,
  Loader2,
  Type,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, truncate } from "@/lib/utils";

interface Props {
  userId: string;
  organizationId: string | null;
  canManage: boolean;
}

type IntakeStatus = "uploading" | "stored" | "failed";

interface IntakeItem {
  id: string;
  kind: "file" | "paste" | "url";
  label: string;
  detail: string;
  status: IntakeStatus;
  message: string | null;
  storagePath: string | null;
}

const ACCEPT = [
  ".pdf",
  ".md",
  ".txt",
  ".docx",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ResourceIntake({ userId, organizationId, canManage }: Props) {
  const [queue, setQueue] = useState<IntakeItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteBody, setPasteBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canManage) {
    return (
      <div className="card-padded text-xs text-ink-600 dark:text-ink-300">
        <p className="label">Resource intake</p>
        <p className="mt-2">
          Only the owner can run intake. Send suggested resources to Jeremy
          directly and they will be reviewed before sharing.
        </p>
      </div>
    );
  }

  function patchItem(id: string, patch: Partial<IntakeItem>) {
    setQueue((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }

  async function uploadFile(file: File, itemId: string) {
    const supabase = getSupabaseBrowserClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    // userId + "/shared-intake/" + unique time-based prefix + "-" + file.name
    const path = `${userId}/shared-intake/${Date.now()}-${uid()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) {
      patchItem(itemId, {
        status: "failed",
        message: `Upload failed: ${upErr.message}`,
      });
      return;
    }

    const { error: rowErr } = await supabase.from("uploaded_files").insert({
      user_id: userId,
      organization_id: organizationId,
      bucket: "uploads",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      source_module: "shared-intake",
    });
    if (rowErr) {
      patchItem(itemId, {
        status: "failed",
        message: `Stored file, but metadata row failed: ${rowErr.message}`,
      });
      return;
    }

    patchItem(itemId, {
      status: "stored",
      message: "Stored in the uploads bucket. Not published to the team.",
      storagePath: path,
    });
  }

  async function uploadText(
    title: string,
    body: string,
    kind: "paste" | "url",
    itemId: string
  ) {
    const supabase = getSupabaseBrowserClient();
    const blob = new Blob([body], { type: "text/plain" });
    const baseName =
      kind === "url"
        ? "link-intake.txt"
        : `${title.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40) || "pasted"}.txt`;
    const path = `${userId}/shared-intake/${Date.now()}-${uid()}-${baseName}`;

    const { error: upErr } = await supabase.storage
      .from("uploads")
      .upload(path, blob, { upsert: false, contentType: "text/plain" });
    if (upErr) {
      patchItem(itemId, {
        status: "failed",
        message: `Upload failed: ${upErr.message}`,
      });
      return;
    }

    const { error: rowErr } = await supabase.from("uploaded_files").insert({
      user_id: userId,
      organization_id: organizationId,
      bucket: "uploads",
      storage_path: path,
      file_name: baseName,
      mime_type: "text/plain",
      size_bytes: blob.size,
      source_module: "shared-intake",
    });
    if (rowErr) {
      patchItem(itemId, {
        status: "failed",
        message: `Stored content, but metadata row failed: ${rowErr.message}`,
      });
      return;
    }

    patchItem(itemId, {
      status: "stored",
      message: "Stored in the uploads bucket. Not published to the team.",
      storagePath: path,
    });
  }

  function acceptFiles(picked: FileList | null) {
    if (!picked) return;
    setError(null);
    const toUpload: { file: File; item: IntakeItem }[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_BYTES) {
        setError(`Skipped ${file.name}: larger than 15 MB.`);
        continue;
      }
      const item: IntakeItem = {
        id: uid(),
        kind: "file",
        label: file.name,
        detail: `${Math.round(file.size / 1024)} KB · ${file.type || "file"}`,
        status: "uploading",
        message: null,
        storagePath: null,
      };
      toUpload.push({ file, item });
    }
    if (toUpload.length === 0) return;
    setQueue((prev) => [...toUpload.map((t) => t.item), ...prev]);
    startTransition(async () => {
      for (const { file, item } of toUpload) {
        await uploadFile(file, item.id);
      }
    });
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    acceptFiles(e.dataTransfer.files);
  }

  function submitPaste() {
    setError(null);
    const body = pasteBody.trim();
    if (!body) {
      setError("Paste some content first.");
      return;
    }
    const title = pasteTitle.trim() || "Pasted content";
    const item: IntakeItem = {
      id: uid(),
      kind: "paste",
      label: title,
      detail: `${body.length} chars pasted`,
      status: "uploading",
      message: null,
      storagePath: null,
    };
    setQueue((prev) => [item, ...prev]);
    setPasteTitle("");
    setPasteBody("");
    startTransition(async () => {
      await uploadText(title, body, "paste", item.id);
    });
  }

  function submitLink() {
    setError(null);
    const url = linkUrl.trim();
    if (!url) {
      setError("Enter a YouTube or web URL first.");
      return;
    }
    try {
      // Validate it parses as a URL before we capture it.
      new URL(url);
    } catch {
      setError("That does not look like a valid URL.");
      return;
    }
    const item: IntakeItem = {
      id: uid(),
      kind: "url",
      label: url,
      detail: "Link captured for review",
      status: "uploading",
      message: null,
      storagePath: null,
    };
    setQueue((prev) => [item, ...prev]);
    setLinkUrl("");
    startTransition(async () => {
      await uploadText(url, `Source URL: ${url}\n`, "url", item.id);
    });
  }

  return (
    <div className="card-padded space-y-4">
      <div>
        <p className="label">Stage for later (stored — pending AI review)</p>
        <p className="mt-1 text-[11px] text-ink-600 dark:text-ink-300">
          Drop a file, paste content, or capture a link. Everything is{" "}
          <strong>stored</strong> in the uploads bucket only — AI review is not
          active yet, and nothing is published to the team. To make a resource
          appear in Active resources now, use the Publish now panel above.
        </p>
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition",
          dragOver
            ? "border-accent-gold/60 bg-accent-gold/10 text-accent-gold"
            : "border-ink-200 dark:border-ink-700 bg-white/70 dark:bg-ink-950/40 text-ink-600 dark:text-ink-300 hover:border-ink-400 dark:hover:border-ink-500"
        )}
      >
        <CloudUpload size={22} />
        <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">
          Drop files here or click to choose
        </p>
        <p className="text-[11px] text-ink-500 dark:text-ink-400">
          PDF, MD, TXT, DOCX. Up to 15 MB each.
        </p>
        <input
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          onChange={(e) => acceptFiles(e.target.files)}
        />
      </label>

      {/* Paste content */}
      <div className="space-y-2 rounded-xl border border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-950/40 p-3">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          <Type size={12} /> Paste content
        </p>
        <input
          className="input"
          placeholder="Title (optional)"
          value={pasteTitle}
          onChange={(e) => setPasteTitle(e.target.value)}
        />
        <textarea
          className="textarea min-h-[90px]"
          placeholder="Paste a prompt, template, or note…"
          value={pasteBody}
          onChange={(e) => setPasteBody(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={submitPaste}
          disabled={isPending || pasteBody.trim().length === 0}
        >
          Capture pasted content
        </button>
      </div>

      {/* URL / YouTube */}
      <div className="space-y-2 rounded-xl border border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-950/40 p-3">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
          <Link2 size={12} /> YouTube / URL
        </p>
        <input
          className="input"
          placeholder="https://…"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={submitLink}
          disabled={isPending || linkUrl.trim().length === 0}
        >
          Capture link
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}

      {/* Intake queue */}
      <div className="space-y-2">
        <p className="label">Staged items</p>
        {queue.length === 0 ? (
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            Nothing staged yet. Items you stage appear here as stored — they are
            not processed and not published.
          </p>
        ) : (
          <ul className="space-y-3">
            {queue.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-950/40 p-3"
              >
                <header className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {item.kind === "url" ? (
                      <Link2 size={13} className="shrink-0 text-ink-500 dark:text-ink-400" />
                    ) : item.kind === "paste" ? (
                      <Type size={13} className="shrink-0 text-ink-500 dark:text-ink-400" />
                    ) : (
                      <FileText size={13} className="shrink-0 text-ink-500 dark:text-ink-400" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                        {truncate(item.label, 44)}
                      </span>
                      <span className="block text-[10px] text-ink-500 dark:text-ink-400">
                        {item.detail}
                      </span>
                    </span>
                  </span>
                  <StatusChip status={item.status} />
                </header>

                {item.message && (
                  <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-300">
                    {item.message}
                  </p>
                )}

                {/* Honest status: file is only stored. No AI has run. */}
                {item.status === "stored" && (
                  <p className="mt-3 text-[11px] text-ink-600 dark:text-ink-400">
                    Status: stored — pending AI review. AI review is not active
                    yet, so no title, summary, or compliance check has been
                    generated. Nothing is shared with the team until you publish
                    it manually.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-ink-500 dark:text-ink-400">
        Staging stores to the <code>uploads</code> bucket only — items are not
        processed and no AI has run. Publishing to Active resources stays a
        manual owner action via Publish now; there is no auto-publish.
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: IntakeStatus }) {
  if (status === "uploading") {
    return (
      <span className="chip chip-info flex shrink-0 items-center gap-1">
        <Loader2 size={10} className="animate-spin" /> uploading
      </span>
    );
  }
  if (status === "stored") {
    return <span className="chip chip-ok shrink-0">stored</span>;
  }
  return <span className="chip chip-err shrink-0">failed</span>;
}
