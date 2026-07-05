#!/bin/bash
# Publish GymTracker APK to GitHub Releases (direct download for anyone)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/app.json').expo.version")
APK_SRC="${1:-$ROOT/releases/GymTracker-v${VERSION}.apk}"
TAG="v${VERSION}"
REPO="HarshGupta-1708/GymTracker"

if [ ! -f "$APK_SRC" ]; then
  echo "APK not found: $APK_SRC"
  echo "Usage: ./scripts/publish-apk-release.sh [path/to/app.apk]"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Login first: gh auth login"
  exit 1
fi

ASSET_NAME="GymTracker-${TAG}.apk"
TMP=$(mktemp -d)
cp "$APK_SRC" "$TMP/$ASSET_NAME"

echo "Publishing $TAG to $REPO ..."
gh release create "$TAG" "$TMP/$ASSET_NAME" \
  --repo "$REPO" \
  --title "GymTracker ${TAG} — AI Coach" \
  --notes "$(cat <<EOF
## Install (Android)
1. Download **${ASSET_NAME}** below
2. Open on your phone → Install
3. Sign in with **Google** (same account keeps your workout history)

## What's new in ${TAG}
- AI Coach tab (personal trainer from your logs)
- 6 gym themes
- Exercise edit/delete, cloud backup
- Google Sign-In fix for APK builds

## Direct download link
https://github.com/${REPO}/releases/download/${TAG}/${ASSET_NAME}
EOF
)" 2>/dev/null || gh release upload "$TAG" "$TMP/$ASSET_NAME" --repo "$REPO" --clobber

rm -rf "$TMP"

echo ""
echo "Done! Share this link:"
echo "https://github.com/${REPO}/releases/latest"
echo "Direct APK:"
echo "https://github.com/${REPO}/releases/download/${TAG}/${ASSET_NAME}"
