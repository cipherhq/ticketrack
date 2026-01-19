# Mobile App Development Guide - Ticketrack

## Overview

This guide outlines what you need to build mobile applications for both **Organizers** and **Attendees** using the existing Ticketrack infrastructure.

## Technology Recommendation: React Native + Expo

### Why React Native/Expo?
- ✅ **Code Reuse**: Your existing React skills and components translate directly
- ✅ **Single Codebase**: Build iOS and Android from one codebase
- ✅ **Supabase Integration**: Works seamlessly with your existing Supabase backend
- ✅ **Faster Development**: Expo provides easy development and deployment
- ✅ **Native Features**: Access to camera, QR scanner, push notifications, etc.

### Alternative Options:
- **Flutter** (Dart language) - Different tech stack but great performance
- **Native** (Swift/Kotlin) - Maximum performance but requires separate iOS/Android code
- **Ionic/Capacitor** - Web-based but less native feel

## Prerequisites & Setup

### 1. Developer Accounts (Required)
- **Apple Developer Account**: $99/year
  - Needed for iOS App Store distribution
  - Required for TestFlight (beta testing)
- **Google Play Developer Account**: $25 one-time
  - Needed for Android app distribution
  - Required for internal testing and production

### 2. Development Tools
```bash
# Install Node.js (if not already installed)
# Install Expo CLI
npm install -g expo-cli

# Or use npx (no global install needed)
npx create-expo-app ticketrack-mobile --template blank-typescript
```

### 3. Mobile Development Environment

**For iOS:**
- **Mac Computer** (required for iOS development)
- **Xcode** (free from Mac App Store)
- **iOS Simulator** (included with Xcode)

**For Android:**
- **Android Studio** (free, works on Mac/Windows/Linux)
- **Android SDK** (included with Android Studio)
- **Android Emulator** or physical device

**Alternative (Easier):**
- **Expo Go App** (free, install on your phone)
  - Test on real devices without setup
  - Scan QR code to run app instantly

### 4. Required Packages/Dependencies

```json
{
  "dependencies": {
    "expo": "~51.0.0",
    "react-native": "0.74.0",
    "@supabase/supabase-js": "^2.39.0",
    "expo-router": "^3.0.0",
    "expo-camera": "~15.0.0",
    "expo-notifications": "~0.27.0",
    "expo-location": "~17.0.0",
    "react-native-qrcode-scanner": "^1.5.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "expo-secure-store": "~13.0.0",
    "expo-constants": "~16.0.0",
    "react-native-reanimated": "~3.10.0",
    "react-native-gesture-handler": "~2.16.0"
  }
}
```

## Architecture Overview

### App Structure (Two Apps or One?)

**Option 1: Separate Apps** (Recommended)
- `ticketrack-attendee` - For event attendees
- `ticketrack-organizer` - For event organizers

**Option 2: Single App with Role-Based Access**
- One app, different screens based on user role
- Easier to maintain but larger app size

### Backend Integration

Your existing **Supabase** backend works perfectly:
- ✅ Authentication (already implemented)
- ✅ Database (same tables, same RLS policies)
- ✅ Real-time subscriptions
- ✅ Storage (for images/files)
- ✅ Edge Functions (API endpoints)

**No backend changes needed!** The mobile app will use the same Supabase URL and keys.

## Feature Breakdown

### Attendee App Features

#### Core Features (MVP)
1. **Authentication**
   - Email/Phone login
   - Sign up
   - Password reset
   - Social login (optional)

2. **Event Discovery**
   - Browse events (grid/list view)
   - Search events
   - Filter by category, date, location
   - Location-based sorting (using device GPS)
   - Event details with images

3. **Ticket Purchase**
   - Select ticket types and quantities
   - Add to cart
   - Checkout flow
   - Payment integration (Paystack, Stripe, Flutterwave)
   - Order confirmation

4. **My Tickets**
   - View purchased tickets
   - QR code display for entry
   - Add to Apple/Google Wallet
   - Download tickets
   - Past event tickets

