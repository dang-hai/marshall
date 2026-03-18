#!/usr/bin/env python3
"""
Generate a surreal painted image of the San Francisco skyline using Google Gemini's Imagen 3.
"""

import os
import base64
from datetime import datetime
from pathlib import Path

# Load .env file if present
def load_dotenv():
    env_paths = [
        Path(__file__).parent.parent / ".env",
        Path.home() / ".env",
    ]
    for env_path in env_paths:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        os.environ.setdefault(key.strip(), value.strip().strip('"\''))

load_dotenv()

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Installing google-genai...")
    import subprocess
    subprocess.check_call(["pip", "install", "google-genai"])
    from google import genai
    from google.genai import types


def generate_sf_skyline_image():
    """Generate a surreal painted San Francisco skyline image."""

    # Initialize the client
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError(
            "Please set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.\n"
            "Get your API key from: https://aistudio.google.com/apikey"
        )

    client = genai.Client(api_key=api_key)

    # Detailed prompt for surreal San Francisco skyline
    prompt = """
    Create a serene, ethereal oil painting of the San Francisco skyline in soft morning light.

    Style: Dreamlike, impressionistic with delicate brushwork. Light, airy palette
    dominated by whites, pale blues, soft grays, and hints of silver.
    Reminiscent of Monet's misty landscapes or Turner's luminous atmospheres.

    Color palette:
    - Predominantly white, cream, and pale ivory
    - Soft powder blues and cerulean
    - Misty grays and silver tones
    - Subtle touches of seafoam and pale aqua
    - Avoid warm tones, oranges, purples, or dramatic contrasts

    Scene elements:
    - The Transamerica Pyramid and Salesforce Tower emerging softly from morning mist
    - Golden Gate Bridge barely visible through a veil of white fog
    - Gentle, wispy clouds in pale blue and white
    - The bay reflecting silvery light, calm and glassy
    - Victorian houses in soft, muted pastels peeking through fog
    - Everything bathed in diffused, overcast morning light
    - A few seagulls floating peacefully in the pale sky
    - Soft, dreamy edges where buildings meet sky

    The mood should be peaceful, quiet, almost meditative.
    Like the city is still waking up, wrapped in a gentle blanket of marine fog.
    Light and luminous, not dramatic. Calming, not intense.

    High quality, 4K resolution, fine art painting with soft, delicate touch.
    """

    print("Generating surreal San Francisco skyline image...")
    print("This may take a moment...\n")

    # Generate image using Imagen 4
    response = client.models.generate_images(
        model="imagen-4.0-generate-001",
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="16:9",  # Cinematic aspect ratio for video
            safety_filter_level="BLOCK_LOW_AND_ABOVE",
            person_generation="DONT_ALLOW",
        )
    )

    # Create output directory
    output_dir = Path(__file__).parent.parent / "generated_media"
    output_dir.mkdir(exist_ok=True)

    # Save the image
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if response.generated_images:
        for i, generated_image in enumerate(response.generated_images):
            image_path = output_dir / f"sf_skyline_surreal_{timestamp}_{i}.png"

            # Decode and save the image
            image_data = generated_image.image.image_bytes
            with open(image_path, "wb") as f:
                f.write(image_data)

            print(f"Image saved to: {image_path}")
            return str(image_path)
    else:
        print("No images were generated. Please check the prompt or try again.")
        return None


if __name__ == "__main__":
    image_path = generate_sf_skyline_image()
    if image_path:
        print(f"\nSuccess! Image ready for video generation: {image_path}")
        print("\nNext step: Run generate_sf_video.py with this image to create the animated scene.")
