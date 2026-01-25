/**
 * Bot Testing Configuration
 * 
 * This file configures the test bots that simulate real users
 */

export const BOT_CONFIG = {
  // Base URL for the application
  baseUrl: process.env.BASE_URL || 'http://localhost:5173',
  
  // Supabase configuration
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MjczMjEsImV4cCI6MjA4MDEwMzMyMX0.1LqLvV5GZPwCfa2dZ3Bkud-WKxGG7E-Jz8780RDKopE',
  
  // Test account credentials
  accounts: {
    organizer: {
      email: process.env.BOT_ORGANIZER_EMAIL || 'bajideace@gmail.com',
      password: process.env.BOT_ORGANIZER_PASSWORD || 'Babajide1$$',
      businessName: 'Bot Test Events Ltd',
    },
    user: {
      email: process.env.BOT_USER_EMAIL || 'bcadepoju@gmail.com',
      password: process.env.BOT_USER_PASSWORD || 'Babajide1$$',
      fullName: 'Test Bot User',
    },
  },
  
  // Timeouts
  timeouts: {
    navigation: 30000,
    action: 15000,
    assertion: 10000,
  },
  
  // Screenshot settings
  screenshots: {
    enabled: true,
    onFailure: true,
    directory: 'tests/bots/screenshots',
  },
  
  // Report settings
  reports: {
    directory: 'tests/bots/reports',
    format: 'json', // 'json' | 'html' | 'both'
  },
  
  // Test data
  testData: {
    event: {
      title: 'Bot Test Event - ' + new Date().toISOString().split('T')[0],
      description: 'This is an automated test event created by the Organizer Bot.',
      venue: 'Test Venue Lagos',
      city: 'Lagos',
      ticketPrice: 5000,
      ticketQuantity: 100,
    },
  },
}

export default BOT_CONFIG
