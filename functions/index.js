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

    // Skip notification if recipient is the same as sender (shouldn't happen, but safety check)
    if (recipientId === message.senderId) {
      console.log('Recipient is same as sender, skipping notification');
      return null;
    }

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
      icon: 'https://pingup-chat-app.vercel.app/PingUP.jpg',
      badge: 'https://pingup-chat-app.vercel.app/PingUP.jpg',
      click_action: `https://pingup-chat-app.vercel.app/chat?user=${message.senderId}`,
      data: {
        chatId: chatId,
        senderId: message.senderId,
        messageId: context.params.messageId
      }
    };

    // Send notifications to all tokens
    const tokenArray = Object.values(tokens);
    console.log(`Sending notifications to ${tokenArray.length} tokens for user ${recipientId}`);

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
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            ...notificationPayload,
            requireInteraction: true
          }
        }
      })
    );

    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`Notifications sent: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        console.error('Failed notifications:', results.filter(result => result.status === 'rejected'));
      }

      return { successful, failed };
    } catch (error) {
      console.error('Error sending notifications:', error);
      return null;
    }
  });
