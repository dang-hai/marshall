#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Building NotchCompanion..."

# Build for release
swift build -c release

# Output location
echo "Build complete: .build/release/NotchCompanion"
