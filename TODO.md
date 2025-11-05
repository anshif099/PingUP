# TODO: Implement AJAX Notifications for Online/Offline and New Messages

## Tasks
- [ ] Remove Cloud Function (functions/index.js)
- [ ] Update usePresence.tsx to send presence notifications via axios to ntfy.sh when user comes online/offline
- [ ] Update Chat.tsx to add useEffect for listening to all users' presence and show browser alerts on online/offline changes
- [ ] Update Chat.tsx messages useEffect to show browser alert on new message arrival
- [ ] Test notifications on web, Android, iOS

## Notes
- Use axios to send notifications to ntfy.sh for presence changes to all users.
- Use window.alert for browser alerts.
- Keep existing axios in handleSendMessage for message notifications.
