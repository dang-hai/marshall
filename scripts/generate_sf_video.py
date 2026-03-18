#!/usr/bin/env python3
"""
Generate an animated video from the San Francisco skyline image using Google Veo 2.
Creates delightful animations with birds, planes, and moving clouds.
"""

import os
import time
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


def generate_video_from_image(image_path: str = None):
    """Generate an animated video from the surreal SF skyline image."""

    # Initialize the client
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError(
            "Please set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.\n"
            "Get your API key from: https://aistudio.google.com/apikey"
        )

    client = genai.Client(api_key=api_key)

    # Find the most recent generated image if not specified
    if not image_path:
        output_dir = Path(__file__).parent.parent / "generated_media"
        images = sorted(output_dir.glob("sf_skyline_surreal_*.png"), reverse=True)
        if images:
            image_path = str(images[0])
            print(f"Using most recent image: {image_path}")
        else:
            raise FileNotFoundError(
                "No generated skyline image found. "
                "Please run generate_sf_skyline.py first."
            )

    # Load the image
    print(f"Loading image: {image_path}")
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Animation prompt with delightful interactions
    animation_prompt = """
    Bring this surreal San Francisco skyline painting to life with magical, delightful animations:

    PRIMARY ANIMATION - The Bird's Journey:
    - A majestic hawk gracefully enters from the left side of the frame
    - It soars toward the Transamerica Pyramid, circling it twice in elegant spirals
    - The bird's wings catch the golden light as it banks and turns
    - After circling, it glides smoothly toward the horizon, getting smaller
    - The bird's shadow occasionally passes over the buildings below

    SECONDARY ANIMATIONS - Delightful Details:
    - Clouds drift slowly and organically across the sky, some swirling gently
    - The fog in the valleys shifts and flows like a slow river
    - A small flock of seagulls passes by in the mid-ground
    - A commercial airplane crosses the upper sky, leaving a soft contrail
    - The water of the bay shimmers and ripples with subtle light reflections
    - Distant lights on the Golden Gate Bridge twinkle softly
    - The sun's golden light slowly shifts, creating moving shadows on buildings

    SUBTLE MAGICAL TOUCHES:
    - Occasional sparkles of light dance around the tower tops
    - The Victorian houses seem to breathe slightly with warm interior glows
    - Stars begin to emerge in the purple portions of the sky

    CAMERA: Slight, dreamy camera movement - a very gentle push-in toward the skyline
    MOOD: Peaceful, wonder-filled, the magic of twilight in the city
    STYLE: Maintain the painterly, impressionistic quality throughout

    The animation should feel like watching a living painting, where every element
    has subtle life and movement while preserving the artistic, surreal atmosphere.
    """

    print("\nGenerating animated video...")
    print("This may take several minutes as the video is rendered...\n")

    # Upload the image first
    uploaded_image = types.RawReferenceImage(
        reference_id=1,
        reference_image=types.Image(image_bytes=image_bytes)
    )

    # Generate video using Veo 2 with image-to-video
    operation = client.models.generate_videos(
        model="veo-2.0-generate-001",
        prompt=animation_prompt,
        image=types.Image(image_bytes=image_bytes),
        config=types.GenerateVideosConfig(
            aspect_ratio="16:9",
            number_of_videos=1,
            duration_seconds=8,  # Veo 2 supports 5-8 second clips
            person_generation="DONT_ALLOW",
        )
    )

    print("Video generation started. Waiting for completion...")

    # Poll for completion
    while not operation.done:
        time.sleep(10)
        operation = client.operations.get(operation)
        print(".", end="", flush=True)

    print("\nVideo generation complete!")

    # Save the video
    output_dir = Path(__file__).parent.parent / "generated_media"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if operation.response and operation.response.generated_videos:
        for i, video in enumerate(operation.response.generated_videos):
            video_path = output_dir / f"sf_skyline_animated_{timestamp}_{i}.mp4"

            # Download and save the video
            video_data = video.video.video_bytes
            if video_data:
                with open(video_path, "wb") as f:
                    f.write(video_data)
                print(f"Video saved to: {video_path}")
                return str(video_path)
            elif hasattr(video.video, 'uri') and video.video.uri:
                # If video is returned as URI, download with API key
                print(f"Video URI: {video.video.uri}")
                import urllib.request
                download_url = f"{video.video.uri}&key={api_key}"
                urllib.request.urlretrieve(download_url, video_path)
                print(f"Video downloaded to: {video_path}")
                return str(video_path)
    else:
        print("No video was generated. Check the operation status:")
        if hasattr(operation, 'error'):
            print(f"Error: {operation.error}")
        return None


