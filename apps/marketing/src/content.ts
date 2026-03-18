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

export type LegalBlock = {
  title: string;
  points: string[];
};

export type MarketingLegalSection = {
  id: "privacy" | "terms";
  eyebrow: string;
  title: string;
  intro: string;
  effectiveDate: string;
  blocks: LegalBlock[];
  closing: string;
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

export const legalSections: MarketingLegalSection[] = [
  {
    id: "privacy",
    eyebrow: "Privacy",
    title: "Marshall is built to keep meeting context local by default.",
    intro:
      "This privacy summary covers the marketing site, the macOS app, and any demo or support conversations connected to Marshall.",
    effectiveDate: "March 18, 2026",
    blocks: [
      {
        title: "What we collect",
        points: [
          "The website may collect basic browser, device, and referral information needed to load pages, prevent abuse, and remember your privacy preferences.",
          "If you book a call, email us, or ask for support, we receive the information you choose to share with us in that conversation.",
          "The desktop app may process meeting audio, transcripts, notes, and meeting metadata on your device so Marshall can surface nudges, decisions, and follow-ups.",
        ],
      },
      {
        title: "How Marshall handles meeting data",
        points: [
          "Marshall is designed around local processing for live meeting assistance, and the site already describes the product as keeping audio on-device.",
          "Meeting content should only leave your device when a feature clearly requires it or when you deliberately share an output such as a recap, follow-up, or integration sync.",
          "If a future feature adds hosted storage or cloud processing, this page should be updated before that behavior changes.",
        ],
      },
      {
        title: "Cookies, analytics, and preferences",
        points: [
          "Essential storage is used to keep the site functioning and to remember choices such as your cookie preferences.",
          "Optional analytics and marketing tools should only run when you opt in through the privacy controls on the site.",
          "You can revisit those choices at any time through the Manage Cookies control in the footer.",
        ],
      },
      {
        title: "Sharing and retention",
        points: [
          "We may use service providers to host the site, deliver communications, or complete the integrations you explicitly connect.",
          "Shared summaries, follow-ups, or notifications are sent only to the destinations you choose, such as Slack, Notion, Teams, email, or calendar tools.",
          "Marketing-site and support information should be kept only for as long as it is useful for operating Marshall, honoring requests, and understanding product usage.",
        ],
      },
    ],
    closing:
      "Marshall should not be used with content you are not allowed to record, process, or share. Your own workplace and meeting obligations still apply.",
  },
  {
    id: "terms",
    eyebrow: "Terms",
    title: "Use Marshall with reviewable judgment, not blind trust.",
    intro:
      "These terms govern access to the Marshall website, previews, and desktop app. By using Marshall, you agree to use it responsibly and within the law.",
    effectiveDate: "March 18, 2026",
    blocks: [
      {
        title: "License and access",
        points: [
          "Marshall grants you a limited, non-exclusive, revocable license to use the product for your own internal or personal workflows.",
          "You may not resell Marshall, copy it into a competing service, reverse engineer protected parts of the product, or remove branding or legal notices.",
          "If you use Marshall on behalf of a company or team, you are responsible for making sure you have authority to do so.",
        ],
      },
      {
        title: "Responsible use",
        points: [
          "You are responsible for giving any notices or obtaining any permissions required before recording or analyzing a meeting.",
          "You may not use Marshall to break the law, violate confidentiality obligations, distribute malware, interfere with the service, or access data that is not yours.",
          "Marshall can draft nudges, summaries, and follow-ups, but you are responsible for reviewing outputs before relying on them for legal, operational, or commercial decisions.",
        ],
      },
      {
        title: "Integrations and third parties",
        points: [
          "If you connect third-party tools, you authorize Marshall to send the specific data needed to complete the action you requested.",
          "Your use of Slack, Notion, Teams, Zoom, Google Calendar, and other connected tools remains subject to those services' own terms and privacy practices.",
          "Marshall is not responsible for outages, policy changes, or data handling decisions made by third-party platforms.",
        ],
      },
      {
        title: "Availability, warranties, and limits",
        points: [
          "Marshall may change, improve, pause, or remove features at any time, especially while the product is still evolving.",
          "The product is provided on an as-is and as-available basis, without a promise that it will be uninterrupted, error-free, or fit for every workflow.",
          "To the extent permitted by law, Marshall is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the product.",
        ],
      },
    ],
    closing:
      "These terms apply until they are replaced by an updated version published on this site. Continued use after an update means you accept the revised terms.",
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
