"use client";

import { BookOpen, Clock, FolderTree, Upload } from "lucide-react";

import { Tabs, type TabItem } from "@/components/ui/Tabs";

interface Props {
  /** The quick-upload picker (drag-and-drop) plus the new-collection form. */
  upload: React.ReactNode;
  /** My collections + team-shared, side by side. */
  collections: React.ReactNode;
  /** Recent items with honest indexing status. */
  recent: React.ReactNode;
  /** Setup guide / tutorial content. */
  setup: React.ReactNode;
}

/**
 * Compacts the Knowledge Sources page into four switchable panels so the
 * drag-and-drop uploader no longer dominates the screen. Each panel receives
 * server-rendered content as a prop — the Supabase queries and role gating
 * stay in the server page; this client wrapper only handles tab state.
 */
export function KnowledgeTabs({ upload, collections, recent, setup }: Props) {
  const tabs: TabItem[] = [
    { id: "upload", label: "Upload", icon: Upload, content: upload },
    {
      id: "collections",
      label: "Collections",
      icon: FolderTree,
      content: collections,
    },
    { id: "recent", label: "Recent files", icon: Clock, content: recent },
    { id: "setup", label: "Setup guide", icon: BookOpen, content: setup },
  ];

  return <Tabs tabs={tabs} variant="underline" defaultTabId="collections" />;
}
