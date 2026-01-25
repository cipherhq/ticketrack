#!/usr/bin/env node

/**
 * Bot Test Runner
 * 
 * Orchestrates the test bots and runs them sequentially
 * 
 * Usage:
 *   npm run test:bots              # Run all bots
 *   npm run test:bots -- --bot organizer   # Run only organizer bot
 *   npm run test:bots -- --bot user        # Run only user bot
 *   npm run test:bots -- --headed          # Run with browser visible
 *   npm run test:bots -- --slow            # Run slowly for debugging
 */

import fs from 'fs'
import path from 'path'
import { OrganizerBot } from './organizer-bot.js'
import { UserBot } from './user-bot.js'
import { reporter } from './reporter.js'
import { BOT_CONFIG } from './config.js'

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  bot: 'all',
  headed: false,
  slow: false,
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--bot' && args[i + 1]) {
    options.bot = args[i + 1]
    i++
  } else if (args[i] === '--headed') {
    options.headed = true
  } else if (args[i] === '--slow') {
    options.slow = true
  }
}

// Set environment based on options
if (options.headed) {
  process.env.HEADLESS = 'false'
}
if (options.slow) {
  process.env.SLOW_MO = '500'
}

// Ensure directories exist
function ensureDirectories() {
  const dirs = [
    BOT_CONFIG.screenshots.directory,
    BOT_CONFIG.reports.directory,
    'tests/bots/videos',
  ]
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

// Print banner
function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖  T I C K E T R A C K   B O T   T E S T E R  🤖          ║
║                                                              ║
║   Testing every feature, one at a time                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`)
  console.log(`Configuration:`)
  console.log(`  Base URL:    ${BOT_CONFIG.baseUrl}`)
  console.log(`  Bot(s):      ${options.bot}`)
  console.log(`  Headed:      ${options.headed}`)
  console.log(`  Slow Mode:   ${options.slow}`)
  console.log('')
}

// Main runner
async function runBots() {
  printBanner()
  ensureDirectories()
  
  reporter.startRun()
  
  try {
    // Run Organizer Bot
    if (options.bot === 'all' || options.bot === 'organizer') {
      console.log('\n' + '▓'.repeat(60))
      console.log('▓  ORGANIZER BOT - Testing Event Management Features')
      console.log('▓'.repeat(60))
      
      const organizerBot = new OrganizerBot()
      await organizerBot.runAllTests()
    }
    
    // Run User Bot
    if (options.bot === 'all' || options.bot === 'user') {
      console.log('\n' + '▓'.repeat(60))
      console.log('▓  USER BOT - Testing Attendee Features')
      console.log('▓'.repeat(60))
      
      const userBot = new UserBot()
      await userBot.runAllTests()
    }
    
  } catch (error) {
    console.error('\n❌ Critical error during bot execution:', error)
  }
  
  reporter.endRun()
  
  // Exit with appropriate code
  const exitCode = reporter.results.summary.failed > 0 ? 1 : 0
  process.exit(exitCode)
}

// Run the bots
runBots().catch(console.error)
