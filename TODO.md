# TODO: Implement Local In-App Notifications

## Current Status
- Firebase push notifications are not working
- Need to replace with local notifications when user comes online

## Tasks
- [x] Remove Firebase push notification setup from usePushNotifications.tsx
- [x] Remove Firebase messaging service worker (public/firebase-messaging-sw.js)
- [x] Remove Firebase Cloud Function for push notifications (functions/index.js)
- [x] Update Firebase config to remove messaging import (src/lib/firebase.ts)
- [x] Modify Chat.tsx to check for unread messages when user comes online
- [x] Implement local notification popup using toast when user has unread messages
- [x] Add click handler to redirect to chat with unread messages
- [x] Test notification flow when user comes online with unread messages
