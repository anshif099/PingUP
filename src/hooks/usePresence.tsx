import { useEffect, useState } from "react";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { database } from "@/lib/firebase";

export const usePresence = (userId: string | null) => {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const presenceRef = ref(database, `users/${userId}/presence`);
    const lastSeenRef = ref(database, `users/${userId}/lastSeen`);

    // Set user as online
    set(presenceRef, true);

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
    };
  }, [userId]);

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
