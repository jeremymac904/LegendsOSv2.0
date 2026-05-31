// LegendsOS v2 — Loan Memory test entrypoint.
// Imports all test modules (their `test(...)` calls register cases) then runs.
//
//   npx tsx tests/loan-memory/run.ts
//
// Exit code is non-zero if any case fails.

import "./loanMemory.test";
import { run } from "./harness";

run();
