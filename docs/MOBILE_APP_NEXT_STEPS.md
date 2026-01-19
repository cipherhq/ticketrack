# Next Steps After Xcode Installation

## ✅ What You've Completed
- [x] Xcode installed (v26.2)
- [x] Node.js ready (v24.11.1)
- [x] npm ready (v11.6.2)

## 🎯 Immediate Next Steps

### Step 1: Open Xcode Once (Accept License)
```bash
# Open Xcode to accept license
open -a Xcode

# In Xcode:
# 1. Accept the license agreement if prompted
# 2. Wait for components to install (may take a few minutes)
# 3. Close Xcode
```

### Step 2: Create the Mobile App Project

You have two options:

#### Option A: Use the Setup Script (Easiest)
```bash
# From ticketrack root directory
cd /Users/bajideace/Desktop/ticketrack
./scripts/setup-mobile-app.sh
```

#### Option B: Manual Setup
```bash
# Navigate to parent directory (or wherever you want the mobile app)
cd /Users/bajideace/Desktop

# Create Expo app
npx create-expo-app ticketrack-mobile --template blank-typescript

# Navigate into the project
cd ticketrack-mobile

# Install dependencies
npm install @supabase/supabase-js expo-router expo-camera expo-notifications expo-location expo-secure-store @react-native-async-storage/async-storage react-native-reanimated react-native-gesture-handler expo-constants
```

### Step 3: Create Environment File

```bash
cd ticketrack-mobile

# Create .env file
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF
```

**Important:** Replace the placeholder values with your actual Supabase credentials (same ones used in your web app).

### Step 4: Test the Setup

```bash
# Start the development server
npm start

# This will:
# - Start Metro bundler
# - Show a QR code
# - Open Expo DevTools in browser
```

### Step 5: Run on iOS Simulator

In the terminal where `npm start` is running, press:
- **`i`** - Opens iOS Simulator
- **`a`** - Opens Android Emulator (if installed)
- **`w`** - Opens in web browser

Or run directly:
```bash
npx expo start --ios
```

## 📱 Alternative: Test on Your iPhone

1. Install **Expo Go** from the App Store
2. Make sure your iPhone and Mac are on the same Wi-Fi
3. Scan the QR code shown in the terminal
4. The app will open on your phone!

## 🐛 Common Issues & Fixes

### Issue: "xcode-select: error: tool 'xcodebuild' requires Xcode"
**Fix:**
```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Issue: Simulator doesn't open
**Fix:**
```bash
# Open Simulator manually
open -a Simulator

# Or via Xcode
# Xcode → Window → Devices and Simulators
```

### Issue: Port 8081 already in use
**Fix:**
```bash
lsof -ti:8081 | xargs kill -9
```

### Issue: Metro bundler errors
**Fix:**
```bash
# Clear cache and restart
npx expo start -c
```

## ✅ Verification Checklist

Before moving forward, verify:

- [ ] Xcode opens without errors
- [ ] `xcodebuild -version` works
- [ ] Expo project created successfully
- [ ] Dependencies installed (check `node_modules` folder exists)
- [ ] `.env` file created with Supabase credentials
- [ ] `npm start` runs without errors
- [ ] iOS Simulator can be opened (press `i` in Expo terminal)

## 🚀 Once Setup is Complete

After you can see your app running (even if it's just a blank screen), let me know and I'll help you:

1. **Set up Supabase client** - Connect to your existing backend
2. **Create authentication screens** - Login/signup forms
3. **Set up navigation** - App routing structure
4. **Build first feature** - Event browsing or ticket viewing

## 📚 Quick Reference

```bash
# Start development
npm start

# Open iOS simulator
npm start (then press 'i')
# OR
npx expo start --ios

# Clear cache
npx expo start -c

# Check Expo version
npx expo --version
```

---

**Ready to continue?** Once you've completed Step 2 (created the Expo project), let me know and we can start building!
