import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, push, set, get, query, orderByChild, update, remove } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, database, storage, messaging } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Search, LogOut, User, Image, Mic, Heart, Laugh, ThumbsUp, MoreVertical, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePresence, useUserPresence } from "@/hooks/usePresence";
import { ThemeToggle } from "@/components/ThemeToggle";
import PingUPLogo from "@/components/PingUPLogo";

interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
}

interface Message {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isOnline: currentUserOnline } = usePresence(currentUser?.uid || null);
  const { isOnline: otherUserOnline, lastSeen: otherUserLastSeen } = useUserPresence(selectedChat?.otherUser.uid || "");

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
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (selectedChat) {
      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      const unsubscribe = onValue(messagesRef, (snapshot) => {
        const messagesData: Message[] = [];
        snapshot.forEach((childSnapshot) => {
          messagesData.push({ id: childSnapshot.key!, ...childSnapshot.val() });
        });
        setMessages(messagesData.sort((a, b) => a.timestamp - b.timestamp));
      });

      // Listen for typing status
      const typingRef = ref(database, `chats/${selectedChat.chatId}/typing/${selectedChat.otherUser.uid}`);
      const unsubscribeTyping = onValue(typingRef, (snapshot) => {
        setIsTyping(snapshot.val() === true);
      });

      // Mark messages as read
      const markMessagesAsRead = async () => {
        if (!currentUser) return;
        const unreadMessages = messagesData.filter(msg =>
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
  }, [selectedChat, messages, currentUser]);

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
              lastMessage: lastMessageData?.text,
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
      const imageRef = storageRef(storage, `images/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      const messageData = {
        senderId: currentUser.uid,
        imageUrl,
        timestamp: Date.now(),
        reactions: {},
        readBy: {},
      };

      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      await push(messagesRef, messageData);

      // Update last message
      await set(ref(database, `chats/${selectedChat.chatId}/lastMessage`), messageData);
    } catch (error) {
      toast.error("Failed to upload image");
    }
  };

  const handleVoiceNote = async (blob: Blob) => {
    if (!selectedChat || !currentUser) return;

    try {
      const voiceRef = storageRef(storage, `voice/${Date.now()}_voice.webm`);
      await uploadBytes(voiceRef, blob);
      const voiceUrl = await getDownloadURL(voiceRef);

      const messageData = {
        senderId: currentUser.uid,
        voiceUrl,
        timestamp: Date.now(),
        reactions: {},
        readBy: {},
      };

      const messagesRef = ref(database, `chats/${selectedChat.chatId}/messages`);
      await push(messagesRef, messageData);

      // Update last message
      await set(ref(database, `chats/${selectedChat.chatId}/lastMessage`), messageData);
    } catch (error) {
      toast.error("Failed to upload voice note");
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
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r bg-sidebar-bg flex flex-col">
         <div className="p-4 border-b space-y-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
               <PingUPLogo className="w-8 h-8" />
               <span className="text-xs text-muted-foreground">v1.0.1 Beta</span>
             </div>
             <div className="flex items-center gap-2">
               <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {searchQuery ? (
            <div className="p-2 space-y-1">
              {filteredUsers.map((user) => (
                <div key={user.uid} className="flex items-center gap-3 p-3 hover:bg-sidebar-hover rounded-lg transition-colors">
                  <button
                    onClick={() => handleUserSelect(user)}
                    className="flex items-center gap-3 flex-1"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                  <Button
                    variant={following[user.uid] ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFollowToggle(user)}
                  >
                    {following[user.uid] ? "Following" : "Follow"}
                  </Button>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No users found</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-sidebar-hover rounded-lg transition-colors ${
                    selectedChat?.chatId === chat.chatId ? "bg-sidebar-hover" : ""
                  }`}
                >
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {chat.otherUser.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{chat.otherUser.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.lastMessage || "Start a conversation"}
                    </p>
                  </div>
                </button>
              ))}
              {chats.length === 0 && (
                <div className="text-center py-8 px-4">
                  <User className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No chats yet</p>
                  <p className="text-sm text-muted-foreground">Search for users to start chatting</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-card flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {selectedChat.otherUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{selectedChat.otherUser.name}</p>
                <p className="text-sm text-muted-foreground">
                  @{selectedChat.otherUser.username} • {otherUserOnline ? "Online" : otherUserLastSeen ? `Last seen ${new Date(otherUserLastSeen).toLocaleString()}` : "Offline"}
                </p>
                {isTyping && <p className="text-sm text-primary animate-pulse">typing...</p>}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-chat-bg">
              <div className="space-y-4">
                {messages.filter(msg => !msg.deleted).map((message) => {
                  const isSent = message.senderId === currentUser?.uid;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                    >
                      <div className="max-w-md">
                        <Card
                          className={`p-3 ${
                            isSent
                              ? "bg-chat-sent text-primary-foreground"
                              : "bg-chat-received"
                          }`}
                        >
                          {message.imageUrl && (
                            <img src={message.imageUrl} alt="Shared image" className="rounded-lg max-w-full mb-2" />
                          )}
                          {message.voiceUrl && (
                            <audio controls className="w-full">
                              <source src={message.voiceUrl} type="audio/webm" />
                            </audio>
                          )}
                          {message.text && <p>{message.text}</p>}
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

            {/* Message Input */}
            <div className="p-4 border-t bg-card">
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
                  className="flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="w-5 h-5" />
                </Button>
                <Button type="submit" size="icon">
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-chat-bg">
            <div className="text-center">
              <PingUPLogo className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Welcome to PingUP</h2>
              <p className="text-muted-foreground">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
