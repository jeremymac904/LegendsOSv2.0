"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { KnowledgeUploadCard } from "@/components/knowledge/KnowledgeUploadCard";

interface CollectionRef {
  id: string;
  name: string;
  visibility: "private" | "team_shared";
}

interface Props {
  userId: string;
  organizationId: string | null;
  collections: CollectionRef[];
}

export function QuickUploadPicker({
  userId,
  organizationId,
  collections,
}: Props) {
  const uniqueCollections = collections.filter(
    (collection, index, all) =>
      all.findIndex((candidate) => candidate.id === collection.id) === index
  );
  const [pickedId, setPickedId] = useState<string>(uniqueCollections[0]?.id ?? "");
  if (uniqueCollections.length === 0) {
    return (
      <p className="text-sm text-ink-700 dark:text-ink-300">
        Create your first collection (right column), then drop files into it.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">Collection</span>
        <select
          className="input mt-1"
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
        >
          {uniqueCollections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.visibility === "team_shared" ? " (team)" : " (private)"}
            </option>
          ))}
        </select>
      </label>
      {pickedId && (
        <>
          <KnowledgeUploadCard
            collectionId={pickedId}
            userId={userId}
            organizationId={organizationId}
          />
          <a
            href={`/knowledge/${pickedId}`}
            className="btn-ghost text-xs"
          >
            Open this collection
            <ArrowRight size={12} />
          </a>
        </>
      )}
    </div>
  );
}
