"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  organizationId: string | null;
  userId: string;
}

export function CreateSharedResourceForm({ organizationId, userId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState("prompt");
  const [description, setDescription] = useState("");
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!organizationId) {
      setError("Owner must belong to an organization.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: insErr } = await supabase
          .from("shared_resources")
          .insert({
            organization_id: organizationId,
            created_by: userId,
            title,
            description: description || null,
            resource_type: resourceType,
            payload: payload ? { body: payload } : {},
          });
        if (insErr) {
          setError(insErr.message);
          return;
        }
        setTitle("");
        setDescription("");
        setPayload("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card-padded space-y-3">
      <p className="label">New shared resource</p>
      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={160}
      />
      <select
        className="input"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value)}
      >
        <option value="prompt">Prompt</option>
        <option value="copy_template">Copy template</option>
        <option value="image_preset">Image preset</option>
        <option value="checklist">Checklist</option>
        <option value="brand_asset">Brand asset</option>
      </select>
      <textarea
        className="textarea"
        placeholder="Short description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={400}
      />
      <textarea
        className="textarea min-h-[160px] font-mono"
        placeholder="Body / template content"
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
      />
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
        {isPending ? "Sharing…" : "Share with team"}
      </button>
    </form>
  );
}