5. **Profile & Settings**
   - Edit profile
   - Notification preferences
   - Payment methods
   - Follow organizers

#### Advanced Features
6. **Waitlist**
   - Join waitlist for sold-out events
   - Get notified when tickets available

7. **Ticket Management**
   - Transfer tickets
   - Request refunds
   - View refund status

8. **Notifications**
   - Push notifications for events
   - Order confirmations
   - Event reminders
   - Waitlist notifications

### Organizer App Features

#### Core Features (MVP)
1. **Authentication**
   - Login/Signup
   - KYC verification status

2. **Dashboard**
   - Overview stats (events, sales, revenue)
   - Quick actions
   - Recent activity

3. **Event Management**
   - Create/edit events
   - View all events
   - Event status (draft, published, cancelled)
   - Event analytics

4. **Check-In**
   - QR code scanner (camera)
   - Manual search/check-in
   - Real-time check-in count
   - Mark attendance

5. **Orders & Attendees**
   - View orders
   - Attendee list
   - Export attendee data
   - Custom form responses

6. **Analytics**
   - Sales overview
   - Ticket sales trends
   - Revenue breakdown

#### Advanced Features
7. **Ticket Issuance**
   - Issue tickets manually
   - On-site sales

8. **Refund Management**
   - View refund requests
   - Approve/reject refunds

9. **Payouts**
   - View pending/available payouts
   - Payout history
   - Bank account management

10. **Notifications**
    - New order alerts
    - Refund requests
    - Payout notifications

## Development Roadmap

### Phase 1: Setup & Foundation (Week 1-2)
- [ ] Initialize Expo project(s)
- [ ] Set up Supabase client
- [ ] Configure authentication
- [ ] Create navigation structure
- [ ] Set up environment variables
- [ ] Basic UI components

### Phase 2: Attendee App MVP (Week 3-6)
- [ ] Authentication screens
- [ ] Event browsing and search
- [ ] Event details page
- [ ] Ticket purchase flow
- [ ] My Tickets screen
- [ ] QR code display

### Phase 3: Organizer App MVP (Week 7-10)
- [ ] Authentication and dashboard
- [ ] Event list and creation
- [ ] Check-in scanner
- [ ] Orders/attendees view
- [ ] Basic analytics

### Phase 4: Payment Integration (Week 11-12)
- [ ] Paystack integration
- [ ] Stripe integration
- [ ] Flutterwave integration
- [ ] Payment status handling

### Phase 5: Advanced Features (Week 13-16)
- [ ] Push notifications
- [ ] Wallet pass integration
- [ ] Refund management
- [ ] Payout tracking
- [ ] Offline support

### Phase 6: Testing & Launch (Week 17-20)
- [ ] Beta testing (TestFlight, Play Store internal)
- [ ] Bug fixes
- [ ] App Store submission
- [ ] Play Store submission
- [ ] Production launch

## Key Mobile-Specific Features

### 1. QR Code Scanning
```javascript
// Example with expo-camera
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';

// Scan ticket QR codes for check-in
```

### 2. Push Notifications
```javascript
// Expo notifications
import * as Notifications from 'expo-notifications';

// Send event reminders, order confirmations, etc.
```

### 3. Wallet Pass Integration
```javascript
// Add tickets to Apple Wallet / Google Pay
// Use existing wallet pass generation from web app
```

### 4. Offline Support
```javascript
// Cache events/tickets locally
import AsyncStorage from '@react-native-async-storage/async-storage';

// Show cached data when offline
```

### 5. Camera Access
- Check-in QR scanning
- Profile photo upload
- Event image upload

### 6. Location Services
- GPS-based event discovery
- Location-based filtering (US-only events)
- Distance calculations

## File Structure

