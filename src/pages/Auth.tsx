import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { getToken, onMessage } from "firebase/messaging";
import { auth, database, messaging } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import PingUPLogo from "@/components/PingUPLogo";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Register state
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
  });

  // Login state
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check if username already exists
      const usernameRef = ref(database, `usernames/${registerData.username}`);
      const usernameSnapshot = await get(usernameRef);

      if (usernameSnapshot.exists()) {
        toast.error("Username already taken");
        setIsLoading(false);
        return;
      }

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        registerData.email,
        registerData.password
      );

      // Store user data in database
      await set(ref(database, `users/${userCredential.user.uid}`), {
        name: registerData.name,
        email: registerData.email,
        username: registerData.username,
        createdAt: Date.now(),
        following: {},
        followers: {},
      });

      // Store username mapping with email for login
      await set(ref(database, `usernames/${registerData.username}`), {
        uid: userCredential.user.uid,
        email: registerData.email
      });

      toast.success("Account created successfully!");
      navigate("/chat");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Get user data from username
      const usernameRef = ref(database, `usernames/${loginData.username}`);
      const usernameSnapshot = await get(usernameRef);

      if (!usernameSnapshot.exists()) {
        toast.error("Username not found");
        setIsLoading(false);
        return;
      }

      const usernameData = usernameSnapshot.val();
      let userEmail;

      // Handle different data formats
      if (typeof usernameData === 'object' && usernameData.email) {
        // New format: { uid, email }
        userEmail = usernameData.email;
      } else if (typeof usernameData === 'string') {
        // Old format: just uid string - need to get email from users collection
        // But we can't read users collection without auth, so try a different approach
        // Use the uid as part of email pattern
        userEmail = `${loginData.username}@pingup.local`;
      } else {
        toast.error("Invalid user data format");
        setIsLoading(false);
        return;
      }

      // Try to sign in with the email
      try {
        await signInWithEmailAndPassword(auth, userEmail, loginData.password);
        toast.success("Logged in successfully!");
        navigate("/chat");
      } catch (authError: any) {
        // If the constructed email doesn't work, try alternative approaches
        if (userEmail.includes('@pingup.local')) {
          // Try with different domain
          try {
            await signInWithEmailAndPassword(auth, `${loginData.username}@example.com`, loginData.password);
            toast.success("Logged in successfully!");
            navigate("/chat");
          } catch (secondError) {
            toast.error("Login failed. Please check your credentials.");
          }
        } else {
          toast.error(authError.message || "Login failed");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Request notification permission on component mount
    const requestNotificationPermission = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: 'YOUR_VAPID_KEY_HERE' // You'll need to generate this from Firebase Console
          });
          console.log('FCM Token:', token);
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    };

    requestNotificationPermission();

    // Listen for foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      // Show notification even when app is open
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title || 'New Message', {
          body: payload.notification?.body,
          icon: '/favicon.ico'
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-accent p-4 chat-container">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md shadow-2xl border-0 mx-4">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <PingUPLogo className="w-16 h-16" />
          </div>
           <CardTitle className="text-3xl font-bold">PingUP</CardTitle>
           <CardDescription>Connect with friends instantly</CardDescription>

        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginData.username}
                    onChange={(e) =>
                      setLoginData({ ...loginData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Enter your name"
                    value={registerData.name}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-username">Username</Label>
                  <Input
                    id="register-username"
                    type="text"
                    placeholder="Choose a unique username"
                    value={registerData.username}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="Enter your email"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Create a password"
                    value={registerData.password}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
