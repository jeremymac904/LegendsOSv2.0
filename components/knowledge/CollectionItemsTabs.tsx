"use client";

import { useState } from "react";
import { FileText, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FileRow {
  id: string;
  title: string;
  meta: string;
}

export interface NoteRow {
  id: string;
  title: string;
  sourceType: string;
  content: string | null;
  addedLabel: string;
}

type TabKey = "files" | "notes";

interface Props {
  files: FileRow[];
  notes: NoteRow[];
}

// Folds the two former full-width sections (Files / Notes & references) into a
// single tabbed card. The document/file list itself may scroll, but the page
// no longer stacks two tall card walls.
export function CollectionItemsTabs({ files, notes }: Props) {
  const [active, setActive] = useState<TabKey>(
    files.length > 0 || notes.length === 0 ? "files" : "notes"
  );

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "files", label: "Files", count: files.length },
    { key: "notes", label: "Notes & references", count: notes.length },
  ];

  return (
    <section className="card-padded space-y-4">
      <div
        role="tablist"
        aria-label="Collection items"
        className="flex flex-wrap gap-1.5 border-b border-ink-200 pb-3 dark:border-ink-800"
      >
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition",
                isActive
                  ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300 dark:hover:text-ink-100"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                  isActive
                    ? "bg-accent-gold/20 text-accent-gold"
                    : "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="max-h-[60vh] overflow-y-auto pr-1">
        {active === "files" &&
          (files.length === 0 ? (
            <EmptyRow
              icon={FileText}
              title="No files yet"
              body="Upload a PDF, DOCX, image, or any reference file using the card above."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {files.map((it) => (
                <div
                  key={it.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                      {it.title}
                    </p>
                    <p className="text-[11px] text-ink-600 dark:text-ink-300">
                      {it.meta}
                    </p>
                  </div>
                  <span className="chip text-[10px]">file</span>
                </div>
              ))}
            </div>
          ))}

        {active === "notes" &&
          (notes.length === 0 ? (
            <EmptyRow
              icon={Pencil}
              title="No notes yet"
              body="Paste reference content using the 'Add item' card above."
            />
          ) : (
            <div className="grid gap-2">
              {notes.map((it) => (
                <div
                  key={it.id}
                  className="rounded-xl border border-ink-200 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                      {it.title}
                    </p>
                    <span className="chip text-[10px]">{it.sourceType}</span>
                  </div>
                  {it.content && (
                    <p className="mt-2 line-clamp-3 text-xs text-ink-700 dark:text-ink-300">
                      {it.content}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
                    Added {it.addedLabel}
                  </p>
                </div>
              ))}
            </div>
          ))}
      </div>
    </section>
  );
}

function EmptyRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center dark:border-ink-800">
      <Icon size={22} className="mx-auto text-ink-400 dark:text-ink-500" />
      <p className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">
        {title}
      </p>
      <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">{body}</p>
    </div>
  );
}
