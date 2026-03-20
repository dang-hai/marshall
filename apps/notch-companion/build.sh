#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Building NotchCompanion..."

# Build for both architectures
swift build -c release --arch arm64
swift build -c release --arch x86_64

# Create universal binary
mkdir -p .build/release
lipo -create \
  .build/arm64-apple-macosx/release/NotchCompanion \
  .build/x86_64-apple-macosx/release/NotchCompanion \
  -output .build/release/NotchCompanion

# Output location
echo "Build complete: .build/release/NotchCompanion (universal binary)"
file .build/release/NotchCompanion
