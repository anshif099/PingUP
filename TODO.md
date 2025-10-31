# TODO: Add Missing Features to PingUP Chat App

## 1. User Profiles & Search Enhancements
- [x] Add follow/unfollow functionality
  - Store following/followers in Firebase DB (users/{uid}/following/{followedUid})
  - Add follow/unfollow buttons in user search results
  - Update UI to show follow status

## 2. Chat Features Enhancements
- [x] Media Messages (Images and Voice Notes)
  - Integrate Firebase Storage for uploads
  - Add image upload button in chat input
  - Add voice recording/upload functionality
  - Store media URLs in message objects
  - Display images/voice in chat

- [x] Message Reactions
  - Add reaction buttons (❤️ 😂 👍 etc.) to messages
  - Store reactions in message object (reactions: {userId: emoji})
  - Display reactions below messages

- [x] Typing Indicator
  - Track typing status in DB (chats/{chatId}/typing/{userId})
  - Show "typing..." in chat header when other user is typing

- [x] Read Receipts
  - Add read status to messages (readBy: {userId: timestamp})
  - Update read status when messages are viewed
  - Show read indicators (e.g., double checkmark)

- [x] Message Deletion
  - Add delete option for self or everyone
  - Remove message from DB or mark as deleted

## 3. Instant Notifications
- [x] Integrate Firebase Cloud Messaging (FCM)
  - Add FCM import to firebase.ts
  - Request notification permission on login
  - Send notifications on new messages (even when app is open)
  - Include sender username and message preview

## 4. Additional Features
- [x] Online/Offline Status
  - Track user presence in DB (users/{uid}/presence)
  - Display online/offline in user profiles and chat headers

- [x] Last Seen
  - Store last seen timestamp in user profile
  - Display last seen when user is offline

- [x] Dark/Light Mode Toggle
  - Add theme context/provider
  - Create theme toggle component
  - Apply theme classes throughout UI

## 5. Security Rules
- [x] Add Firebase Database Security Rules
  - Protect user data (only owner can read/write)
  - Protect messages (only chat participants can access)
  - Create database.rules.json file

## 6. Testing and Followup
- [x] Test all features: Auth, chat, media, notifications, etc.
- [x] Install any additional packages if needed (e.g., for media handling)
- [x] Verify responsive design on mobile/desktop
- [x] Deploy and test security rules
