"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  organizationId: string | null;
  canShare: boolean;
}

export function CreateCollectionForm({ userId, organizationId, canShare }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "team_shared">(
    "private"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: insErr } = await supabase
          .from("knowledge_collections")
          .insert({
            user_id: userId,
            organization_id: organizationId,
            name,
            description,
            visibility,
          });
        if (insErr) {
          setError(insErr.message);
          return;
        }
        setName("");
        setDescription("");
        setVisibility("private");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card-padded space-y-3">
      <p className="label">New collection</p>
      <input
        className="input"
        placeholder="e.g. Loan officer playbooks"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={120}
      />
      <textarea
        className="textarea"
        placeholder="What is this collection for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={400}
      />
      <div>
        <p className="label">Visibility</p>
        <div className="mt-1 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVisibility("private")}
            className={
              visibility === "private"
                ? "btn-primary px-3 py-1.5"
                : "btn px-3 py-1.5"
            }
          >
            Private
          </button>
          <button
            type="button"
            onClick={() => canShare && setVisibility("team_shared")}
            className={
              visibility === "team_shared"
                ? "btn-primary px-3 py-1.5"
                : "btn px-3 py-1.5 disabled:opacity-50"
            }
            disabled={!canShare}
            title={canShare ? undefined : "Owner only"}
          >
            Team shared
          </button>
        </div>
        {!canShare && (
          <p className="mt-2 text-[11px] text-ink-300">
            Only Jeremy can mark a collection team-shared.
          </p>
        )}
      </div>
      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn-primary w-full"
        disabled={isPending || !name.trim()}
      >
        <Plus size={14} />
        {isPending ? "Creating…" : "Create collection"}
      </button>
    </form>
  );
}
