import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, push, set, get, query, orderByChild, update, remove } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, database, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Search, LogOut, User, Image, Mic, Heart, Laugh, ThumbsUp, MoreVertical, Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePresence, useUserPresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ThemeToggle } from "@/components/ThemeToggle";
import PingUPLogo from "@/components/PingUPLogo";
import { UpdateDialog } from "@/components/UpdateDialog";
import axios from "axios";

const sendPushNotification = async (recipientUid: string, message: Message, senderName: string, chatId: string) => {
  try {
    // Get recipient's FCM token
    const tokenRef = ref(database, `users/${recipientUid}/fcmToken`);
    const tokenSnapshot = await get(tokenRef);

    if (tokenSnapshot.exists()) {
      const fcmToken = tokenSnapshot.val();

      // Prepare notification payload
      const notificationPayload = {
        to: fcmToken,
        notification: {
          title: `New message from ${senderName}`,
          body: message.text || (message.imageData ? '📷 Image' : message.voiceData ? '🎵 Voice message' : 'New message'),
          icon: '/PingUP.jpg',
          badge: '/PingUP.jpg',
          click_action: '/'
        },
        data: {
          chatId: chatId,
          senderId: message.senderId,
          messageType: message.text ? 'text' : message.imageData ? 'image' : 'voice'
        }
      };

      // Send via Firebase Cloud Messaging API
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${process.env.REACT_APP_FCM_SERVER_KEY}` // You'll need to add this to your env
        },
        body: JSON.stringify(notificationPayload)
      });

      if (response.ok) {
        console.log('Push notification sent successfully');
      } else {
        console.error('Failed to send push notification:', response.statusText);
      }
    } else {
      console.log('No FCM token found for recipient');
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  following?: string[];
  followers?: string[];
}

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageData?: string;
  imageName?: string;
  voiceData?: string;
  timestamp: number;
  reactions?: { [userId: string]: string };
  readBy?: { [userId: string]: number };
  deleted?: boolean;
}

interface Chat {
  chatId: string;
  otherUser: User;
  lastMessage?: string;
  timestamp?: number;
}

const Chat = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [following, setFollowing] = useState<{ [uid: string]: boolean }>({});
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasShownNotification, setHasShownNotification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout>();
  const { isOnline: currentUserOnline } = usePresence(currentUser?.uid || null, currentUser?.name);
  const { isOnline: otherUserOnline, lastSeen: otherUserLastSeen } = useUserPresence(selectedChat?.otherUser.uid || "");
  const { isRegistered: notificationsRegistered } = usePushNotifications();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setCurrentUser({ uid: user.uid, ...userData });
          setFollowing(userData.following || {});
          loadChats(user.uid);


        }
      } else {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        if (childSnapshot.key !== currentUser?.uid) {
          usersData.push({ uid: childSnapshot.key!, ...userData });
        }
      });
      setUsers(usersData);

      // Listen for presence changes of all users and show alerts
      const presenceRefs: any[] = [];
      usersData.forEach((user) => {
        const presenceRef = ref(database, `users/${user.uid}/presence`);
        const unsubscribePresence = onValue(presenceRef, (snapshot) => {
          const isOnline = snapshot.val() === true;
          if (isOnline && !hasShownNotification) {
            window.alert(`${user.name} is now online`);
            setHasShownNotification(true);
            setTimeout(() => setHasShownNotification(false), 1000); // Reset after 1 second
          }
        });
        presenceRefs.push(unsubscribePresence);
      });

      return () => {
        presenceRefs.forEach(unsub => unsub());
      };
    });

    return () => unsubscribe();
  }, [currentUser, hasShownNotification]);

  useEffect(() => {
    if (selectedChat) {
      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
          const messagesData = snapshot.val();
          const messagesArray = Object.entries(messagesData)
            .map(([id, msg]: [string, any]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);

          setMessages(messagesArray);

          // Send push notification for new message
          const latestMessage = messagesArray[messagesArray.length - 1];
          if (latestMessage && latestMessage.senderId !== currentUser?.uid) {
            sendPushNotification(selectedChat.otherUser.uid, latestMessage, selectedChat.otherUser.name, selectedChat.chatId);
          }
        }
      });

      // Listen for typing status
      const typingRef = ref(database, `chats/${selectedChat.chatId}/typing/${selectedChat.otherUser.uid}`);
      const unsubscribeTyping = onValue(typingRef, (snapshot) => {
        setIsTyping(snapshot.val() === true);
      });

      // Mark messages as read
      const markMessagesAsRead = async () => {
        if (!currentUser) return;
        const unreadMessages = messages.filter(msg =>
          msg.senderId !== currentUser.uid && !msg.readBy?.[currentUser.uid]
        );
        const updates: { [key: string]: any } = {};
        unreadMessages.forEach(msg => {
          updates[`chats/${selectedChat.chatId}/messages/${msg.id}/readBy/${currentUser.uid}`] = Date.now();
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
        }
      };

      markMessagesAsRead();

      return () => {
        unsubscribe();
        unsubscribeTyping();
      };
    }
  }, [selectedChat, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);



  const loadChats = async (userId: string) => {
    const chatsRef = ref(database, `userChats/${userId}`);
    const unsubscribe = onValue(chatsRef, async (snapshot) => {
      const chatsData: Chat[] = [];
      const promises: Promise<void>[] = [];

      snapshot.forEach((childSnapshot) => {
        const chatId = childSnapshot.key!;
        const promise = (async () => {
          const [uid1, uid2] = chatId.split("_");
          const otherUserId = uid1 === userId ? uid2 : uid1;
          const otherUserRef = ref(database, `users/${otherUserId}`);
          const otherUserSnapshot = await get(otherUserRef);

          if (otherUserSnapshot.exists()) {
            const lastMessageRef = ref(database, `chats/${chatId}/lastMessage`);
            const lastMessageSnapshot = await get(lastMessageRef);
            const lastMessageData = lastMessageSnapshot.val();

            chatsData.push({
              chatId,
              otherUser: { uid: otherUserId, ...otherUserSnapshot.val() },
              lastMessage: lastMessageData?.text || (lastMessageData?.imageData ? "[Image]" : lastMessageData?.voiceData ? "[Voice Message]" : null),
              timestamp: lastMessageData?.timestamp,
            });
          }
        })();
        promises.push(promise);
      });

      await Promise.all(promises);
      setChats(chatsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    return () => unsubscribe();
  };

  const getChatId = (userId1: string, userId2: string) => {
    return [userId1, userId2].sort().join("_");
  };

  const handleUserSelect = async (user: User) => {
    if (!currentUser) return;

    const chatId = getChatId(currentUser.uid, user.uid);

    // Create chat references if they don't exist
    await set(ref(database, `userChats/${currentUser.uid}/${chatId}`), true);
    await set(ref(database, `userChats/${user.uid}/${chatId}`), true);

    setSelectedChat({ chatId, otherUser: user });
  };

  const handleFollowToggle = async (user: User) => {
    if (!currentUser) return;

    const isFollowing = following[user.uid];
    const updates: { [key: string]: any } = {};

    if (isFollowing) {
      // Unfollow
      updates[`users/${currentUser.uid}/following/${user.uid}`] = null;
      updates[`users/${user.uid}/followers/${currentUser.uid}`] = null;
    } else {
      // Follow
      updates[`users/${currentUser.uid}/following/${user.uid}`] = true;
      updates[`users/${user.uid}/followers/${currentUser.uid}`] = true;
    }

    await update(ref(database), updates);
    setFollowing(prev => ({ ...prev, [user.uid]: !isFollowing }));
  };

  const handleTyping = () => {
    if (!selectedChat || !currentUser) return;

    // Set typing status
    set(ref(database, `chats/${selectedChat.chatId}/typing/${currentUser.uid}`), true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      set(ref(database, `chats/${selectedChat.chatId}/typing/${currentUser.uid}`), false);
    }, 1000);
  };

  const handleImageUpload = async (file: File) => {
    if (!selectedChat || !currentUser) return;

    try {
      console.log("Processing image:", file.name);

      // Convert image to base64 for storage in Firebase Realtime Database
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      console.log("Image converted to base64");

      const messageData = {
        senderId: currentUser.uid,
        imageData: base64Image,
        imageName: file.name,
        timestamp: Date.now(),
        reactions: {},
        readBy: {},
      };

      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      await push(messagesRef, messageData);

      // Update last message
      await set(ref(database, `chats/${selectedChat.chatId}/lastMessage`), {
        senderId: currentUser.uid,
        imageData: "[Image]",
        timestamp: Date.now(),
      });

      console.log("Image message sent to chat");
      toast.success("Image sent successfully!");
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to send image");
    }
  };

  const handleVoiceNote = async (blob: Blob) => {
    if (!selectedChat || !currentUser) return;

    try {
      console.log("Processing voice note");

      // Convert voice blob to base64 for storage in Firebase Realtime Database
      const base64Voice = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log("Voice converted to base64");

      const messageData = {
        senderId: currentUser.uid,
        voiceData: base64Voice,
        timestamp: Date.now(),
        reactions: {},
        readBy: {},
      };

      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      await push(messagesRef, messageData);

      // Update last message
      await set(ref(database, `chats/${selectedChat.chatId}/lastMessage`), {
        senderId: currentUser.uid,
        voiceData: "[Voice Message]",
        timestamp: Date.now(),
      });

      console.log("Voice message sent to chat");
      toast.success("Voice message sent!");
    } catch (error) {
      console.error("Error processing voice note:", error);
      toast.error("Failed to send voice message");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await handleVoiceNote(blob);
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      const startTime = Date.now();
      recordingTimeoutRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recordingTimeoutRef.current) {
        clearInterval(recordingTimeoutRef.current);
      }
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !selectedChat) return;

    const reactionRef = ref(database, `chats/${selectedChat.chatId}/messages/${messageId}/reactions/${currentUser.uid}`);
    await set(reactionRef, emoji);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;

    await remove(ref(database, `chats/${selectedChat.chatId}/messages/${messageId}`));
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !currentUser) return;

    const messageData = {
      senderId: currentUser.uid,
      text: messageText.trim(),
      timestamp: Date.now(),
      reactions: {},
      readBy: {},
    };

    const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
    await push(messagesRef, messageData);

    // Update last message
    await set(ref(database, `chats/${selectedChat.chatId}/lastMessage`), messageData);

    // Send notification via ntfy.sh
    try {
      await axios.post(`https://ntfy.sh/PingUP/${selectedChat.otherUser.uid}`, `${currentUser.name}: ${messageText.trim()}`, {
        headers: {
          'Title': 'PingUP',
          'Priority': 'default',
          'Tags': 'speech_balloon'
        }
      });
      console.log(`ntfy.sh notification sent to PingUP/${selectedChat.otherUser.uid}`);
    } catch (error) {
      console.error('Error sending ntfy.sh notification:', error);
    }

    setMessageText("");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex bg-background chat-container">
      {/* Sidebar */}
      <div className={`w-80 border-r bg-sidebar-bg flex flex-col md:w-64 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
         <div className="p-2 sm:p-4 border-b space-y-4">
             <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <PingUPLogo className="w-6 h-6 sm:w-8 sm:h-8" />
             </div>
             <div className="flex items-center gap-1 sm:gap-2">
               <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowUpdateDialog(true)}
                title="Check for Updates"
                className="w-8 h-8 sm:w-10 sm:h-10"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                className="w-8 h-8 sm:w-10 sm:h-10"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm sm:text-base"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {searchQuery ? (
            <div className="p-2 space-y-1">
              {filteredUsers.map((user) => (
                <div key={user.uid} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-sidebar-hover rounded-lg transition-colors">
                  <button
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center gap-2 sm:gap-3 flex-1"
                  >
                    <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{user.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </button>
                  <Button
                    variant={following[user.uid] ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFollowToggle(user)}
                    className="text-xs sm:text-sm px-2 sm:px-3 h-7 sm:h-8"
                  >
                    {following[user.uid] ? "Following" : "Follow"}
                  </Button>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm sm:text-base">No users found</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-2 sm:p-3 flex items-center gap-2 sm:gap-3 hover:bg-sidebar-hover rounded-lg transition-colors ${
                    selectedChat?.chatId === chat.chatId ? "bg-sidebar-hover" : ""
                  }`}
                >
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base">
                      {chat.otherUser.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{chat.otherUser.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      {chat.lastMessage || "Start a conversation"}
                    </p>
                  </div>
                </button>
              ))}
              {chats.length === 0 && (
                <div className="text-center py-8 px-4">
                  <User className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm sm:text-base">No chats yet</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Search for users to start chatting</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-2 sm:p-4 border-b bg-card flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden sm:flex"
                onClick={() => setSelectedChat(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base">
                  {selectedChat.otherUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate">{selectedChat.otherUser.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  @{selectedChat.otherUser.username} • {otherUserOnline ? "Online" : otherUserLastSeen ? `Last seen ${new Date(otherUserLastSeen).toLocaleString()}` : "Offline"}
                </p>
                {isTyping && <p className="text-xs sm:text-sm text-primary animate-pulse">typing...</p>}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 sm:p-4 bg-chat-bg">
              <div className="space-y-4">
                {messages.filter(msg => !msg.deleted).map((message) => {
                  const isSent = message.senderId === currentUser?.uid;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-xs sm:max-w-md">
                        <Card
                          className={`p-3 ${
                            isSent
                              ? "bg-chat-sent text-primary-foreground"
                              : "bg-chat-received"
                          }`}
                        >
                          {message.imageData && (
                            <div>
                              <img src={message.imageData} alt={message.imageName || "Shared image"} className="rounded-lg max-w-full mb-2" />
                              {message.imageName && (
                                <p className="text-xs text-muted-foreground mb-2">{message.imageName}</p>
                              )}
                            </div>
                          )}
                          {message.voiceData && (
                            <div className="flex items-center gap-2">
                              <audio controls className="flex-1">
                                <source src={message.voiceData} type="audio/webm" />
                              </audio>
                              <span className="text-xs text-muted-foreground">🎵 Voice</span>
                            </div>
                          )}
                          {message.text && <p className="text-sm sm:text-base">{message.text}</p>}
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {message.readBy && Object.keys(message.readBy).length > 1 && isSent && " ✓✓"}
                          </p>
                        </Card>
                        {/* Reactions */}
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {Object.entries(message.reactions).map(([userId, emoji]) => (
                              <span key={userId} className="text-sm bg-muted rounded-full px-2 py-1">
                                {emoji}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Message Actions */}
                        <div className="flex gap-1 mt-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => handleReaction(message.id, "❤️")}>
                                ❤️ React
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReaction(message.id, "😂")}>
                                😂 React
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReaction(message.id, "👍")}>
                                👍 React
                              </DropdownMenuItem>
                              {isSent && (
                                <DropdownMenuItem onClick={() => handleDeleteMessage(message.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Image Preview */}
            {imagePreview && (
              <div className="p-2 sm:p-4 border-t bg-card">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Ready to send</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedImage?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        console.log("Send button clicked, selectedImage:", selectedImage);
                        console.log("selectedChat:", selectedChat);
                        console.log("currentUser:", currentUser);
                        if (selectedImage && selectedChat && currentUser) {
                          try {
                            await handleImageUpload(selectedImage);
                            console.log("Image upload completed successfully");
                            setSelectedImage(null);
                            setImagePreview(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          } catch (error) {
                            console.error("Error in send button click:", error);
                            toast.error("Failed to send image");
                          }
                        } else {
                          console.log("Missing required data for image upload");
                          toast.error("Unable to send image - missing chat or user data");
                        }
                      }}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-2 sm:p-4 border-t bg-card">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 text-sm sm:text-base"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedImage(file);
                      const reader = new FileReader();
                      reader.onload = (e) => {
                        setImagePreview(e.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10"
                >
                  <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  className="w-10 h-10"
                  title={isRecording ? `Recording... ${recordingTime}s` : "Hold to record voice message"}
                >
                  <Mic className={`w-4 h-4 sm:w-5 sm:h-5 ${isRecording ? 'animate-pulse' : ''}`} />
                </Button>
                <Button type="submit" size="icon" className="w-10 h-10">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-chat-bg">
          <div className="text-center">
            <PingUPLogo className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg sm:text-2xl font-semibold mb-2">Welcome to PingUP</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Select a chat to start messaging</p>
          </div>
          </div>
        )}
      </div>

      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
    </div>
  );
};

export default Chat;
