# SprayMarker

ATV spray tracking app. Shows your GPS position on a satellite map, marks spray swaths as you drive, and calculates acres sprayed.

## Features

- **Satellite map** with real-time GPS tracking
- **Big SPRAY/STOP button** - easy to tap while riding
- **Adjustable spray width** (default 16ft, range 4-40ft) with quick presets
- **Acres calculation** - shows total area sprayed per session
- **Session saving** - save and reload past spray sessions locally
- **Auto-recovery** - if the app crashes or closes, your current session is preserved
- **Past session overlay** - view previous sessions on the map as a gray overlay

## Development

```bash
npm install
npm run dev
```

## Build for Mobile (Capacitor)

### First time setup

```bash
# Build the web app
npm run build

# Add platforms
npx cap add android
npx cap add ios
```

### Build & deploy cycle

```bash
# Build web app and sync to native projects
npm run build
npx cap sync

# Open in IDE
npx cap open android   # Opens Android Studio
npx cap open ios       # Opens Xcode
```

### Android

1. `npx cap open android`
2. In Android Studio, run on your device or build an APK
3. The app will request location permissions on first launch

### iOS

1. `npx cap open ios`
2. In Xcode, set your signing team and run on your device
3. You'll need to add these to `Info.plist` (Capacitor does this automatically):
   - `NSLocationWhenInUseUsageDescription`
   - `NSLocationAlwaysUsageDescription`

## Quick Browser Test

You can also just open it in your phone's browser:

```bash
npm run dev -- --host
```

Then open the URL on your phone. GPS works in the browser too, though the native wrapper provides better background GPS access.
