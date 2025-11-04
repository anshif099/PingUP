const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

exports.sendNotification = functions.database.ref('/chats/{chatId}/messages/{messageId}')
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

    // Send notification regardless of online status (like WhatsApp)
    console.log('Sending notification to recipient:', recipientId);

    // Send notification via ntfy.sh
    const messageText = message.text || (message.imageData ? '[Image]' : message.voiceData ? '[Voice Message]' : 'New message');
    const ntfyBody = `${senderData.name}: ${messageText}`;

    try {
      await axios.post(`https://ntfy.sh/PingUP/${recipientId}`, ntfyBody, {
        headers: {
          'Title': 'PingUP',
          'Priority': 'default',
          'Tags': 'speech_balloon'
        }
      });
      console.log(`ntfy.sh notification sent to PingUP/${recipientId}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending ntfy.sh notification:', error.message);
      return { success: false, error: error.message };
    }
  });
