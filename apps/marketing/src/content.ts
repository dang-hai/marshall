export const downloadPlaceholderHref = "#download";
export const bookCallPlaceholderHref = "#book-call";

export type Scenario = {
  label: string;
  example: string;
};

export type StorySection = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  prompt: string;
  scenarios: Scenario[];
};

export type IntegrationService = {
  name: string;
  slug:
    | "google-calendar"
    | "notion-calendar"
    | "notion"
    | "slack"
    | "attio"
    | "teams"
    | "email"
    | "google-meet"
    | "zoom";
};

export type IntegrationGroup = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  services: IntegrationService[];
};

export const heroSignals = ["Spots drift", "Flags open questions", "Tracks owners"];

export const storySections: StorySection[] = [
  {
    id: "ambient",
    eyebrow: "Ambient",
    title: "Ready when you are.",
    description: "A quiet nudge appears before your call. One click to start with the plan loaded.",
    prompt: "Customer sync in 2 min",
    scenarios: [
      {
        label: "Sales call",
        example: "Notifies you 5 min before, with account context pre-loaded.",
      },
      { label: "Team sync", example: "Reminds you standup is starting, with yesterday's actions." },
      { label: "Client meeting", example: "Alerts you before QBR, health score visible." },
    ],
  },
  {
    id: "purpose",
    eyebrow: "Purpose",
    title: "Know the goal before you start.",
    description: "Marshall drafts the decisions to make and context to gather. You start aligned.",
    prompt: "Goal: agree on pricing owner",
    scenarios: [
      { label: "Strategy", example: 'Shows: "Leave with Q3 owners assigned."' },
      { label: "Deal review", example: 'Shows: "Unblock legal by end of call."' },
      { label: "Planning", example: 'Shows: "Confirm launch date and DRI."' },
    ],
  },
  {
    id: "focus",
    eyebrow: "Focus",
    title: "Stay on track.",
    description:
      "When conversation drifts, Marshall suggests parking it and getting back to the goal.",
    prompt: "Drifted 4 min. Park this?",
    scenarios: [
      { label: "Off-topic", example: "Flags when side conversations go past 3 minutes." },
      { label: "Rabbit hole", example: "Suggests tabling deep-dives for a follow-up." },
      { label: "Tangent", example: "Offers to save the thread and refocus." },
    ],
  },
  {
    id: "context",
    eyebrow: "Context",
    title: "Facts at your fingertips.",
    description:
      "Reference a doc, thread, or data point — Marshall pulls it up without breaking flow.",
    prompt: "Q2 memo pulled",
    scenarios: [
      { label: "Internal doc", example: "Surfaces the pricing memo when pricing comes up." },
      { label: "Past thread", example: "Finds the Slack convo where you made the decision." },
      { label: "Market data", example: "Pulls competitor pricing from the web." },
    ],
  },
  {
    id: "follow-up",
    eyebrow: "Follow-up",
    title: "Next steps, not loose ends.",
    description: "Marshall drafts the follow-up meeting with attendees and agenda. Ready to send.",
    prompt: "Security review scheduled",
    scenarios: [
      { label: "Meeting needed", example: "Drafts invite with attendees and agenda pre-filled." },
      { label: "Task assigned", example: "Creates action item with owner and due date." },
      { label: "Escalation", example: "Suggests who else needs to be looped in." },
    ],
  },
  {
    id: "summary",
    eyebrow: "Share",
    title: "Decisions captured. Team informed.",
    description: "A clean recap goes to Slack, email, or your workspace before momentum fades.",
    prompt: "3 decisions, 2 owners, shared",
    scenarios: [
      { label: "Team update", example: "Posts recap to your team channel in one click." },
      { label: "Stakeholders", example: "Emails summary to people who weren't on the call." },
      { label: "Documentation", example: "Saves decisions to Notion or your wiki." },
    ],
  },
];

export const integrationGroups: IntegrationGroup[] = [
  {
    id: "calendar-sync",
    eyebrow: "Calendar sync",
    title: "Marshall stays ahead of your next call.",
    description:
      "Starting with Google Calendar and Notion Calendar, Marshall tracks upcoming calls and helps you schedule follow-up calls before momentum drops.",
    services: [
      { name: "Google Calendar", slug: "google-calendar" },
      { name: "Notion Calendar", slug: "notion-calendar" },
      { name: "Google Meet", slug: "google-meet" },
      { name: "Zoom", slug: "zoom" },
    ],
  },
  {
    id: "follow-up-channels",
    eyebrow: "Follow-up channels",
    title: "Follow-ups land in the tools your team already checks.",
    description:
      "Marshall integrates with Notion, Slack, Attio, Teams, and email so you can follow up with colleagues and share updates without changing your workflow.",
    services: [
      { name: "Notion", slug: "notion" },
      { name: "Slack", slug: "slack" },
      { name: "Teams", slug: "teams" },
    ],
  },
];

export const mobileAppNote = "The mobile app is coming soon.";

export const ambientPrompts = [
  { type: "nudge", text: "Who owns the go-to-market checklist?" },
  { type: "drift", text: "You've been on contractor policy for 3 minutes." },
  { type: "decision", text: "Ship date confirmed: April 15" },
];

export const transcriptLines = [
  { speaker: "Sarah", text: "Let's finalize the launch date.", align: "left" },
  { speaker: "Marcus", text: "April 15th works for me.", align: "right" },
  { speaker: "Dev", text: "Oh, did anyone see that HR email?", align: "left", drift: true },
  { speaker: "Marcus", text: "Who owns the checklist?", align: "right" },
];

export const beforeAfter = {
  before: "Meeting ended. What did we decide?",
  after: "Ship April 15. Marcus owns launch. Alicia on press.",
};
