// This hook is no longer used - notifications are handled locally in Chat.tsx
export const usePushNotifications = () => {
  return {
    isRegistered: false,
    unregisterNotifications: () => {}
  };
};
