"use client";

import { useState } from "react";
import { ArrowRight, Upload } from "lucide-react";

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
  const [pickedId, setPickedId] = useState<string>(collections[0]?.id ?? "");
  if (collections.length === 0) {
    return (
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Upload knowledge</h2>
            <p>
              Create your first collection (right column), then drop files
              into it.
            </p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <Upload size={16} className="text-accent-gold" />
            Quick upload
          </h2>
          <p>
            Drop files straight into any collection without navigating in.
            Atlas indexes the text and picks them up on its next reply.
          </p>
        </div>
      </div>
      <label className="block">
        <span className="label">Collection</span>
        <select
          className="input mt-1"
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
        >
          {collections.map((c) => (
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
    </section>
  );
}
