// Legends Mortgage Academy — Execution Tracker configs.
//
// Each tracker is a lightweight editable row list the LO keeps open next to
// the LOS — not a CRM. Column configs drive the generic TrackersPanel table
// (add row, edit cells, delete row, CSV export). Rows persist per tracker to
// localStorage under `legendsos:academy:tracker-<key>`.

export type TrackerColumnKind = "text" | "select" | "date" | "long";

export interface TrackerColumn {
  key: string;
  label: string;
  kind: TrackerColumnKind;
  options?: string[];
  minWidth?: string;
}

export type TrackerRow = Record<string, string>;

export interface TrackerConfig {
  key: string;
  title: string;
  /** Short tab label for the tracker switcher. */
  tab: string;
  subtitle: string;
  addLabel: string;
  csvName: string;
  columns: TrackerColumn[];
}

export const TRACKER_STORAGE_PREFIX = "legendsos:academy:tracker-";

export function trackerStorageKey(trackerKey: string): string {
  return `${TRACKER_STORAGE_PREFIX}${trackerKey}`;
}

export const trackers: TrackerConfig[] = [
  {
    key: "daily-execution",
    title: "Daily Execution Tracker",
    tab: "Daily Execution",
    subtitle:
      "One row per day — what the Power Block produced and the first move for tomorrow.",
    addLabel: "Add day",
    csvName: "daily-execution-tracker.csv",
    columns: [
      { key: "date", label: "Date", kind: "date", minWidth: "9rem" },
      { key: "focus", label: "Power Block focus", kind: "text", minWidth: "12rem" },
      { key: "conversations", label: "Real conversations", kind: "text", minWidth: "8rem" },
      { key: "followUps", label: "Follow-ups sent", kind: "text", minWidth: "8rem" },
      { key: "appointments", label: "Appointments set", kind: "text", minWidth: "8rem" },
      { key: "win", label: "Biggest win", kind: "long", minWidth: "13rem" },
      { key: "nextMove", label: "Tomorrow's first move", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "realtor-relationship",
    title: "Realtor Relationship Tracker",
    tab: "Realtor Relationships",
    subtitle:
      "A focused partner list with tiers, last touch, and a real next action for every agent.",
    addLabel: "Add partner",
    csvName: "realtor-relationship-tracker.csv",
    columns: [
      { key: "name", label: "Name", kind: "text", minWidth: "11rem" },
      {
        key: "type",
        label: "Partner type",
        kind: "select",
        options: ["Realtor", "CPA", "Builder", "Attorney", "Financial Planner", "Other"],
        minWidth: "10rem",
      },
      { key: "tier", label: "Tier", kind: "select", options: ["A", "B", "C"], minWidth: "5rem" },
      { key: "phone", label: "Phone", kind: "text", minWidth: "9rem" },
      { key: "email", label: "Email", kind: "text", minWidth: "12rem" },
      { key: "lastContact", label: "Last contact", kind: "date", minWidth: "9rem" },
      { key: "nextAction", label: "Next action", kind: "text", minWidth: "12rem" },
      { key: "notes", label: "Notes", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "deal-flow",
    title: "Deal Flow Tracker",
    tab: "Deal Flow",
    subtitle: "Every active file with its status and next action — simple, not a CRM.",
    addLabel: "Add deal",
    csvName: "deal-flow-tracker.csv",
    columns: [
      { key: "borrower", label: "Borrower / client", kind: "text", minWidth: "11rem" },
      { key: "partner", label: "Referral partner", kind: "text", minWidth: "11rem" },
      { key: "lender", label: "Lender", kind: "text", minWidth: "9rem" },
      { key: "loanType", label: "Loan type", kind: "text", minWidth: "8rem" },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: [
          "Lead",
          "Application started",
          "Pre-approved",
          "Under contract",
          "Submitted to lender",
          "Conditional approval",
          "Clear to close",
          "Closed",
          "On hold",
          "Lost",
        ],
        minWidth: "11rem",
      },
      { key: "closeDate", label: "Close date", kind: "date", minWidth: "9rem" },
      { key: "nextAction", label: "Next action", kind: "text", minWidth: "12rem" },
      { key: "notes", label: "Notes", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "follow-up",
    title: "Follow-Up Tracker",
    tab: "Follow-Up",
    subtitle:
      "Warm leads, buyers, past clients, and partner promises — every contact carries a next message and a due date.",
    addLabel: "Add contact",
    csvName: "follow-up-tracker.csv",
    columns: [
      { key: "contact", label: "Contact", kind: "text", minWidth: "11rem" },
      {
        key: "segment",
        label: "Segment",
        kind: "select",
        options: [
          "Warm lead",
          "Pre-approved buyer",
          "Past client",
          "Partner promise",
          "Database",
        ],
        minWidth: "10rem",
      },
      { key: "lastTouch", label: "Last touch", kind: "date", minWidth: "9rem" },
      { key: "dueDate", label: "Next touch due", kind: "date", minWidth: "9rem" },
      {
        key: "channel",
        label: "Channel",
        kind: "select",
        options: ["Call", "Text", "Email", "Video", "In person"],
        minWidth: "8rem",
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: ["Scheduled", "Sent", "Replied", "Booked", "Loop closed"],
        minWidth: "8rem",
      },
      { key: "nextMessage", label: "Next message", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "theme-day",
    title: "Theme Day Tracker",
    tab: "Theme Days",
    subtitle:
      "Give every day one theme, plan the actions in advance, and grade the follow-through.",
    addLabel: "Add theme day",
    csvName: "theme-day-tracker.csv",
    columns: [
      { key: "date", label: "Date", kind: "date", minWidth: "9rem" },
      {
        key: "theme",
        label: "Theme",
        kind: "select",
        options: [
          "Partner Day",
          "Follow-Up Day",
          "Content Day",
          "Database Day",
          "Pipeline Day",
          "Planning Day",
        ],
        minWidth: "10rem",
      },
      { key: "plan", label: "Planned actions", kind: "long", minWidth: "14rem" },
      {
        key: "executed",
        label: "Executed",
        kind: "select",
        options: ["Yes", "Partial", "No"],
        minWidth: "7rem",
      },
      { key: "result", label: "Standout result", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "time-block",
    title: "Time Block Tracker",
    tab: "Time Blocks",
    subtitle:
      "Protected Power Blocks, appointments, admin, and review — did the calendar hold?",
    addLabel: "Add block",
    csvName: "time-block-tracker.csv",
    columns: [
      { key: "date", label: "Date", kind: "date", minWidth: "9rem" },
      {
        key: "block",
        label: "Block",
        kind: "select",
        options: ["Power Block 1", "Power Block 2", "Appointments", "Admin", "Review"],
        minWidth: "10rem",
      },
      { key: "start", label: "Start", kind: "text", minWidth: "6rem" },
      { key: "end", label: "End", kind: "text", minWidth: "6rem" },
      { key: "focus", label: "Planned focus", kind: "text", minWidth: "12rem" },
      {
        key: "held",
        label: "Held?",
        kind: "select",
        options: ["Held", "Interrupted", "Missed"],
        minWidth: "8rem",
      },
      { key: "notes", label: "Notes", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "greatness",
    title: "Greatness Tracker",
    tab: "Greatness",
    subtitle:
      "Daily accountability for the habits behind the numbers — commitment, mindset, action, follow-through.",
    addLabel: "Add day",
    csvName: "greatness-tracker.csv",
    columns: [
      { key: "date", label: "Date", kind: "date", minWidth: "9rem" },
      { key: "commitment", label: "Today's commitment", kind: "text", minWidth: "13rem" },
      {
        key: "mindset",
        label: "Mindset",
        kind: "select",
        options: ["Locked in", "Steady", "Distracted"],
        minWidth: "8rem",
      },
      { key: "action", label: "Key action taken", kind: "text", minWidth: "13rem" },
      {
        key: "followThrough",
        label: "Follow-through",
        kind: "select",
        options: ["Done", "Partial", "Missed"],
        minWidth: "8rem",
      },
      { key: "gratitude", label: "Wins & gratitude", kind: "long", minWidth: "13rem" },
    ],
  },
  {
    key: "conversion",
    title: "Conversion Tracker",
    tab: "Conversion",
    subtitle:
      "Run the pipeline by ratios, not vibes — one row per week, one system fix per weakest handoff.",
    addLabel: "Add week",
    csvName: "conversion-tracker.csv",
    columns: [
      { key: "weekOf", label: "Week of", kind: "date", minWidth: "9rem" },
      { key: "leads", label: "Leads", kind: "text", minWidth: "6rem" },
      { key: "conversations", label: "Conversations", kind: "text", minWidth: "7rem" },
      { key: "applications", label: "Applications", kind: "text", minWidth: "7rem" },
      { key: "preApprovals", label: "Pre-approvals", kind: "text", minWidth: "7rem" },
      { key: "contracts", label: "Contracts", kind: "text", minWidth: "6rem" },
      { key: "closings", label: "Closings", kind: "text", minWidth: "6rem" },
      {
        key: "weakestHandoff",
        label: "Weakest handoff",
        kind: "select",
        options: [
          "Lead → Conversation",
          "Conversation → Application",
          "Application → Pre-approval",
          "Pre-approval → Contract",
          "Contract → Close",
        ],
        minWidth: "12rem",
      },
      { key: "systemFix", label: "System fix this week", kind: "long", minWidth: "14rem" },
    ],
  },
];
