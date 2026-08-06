# TallyHo — App Store Foundation

This package converts the existing TallyHo budgeting PWA into a Capacitor-ready application foundation for iOS, Android, and web.

## What is included

- Login and account-creation screen
- Per-account budget data on the local device for preview/testing
- Free and Premium plan model
- Premium paywall, restore-purchase entry point, and feature gates
- Native StoreKit 2 product loading, purchasing, restoring, and entitlement refresh
- “Can I buy it?” weekly/biweekly purchase checker with a safety buffer
- Unlimited Premium checks and three free checks per week
- Existing calendar, weekly map, Split Coach, insights, debt tools, imports, exports, premium themes, and device-unlock hooks
- In-app logout and account deletion
- Capacitor 8 project configuration
- 192px, 512px, and 1024px app icons
- Demo account with sample budget data

## Production boundary

TallyHo 1.0 is intentionally local-first: profiles and budget data remain on the user's device. StoreKit 2 is the source of truth for paid entitlement on iOS; the app never grants Premium merely because a purchase button was tapped. Before submission, complete real-device Sandbox purchase and restore testing, publish the included privacy policy at a public HTTPS URL, add the final support URL, and verify the App Store privacy answers against the shipped build.

## Run in a browser

```bash
npm install
npm run serve
```

Open `http://localhost:4173`.

Use `demo@tallyho.app` with password `Fire$e@L64280` to load a Premium demo with sample entries.

## Create the iOS project

Capacitor 8 requires a current supported Node and Xcode environment.

```bash
npm install
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

In Xcode:

- Set your development team and bundle identifier.
- Replace the generated AppIcon set with `AppStoreIcon-1024.png` and generated required sizes.
- Configure signing and capabilities.
- Add StoreKit products in App Store Connect.
- Test purchases using a StoreKit configuration and App Store sandbox account.
- Archive and upload through Xcode.

## Suggested subscription products

- `com.kayladeshasier.tallyho.premium.month` — $4.99/month
- `com.kayladeshasier.tallyho.premium.annually` — $39.99/year

These are launch suggestions only. Final prices are configured in App Store Connect and displayed from StoreKit in production rather than hard-coded.

## Free and Premium structure

### Free

- Up to 25 planned items
- Overview and calendar
- Weekly money map
- Three “Can I buy it?” checks each week
- Local backup

### Premium

- Unlimited planned items
- Split Coach
- Unlimited purchase checks
- Spending and savings insights
- Debt planning
- Cloud-sync-ready account architecture
- Premium themes

## App Store checklist

- Apple Developer Program membership
- App record in App Store Connect
- Bundle ID and signing certificates
- Privacy Policy URL and support URL
- App privacy questionnaire
- Account deletion available in app
- Working demo account for App Review
- In-app purchases attached to the submitted version
- Subscription terms and restore-purchase button
- Screenshots for every required device size
- TestFlight testing before review

## Files

- `www/` — web application loaded by Capacitor
- `capacitor.config.json` — native wrapper configuration
- `package.json` — Capacitor scripts and dependencies
- `AppStoreIcon-1024.png` — source icon for App Store artwork
