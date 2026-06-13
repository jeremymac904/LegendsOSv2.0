// GOAT Architect Command API — OpenAPI 3.1 contract.
// ---------------------------------------------------------------------------
// This object is the schema the Custom GPT Action imports (paste it, or
// import from https://legendsos.app/api/goat/openapi). Keep operationIds
// stable — the GPT references them by name.
// ---------------------------------------------------------------------------

import { GOAT_API_VERSION } from "./api";

export const GOAT_DEFAULT_BASE_URL = "https://legendsos.app";

function envelope(extra: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      request_id: { type: "string" },
      ...extra,
    },
  };
}

const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: envelope({
        error: { type: "string" },
        message: { type: "string" },
      }),
    },
  },
};

const runSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["plan", "execute"] },
    status: { type: "string", enum: ["planned", "queued", "running", "completed", "failed"] },
    goal: { type: "string" },
    plan: { type: "object" },
    result: { type: "object" },
    error: { type: ["string", "null"] },
    parent_run_id: { type: ["string", "null"] },
    created_at: { type: "string" },
    updated_at: { type: "string" },
  },
};

export function buildGoatOpenApiSpec(baseUrl?: string) {
  const server = (baseUrl || process.env.GOAT_PUBLIC_BASE_URL || GOAT_DEFAULT_BASE_URL).replace(
    /\/$/,
    ""
  );
  return {
    openapi: "3.1.0",
    info: {
      title: "GOAT Architect Command API",
      description:
        "Command surface for the GOAT Architect Custom GPT: health, capabilities, projects, memory, repo status, agent planning/execution, research, and secret-file preparation. All endpoints except get_health require Bearer auth.",
      version: GOAT_API_VERSION,
    },
    servers: [{ url: server }],
    paths: {
      "/api/goat/health": {
        get: {
          operationId: "get_health",
          summary: "Service health, version, and message.",
          security: [],
          responses: {
            "200": {
              description: "Service is up.",
              content: {
                "application/json": {
                  schema: envelope({
                    status: { type: "string" },
                    version: { type: "string" },
                    message: { type: "string" },
                    service: { type: "string" },
                    time: { type: "string" },
                    auth_configured: { type: "boolean" },
                  }),
                },
              },
            },
          },
        },
      },
      "/api/goat/capabilities": {
        get: {
          operationId: "list_capabilities",
          summary: "Tools, agents, MCP servers, repositories, and memory stores available to the GOAT Architect.",
          responses: {
            "200": {
              description: "Capability registry.",
              content: {
                "application/json": {
                  schema: envelope({
                    tools: { type: "array", items: { type: "object" } },
                    agents: { type: "array", items: { type: "object" } },
                    mcp_servers: { type: "array", items: { type: "object" } },
                    repositories: { type: "array", items: { type: "object" } },
                    memory_stores: { type: "array", items: { type: "object" } },
                  }),
                },
              },
            },
            "401": errorResponse,
          },
        },
      },
      "/api/goat/projects/search": {
        get: {
          operationId: "search_projects",
          summary: "Search registered projects by name, description, or tag.",
          parameters: [
            {
              name: "query",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Keyword filter. Omit to list the most recent projects.",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Matching projects.",
              content: {
                "application/json": {
                  schema: envelope({
                    projects: { type: "array", items: { type: "object" } },
                    count: { type: "integer" },
                  }),
                },
              },
            },
            "401": errorResponse,
          },
        },
      },
      "/api/goat/projects": {
        post: {
          operationId: "create_project",
          summary: "Register a new project.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string", maxLength: 120 },
                    description: { type: "string", maxLength: 2000 },
                    repo_url: { type: "string" },
                    status: { type: "string", enum: ["active", "paused", "done", "idea"] },
                    tags: { type: "array", items: { type: "string" }, maxItems: 12 },
                    metadata: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Project created.",
              content: {
                "application/json": { schema: envelope({ project: { type: "object" } }) },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "409": errorResponse,
          },
        },
      },
      "/api/goat/memory/search": {
        get: {
          operationId: "search_memory",
          summary: "Search GOAT long-term memory.",
          parameters: [
            {
              name: "query",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Keyword filter over title/content/tags. Omit for most recent.",
            },
            {
              name: "scope",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Matching memories.",
              content: {
                "application/json": {
                  schema: envelope({
                    memories: { type: "array", items: { type: "object" } },
                    count: { type: "integer" },
                  }),
                },
              },
            },
            "401": errorResponse,
          },
        },
      },
      "/api/goat/memory": {
        post: {
          operationId: "write_memory",
          summary: "Write a memory entry (facts, decisions, preferences).",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "content"],
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    content: { type: "string", maxLength: 8000 },
                    scope: { type: "string", maxLength: 60 },
                    tags: { type: "array", items: { type: "string" }, maxItems: 12 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Memory stored.",
              content: {
                "application/json": { schema: envelope({ memory: { type: "object" } }) },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/api/goat/repo/status": {
        get: {
          operationId: "get_repo_status",
          summary: "Deployed commit/branch of this API plus live GitHub repo status when a token is configured.",
          responses: {
            "200": {
              description: "Repository status.",
              content: {
                "application/json": {
                  schema: envelope({
                    repository: { type: "object" },
                    deployed: { type: "object" },
                    live: { type: ["object", "null"] },
                  }),
                },
              },
            },
            "401": errorResponse,
          },
        },
      },
      "/api/goat/agent/plan": {
        post: {
          operationId: "plan_agent_task",
          summary: "Produce a structured execution plan for a goal and persist it as a run.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["goal"],
                  properties: {
                    goal: { type: "string", maxLength: 2000 },
                    context: { type: "string", maxLength: 6000 },
                    constraints: { type: "array", items: { type: "string" }, maxItems: 10 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Plan created.",
              content: {
                "application/json": {
                  schema: envelope({ run: runSchema }),
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
      "/api/goat/agent/execute": {
        post: {
          operationId: "execute_agent_task",
          summary: "Queue a planned run for execution (or dry-run it). Execution is performed by Claude Code on Jeremy's side; this endpoint records and tracks the run.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    run_id: {
                      type: "string",
                      description: "A run id returned by plan_agent_task. Provide this OR goal.",
                    },
                    goal: {
                      type: "string",
                      maxLength: 2000,
                      description: "Plan-and-queue in one call when no run_id exists yet.",
                    },
                    mode: { type: "string", enum: ["queue", "dry_run"], default: "queue" },
                    notes: { type: "string", maxLength: 2000 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Execution run created.",
              content: {
                "application/json": { schema: envelope({ run: runSchema }) },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "404": errorResponse,
          },
        },
      },
      "/api/goat/runs/{run_id}": {
        get: {
          operationId: "get_run_status",
          summary: "Fetch a run (plan or execution) by id.",
          parameters: [
            {
              name: "run_id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "The run.",
              content: {
                "application/json": { schema: envelope({ run: runSchema }) },
              },
            },
            "401": errorResponse,
            "404": errorResponse,
          },
        },
      },
      "/api/goat/research/github": {
        post: {
          operationId: "research_github",
          summary: "Search GitHub repositories for research.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["query"],
                  properties: {
                    query: { type: "string", maxLength: 200 },
                    language: { type: "string", maxLength: 40 },
                    sort: { type: "string", enum: ["best-match", "stars", "updated"] },
                    limit: { type: "integer", minimum: 1, maximum: 20 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Repository results.",
              content: {
                "application/json": {
                  schema: envelope({
                    results: { type: "array", items: { type: "object" } },
                    total: { type: "integer" },
                  }),
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
            "502": errorResponse,
          },
        },
      },
      "/api/goat/research/ai-news": {
        post: {
          operationId: "research_ai_news",
          summary: "Fetch recent AI news stories (Hacker News index).",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    query: { type: "string", maxLength: 200 },
                    days: { type: "integer", minimum: 1, maximum: 30 },
                    limit: { type: "integer", minimum: 1, maximum: 20 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "News results.",
              content: {
                "application/json": {
                  schema: envelope({
                    results: { type: "array", items: { type: "object" } },
                  }),
                },
              },
            },
            "401": errorResponse,
            "502": errorResponse,
          },
        },
      },
      "/api/goat/secrets/prepare": {
        post: {
          operationId: "prepare_secret_file",
          summary:
            "Prepare an OPEN_ME_ADD_KEYS.txt helper (file content + exact instructions) for keys Jeremy must add himself. NEVER send secret values to this endpoint — it rejects anything that looks like one.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["service", "env_var_names"],
                  properties: {
                    service: { type: "string", maxLength: 80 },
                    env_var_names: {
                      type: "array",
                      items: { type: "string" },
                      minItems: 1,
                      maxItems: 10,
                      description: "Environment variable NAMES only (e.g. OPENAI_API_KEY). Never values.",
                    },
                    notes: { type: "string", maxLength: 1000 },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Helper file content and instructions.",
              content: {
                "application/json": {
                  schema: envelope({
                    file: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        content: { type: "string" },
                      },
                    },
                    instructions: { type: "array", items: { type: "string" } },
                  }),
                },
              },
            },
            "400": errorResponse,
            "401": errorResponse,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Send the value of GOAT_COMMAND_API_KEY as a Bearer token.",
        },
      },
      schemas: {},
    },
    security: [{ bearerAuth: [] }],
  };
}
