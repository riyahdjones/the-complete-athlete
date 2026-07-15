# The Complete Athlete Mobile Shell

The app now has a Capacitor iOS shell. The web app remains the source of truth, and Capacitor packages that app into an iPhone-ready Xcode project.

## What Was Added

- Capacitor app name: `The Complete Athlete`
- iOS bundle ID: `com.thecompleteathlete.app`
- iOS project folder: `ios/`
- Mobile build scripts in `package.json`

## Everyday Mobile Build Flow

Run this after app changes:

```bash
pnpm run mobile:build
```

That builds the web app and syncs the latest files into the iOS project.

## Open In Xcode

After Apple developer tools are installed on this Mac:

```bash
pnpm run ios:open
```

Then in Xcode:

1. Select your Apple Developer Team.
2. Confirm the bundle ID is `com.thecompleteathlete.app`.
3. Choose an iPhone simulator or connected iPhone.
4. Press Run.

## App Store Next Steps

Before submitting to Apple:

1. Add final app icon and launch screen.
2. Set signing team in Xcode.
3. Test athlete signup, parent signup, AI coach, plans, standards, points, account deletion, and login/logout on an iPhone.
4. Create App Store screenshots and metadata.
5. Archive the app in Xcode and upload to App Store Connect.
