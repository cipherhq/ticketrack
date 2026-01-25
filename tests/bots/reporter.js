/**
 * Bot Test Reporter
 * 
 * Collects test results, logs issues, and generates reports
 */

import fs from 'fs'
import path from 'path'
import { BOT_CONFIG } from './config.js'

class TestReporter {
  constructor() {
    this.results = {
      startTime: null,
      endTime: null,
      duration: null,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
      },
      tests: [],
      issues: [],
    }
    this.currentTest = null
  }

  // Start the test run
  startRun() {
    this.results.startTime = new Date().toISOString()
    console.log('\n' + '='.repeat(60))
    console.log('🤖 BOT TEST RUN STARTED')
    console.log('='.repeat(60))
    console.log(`Started at: ${this.results.startTime}`)
    console.log('')
  }

  // End the test run
  endRun() {
    this.results.endTime = new Date().toISOString()
    this.results.duration = 
      (new Date(this.results.endTime) - new Date(this.results.startTime)) / 1000

    console.log('\n' + '='.repeat(60))
    console.log('🤖 BOT TEST RUN COMPLETED')
    console.log('='.repeat(60))
    console.log(`Duration: ${this.results.duration.toFixed(2)}s`)
    console.log('')
    this.printSummary()
    this.saveReport()
  }

  // Start a test
  startTest(botName, testName, description) {
    this.currentTest = {
      bot: botName,
      name: testName,
      description,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      steps: [],
      errors: [],
      screenshots: [],
    }
    
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`🔄 [${botName}] ${testName}`)
    console.log(`   ${description}`)
  }

  // Log a step within a test
  logStep(step, success = true) {
    if (this.currentTest) {
      this.currentTest.steps.push({
        step,
        success,
        timestamp: new Date().toISOString(),
      })
    }
    
    const icon = success ? '✓' : '✗'
    const color = success ? '\x1b[32m' : '\x1b[31m'
    console.log(`   ${color}${icon}\x1b[0m ${step}`)
  }

  // Log an error
  logError(error, screenshot = null) {
    const errorInfo = {
      message: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      screenshot,
    }

    if (this.currentTest) {
      this.currentTest.errors.push(errorInfo)
      if (screenshot) {
        this.currentTest.screenshots.push(screenshot)
      }
    }

    console.log(`   \x1b[31m✗ ERROR: ${error.message || error}\x1b[0m`)
  }

  // End a test
  endTest(status, screenshotPath = null) {
    if (!this.currentTest) return

    this.currentTest.status = status
    this.currentTest.endTime = new Date().toISOString()
    this.currentTest.duration = 
      (new Date(this.currentTest.endTime) - new Date(this.currentTest.startTime)) / 1000

    if (screenshotPath) {
      this.currentTest.screenshots.push(screenshotPath)
    }

    // Update summary
    this.results.summary.total++
    if (status === 'passed') {
      this.results.summary.passed++
      console.log(`   \x1b[32m✓ PASSED\x1b[0m (${this.currentTest.duration.toFixed(2)}s)`)
    } else if (status === 'failed') {
      this.results.summary.failed++
      console.log(`   \x1b[31m✗ FAILED\x1b[0m (${this.currentTest.duration.toFixed(2)}s)`)
      
      // Add to issues list
      this.results.issues.push({
        bot: this.currentTest.bot,
        test: this.currentTest.name,
        errors: this.currentTest.errors,
        screenshots: this.currentTest.screenshots,
      })
    } else if (status === 'skipped') {
      this.results.summary.skipped++
      console.log(`   \x1b[33m⊘ SKIPPED\x1b[0m`)
    }

    this.results.tests.push({ ...this.currentTest })
    this.currentTest = null
  }

  // Print summary
  printSummary() {
    const { total, passed, failed, skipped } = this.results.summary
    
    console.log('SUMMARY:')
    console.log(`  Total:   ${total}`)
    console.log(`  \x1b[32mPassed:  ${passed}\x1b[0m`)
    console.log(`  \x1b[31mFailed:  ${failed}\x1b[0m`)
    console.log(`  \x1b[33mSkipped: ${skipped}\x1b[0m`)
    console.log('')

    if (this.results.issues.length > 0) {
      console.log('\x1b[31mISSUES FOUND:\x1b[0m')
      this.results.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.bot}] ${issue.test}`)
        issue.errors.forEach(err => {
          console.log(`     - ${err.message}`)
        })
      })
      console.log('')
    }
  }

  // Save report to file
  saveReport() {
    const reportsDir = BOT_CONFIG.reports.directory
    
    // Ensure directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `bot-test-report-${timestamp}.json`
    const filepath = path.join(reportsDir, filename)

    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2))
    console.log(`Report saved: ${filepath}`)

    // Also generate HTML if configured
    if (BOT_CONFIG.reports.format === 'html' || BOT_CONFIG.reports.format === 'both') {
      this.generateHtmlReport(reportsDir, timestamp)
    }

    return filepath
  }

  // Generate HTML report
  generateHtmlReport(reportsDir, timestamp) {
    const { summary, tests, issues, duration } = this.results
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bot Test Report - ${timestamp}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 20px; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
    .stat { background: white; padding: 20px; border-radius: 8px; flex: 1; text-align: center; }
    .stat h3 { font-size: 32px; margin-bottom: 5px; }
    .stat.passed h3 { color: #22c55e; }
    .stat.failed h3 { color: #ef4444; }
    .stat.skipped h3 { color: #f59e0b; }
    .tests { background: white; border-radius: 8px; overflow: hidden; }
    .test { padding: 15px 20px; border-bottom: 1px solid #eee; }
    .test:last-child { border-bottom: none; }
    .test-header { display: flex; justify-content: space-between; align-items: center; }
    .test-name { font-weight: 600; }
    .test-bot { color: #666; font-size: 14px; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge.passed { background: #dcfce7; color: #166534; }
    .badge.failed { background: #fee2e2; color: #991b1b; }
    .badge.skipped { background: #fef3c7; color: #92400e; }
    .steps { margin-top: 10px; padding-left: 20px; font-size: 14px; color: #666; }
    .step { padding: 2px 0; }
    .step.success::before { content: '✓ '; color: #22c55e; }
    .step.failed::before { content: '✗ '; color: #ef4444; }
    .issues { background: #fee2e2; border-radius: 8px; padding: 20px; margin-top: 30px; }
    .issues h2 { color: #991b1b; margin-bottom: 15px; }
    .issue { background: white; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .issue:last-child { margin-bottom: 0; }
    .error { color: #991b1b; font-family: monospace; font-size: 13px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 Bot Test Report</h1>
    <p style="color: #666; margin-bottom: 20px;">Generated: ${new Date().toLocaleString()} | Duration: ${duration?.toFixed(2)}s</p>
    
    <div class="summary">
      <div class="stat"><h3>${summary.total}</h3><p>Total Tests</p></div>
      <div class="stat passed"><h3>${summary.passed}</h3><p>Passed</p></div>
      <div class="stat failed"><h3>${summary.failed}</h3><p>Failed</p></div>
      <div class="stat skipped"><h3>${summary.skipped}</h3><p>Skipped</p></div>
    </div>
    
    <h2 style="margin-bottom: 15px;">Test Results</h2>
    <div class="tests">
      ${tests.map(test => `
        <div class="test">
          <div class="test-header">
            <div>
              <span class="test-name">${test.name}</span>
              <span class="test-bot"> - ${test.bot}</span>
            </div>
            <span class="badge ${test.status}">${test.status.toUpperCase()}</span>
          </div>
          <div class="steps">
            ${test.steps.map(step => `<div class="step ${step.success ? 'success' : 'failed'}">${step.step}</div>`).join('')}
          </div>
          ${test.errors.length > 0 ? `<div class="error">${test.errors.map(e => e.message).join('<br>')}</div>` : ''}
        </div>
      `).join('')}
    </div>
    
    ${issues.length > 0 ? `
    <div class="issues">
      <h2>⚠️ Issues Found (${issues.length})</h2>
      ${issues.map(issue => `
        <div class="issue">
          <strong>[${issue.bot}] ${issue.test}</strong>
          ${issue.errors.map(e => `<div class="error">${e.message}</div>`).join('')}
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>
</body>
</html>`

    const filepath = path.join(reportsDir, `bot-test-report-${timestamp}.html`)
    fs.writeFileSync(filepath, html)
    console.log(`HTML Report saved: ${filepath}`)
  }
}

// Singleton instance
export const reporter = new TestReporter()
export default reporter
