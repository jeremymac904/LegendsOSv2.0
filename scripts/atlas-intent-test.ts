// Atlas intent detection — deterministic unit-style smoke test.
//
// Runs the regex classifier directly from compiled `lib/atlas/intentDetection`
// without hitting the network. Used by Chief Integrator to prove the new
// capability_query + create_knowledge_note intents stay correctly classified
// alongside the existing create_social / create_email / create_calendar
// patterns.
//
// Usage: `node --import tsx scripts/atlas-intent-test.mjs` (tsx is already a
// dev dep). Exits 0 on full pass, 1 with a JSON diff on first failure.
import {
  detectAtlasIntent,
  type AtlasIntentKind,
  type SocialChannelLite,
} from "../lib/atlas/intentDetection";

interface Case {
  msg: string;
  expect: AtlasIntentKind;
  titleContains?: string;
  collectionHint?: string;
  channels?: SocialChannelLite[];
}

const cases: Case[] = [
  // --- capability_query --------------------------------------------------
  { msg: "what can you do?", expect: "capability_query" },
  { msg: "What can you do", expect: "capability_query" },
  { msg: "what tools do you have?", expect: "capability_query" },
  { msg: "show your capabilities", expect: "capability_query" },
  { msg: "list available tools", expect: "capability_query" },
  { msg: "Atlas, what can you do?", expect: "capability_query" },

  // --- create_knowledge_note --------------------------------------------
  {
    msg: "save a note about FHA loan limits",
    expect: "create_knowledge_note",
    titleContains: "FHA loan limits",
  },
  {
    msg: "save this to my knowledge: VA loans require zero down",
    expect: "create_knowledge_note",
  },
  { msg: "remember that DTI cap is 50% on FHA", expect: "create_knowledge_note" },
  { msg: "note: refi rates dropped today", expect: "create_knowledge_note" },
  {
    msg: "save a knowledge note about Q2 marketing playbook in Marketing",
    expect: "create_knowledge_note",
    collectionHint: "Marketing",
  },

  // --- create_social (regressions) --------------------------------------
  {
    msg: "draft a Facebook post about FHA limits",
    expect: "create_social",
    channels: ["facebook"],
  },
  {
    msg: "Post to Instagram about the new Vegas listing",
    expect: "create_social",
    channels: ["instagram"],
  },
  {
    msg: "Create a YouTube post about market updates",
    expect: "create_social",
    channels: ["youtube"],
  },

  // --- create_email (regressions) ---------------------------------------
  { msg: "Write a newsletter about refi options", expect: "create_email" },
  { msg: "Draft an email campaign about rate cuts", expect: "create_email" },

  // --- create_calendar (regressions) ------------------------------------
  { msg: "Schedule team standup on Monday", expect: "create_calendar" },
  { msg: "Add to my calendar coffee with Ana tomorrow", expect: "create_calendar" },

  // --- none (regression: chat-style messages) ---------------------------
  { msg: "What's the median DTI on FHA loans?", expect: "none" },
  { msg: "Tell me about VA loan eligibility", expect: "none" },
  { msg: "Hello Atlas", expect: "none" },
];

let failures = 0;
for (const c of cases) {
  const actual = detectAtlasIntent(c.msg);
  const okKind = actual.kind === c.expect;
  let okExtras = true;
  if (c.titleContains && actual.kind === "create_knowledge_note") {
    okExtras = (actual.extracted.title || "").includes(c.titleContains);
  }
  if (c.collectionHint && actual.kind === "create_knowledge_note") {
    okExtras = okExtras && actual.extracted.collection_hint === c.collectionHint;
  }
  if (c.channels && actual.kind === "create_social") {
    const got = actual.extracted.channels || [];
    okExtras =
      okExtras &&
      c.channels.every((ch) => got.includes(ch));
  }
  const ok = okKind && okExtras;
  const status = ok ? "PASS" : "FAIL";
  console.log(
    `${status}  ${c.msg.padEnd(60)} -> kind=${actual.kind}` +
      (actual.kind === "create_knowledge_note"
        ? ` title="${actual.extracted.title}" hint=${actual.extracted.collection_hint ?? "null"}`
        : actual.kind === "create_social"
        ? ` channels=${JSON.stringify(actual.extracted.channels)}`
        : "")
  );
  if (!ok) {
    failures += 1;
    console.error(
      "  expected:",
      JSON.stringify({
        kind: c.expect,
        titleContains: c.titleContains,
        collectionHint: c.collectionHint,
        channels: c.channels,
      })
    );
    console.error("  actual:  ", JSON.stringify(actual));
  }
}

if (failures > 0) {
  console.error(`\n${failures} / ${cases.length} cases failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} intent cases passed.`);
