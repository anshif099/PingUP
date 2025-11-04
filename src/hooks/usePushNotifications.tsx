import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { ref, set, push } from 'firebase/database';
import { auth, database } from '@/lib/firebase';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Web platform - use browser notifications (no Firebase needed)
      registerWebNotifications();
    } else {
      // Native platform - use Capacitor Push Notifications (no Firebase needed)
      registerNativeNotifications();
    }
  }, []);

  const registerWebNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setIsRegistered(true);
      }
    } catch (error) {
      console.error('Error registering web notifications:', error);
    }
  };

  const registerNativeNotifications = async () => {
    try {
      // Request permission
      const permissionResult = await PushNotifications.requestPermissions();
      if (permissionResult.receive === 'granted') {
        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          setIsRegistered(true);
        });

        // Listen for registration error
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration failed:', error);
        });

        // Listen for push notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
          toast(notification.title || 'New Message', {
            description: notification.body
          });
        });

        // Listen for push notification action
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          // Handle notification tap - could navigate to specific chat
        });
      }
    } catch (error) {
      console.error('Error registering native notifications:', error);
    }
  };

  const unregisterNotifications = async () => {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.unregister();
    }
    setIsRegistered(false);
  };

  return {
    isRegistered,
    unregisterNotifications
  };
};
