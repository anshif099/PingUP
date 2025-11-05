import { useEffect, useState } from "react";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { database } from "@/lib/firebase";
import axios from "axios";

export const usePresence = (userId: string | null, currentUserName?: string) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const presenceRef = ref(database, `users/${userId}/presence`);
    const lastSeenRef = ref(database, `users/${userId}/lastSeen`);

    // Set user as online
    set(presenceRef, true);

    // Send online notification to all users via ntfy.sh
    if (currentUserName) {
      axios.post(`https://ntfy.sh/PingUP/all`, `${currentUserName} is now online`, {
        headers: {
          'Title': 'PingUP',
          'Priority': 'default',
          'Tags': 'green_circle'
        }
      }).catch(error => console.error('Error sending online notification:', error));
    }

    // Set up disconnect handler to mark as offline and update last seen
    onDisconnect(presenceRef).set(false);
    onDisconnect(lastSeenRef).set(Date.now());

    // Listen for presence changes
    const unsubscribePresence = onValue(presenceRef, (snapshot) => {
      setIsOnline(snapshot.val() === true);
    });

    // Listen for last seen changes
    const unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
      setLastSeen(snapshot.val());
    });

    return () => {
      unsubscribePresence();
      unsubscribeLastSeen();
      // Mark as offline when component unmounts
      set(presenceRef, false);
      set(lastSeenRef, Date.now());
      // Send offline notification
      if (currentUserName) {
        axios.post(`https://ntfy.sh/PingUP/all`, `${currentUserName} is now offline`, {
          headers: {
            'Title': 'PingUP',
            'Priority': 'default',
            'Tags': 'red_circle'
          }
        }).catch(error => console.error('Error sending offline notification:', error));
      }
    };
  }, [userId, currentUserName]);

  return { isOnline, lastSeen };
};

export const useUserPresence = (userId: string) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    const presenceRef = ref(database, `users/${userId}/presence`);
    const lastSeenRef = ref(database, `users/${userId}/lastSeen`);

    const unsubscribePresence = onValue(presenceRef, (snapshot) => {
      setIsOnline(snapshot.val() === true);
    });

    const unsubscribeLastSeen = onValue(lastSeenRef, (snapshot) => {
      setLastSeen(snapshot.val());
    });

    return () => {
      unsubscribePresence();
      unsubscribeLastSeen();
    };
  }, [userId]);

  return { isOnline, lastSeen };
};
