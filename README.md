# PingUP Chat App

A modern, WhatsApp-like chat application built with React, TypeScript, Firebase, and Capacitor for cross-platform deployment.

## Features

### Core Features
- **User Authentication**: Register and login with username/password
- **Real-time Chat**: Instant messaging with Firebase Realtime Database
- **User Search & Follow**: Find users by username and follow/unfollow
- **Media Messages**: Send images and voice notes via Firebase Storage
- **Message Reactions**: React to messages with emojis (❤️ 😂 👍)
- **Typing Indicators**: See when others are typing
- **Read Receipts**: Double checkmarks for read messages
- **Message Deletion**: Delete messages for sender
- **Online Status & Last Seen**: Real-time presence tracking
- **Dark/Light Mode**: Theme toggle with persistence
- **Push Notifications**: FCM integration for instant notifications

### Mobile & Web
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **PWA Support**: Installable web app on mobile devices
- **Native Apps**: Android and iOS builds via Capacitor
- **Touch-Friendly**: Mobile-optimized interactions

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Firebase (Auth, Realtime Database, Storage, Cloud Messaging)
- **Build Tool**: Vite
- **Mobile**: Capacitor (Android & iOS)
- **State Management**: React hooks, Context API
- **Icons**: Lucide React

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with configured services

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anshif099/PingUP.git
   cd pingup-chat-app-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Update `src/lib/firebase.ts` with your Firebase config
   - Set up Firebase Realtime Database rules (see `database.rules.json`)
   - Enable Firebase Storage and Cloud Messaging

4. **Development**
   ```bash
   npm run dev
   ```
   Open [http://localhost:8080](http://localhost:8080)

### Mobile App Builds

#### Android
```bash
# Build and open Android Studio
npm run android:build

# Or step by step:
npm run build
npx cap sync android
npx cap open android
```

#### iOS (macOS only)
```bash
# Build and open Xcode
npm run ios:build

# Or step by step:
npm run build
npx cap sync ios
npx cap open ios
```

### Capacitor Commands

```bash
# Sync web assets to all platforms
npm run cap:sync

# Open Android Studio
npm run cap:android

# Open Xcode
npm run cap:ios
```

## Firebase Setup

1. **Create Firebase Project**
2. **Enable Services**:
   - Authentication (Email/Password)
   - Realtime Database
   - Storage
   - Cloud Messaging
3. **Security Rules**: Apply the rules from `database.rules.json`
4. **Update Config**: Replace the config in `src/lib/firebase.ts`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn/ui components
│   └── ...
├── contexts/           # React contexts (Theme, etc.)
├── hooks/              # Custom React hooks
├── lib/                # Utilities and Firebase config
├── pages/              # Main app pages (Auth, Chat)
└── ...

android/                # Android native project
ios/                    # iOS native project
dist/                   # Built web assets
```

## Features Overview

### Authentication
- Register with name, email, username, password
- Login with username and password
- Username uniqueness validation
- User data stored in Firebase Auth + Realtime DB

### Chat System
- Real-time messaging with Firebase Realtime Database
- Chat rooms stored under unique chat IDs
- Message history with timestamps
- Support for text, images, and voice notes

### User Management
- Search users by username
- Follow/unfollow functionality
- Online/offline status tracking
- Last seen timestamps

### Advanced Features
- Message reactions and read receipts
- Typing indicators
- Message deletion
- Push notifications via FCM
- Dark/light theme toggle
- Mobile-responsive design

## Security

- Firebase Database rules protect user data
- Only authenticated users can access their own data
- Chat participants can access shared messages
- Secure file uploads to Firebase Storage

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.
