// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAaxuleENvEkCeyGT-fpbD2MucqYqrTVKs",
  authDomain: "chating-37001.firebaseapp.com",
  databaseURL: "https://chating-37001-default-rtdb.firebaseio.com",
  projectId: "chating-37001",
  storageBucket: "chating-37001.firebasestorage.app",
  messagingSenderId: "34963823190",
  appId: "1:34963823190:web:1a799357de4b552564b9f7",
  measurementId: "G-FY3X1671VP"
});

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message',
    icon: payload.notification?.icon || '/PingUP.jpg',
    badge: payload.notification?.badge || '/PingUP.jpg',
    tag: 'pingup-message',
    requireInteraction: true,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);

  event.notification.close();

  // Open the app
  event.waitUntil(
    clients.openWindow(event.notification.data?.click_action || '/')
  );
});
