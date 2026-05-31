// LegendsOS v2 — Loan Memory test doubles.
// A tiny in-memory fake of the Supabase client surface the foundation lib uses:
//   client.from(table).select(...).eq(...).ilike(...).order(...).limit(...)
//   client.from(table).insert(row).select(...).single()
//   client.from(table).update(patch).eq(...)
//   ...maybeSingle() / single()
//
// The fake is intentionally permissive: query builders are awaitable (thenable)
// and also expose .single()/.maybeSingle(). It records every insert/update so
// tests can assert side effects (e.g. a retrieval-log row was written) without
// a live database. No network, no real Supabase, no RLS — RLS is asserted
// separately in rls.assertions.sql because it runs in Postgres.
//
// This file is a test double only. It is NOT a re-implementation of the
// foundation lib and never imports application Supabase clients.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecordedWrite {
  table: string;
  op: "insert" | "update";
  payload: unknown;
  // For updates: the .eq() filters captured before the write resolved.
  filters?: Record<string, unknown>;
}

export interface FakeClientOptions {
  /**
   * Canned rows keyed by table name. Filters are applied in-memory. Rows are
   * any object shape (e.g. LoanMemory) — they don't need an index signature.
   */
  tables?: Record<string, object[]>;
  /**
   * Tables that should behave as "migration not applied" — any query throws,
   * proving the foundation lib degrades gracefully instead of crashing.
   */
  missingTables?: string[];
  /** Optional id generator for inserted rows (defaults to incrementing ids). */
  nextId?: () => string;
}

export interface FakeClient {
  /** The Supabase-shaped client to pass into the foundation lib. */
  client: SupabaseClient;
  /** Everything that was written, in order. */
  writes: RecordedWrite[];
  /** Convenience: writes filtered to a single table + op. */
  writesTo(table: string, op?: "insert" | "update"): RecordedWrite[];
}

type Row = Record<string, unknown>;

function matches(row: Row, filters: Array<[string, "eq" | "neq" | "ilike", unknown]>): boolean {
  return filters.every(([col, kind, val]) => {
    const cell = row[col];
    if (kind === "eq") return cell === val;
    if (kind === "neq") return cell !== val;
    // ilike: %term% substring, case-insensitive. Strip surrounding %.
    const needle = String(val ?? "").replace(/^%|%$/g, "").toLowerCase();
    return String(cell ?? "").toLowerCase().includes(needle);
  });
}

export function makeFakeClient(opts: FakeClientOptions = {}): FakeClient {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(opts.tables ?? {})) tables[k] = v.map((r) => ({ ...r }));
  const missing = new Set(opts.missingTables ?? []);
  const writes: RecordedWrite[] = [];
  let idCounter = 1;
  const nextId = opts.nextId ?? (() => `fake-id-${idCounter++}`);

  function from(table: string) {
    if (missing.has(table)) {
      // Simulate a not-yet-applied table: every terminal call rejects.
      const thrower = () => {
        throw new Error(`relation "public.${table}" does not exist`);
      };
      const proxy: Record<string, unknown> = {};
      const methods = ["select", "eq", "neq", "ilike", "order", "limit", "insert", "update"];
      for (const m of methods) proxy[m] = () => proxy;
      proxy.single = thrower;
      proxy.maybeSingle = thrower;
      // Awaiting the builder also rejects.
      (proxy as { then: unknown }).then = (_res: unknown, rej: (e: unknown) => void) =>
        rej(new Error(`relation "public.${table}" does not exist`));
      return proxy;
    }

    const filters: Array<[string, "eq" | "neq" | "ilike", unknown]> = [];
    let limitN = Infinity;
    let pendingInsert: Row[] | null = null;
    let pendingUpdate: Row | null = null;

    const resolveRows = (): Row[] => {
      const base = tables[table] ?? [];
      return base.filter((r) => matches(r, filters)).slice(0, limitN);
    };

    const applyInsert = (): Row[] => {
      const inserted = (pendingInsert ?? []).map((r) => ({ id: nextId(), ...r }));
      tables[table] = [...(tables[table] ?? []), ...inserted];
      writes.push({ table, op: "insert", payload: pendingInsert!.length === 1 ? pendingInsert![0] : pendingInsert });
      return inserted;
    };

    const applyUpdate = (): Row[] => {
      const target = tables[table] ?? [];
      const updated: Row[] = [];
      for (const r of target) {
        if (matches(r, filters)) {
          Object.assign(r, pendingUpdate);
          updated.push(r);
        }
      }
      const filterObj: Record<string, unknown> = {};
      for (const [c, k, v] of filters) if (k === "eq") filterObj[c] = v;
      writes.push({ table, op: "update", payload: pendingUpdate, filters: filterObj });
      return updated;
    };

    const settle = (): { data: unknown; error: unknown } => {
      try {
        if (pendingInsert) return { data: applyInsert(), error: null };
        if (pendingUpdate) return { data: applyUpdate(), error: null };
        return { data: resolveRows(), error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    };

    const builder: Record<string, unknown> = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push([col, "eq", val]);
        return builder;
      },
      neq(col: string, val: unknown) {
        filters.push([col, "neq", val]);
        return builder;
      },
      ilike(col: string, val: unknown) {
        filters.push([col, "ilike", val]);
        return builder;
      },
      order() {
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      insert(rows: Row | Row[]) {
        pendingInsert = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      update(patch: Row) {
        pendingUpdate = patch;
        return builder;
      },
      single() {
        const { data, error } = settle();
        const arr = (data ?? []) as Row[];
        return Promise.resolve({ data: arr[0] ?? null, error });
      },
      maybeSingle() {
        const { data, error } = settle();
        const arr = (data ?? []) as Row[];
        return Promise.resolve({ data: arr[0] ?? null, error });
      },
      // Awaiting the builder (no .single()) resolves to the array result.
      then(res: (v: { data: unknown; error: unknown }) => unknown, rej?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(settle()).then(res, rej);
        } catch (e) {
          return rej ? Promise.resolve(rej(e)) : Promise.reject(e);
        }
      },
    };
    return builder;
  }

  const client = { from } as unknown as SupabaseClient;

  return {
    client,
    writes,
    writesTo(table: string, op?: "insert" | "update") {
      return writes.filter((w) => w.table === table && (op ? w.op === op : true));
    },
  };
}
