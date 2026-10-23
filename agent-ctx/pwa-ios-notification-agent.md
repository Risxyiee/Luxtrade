# Task: iPhone PWA Install Prompt & Mobile Notification Support

## Agent: notification-pwa-agent

## Summary

Added comprehensive iPhone/iOS PWA install guidance and improved mobile notification support for the LuxTradee trading app. The key insight is that **iPhone Safari does NOT support Web Push API** — push notifications only work when the app is installed as a PWA via "Add to Home Screen" (iOS 16.4+).

## Files Created

1. **`src/components/NotificationSetup.tsx`** (NEW)
   - Smart notification setup component that detects iOS Safari vs standalone mode
   - When user clicks "Enable Notifications" on iOS Safari (not standalone) → shows iOS install banner instead of requesting permission
   - When in standalone mode or on Android → proceeds with normal push subscription
   - Supports `compact` (toggle) and full card layouts
   - Shows email fallback note on iOS
   - Fully i18n'd (Indonesian/English)

## Files Modified

2. **`src/components/PWAInstallPrompt.tsx`** (REWRITTEN)
   - Complete rewrite from basic install prompt to comprehensive iOS PWA guide
   - Detects iOS Safari specifically (excludes Chrome/Firefox on iOS)
   - Exports `isIOSSafari()` and `isStandaloneMode()` helper functions for reuse
   - Shows step-by-step instructions: Share → Add to Home Screen → Add → Open
   - Two variants: `banner` (top of dashboard) and `card` (floating)
   - Uses localStorage for dismissal (`luxtrade_pwa_prompt_dismissed`)
   - Supports `forceShow` prop (e.g. when user clicks "Enable Notifications" on iOS)
   - Shows email fallback note
   - Fully i18n'd with useLanguage hook
   - framer-motion animations

3. **`src/components/PushNotificationSetup.tsx`** (UPDATED)
   - Now iOS-aware: checks `isIOSSafari()` and `isStandaloneMode()` from PWAInstallPrompt
   - On iOS Safari (not standalone): shows amber "Enable Push on iPhone" banner with install guidance instead of trying to subscribe
   - On standalone or Android: normal push subscription flow
   - Added `onShowIOSInstall` callback prop
   - Fully i18n'd (was previously only Indonesian)

4. **`src/app/dashboard/components/TabContent.tsx`** (UPDATED)
   - Added `PWAInstallPrompt` import and rendered as banner variant at top of dashboard content
   - Placed before `PushNotificationSetup` so iOS users see install guidance first

5. **`src/app/dashboard/components/sidebar/SidebarFooter.tsx`** (UPDATED)
   - Replaced `PushNotificationPermission` with `NotificationSetup` (iOS-aware)
   - Sidebar toggle now shows iOS install button instead of push toggle when on iOS Safari

6. **`src/app/dashboard/components/NotificationPreferences.tsx`** (UPDATED)
   - Added iOS Safari detection
   - When on iOS Safari (not standalone): shows amber info box explaining email alerts serve as fallback
   - Added i18n strings for `iosEmailFallback`, `pushNotifications`, `pushNotSupported`
   - Added `Smartphone` and `Info` lucide icons

## Email Notification Fallback

The existing `src/app/api/notifications/send-alert/route.ts` already sends email alerts via Resend. This continues to work as a fallback on iOS:
- When on iOS Safari, push notifications are unavailable
- Email alerts (daily/weekly digest, trade alerts) still work as fallback
- Users are informed of this in:
  - PWAInstallPrompt banner ("Email notifications will be sent as fallback")
  - NotificationSetup component ("Email alerts active as fallback on iPhone")
  - NotificationPreferences dialog (iOS-specific info box)

## Technical Details

- **iOS Detection**: Uses UA sniffing (`/iPad|iPhone|iPod/`) + Safari check + `MSStream` exclusion for iOS detection, plus `window.matchMedia('(display-mode: standalone)')` and `navigator.standalone` for PWA detection
- **All components are `'use client'`** with no server-side code
- **No changes to secrets or VAPID configuration**
- **No changes to service worker** (`src/sw.ts`) — push notification handling there remains unchanged
- **Existing `PushNotificationPermission` component** (`src/components/PushNotificationPermission.tsx`) is still available but no longer imported anywhere (replaced by `NotificationSetup`)
