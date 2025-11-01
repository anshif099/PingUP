import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAaxuleENvEkCeyGT-fpbD2MucqYqrTVKs",
  authDomain: "chating-37001.firebaseapp.com",
  databaseURL: "https://chating-37001-default-rtdb.firebaseio.com",
  projectId: "chating-37001",
  storageBucket: "chating-37001.firebasestorage.app",
  messagingSenderId: "34963823190",
  appId: "1:34963823190:web:1a799357de4b552564b9f7",
  measurementId: "G-FY3X1671VP"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Set persistence to browser local storage to maintain login state
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set auth persistence:", error);
});

export default app;
