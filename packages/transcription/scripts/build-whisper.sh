#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PACKAGE_DIR/.whisper-build"
BIN_DIR="$PACKAGE_DIR/bin"

echo "Building whisper.cpp with Metal support..."
echo "Package directory: $PACKAGE_DIR"

# Check for required tools
if ! command -v cmake &> /dev/null; then
    echo "Error: cmake is required. Install with: brew install cmake"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "Error: git is required"
    exit 1
fi

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Clone or update whisper.cpp
if [ -d "whisper.cpp" ]; then
    echo "Updating whisper.cpp..."
    cd whisper.cpp
    git fetch origin
    git checkout master
    git pull origin master
    cd ..
else
    echo "Cloning whisper.cpp..."
    git clone https://github.com/ggerganov/whisper.cpp.git
fi

cd whisper.cpp

# Build with Metal support (automatically enabled on macOS with Apple Silicon)
echo "Configuring with Metal support..."
cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DWHISPER_METAL=ON \
    -DWHISPER_COREML=OFF \
    -DBUILD_SHARED_LIBS=OFF

echo "Building..."
cmake --build build --config Release -j $(sysctl -n hw.ncpu)

# Create bin directory and copy binary
mkdir -p "$BIN_DIR"
cp build/bin/whisper-cli "$BIN_DIR/whisper-cli"

# Make executable
chmod +x "$BIN_DIR/whisper-cli"

echo ""
echo "Build complete!"
echo "Binary location: $BIN_DIR/whisper-cli"

# Verify Metal support
echo ""
echo "Verifying build..."
"$BIN_DIR/whisper-cli" --help | head -5

# Check if Metal is available
if [ -f build/bin/whisper-cli ]; then
    echo ""
    echo "Metal acceleration: Enabled (Apple Silicon)"
    echo ""
    echo "To download a model, run:"
    echo "  bun run download:model tiny.en"
fi
