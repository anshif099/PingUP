const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.sendPushNotification = functions.database.ref('/chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.val();
    const chatId = context.params.chatId;

    // Get the chat participants
    const [userId1, userId2] = chatId.split('_');

    // Determine the recipient (not the sender)
    const recipientId = message.senderId === userId1 ? userId2 : userId1;

    // Get recipient's user data
    const userRef = admin.database().ref(`/users/${recipientId}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      console.log('User not found');
      return null;
    }

    // Get sender's user data
    const senderRef = admin.database().ref(`/users/${message.senderId}`);
    const senderSnapshot = await senderRef.once('value');
    const senderData = senderSnapshot.val();

    if (!senderData) {
      console.log('Sender not found');
      return null;
    }

    // Get recipient's FCM tokens
    const tokensRef = admin.database().ref(`/users/${recipientId}/fcmTokens`);
    const tokensSnapshot = await tokensRef.once('value');
    const tokens = tokensSnapshot.val();

    if (!tokens) {
      console.log('No FCM tokens found for recipient');
      return null;
    }

    // Prepare the notification payload
    const notificationPayload = {
      title: `PingUP ${senderData.name}`,
      body: message.text || (message.imageData ? '[Image]' : message.voiceData ? '[Voice Message]' : 'New message'),
      icon: '/PingUP.jpg',
      badge: '/PingUP.jpg',
      click_action: `https://your-app-url.com/chat?user=${message.senderId}`,
      data: {
        chatId: chatId,
        senderId: message.senderId,
        messageId: context.params.messageId
      }
    };

    // Send notifications to all tokens
    const tokenArray = Object.values(tokens);
    const promises = tokenArray.map(token =>
      admin.messaging().send({
        token: token,
        notification: notificationPayload,
        data: {
          chatId: chatId,
          senderId: message.senderId,
          messageId: context.params.messageId
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messages',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              alert: notificationPayload,
              badge: 1,
              sound: 'default'
            }
          }
        }
      })
    );

    try {
      await Promise.all(promises);
      console.log('Notifications sent successfully');
    } catch (error) {
      console.error('Error sending notifications:', error);
    }

    return null;
  });
