# App screenshots

Add 3–6 phone screenshots here for the GitHub README.

## Recommended files

| File | Screen |
|------|--------|
| `login.png` | Login / sign-in |
| `dashboard.png` | Dashboard |
| `today.png` | Today workout |
| `history.png` | History |
| `progress.png` | Progress charts |
| `coach.png` | AI Coach tab (optional) |

## How to add photos from your phone

### 1. Take or pick screenshots on your phone
Use real app screens (dark theme looks best).

### 2. Transfer to your Mac
- **AirDrop** — select photos → AirDrop to Mac → save to Desktop
- **Google Drive / WhatsApp** — upload from phone, download on Mac
- **USB cable** — copy from phone’s DCIM/Screenshots folder

### 3. Rename and resize (optional)
```bash
cd /Users/harshgupta1708/Desktop/GymTracker/docs/screenshots
# Copy your files here with the names above, e.g.:
# cp ~/Desktop/IMG_1234.png today.png
```

Keep width around **400–600px** for README (phone aspect ratio). Preview:
```bash
open today.png
```

### 4. Commit and push
```bash
cd /Users/harshgupta1708/Desktop/GymTracker
git add docs/screenshots/*.png
git commit -m "Add app screenshots for README"
git push origin master
```

### 5. README updates automatically
Once files exist, README shows them in the Screenshots section.

## Tips for a professional look
- Use the same theme (e.g. Midnight Iron or Blood Pump)
- Crop out status bar clutter if needed
- Show real workout data (not empty states) where possible
- 4–5 images is enough; don’t overcrowd
