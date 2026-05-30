"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpen,
  CheckCircle,
  FolderKanban,
  Layers3,
  ListChecks,
  Plus,
  Save,
  Settings2,
  X,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative } from "@/lib/utils";
import type { AssistantVisibility, AtlasAssistant } from "@/types/database";

export type AtlasProjectSummary = Pick<
  AtlasAssistant,
  | "id"
  | "organization_id"
  | "owner_user_id"
  | "name"
  | "description"
  | "visibility"
  | "system_prompt"
  | "model"
  | "metadata"
  | "is_active"
  | "updated_at"
  | "created_at"
>;

export interface AtlasKnowledgeCollectionOption {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "team_shared";
  item_count: number;
}

export interface AtlasThreadSummary {
  id: string;
  title: string;
  assistant_id: string | null;
  last_message_at: string | null;
  is_archived: boolean;
}

export type AtlasProjectAccessMap = Record<string, string[]>;

interface Props {
  ownerId: string;
  organizationId: string | null;
  projects: AtlasProjectSummary[];
  knowledgeCollections: AtlasKnowledgeCollectionOption[];
  projectAccess: AtlasProjectAccessMap;
  recentThreads: AtlasThreadSummary[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
}

const VISIBILITY_OPTIONS: { value: AssistantVisibility; label: string }[] = [
  { value: "assigned_user", label: "Personal workspace" },
  { value: "team_shared", label: "Team workspace" },
  { value: "owner_only", label: "Owner only" },
];

function taskLines(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = metadata?.tasks;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toolSettings(metadata: Record<string, unknown> | null | undefined) {
  const raw = metadata?.tool_settings;
  if (!raw || typeof raw !== "object") {
    return { web: true, mcp: true, n8n: false, image: true };
  }
  const obj = raw as Record<string, unknown>;
  return {
    web: obj.web !== false,
    mcp: obj.mcp !== false,
    n8n: obj.n8n === true,
    image: obj.image !== false,
  };
}

function newDraft(project?: AtlasProjectSummary | null) {
  const tools = toolSettings(project?.metadata);
  return {
    id: project?.id ?? null,
    name: project?.name ?? "",
    description: project?.description ?? "",
    instructions: project?.system_prompt ?? "",
    visibility: project?.visibility ?? ("assigned_user" as AssistantVisibility),
    tasksText: taskLines(project?.metadata).join("\n"),
    tools,
  };
}

export function AtlasProjectsPanel({
  ownerId,
  organizationId,
  projects,
  knowledgeCollections,
  projectAccess,
  recentThreads,
  selectedProjectId,
  onSelectProject,
}: Props) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(newDraft());
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const editingProject = draft.id
    ? projects.find((project) => project.id === draft.id) ?? null
    : null;
  const visibleProjects = projects.filter((p) => p.is_active);
  const projectThreads = selectedProjectId
    ? recentThreads.filter((t) => t.assistant_id === selectedProjectId)
    : recentThreads.filter((t) => !t.assistant_id).slice(0, 5);

  useEffect(() => {
    if (!selectedProjectId) return;
    setSelectedKnowledgeIds(projectAccess[selectedProjectId] ?? []);
  }, [projectAccess, selectedProjectId]);

  function startNew() {
    setDraft(newDraft());
    setSelectedKnowledgeIds([]);
    setError(null);
    setInfo(null);
    setEditorOpen(true);
  }

  function editProject(project: AtlasProjectSummary) {
    setDraft(newDraft(project));
    setSelectedKnowledgeIds(projectAccess[project.id] ?? []);
    setError(null);
    setInfo(null);
    setEditorOpen(true);
  }

  function toggleKnowledge(id: string) {
    setSelectedKnowledgeIds((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= 40) {
        setError("Projects can attach up to 40 knowledge collections.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function saveProject() {
    setError(null);
    setInfo(null);
    if (!draft.name.trim()) {
      setError("Project name is required.");
      return;
    }
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const tasks = draft.tasksText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20);
      const payload = {
        organization_id: organizationId,
        owner_user_id: ownerId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        visibility: draft.visibility,
        system_prompt: draft.instructions.trim() || null,
        is_active: true,
        metadata: {
          kind: "atlas_project",
          workspace: "hermes",
          max_knowledge_documents: 40,
          tool_settings: draft.tools,
          tasks,
        },
      };
      let projectId = draft.id;
      if (projectId) {
        const { error: updateErr } = await supabase
          .from("atlas_assistants")
          .update(payload)
          .eq("id", projectId);
        if (updateErr) {
          setError(updateErr.message);
          return;
        }
      } else {
        const { data, error: insertErr } = await supabase
          .from("atlas_assistants")
          .insert(payload)
          .select("id")
          .single();
        if (insertErr || !data) {
          setError(insertErr?.message ?? "Project create failed.");
          return;
        }
        projectId = data.id as string;
      }

      await supabase
        .from("assistant_knowledge_access")
        .delete()
        .eq("assistant_id", projectId);
      if (selectedKnowledgeIds.length > 0) {
        const { error: accessErr } = await supabase
          .from("assistant_knowledge_access")
          .insert(
            selectedKnowledgeIds.slice(0, 40).map((collection_id) => ({
              assistant_id: projectId,
              collection_id,
              granted_by: ownerId,
            }))
          );
        if (accessErr) {
          setError(accessErr.message);
          return;
        }
      }

      setInfo("Project saved. New chats inside this project will inherit its instructions and knowledge.");
      onSelectProject(projectId);
      setEditorOpen(false);
      router.refresh();
    });
  }

  function archiveProject(project: AtlasProjectSummary) {
    if (!window.confirm(`Archive "${project.name}"? Existing chats stay readable.`)) {
      return;
    }
    startTransition(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error: archiveErr } = await supabase
        .from("atlas_assistants")
        .update({ is_active: false })
        .eq("id", project.id);
      if (archiveErr) {
        setError(archiveErr.message);
        return;
      }
      if (selectedProjectId === project.id) onSelectProject(null);
      setInfo("Project archived.");
      setEditorOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="border-b border-ink-200 dark:border-ink-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
              Projects
            </p>
            <p className="mt-1 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
              Instructions, scoped chats, tools, and knowledge.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="grid h-8 w-8 place-items-center rounded-lg border border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/15"
            title="Create Atlas project"
          >
            <Plus size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className={cn(
            "mt-3 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition",
            selectedProjectId === null
              ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
              : "border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/40 text-ink-800 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-600"
          )}
        >
          <FolderKanban size={12} />
          General Atlas chat
        </button>
      </div>

      <div className="space-y-2 p-3">
        {visibleProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white/30 dark:bg-ink-900/30 p-3 text-[11px] text-ink-600 dark:text-ink-300">
            Create a project to bind instructions, up to 40 knowledge collections, and project chats.
          </div>
        ) : (
          visibleProjects.map((project) => {
            const active = project.id === selectedProjectId;
            const accessCount = projectAccess[project.id]?.length ?? 0;
            return (
              <article
                key={project.id}
                className={cn(
                  "rounded-xl border bg-white/40 dark:bg-ink-900/40 p-2.5 transition",
                  active
                    ? "border-accent-gold/40 bg-accent-gold/[0.07]"
                    : "border-ink-200 dark:border-ink-800 hover:border-ink-300 dark:hover:border-ink-600"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                    <Layers3 size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink-900 dark:text-ink-100">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
                      {project.description || "No description yet."}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="chip h-5 px-2 text-[9px]">
                    {project.visibility.replace("_", " ")}
                  </span>
                  <span className="chip h-5 px-2 text-[9px]">
                    <BookOpen size={10} />
                    {accessCount}/40
                  </span>
                  {active && (
                    <span className="chip-active h-5 px-2 text-[9px]">
                      <CheckCircle size={10} />
                      active
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => editProject(project)}
                    className="text-[10.5px] text-ink-600 dark:text-ink-300 hover:text-accent-gold"
                  >
                    Edit workspace
                  </button>
                  <span className="text-[9.5px] text-ink-500 dark:text-ink-500">
                    {formatRelative(project.updated_at)}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="border-t border-ink-200 dark:border-ink-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
            Project threads
          </p>
          {selectedProject && (
            <button
              type="button"
              onClick={() => {
                onSelectProject(selectedProject.id);
                router.push("/atlas");
              }}
              className="text-[10px] text-accent-gold hover:text-ink-900 dark:hover:text-ink-100"
            >
              New chat
            </button>
          )}
        </div>
        <div className="mt-2 grid gap-1">
          {projectThreads.length === 0 ? (
            <p className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white/30 dark:bg-ink-900/30 p-2 text-[10.5px] text-ink-500 dark:text-ink-400">
              No scoped chats yet.
            </p>
          ) : (
            projectThreads.slice(0, 6).map((thread) => (
              <Link
                key={thread.id}
                href={`/atlas/${thread.id}`}
                className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/40 px-2 py-1.5 text-[10.5px] text-ink-800 dark:text-ink-200 hover:border-accent-gold/30"
              >
                <span className="block truncate">{thread.title}</span>
                {thread.last_message_at && (
                  <span className="text-[9px] text-ink-500 dark:text-ink-500">
                    {formatRelative(thread.last_message_at)}
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      </div>

      {(error || info) && (
        <div className="border-t border-ink-200 dark:border-ink-800 p-3">
          {error && (
            <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-2 py-1.5 text-[10.5px] text-status-err">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-2 py-1.5 text-[10.5px] text-status-ok">
              {info}
            </p>
          )}
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/75 dark:bg-ink-950/75 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-200 dark:border-ink-800 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-gold">
                  Atlas Project
                </p>
                <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
                  {draft.id ? "Edit project workspace" : "Create project workspace"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[calc(92vh-4.25rem)] overflow-y-auto p-4 scrollbar-thin">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  <input
                    className="input"
                    placeholder="Project name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    maxLength={120}
                  />
                  <textarea
                    className="textarea min-h-[86px]"
                    placeholder="Project description"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    maxLength={600}
                  />
                  <textarea
                    className="textarea min-h-[180px]"
                    placeholder="Project instructions Atlas should follow inside this workspace"
                    value={draft.instructions}
                    onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
                  />
                  <div>
                    <p className="label">Owner / user scope</p>
                    <select
                      className="input mt-2"
                      value={draft.visibility}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          visibility: e.target.value as AssistantVisibility,
                        }))
                      }
                    >
                      {VISIBILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="label flex items-center gap-1.5">
                      <ListChecks size={12} />
                      Tasks / action list
                    </p>
                    <textarea
                      className="textarea mt-2 min-h-[120px]"
                      placeholder="One project task per line"
                      value={draft.tasksText}
                      onChange={(e) => setDraft((d) => ({ ...d, tasksText: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/30 dark:bg-ink-900/30 p-3">
                    <p className="label flex items-center gap-1.5">
                      <Settings2 size={12} />
                      Tool and connector settings
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        ["web", "Web research"],
                        ["mcp", "MCP tools"],
                        ["n8n", "n8n actions"],
                        ["image", "Image tools"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 rounded-lg border border-ink-200 dark:border-ink-800 bg-white/50 dark:bg-ink-950/50 px-2 py-2 text-[11px] text-ink-800 dark:text-ink-200"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(draft.tools[key as keyof typeof draft.tools])}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                tools: { ...d.tools, [key]: e.target.checked },
                              }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/30 dark:bg-ink-900/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="label flex items-center gap-1.5">
                        <BookOpen size={12} />
                        Knowledge
                      </p>
                      <span className="chip h-5 px-2 text-[9px]">
                        {selectedKnowledgeIds.length}/40
                      </span>
                    </div>
                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {knowledgeCollections.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-ink-200 dark:border-ink-700 p-3 text-[11px] text-ink-600 dark:text-ink-300">
                          Create or upload a knowledge collection first.
                        </p>
                      ) : (
                        knowledgeCollections.map((collection) => {
                          const checked = selectedKnowledgeIds.includes(collection.id);
                          return (
                            <label
                              key={collection.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-[11px]",
                                checked
                                  ? "border-accent-gold/40 bg-accent-gold/10"
                                  : "border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-950/40"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleKnowledge(collection.id)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-ink-900 dark:text-ink-100">
                                  {collection.name}
                                </span>
                                <span className="block truncate text-ink-500 dark:text-ink-400">
                                  {collection.item_count} docs · {collection.visibility.replace("_", " ")}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-200 dark:border-ink-800 pt-4">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveProject}
                  disabled={isPending}
                >
                  <Save size={14} />
                  {isPending ? "Saving..." : "Save project"}
                </button>
                {draft.id && editingProject && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => archiveProject(editingProject)}
                    disabled={isPending}
                  >
                    <Archive size={14} />
                    Archive
                  </button>
                )}
                <p className="ml-auto max-w-xs text-[11px] text-ink-600 dark:text-ink-300">
                  Project chats use these instructions and selected knowledge before global context.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
