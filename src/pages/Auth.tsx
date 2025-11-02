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
      // Check if username already exists (this should work since usernames collection allows public read)
      const usernameRef = ref(database, `usernames/${registerData.username}`);
      const usernameSnapshot = await get(usernameRef);

      if (usernameSnapshot.exists()) {
        toast.error("Username already taken");
        setIsLoading(false);
        return;
      }

      // Create a unique email for Firebase Auth (since emails must be unique)
      // We'll use the username with a domain to ensure uniqueness
      const authEmail = `${registerData.username}@pingup.local`;

      console.log(`Creating user with email: ${authEmail}`);

      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authEmail,
        registerData.password
      );

      console.log("User created in Firebase Auth:", userCredential.user.uid);

      // Store user data in database
      await set(ref(database, `users/${userCredential.user.uid}`), {
        name: registerData.name,
        email: registerData.email, // Store the real email for display purposes
        username: registerData.username,
        createdAt: Date.now(),
        following: {},
        followers: {},
      });

      // Store username mapping with auth email for login
      await set(ref(database, `usernames/${registerData.username}`), {
        uid: userCredential.user.uid,
        authEmail: authEmail, // Store the auth email for login
        displayEmail: registerData.email // Store the real email for display
      });

      console.log("User data stored in database");
      toast.success("Account created successfully!");
      navigate("/chat");
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.message?.includes('email-already-in-use')) {
        toast.error("This username is already taken. Please choose a different one.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Try to get the auth email from the usernames collection
      const usernameRef = ref(database, `usernames/${loginData.username}`);
      const usernameSnapshot = await get(usernameRef);

      if (!usernameSnapshot.exists()) {
        toast.error("Username not found");
        setIsLoading(false);
        return;
      }

      const usernameData = usernameSnapshot.val();
      let authEmails = [];

      // Get possible auth emails to try
      if (typeof usernameData === 'object') {
        // New account structure
        if (usernameData.authEmail) {
          authEmails.push(usernameData.authEmail);
        }
        if (usernameData.displayEmail && usernameData.displayEmail !== usernameData.authEmail) {
          authEmails.push(usernameData.displayEmail);
        }
        if (!usernameData.authEmail && !usernameData.displayEmail) {
          authEmails.push(`${loginData.username}@pingup.local`);
        }
      } else {
        // Old account structure - usernames collection stores uid directly
        const uid = usernameData;
        const userRef = ref(database, `users/${uid}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          // For old accounts, try real email first, then generated email
          if (userData.email) {
            authEmails.push(userData.email);
          }
          authEmails.push(`${loginData.username}@pingup.local`);
        } else {
          authEmails.push(`${loginData.username}@pingup.local`);
        }
      }

      // Also try the username as email directly (for very old accounts)
      authEmails.push(loginData.username);

      console.log(`Attempting login with possible emails:`, authEmails);

      let loginSuccess = false;
      let lastError = null;

      // Try each possible email until one works
      for (const email of authEmails) {
        try {
          console.log(`Trying login with email: ${email}`);
          await signInWithEmailAndPassword(auth, email, loginData.password);
          console.log("Login successful!");
          loginSuccess = true;
          break;
        } catch (loginError: any) {
          console.error(`Login attempt failed with email ${email}:`, loginError);
          lastError = loginError;
          // Continue to next email if this one failed
        }
      }

      if (!loginSuccess) {
        throw lastError;
      }

      toast.success("Logged in successfully!");
      navigate("/chat");

    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message?.includes('user-not-found')) {
        toast.error("Username not found. Please check your username.");
      } else if (error.message?.includes('wrong-password') || error.message?.includes('invalid-credential')) {
        toast.error("Incorrect password. Please try again.");
      } else {
        toast.error("Login failed. Please check your credentials.");
      }
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
