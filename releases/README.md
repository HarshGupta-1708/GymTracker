# APK downloads

APK files are **not stored in git** (too large). They are published on **GitHub Releases**.

## Direct download (after release is published)

**Latest:** https://github.com/HarshGupta-1708/GymTracker/releases/latest

**v1.2.1:** https://github.com/HarshGupta-1708/GymTracker/releases/download/v1.2.1/GymTracker-v1.2.1.apk

## Publish a new APK

See [docs/APK_BUILD_AND_RELEASE.md](../docs/APK_BUILD_AND_RELEASE.md) or run:

```bash
chmod +x scripts/publish-apk-release.sh
gh auth login
./scripts/publish-apk-release.sh releases/GymTracker-v1.2.1.apk
```
