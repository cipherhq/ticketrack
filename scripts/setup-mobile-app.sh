#!/bin/bash

# Ticketrack Mobile App Setup Script
# This script helps set up the mobile app project

set -e

echo "🚀 Setting up Ticketrack Mobile App..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "⚠️  Warning: package.json not found. Are you in the ticketrack root directory?"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Navigate to parent directory to create mobile app
cd "$(dirname "$0")/.."
PARENT_DIR="$(pwd)"
MOBILE_DIR="$PARENT_DIR/ticketrack-mobile"

if [ -d "$MOBILE_DIR" ]; then
  echo "⚠️  Directory $MOBILE_DIR already exists!"
  read -p "Remove and recreate? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$MOBILE_DIR"
  else
    echo "Aborted."
    exit 1
  fi
fi

echo "📦 Creating Expo app..."
echo "Location: $MOBILE_DIR"
echo ""

# Create Expo app with TypeScript template
npx create-expo-app@latest ticketrack-mobile --template blank-typescript

cd "$MOBILE_DIR"

echo ""
echo "📥 Installing dependencies..."
npm install @supabase/supabase-js expo-router expo-camera expo-notifications expo-location expo-secure-store @react-native-async-storage/async-storage react-native-reanimated react-native-gesture-handler expo-constants

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. cd ticketrack-mobile"
echo "2. Create .env file with your Supabase credentials"
echo "3. Run 'npm start' to begin development"
echo ""
echo "📖 See docs/MOBILE_APP_SETUP_STEPS.md for detailed instructions"
