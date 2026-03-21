export const downloadPlaceholderHref =
  "https://github.com/dang-hai/marshall/releases/latest/download/Marshall-arm64.dmg";
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
    | "zoom"
    | "salesforce"
    | "hubspot"
    | "linear"
    | "jira"
    | "asana"
    | "monday"
    | "confluence"
    | "gmail"
    | "outlook"
    | "discord"
    | "loom"
    | "figma"
    | "github"
    | "airtable"
    | "dropbox"
    | "drive";
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

export const heroSignals = [
  "Detects when conversations go off-track",
  "Surfaces open questions before calls end",
  "Captures decisions with clear owners",
];

export const storySections: StorySection[] = [
  {
    id: "ambient",
    eyebrow: "Before the call",
    title: "Walk in prepared, not scrambling.",
    description:
      "Marshall surfaces relevant context 5 minutes before your call starts. Past decisions, open threads, account history — everything you need to hit the ground running, without digging through docs.",
    prompt: "Customer sync in 2 min",
    scenarios: [
      {
        label: "Sales call",
        example:
          "See the prospect's last objection, your proposed discount, and the stakeholder map — all before you say hello.",
      },
      {
        label: "Team sync",
        example:
          "Yesterday's blockers, this week's commitments, and who's waiting on what — loaded automatically.",
      },
      {
        label: "Client meeting",
        example:
          "Account health, renewal date, and the last three support tickets — context that makes you look prepared.",
      },
    ],
  },
  {
    id: "purpose",
    eyebrow: "Set the agenda",
    title: "Every call should have a goal. Marshall makes sure it does.",
    description:
      "Based on the invite, past conversations, and pending decisions, Marshall suggests what this call should accomplish. No more 'so what are we here to discuss?'",
    prompt: "Goal: agree on pricing owner",
    scenarios: [
      {
        label: "Strategy",
        example: "Suggests: 'Leave with Q3 initiative owners assigned and timeline confirmed.'",
      },
      {
        label: "Deal review",
        example: "Suggests: 'Resolve the legal blocker or escalate to VP by end of call.'",
      },
      {
        label: "Planning",
        example: "Suggests: 'Confirm launch date and identify the single DRI.'",
      },
    ],
  },
  {
    id: "focus",
    eyebrow: "During the call",
    title: "Conversations drift. Marshall notices so you don't have to.",
    description:
      "When the discussion veers off-topic for more than a few minutes, Marshall gently flags it. Park the tangent, capture it for later, and get back to what matters.",
    prompt: "Drifted 4 min. Park this?",
    scenarios: [
      {
        label: "Off-topic",
        example:
          "Someone brings up an unrelated project. Marshall notes it and suggests: 'Worth its own meeting?'",
      },
      {
        label: "Rabbit hole",
        example:
          "A technical deep-dive is eating time. Marshall offers to capture the thread and schedule a follow-up.",
      },
      {
        label: "Tangent",
        example:
          "The conversation spirals into history. Marshall saves the context and prompts: 'Back to the decision?'",
      },
    ],
  },
  {
    id: "context",
    eyebrow: "Instant recall",
    title: "Never say 'I'll have to find that and get back to you.'",
    description:
      "When someone mentions a doc, a past decision, or a data point, Marshall surfaces it in seconds. Stay in flow. Keep the momentum.",
    prompt: "Q2 memo pulled",
    scenarios: [
      {
        label: "Internal doc",
        example:
          "Someone asks about the pricing rationale. Marshall pulls up the strategy memo before you finish the sentence.",
      },
      {
        label: "Past thread",
        example:
          "Who approved that change? Marshall finds the Slack thread where the decision was made.",
      },
      {
        label: "Market data",
        example:
          "Competitor just raised prices. Marshall pulls recent coverage so you can respond with facts.",
      },
    ],
  },
  {
    id: "follow-up",
    eyebrow: "After the call",
    title: "Turn 'let's find time' into a calendar invite in seconds.",
    description:
      "When someone suggests a follow-up meeting, Marshall drafts the invite with the right attendees, a clear agenda, and proposed times. One click to send.",
    prompt: "Security review scheduled",
    scenarios: [
      {
        label: "Meeting needed",
        example:
          "Legal review mentioned? Marshall drafts an invite with Legal, Engineering, and a clear ask.",
      },
      {
        label: "Task assigned",
        example:
          "Action item captured with owner, due date, and context — pushed to your task manager automatically.",
      },
      {
        label: "Escalation",
        example:
          "Decision needs executive input. Marshall suggests who to loop in and drafts the ask.",
      },
    ],
  },
  {
    id: "summary",
    eyebrow: "Share outcomes",
    title: "Decisions shouldn't live in someone's memory.",
    description:
      "Within minutes of hanging up, Marshall sends a clean summary to the people who need it. Decisions, owners, next steps — captured and shared before anyone forgets.",
    prompt: "3 decisions, 2 owners, shared",
    scenarios: [
      {
        label: "Team update",
        example:
          "A structured recap hits your team Slack channel. No one asks 'what did we decide?'",
      },
      {
        label: "Stakeholders",
        example:
          "Executives who weren't on the call get a one-paragraph summary with the key outcome.",
      },
      {
        label: "Documentation",
        example: "Decisions flow into Notion, Confluence, or your wiki — searchable forever.",
      },
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

// All integrations for the grid display
export const allIntegrations: IntegrationService[] = [
  { name: "Google Calendar", slug: "google-calendar" },
  { name: "Slack", slug: "slack" },
  { name: "Notion", slug: "notion" },
  { name: "Zoom", slug: "zoom" },
  { name: "Google Meet", slug: "google-meet" },
  { name: "Teams", slug: "teams" },
  { name: "Salesforce", slug: "salesforce" },
  { name: "HubSpot", slug: "hubspot" },
  { name: "Linear", slug: "linear" },
  { name: "Jira", slug: "jira" },
  { name: "Asana", slug: "asana" },
  { name: "Gmail", slug: "gmail" },
  { name: "Outlook", slug: "outlook" },
  { name: "Confluence", slug: "confluence" },
  { name: "Notion Calendar", slug: "notion-calendar" },
  { name: "Monday", slug: "monday" },
  { name: "Discord", slug: "discord" },
  { name: "Loom", slug: "loom" },
  { name: "Figma", slug: "figma" },
  { name: "GitHub", slug: "github" },
  { name: "Airtable", slug: "airtable" },
  { name: "Dropbox", slug: "dropbox" },
  { name: "Google Drive", slug: "drive" },
  { name: "Attio", slug: "attio" },
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
