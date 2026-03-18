#!/usr/bin/env python3
"""Generate the Marshall "How it works" illustrations with Gemini Pro Image."""

import argparse
import base64
import os
import sys
from pathlib import Path


def load_dotenv() -> None:
    env_paths = [
        Path.cwd() / ".env",
        Path.cwd() / ".env.local",
        Path(__file__).resolve().parent.parent / ".env",
        Path(__file__).resolve().parent.parent / ".env.local",
    ]

    for env_path in env_paths:
        if not env_path.exists():
            continue

        with env_path.open() as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue

                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"\''))


load_dotenv()

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Installing google-genai...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "google-genai"])
    from google import genai
    from google.genai import types


MODEL = "gemini-3-pro-image-preview"
OUTPUT_DIR = (
    Path(__file__).resolve().parent.parent
    / "apps"
    / "marketing"
    / "public"
    / "images"
    / "how-it-works"
)

STYLE_GUIDE = """
Create a polished product-marketing rendering of a single Marshall UI component.
The product aesthetic is warm, calm, and premium: soft cream and sand backgrounds,
subtle charcoal typography, muted olive accents, delicate shadows, and gentle glassmorphism.
Show realistic English UI copy with clear hierarchy and believable details.
The image should feel like a designed product screenshot, not an illustration poster.
Avoid purple palettes, cluttered dashboards, stock-photo people, comic styling, or fantasy visuals.
Keep the composition simple and focused on one primary UI surface with a desktop context when helpful.
"""

SCENARIOS = [
    {
        "id": "ambient",
        "filename": "ambient-call-start.png",
        "prompt": """
Render a macOS desktop scene with a minimal Marshall notification appearing in the top-right corner.
The notification is unobtrusive and elegant. It says "Customer sync", "Starts in 2 min",
and has a single dark pill button labeled "Start call". Include subtle context like a calm desktop,
menu bar, and a call app in the background, but keep the focus on the floating start prompt.
The component should communicate that Marshall quietly appears right before a call begins.
""",
    },
    {
        "id": "purpose",
        "filename": "purpose-call-plan.png",
        "prompt": """
Render a pre-call planning panel for Marshall.
Show a clear call purpose at the top: "Renewal strategy sync".
Include sections for "Primary goal", "Decisions to make", and "Context to pull".
The realistic content should include a goal about aligning on renewal blockers,
a decision about pricing ownership, and references to internal docs.
This should feel like AI helped the user structure the call before anyone started talking.
""",
    },
    {
        "id": "focus",
        "filename": "focus-refocus.png",
        "prompt": """
Render a live in-call focus nudge from Marshall layered over a video meeting.
The meeting has drifted off topic. The Marshall card should say that the conversation
has spent several minutes on procurement policy and suggest parking that topic so the room
can return to onboarding blockers. Include a graceful action like "Park this topic".
The UI should make it obvious that the assistant helps refocus the call without being aggressive.
""",
    },
    {
        "id": "context",
        "filename": "context-retrieval.png",
        "prompt": """
Render a Marshall context panel that appears during a call after several references were mentioned.
Show three compact columns or cards for company docs, communication channels, and the web.
Use realistic content such as a "Q2 packaging memo", a "#sales-escalations" thread,
and a competitor pricing update. The panel should summarize each source clearly so the user
can answer questions without leaving the meeting.
""",
    },
    {
        "id": "follow-up",
        "filename": "follow-up-orchestration.png",
        "prompt": """
Render a Marshall follow-up assistant panel after a call.
Show a drafted calendar invite for a security review follow-up meeting,
an agenda section, and a list of recommended stakeholders who should attend or be informed.
Use realistic content, concise layout, and premium productivity-app styling.
The essence should be that Marshall turns loose ends into the next concrete action.
""",
    },
    {
        "id": "summary",
        "filename": "share-summary.png",
        "prompt": """
Render a post-call summary composer for Marshall.
Show crisp sections for decisions, owners, one open risk, and a share destination list.
Use realistic content from a customer-facing work call, and make the panel feel ready
to post into Slack, email, or an internal workspace. This should clearly communicate that
Marshall captures what was decided and helps share it broadly.
""",
    },
]


def save_image_part(part: object, output_path: Path) -> bool:
    inline_data = getattr(part, "inline_data", None)
    if inline_data is None:
        return False

    payload = getattr(inline_data, "data", None)
    if payload is None:
        return False

    if isinstance(payload, str):
        image_bytes = base64.b64decode(payload)
    else:
        image_bytes = payload

    output_path.write_bytes(image_bytes)
    return True


def build_prompt(scenario_prompt: str) -> str:
    return f"{STYLE_GUIDE.strip()}\n\n{scenario_prompt.strip()}"


def extract_parts(response: object) -> list[object]:
    response_parts = getattr(response, "parts", None)
    if response_parts:
        return list(response_parts)

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None)
        if parts:
            return list(parts)

    return []


def generate_image(client: "genai.Client", scenario: dict[str, str]) -> Path:
    output_path = OUTPUT_DIR / scenario["filename"]
    prompt = build_prompt(scenario["prompt"])

    response = client.models.generate_content(
        model=MODEL,
        contents=[prompt],
        config=types.GenerateContentConfig(
            response_modalities=[types.Modality.IMAGE],
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
            image_config=types.ImageConfig(
                aspect_ratio="16:9",
            ),
        ),
    )

    for part in extract_parts(response):
        if save_image_part(part, output_path):
            return output_path

    raise RuntimeError(f"No image was returned for scenario '{scenario['id']}'.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate the Marshall marketing how-it-works illustrations.",
    )
    parser.add_argument(
        "scenarios",
        nargs="*",
        help="Optional scenario ids to generate. Defaults to all.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Missing GEMINI_API_KEY or GOOGLE_API_KEY.")
        print("Set one in your shell or in .env.local, then rerun this script.")
        return 1

    requested = set(args.scenarios)
    scenarios = [
        scenario for scenario in SCENARIOS if not requested or scenario["id"] in requested
    ]

    if not scenarios:
        print("No matching scenarios found.")
        print("Available ids:", ", ".join(scenario["id"] for scenario in SCENARIOS))
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    client = genai.Client(api_key=api_key)

    print(f"Using model: {MODEL}")
    print(f"Writing images to: {OUTPUT_DIR}")

    for scenario in scenarios:
        print(f"\nGenerating {scenario['id']}...")
        output_path = generate_image(client, scenario)
        print(f"Saved {output_path}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