def generate_video_text_to_video():
    """
    Alternative: Generate video purely from text prompt (no input image).
    Useful if image generation fails or for a different approach.
    """

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Please set GEMINI_API_KEY or GOOGLE_API_KEY")

    client = genai.Client(api_key=api_key)

    prompt = """
    A breathtaking surreal oil painting style video of the San Francisco skyline at golden hour,
    coming to life with magical animations.

    The scene shows the Transamerica Pyramid and Salesforce Tower against a dramatic sky
    with swirling clouds in purple, orange, pink, and gold tones. The Golden Gate Bridge
    glows ethereally in the misty distance.

    A majestic hawk gracefully soars into frame from the left, its wings catching the
    golden light. It circles elegantly around the Transamerica Pyramid twice, banking
    smoothly, before gliding toward the horizon and disappearing into the distance.

    Meanwhile, clouds drift slowly across the sky, fog flows through the valleys like
    a river, a flock of seagulls passes through the mid-ground, and a commercial
    airplane crosses the upper sky leaving a soft contrail.

    The bay waters shimmer with iridescent reflections, and the Victorian houses
    on the hills seem to glow warmly. Stars begin to emerge in the purple sky.

    Style: Impressionistic, dreamlike, painterly with visible brushstrokes.
    Camera: Gentle, dreamy push-in toward the skyline.
    Mood: Peaceful wonder, the magic of twilight.
    """

    print("Generating video from text prompt...")

    operation = client.models.generate_videos(
        model="veo-2.0-generate-001",
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio="16:9",
            number_of_videos=1,
            duration_seconds=8,
            person_generation="DONT_ALLOW",
        )
    )

    while not operation.done:
        time.sleep(10)
        operation = client.operations.get(operation)
        print(".", end="", flush=True)

    print("\nComplete!")

    output_dir = Path(__file__).parent.parent / "generated_media"
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Debug: print operation result structure
    print(f"Operation result: {operation}")

    result = operation.result
    if hasattr(result, 'generated_videos') and result.generated_videos:
        for i, video in enumerate(result.generated_videos):
            video_path = output_dir / f"sf_skyline_text2video_{timestamp}_{i}.mp4"

            # Try to get video bytes
            if hasattr(video, 'video'):
                vid = video.video
                if hasattr(vid, 'video_bytes') and vid.video_bytes:
                    with open(video_path, "wb") as f:
                        f.write(vid.video_bytes)
                    print(f"Video saved to: {video_path}")
                    return str(video_path)
                elif hasattr(vid, 'uri') and vid.uri:
                    print(f"Video available at URI: {vid.uri}")
                    # Download from URI with API key authentication
                    import urllib.request
                    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
                    download_url = f"{vid.uri}&key={api_key}"
                    urllib.request.urlretrieve(download_url, video_path)
                    print(f"Video downloaded to: {video_path}")
                    return str(video_path)

    print("No video in result. Full result:")
    print(result)
    return None


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Use provided image path
        video_path = generate_video_from_image(sys.argv[1])
    else:
        # Try image-to-video first, fall back to text-to-video
        try:
            video_path = generate_video_from_image()
        except FileNotFoundError:
            print("No image found. Generating video directly from text prompt...")
            video_path = generate_video_text_to_video()

    if video_path:
        print(f"\nSuccess! Your magical San Francisco skyline video is ready!")
        print(f"Location: {video_path}")
