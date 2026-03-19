#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PACKAGE_DIR/.whisper-build"
WHISPER_CPP_DIR="$BUILD_DIR/whisper.cpp"
MODELS_DIR="${HOME}/.marshall/models"
VENV_DIR="$BUILD_DIR/.coreml-venv"

# Default model if none specified
MODEL_NAME="${1:-base.en}"

echo "Generating CoreML model for: $MODEL_NAME"
echo ""

# Check if whisper.cpp is built
if [ ! -d "$WHISPER_CPP_DIR" ]; then
    echo "Error: whisper.cpp not found. Run 'bun run build:whisper' first."
    exit 1
fi

# Verify xcode-select
if ! xcode-select -p &> /dev/null; then
    echo ""
    echo "Error: Xcode command-line tools not found."
    echo "Run: xcode-select --install"
    exit 1
fi

# Find Python 3.11+ (required for CoreML tools compatibility)
PYTHON_BIN=""
for py in python3.13 python3.12 python3.11; do
    if command -v "$py" &> /dev/null; then
        PYTHON_BIN="$py"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "Error: Python 3.11+ is required for CoreML model generation."
    echo "Install via Homebrew: brew install python@3.12"
    exit 1
fi

# Create or reuse virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating Python virtual environment for CoreML..."
    "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

PYTHON_VERSION=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Using Python $PYTHON_VERSION (venv)"

# Install required Python packages in venv
echo ""
echo "Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install --quiet ane_transformers openai-whisper coremltools

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"

# Generate CoreML model
echo ""
echo "Generating CoreML encoder model..."
echo "This may take several minutes..."
echo ""

cd "$WHISPER_CPP_DIR"

# Run the whisper.cpp CoreML generation script
./models/generate-coreml-model.sh "$MODEL_NAME"

# The script generates models/ggml-{model}-encoder.mlmodelc
COREML_MODEL_DIR="$WHISPER_CPP_DIR/models/ggml-${MODEL_NAME}-encoder.mlmodelc"

if [ ! -d "$COREML_MODEL_DIR" ]; then
    echo "Error: CoreML model was not generated at $COREML_MODEL_DIR"
    exit 1
fi

# Copy to the Marshall models directory
DEST_DIR="$MODELS_DIR/ggml-${MODEL_NAME}-encoder.mlmodelc"

echo ""
echo "Copying CoreML model to $DEST_DIR..."

# Remove existing if present
if [ -d "$DEST_DIR" ]; then
    rm -rf "$DEST_DIR"
fi

cp -R "$COREML_MODEL_DIR" "$DEST_DIR"

echo ""
echo "CoreML model generated successfully!"
echo ""
echo "Model location: $DEST_DIR"
echo ""
echo "whisper-cli will automatically use CoreML acceleration when:"
echo "  - The CoreML encoder (.mlmodelc) is in the same directory as the model"
echo "  - Running on Apple Silicon with macOS Sonoma (14+)"
echo ""
echo "Expected speedup: ~3x faster than CPU-only inference"
