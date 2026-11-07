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

The native `ios/` project is generated locally and git-ignored; it is not present
in this repository. `capacitor.config.ts` configures the wrapper, but does not
set architecture requirements or location permission strings.

On a Mac with Node.js 22 or later and Xcode:

1. Run `npm install`, `npm run build`, then `npx cap sync ios` to install the
   native keep-awake plugin and copy web assets. If the native project does not
   exist yet, first run `npx cap add ios`.
2. In `ios/App/App/Info.plist`, ensure `UIRequiredDeviceCapabilities` contains
   `arm64`, replacing `armv7` if present. In `ios/App/App.xcodeproj/project.pbxproj`
   (or Xcode Build Settings), check all device build configurations for legacy
   `armv7` architecture overrides. Use the standard architectures setting
   (`$(ARCHS_STANDARD)`, arm64 for current iOS devices); do not exclude arm64 for
   device builds. Do not change signing or team settings for these fixes.
3. Add or update these location descriptions in `ios/App/App/Info.plist` (they
   are not populated automatically by this repo):

   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>SwathTrak uses your precise location to show your position and record sprayer coverage while you spray.</string>
   <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
   <string>SwathTrak uses your precise location to show your position and record sprayer coverage while you spray.</string>
   ```

   The installed Capacitor Geolocation plugin requires the second key because
   of its iOS dependency, even though the app does not request Always access.
   The obsolete `NSLocationAlwaysUsageDescription` key is not needed for this
   app's current iOS target.
4. Run `npx cap open ios` and verify on an iPhone: spraying prevents automatic
   screen lock; Stop, Refill, Finish, and Cancel allow normal screen sleep again.
   Check the imagery credits are readable and location permission wording is shown.

No background-location plugin or background mode is configured in the available
source. The standard Geolocation plugin does not directly support background
tracking. Keep-awake prevents automatic screen sleep while spraying; manually
locking the device or switching apps can still interrupt GPS. Do not enable
Background Modes / Location updates for this foreground workflow.

`public/privacy.html` is the site copy of `docs/privacy-policy.html` and is
served at `/privacy.html` (`/privacy` redirects there). After this is deployed,
use `https://swathtrak.netlify.app/privacy.html` in App Store Connect. The
policy uses the existing in-app contact, support@swathtrak.com; verify that
mailbox receives mail before submission.

## Quick Browser Test

You can also just open it in your phone's browser:

```bash
npm run dev -- --host
```

Then open the URL on your phone. GPS works in the browser too, keep the app visible while recording coverage.
