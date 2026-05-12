"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Upload, X } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { truncate } from "@/lib/utils";

interface Props {
  collectionId: string;
  userId: string;
  organizationId: string | null;
}

export function CreateKnowledgeItem({
  collectionId,
  userId,
  organizationId,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState("note");
  const [sourceUri, setSourceUri] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(picked)]);
  }

  async function uploadFile(file: File): Promise<{
    uploaded_file_id: string;
    storage_path: string;
    file_name: string;
  } | null> {
    const supabase = getSupabaseBrowserClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${userId}/${collectionId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("knowledge")
      .upload(path, file, { upsert: false });
    if (upErr) {
      setError(`Upload failed (${file.name}): ${upErr.message}`);
      return null;
    }
    const { data: row, error: insErr } = await supabase
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
    if (insErr || !row) {
      setError(`File metadata failed (${file.name}): ${insErr?.message ?? ""}`);
      return null;
    }
    return {
      uploaded_file_id: row.id,
      storage_path: path,
      file_name: file.name,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        // If files are attached, upload each and create one knowledge_item per file.
        if (files.length > 0) {
          for (const file of files) {
            const uploaded = await uploadFile(file);
            if (!uploaded) return;
            const { error: insErr } = await supabase
              .from("knowledge_items")
              .insert({
                collection_id: collectionId,
                user_id: userId,
                organization_id: organizationId,
                title: title.trim() || file.name,
                content: content || null,
                source_type: "file",
                source_uri: null,
                file_id: uploaded.uploaded_file_id,
                metadata: {
                  storage_bucket: "knowledge",
                  storage_path: uploaded.storage_path,
                  file_name: uploaded.file_name,
                  mime_type: file.type,
                  size_bytes: file.size,
                },
              });
            if (insErr) {
              setError(insErr.message);
              return;
            }
          }
          setInfo(`Uploaded ${files.length} file(s) and linked to collection.`);
        } else {
          if (!title.trim()) {
            setError("Title is required when no file is attached.");
            return;
          }
          const { error: insErr } = await supabase
            .from("knowledge_items")
            .insert({
              collection_id: collectionId,
              user_id: userId,
              organization_id: organizationId,
              title,
              content: content || null,
              source_type: sourceType,
              source_uri: sourceUri || null,
            });
          if (insErr) {
            setError(insErr.message);
            return;
          }
          setInfo("Added.");
        }
        setTitle("");
        setContent("");
        setSourceUri("");
        setFiles([]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card-padded space-y-3">
      <p className="label">Add item</p>
      <input
        className="input"
        placeholder="Title (defaults to file name when uploading)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />
      <textarea
        className="textarea"
        placeholder="Paste reference content here…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          className="input"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          disabled={files.length > 0}
        >
          <option value="note">Note</option>
          <option value="webpage">Webpage</option>
          <option value="document">Document</option>
          <option value="transcript">Transcript</option>
          <option value="policy">Policy</option>
        </select>
        <input
          className="input"
          placeholder="Optional URL"
          value={sourceUri}
          onChange={(e) => setSourceUri(e.target.value)}
          disabled={files.length > 0}
        />
      </div>
      <div>
        <label className="btn cursor-pointer">
          <Paperclip size={14} />
          Attach files
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px]">
            {files.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded border border-ink-800 bg-ink-900/40 px-2 py-1 text-ink-200"
              >
                <span>{truncate(f.name, 40)} · {Math.round(f.size / 1024)} KB</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-ink-300 hover:text-status-err"
                >
                  <X size={10} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isPending || (files.length === 0 && !title.trim())}
      >
        {files.length > 0 ? <Upload size={14} /> : <Plus size={14} />}
        {isPending
          ? "Saving…"
          : files.length > 0
          ? `Upload ${files.length} file(s)`
          : "Add to collection"}
      </button>
      <p className="text-[11px] text-ink-300">
        Files upload to the <code>knowledge</code> bucket. Each file creates an{" "}
        <code>uploaded_files</code> row and a <code>knowledge_items</code> row.
      </p>
    </form>
  );
}