```
ticketrack-mobile/
├── app/                    # Expo Router (file-based routing)
│   ├── (auth)/            # Auth screens (login, signup)
│   ├── (attendee)/        # Attendee app screens
│   ├── (organizer)/       # Organizer app screens
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── ui/               # Basic UI components
│   └── shared/           # Shared components
├── lib/                  # Utilities and services
│   ├── supabase.ts       # Supabase client
│   ├── auth.ts           # Auth helpers
│   └── api.ts            # API calls
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
├── constants/            # App constants
└── assets/              # Images, fonts, etc.
```

## Environment Variables

Create `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn (optional)
```

## App Icons & Splash Screens

### Required Assets:
- App icon (1024x1024px for iOS, multiple sizes for Android)
- Splash screen images
- Adaptive icons (Android)

### Tools:
- Expo's built-in asset generator
- Or use online tools like AppIcon.co

## Security Considerations

1. **Secure Storage**: Use `expo-secure-store` for sensitive data (tokens)
2. **API Keys**: Never hardcode - use environment variables
3. **Certificate Pinning**: For production API calls
4. **Code Obfuscation**: For production builds
5. **Biometric Auth**: Optional for sensitive actions

## Testing Strategy

### Development Testing
- Expo Go app (easiest)
- iOS Simulator (Mac only)
- Android Emulator (cross-platform)

### Beta Testing
- **TestFlight** (iOS) - Up to 10,000 testers
- **Google Play Internal Testing** (Android) - Unlimited testers
- **Firebase App Distribution** (alternative)

### Testing Tools
- React Native Debugger
- Flipper (Facebook's debugging platform)
- Sentry (error tracking)

## Deployment

### iOS (App Store)
1. Build with `eas build --platform ios`
2. Submit via App Store Connect
3. Review process: 1-7 days typically

### Android (Play Store)
1. Build with `eas build --platform android`
2. Upload AAB file to Play Console
3. Review process: 1-3 days typically

### Build Services
- **Expo Application Services (EAS)**: Recommended (handles builds)
- **GitHub Actions**: Alternative CI/CD
- **Local Builds**: Requires full setup

## Cost Estimation

### Development Costs
- **Developer Time**: 4-6 months (1 developer)
- **Design**: UI/UX design (1-2 months)

### Ongoing Costs
- Apple Developer: $99/year
- Google Play: $25 one-time
- EAS Build: Free tier available, then $29/month
- Push Notifications: Free with Expo
- App Store fees: 30% (revenue share) - same as web

## Recommendations

### Start Small (MVP)
1. **Attendee App First**: Higher user base
   - Authentication
   - Browse events
   - Buy tickets
   - View tickets with QR

2. **Organizer App Second**: More complex features
   - Dashboard
   - Event management
   - Check-in scanner

### Code Sharing
- Extract shared logic (Supabase calls, utilities)
- Use monorepo structure if building both apps
- Consider React Native Web for code reuse with web

### Design Consistency
- Use same brand colors (#2969FF)
- Reuse design patterns from web app
- Follow iOS/Android design guidelines

## Next Steps

1. **Decide**: Separate apps or single app?
2. **Setup**: Install Expo CLI and create project
3. **Prototype**: Build one feature end-to-end (e.g., event list)
4. **Iterate**: Add features incrementally
5. **Test**: Beta test with real users
6. **Launch**: Submit to app stores

## Resources

- **Expo Documentation**: https://docs.expo.dev
- **React Native Docs**: https://reactnative.dev
- **Supabase Mobile**: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- **Expo Router**: https://docs.expo.dev/router/introduction/

## Questions to Consider

1. **App Distribution**: Public or private/internal?
2. **Offline Support**: How critical is offline access?
3. **Push Notifications**: Required from day 1 or later?
4. **Platform Priority**: iOS first, Android first, or both simultaneously?
5. **Budget**: In-house development or outsourcing?

---

**Ready to start?** I can help you:
- Set up the Expo project structure
- Create the initial authentication screens
- Integrate Supabase client for mobile
- Build the first feature (e.g., event browsing)

Let me know which direction you'd like to take!
