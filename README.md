# Disaster SOS Offline Demo

This static PWA demo is designed for emergency use when internet is unavailable but cellular network exists.

## Highlights

- Panic-first layout with large top button.
- Default panic/unknown number for testing: `+91 8700523035`.
- Guardian quick actions: `Call Guardian` and `SMS Guardian`.
- Category buttons for Fire/Flood/Earthquake/Medical.
- App requests GPS location automatically and includes coordinates in SMS.
- App stores last SOS as pending and can resend via `Send Pending SOS`.
- Works offline after first load/install.

## Run locally

```bash
cd "/Users/matrika/Documents/New project"
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Phone testing flow

1. Open once with internet.
2. Save your numbers in setup and install to home screen.
3. Turn off internet, keep cellular ON.
4. Tap Panic or any category to open call then prefilled SMS.

## Important limitations

- Web app cannot silently place calls or send SMS in background.
- User still confirms in phone dialer/SMS UI.
- If signal is weak, SMS app outbox retries once network is available.
