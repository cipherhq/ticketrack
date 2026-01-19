# Mobile App Setup Steps - Quick Start Guide

## Step 1: Verify Xcode Installation ✅ (You're Here!)

After downloading Xcode from the Mac App Store:

1. **Open Xcode** (from Applications folder)
2. **Accept the license agreement** if prompted
3. **Install Command Line Tools**:
   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   ```
4. **Verify installation**:
   ```bash
   xcodebuild -version
   ```

## Step 2: Install Expo CLI

Choose one of these methods:

### Option A: Use npx (Recommended - No Global Install)
```bash
npx create-expo-app@latest ticketrack-mobile --template blank-typescript
```

### Option B: Install Expo CLI Globally
```bash
npm install -g expo-cli
```

## Step 3: Create the Mobile App Project

Navigate to your workspace and create the project:

```bash
# From your ticketrack directory
cd /Users/bajideace/Desktop
npx create-expo-app ticketrack-mobile --template blank-typescript
cd ticketrack-mobile
```

Or if you want to create it in a separate directory:
```bash
mkdir -p ~/Projects/ticketrack
cd ~/Projects/ticketrack
npx create-expo-app ticketrack-mobile --template blank-typescript
cd ticketrack-mobile
```

## Step 4: Install Required Dependencies

```bash
cd ticketrack-mobile
npm install @supabase/supabase-js expo-router expo-camera expo-notifications expo-location expo-secure-store @react-native-async-storage/async-storage react-native-reanimated react-native-gesture-handler
```

## Step 5: Configure Environment Variables

Create `.env` file:
```bash
cp .env.example .env
# Or create manually
```

Add your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Step 6: Start the Development Server

```bash
npm start
# Or
npx expo start
```

This will:
- Start the Metro bundler
- Show a QR code
- Open Expo DevTools in browser

## Step 7: Test on iOS Simulator

### First Time Setup:
1. Open Xcode
2. Go to Xcode → Settings → Locations
3. Verify Command Line Tools are set

### Run on Simulator:
```bash
# Press 'i' in the terminal where expo start is running
# Or run directly:
npx expo start --ios
```

This will:
- Open iOS Simulator
- Install Expo Go automatically
- Launch your app

## Step 8: Test on Your iPhone (Optional but Recommended)

1. Install **Expo Go** app from App Store on your iPhone
2. Make sure your phone and Mac are on the same Wi-Fi
3. In the terminal (where `expo start` is running), press `i` or scan the QR code
4. App will open on your phone via Expo Go

## Troubleshooting

### Xcode Command Line Tools Issue
```bash
# If xcode-select fails:
sudo xcode-select --reset
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Simulator Not Opening
- Open Xcode → Window → Devices and Simulators
- Click "+" to add a simulator if none exist
- Or run: `open -a Simulator`

### Port Already in Use
```bash
# Kill process on port 8081 (Metro bundler default port)
lsof -ti:8081 | xargs kill -9
```

## Next Steps After Setup

Once your app is running:

1. **Set up Supabase client** in your app
2. **Create authentication screens** (login/signup)
3. **Build navigation structure**
4. **Add first feature** (e.g., event list)

## Quick Commands Reference

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios
# or
npx expo start --ios

# Run on Android (if you have Android Studio)
npm run android
# or
npx expo start --android

# Clear cache if issues
npx expo start -c

# Build for production (later)
eas build --platform ios
```

## Project Structure After Creation

```
ticketrack-mobile/
├── .expo/              # Expo cache
├── assets/             # Images, fonts
├── node_modules/       # Dependencies
├── app/                # Your app code (Expo Router)
│   └── _layout.tsx    # Root layout
├── .gitignore
├── app.json           # Expo config
├── package.json
└── tsconfig.json      # TypeScript config
```

## Ready to Code?

After setup, I can help you:
1. Configure Supabase client for mobile
2. Create authentication screens
3. Set up navigation
4. Build your first feature

Let me know when you've completed the setup and we'll start building!
