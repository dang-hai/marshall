#!/usr/bin/env python3
"""
Complete pipeline to create a magical, surreal San Francisco skyline video.

This script:
1. Generates a surreal painted image of the SF skyline using Gemini Imagen 3
2. Animates it with Veo 2, adding birds, planes, clouds, and magical details
"""

import os
import sys
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from generate_sf_skyline import generate_sf_skyline_image
from generate_sf_video import generate_video_from_image, generate_video_text_to_video


def create_magical_sf_video():
    """Run the complete pipeline to create the magical SF skyline video."""

    print("=" * 70)
    print("  MAGICAL SAN FRANCISCO SKYLINE VIDEO GENERATOR")
    print("  Creating a surreal, painted dreamscape of the city by the bay")
    print("=" * 70)
    print()

    # Check for API key
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("ERROR: No API key found!")
        print()
        print("Please set your Gemini API key:")
        print("  export GEMINI_API_KEY='your-api-key-here'")
        print()
        print("Get your API key from: https://aistudio.google.com/apikey")
        print()
        print("Note: You need access to Imagen 3 and Veo 2 models.")
        print("These may require a paid plan or specific access permissions.")
        return None

    # Step 1: Generate the surreal painted image
    print("STEP 1: Generating surreal painted San Francisco skyline...")
    print("-" * 70)

    try:
        image_path = generate_sf_skyline_image()
        if not image_path:
            print("Image generation failed. Trying text-to-video fallback...")
            return generate_video_text_to_video()
    except Exception as e:
        print(f"Image generation error: {e}")
        print("Trying text-to-video fallback...")
        return generate_video_text_to_video()

    print()
    print("STEP 2: Animating the scene with magical elements...")
    print("-" * 70)
    print("Adding: Birds circling towers, planes flying by, clouds drifting,")
    print("        fog flowing, bay shimmering, and twilight magic...")
    print()

    # Step 2: Generate the animated video
    try:
        video_path = generate_video_from_image(image_path)
    except Exception as e:
        print(f"Video generation error: {e}")
        print("Trying text-to-video as fallback...")
        video_path = generate_video_text_to_video()

    print()
    print("=" * 70)

    if video_path:
        print("  SUCCESS!")
        print()
        print(f"  Your magical San Francisco skyline video is ready:")
        print(f"  {video_path}")
        print()
        print("  The scene features:")
        print("  - A hawk gracefully circling the Transamerica Pyramid")
        print("  - Seagulls gliding through the golden hour light")
        print("  - An airplane crossing the twilight sky")
        print("  - Clouds drifting and fog flowing through valleys")
        print("  - Shimmering bay waters reflecting the magic")
        print("  - Stars emerging as day transitions to dream")
    else:
        print("  Video generation was not successful.")
        print("  Please check your API key permissions and try again.")

    print("=" * 70)

    return video_path


if __name__ == "__main__":
    create_magical_sf_video()
