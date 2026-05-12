"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  organizationId: string | null;
}

const ITEM_TYPES = [
  { value: "content_plan", label: "Content plan" },
  { value: "team_event", label: "Team event" },
  { value: "reminder", label: "Reminder" },
] as const;

export function CreateCalendarItem({ userId, organizationId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<typeof ITEM_TYPES[number]["value"]>(
    "content_plan"
  );
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startsAt) {
      setError("Pick a start time.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: insErr } = await supabase.from("calendar_items").insert({
          user_id: userId,
          organization_id: organizationId,
          item_type: itemType,
          title,
          description: description || null,
          starts_at: new Date(startsAt).toISOString(),
        });
        if (insErr) {
          setError(insErr.message);
          return;
        }
        setTitle("");
        setDescription("");
        setStartsAt("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={submit} className="card-padded space-y-3">
      <p className="label">New planning item</p>
      <select
        className="input"
        value={itemType}
        onChange={(e) => setItemType(e.target.value as never)}
      >
        {ITEM_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={160}
      />
      <textarea
        className="textarea"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
      />
      <input
        type="datetime-local"
        className="input"
        value={startsAt}
        onChange={(e) => setStartsAt(e.target.value)}
        required
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
        {isPending ? "Saving…" : "Add to calendar"}
      </button>
    </form>
  );
}
