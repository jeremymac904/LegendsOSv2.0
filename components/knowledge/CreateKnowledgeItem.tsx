"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: insErr } = await supabase.from("knowledge_items").insert({
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
        setTitle("");
        setContent("");
        setSourceUri("");
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
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
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
        />
      </div>
      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isPending || !title.trim()}
      >
        <Plus size={14} />
        {isPending ? "Saving…" : "Add to collection"}
      </button>
      <p className="text-[11px] text-ink-300">
        File uploads write to the <code>knowledge</code> bucket via Supabase
        Storage — coming next pass.
      </p>
    </form>
  );
}
