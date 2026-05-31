// LegendsOS v2 — zero-dependency test harness.
// The repo has no JS unit-test runner configured (only Playwright e2e + tsc).
// Rather than add a heavy dependency, these loan-memory unit tests run under
// `tsx` (already a devDependency) using this tiny harness. It collects async
// test cases, runs them, prints a TAP-ish summary, and sets a non-zero exit
// code on failure so CI can gate on it.

type TestFn = () => void | Promise<void>;

interface Case {
  name: string;
  fn: TestFn;
}

const cases: Case[] = [];

export function test(name: string, fn: TestFn): void {
  cases.push({ name, fn });
}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

export function assertIncludes(haystack: string, needle: string, message: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`${message}\n  string did not include: ${JSON.stringify(needle)}\n  full: ${JSON.stringify(haystack)}`);
  }
}

export async function run(): Promise<void> {
  let passed = 0;
  const failures: { name: string; err: unknown }[] = [];
  for (const c of cases) {
    try {
      await c.fn();
      passed += 1;
      // eslint-disable-next-line no-console
      console.log(`ok   - ${c.name}`);
    } catch (err) {
      failures.push({ name: c.name, err });
      // eslint-disable-next-line no-console
      console.log(`FAIL - ${c.name}`);
      // eslint-disable-next-line no-console
      console.log(`       ${(err as Error)?.message ?? String(err)}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\n${passed}/${cases.length} passed${failures.length ? `, ${failures.length} failed` : ""}.`);
  if (failures.length) process.exitCode = 1;
}
