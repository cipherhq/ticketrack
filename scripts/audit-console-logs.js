#!/usr/bin/env node

/**
 * Console Log Security Audit Script
 * 
 * Scans codebase for console.log statements that might expose sensitive data
 * in production builds.
 * 
 * Usage: node scripts/audit-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SENSITIVE_KEYWORDS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'auth',
  'credential',
  'key',
  'private',
  'session',
  'cookie',
  'ssn',
  'credit_card',
  'card_number',
  'cvv',
  'pin',
  'otp',
];

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'scripts',
];

const CONSOLE_METHODS = ['console.log', 'console.error', 'console.warn', 'console.info', 'console.debug'];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function isSensitive(line, filePath) {
  const lowerLine = line.toLowerCase();
  
  // Check if line contains sensitive keywords
  const hasSensitiveKeyword = SENSITIVE_KEYWORDS.some(keyword => 
    lowerLine.includes(keyword)
  );
  
  // Check if line logs error objects directly (might contain sensitive data)
  const logsErrorObject = /console\.(log|error|warn|info)\([^)]*error[^)]*\)/i.test(line);
  
  // Check if line logs entire objects without filtering
  const logsLargeObject = /console\.(log|error|warn|info)\([^)]*\b(user|request|response|data|body|params|query)\b[^)]*\)/i.test(line);
  
  return hasSensitiveKeyword || logsErrorObject || logsLargeObject;
}

function findConsoleStatements(dir, results = { issues: [], stats: { total: 0, sensitive: 0, byFile: {} } }) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (shouldIgnore(fullPath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      findConsoleStatements(fullPath, results);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const lineNum = index + 1;
          const trimmedLine = line.trim();
          
          // Check if line contains console statements
          const hasConsole = CONSOLE_METHODS.some(method => trimmedLine.includes(method));
          
          if (hasConsole) {
            const relativePath = path.relative(process.cwd(), fullPath);
            results.stats.total++;
            
            if (!results.stats.byFile[relativePath]) {
              results.stats.byFile[relativePath] = 0;
            }
            results.stats.byFile[relativePath]++;
            
            // Check if potentially sensitive
            if (isSensitive(trimmedLine, fullPath)) {
              results.stats.sensitive++;
              results.issues.push({
                file: relativePath,
                line: lineNum,
                content: trimmedLine,
                severity: 'medium',
              });
            }
          }
        });
      } catch (error) {
        console.warn(`Error reading ${fullPath}:`, error.message);
      }
    }
  }
  
  return results;
}

function generateReport(results) {
  console.log('\n========================================');
  console.log('Console Log Security Audit Report');
  console.log('========================================\n');
  
  console.log(`Total console statements found: ${results.stats.total}`);
  console.log(`Potentially sensitive: ${results.stats.sensitive}\n`);
  
  if (results.issues.length > 0) {
    console.log('⚠️  POTENTIALLY SENSITIVE CONSOLE STATEMENTS:\n');
    
    // Group by file
    const byFile = {};
    results.issues.forEach(issue => {
      if (!byFile[issue.file]) {
        byFile[issue.file] = [];
      }
      byFile[issue.file].push(issue);
    });
    
    Object.entries(byFile).forEach(([file, issues]) => {
      console.log(`\n📄 ${file}:`);
      issues.forEach(issue => {
        console.log(`   Line ${issue.line}: ${issue.content.substring(0, 80)}${issue.content.length > 80 ? '...' : ''}`);
      });
    });
    
    console.log('\n💡 Recommendations:');
    console.log('   - Use logger.js utility for production-safe logging');
    console.log('   - Remove sensitive data before logging');
    console.log('   - Use logger.error() which sanitizes errors automatically');
    console.log('   - Replace console.log() with logger.debug() for dev-only logs\n');
  } else {
    console.log('✅ No potentially sensitive console statements found!\n');
  }
  
  // Top files with most console statements
  const topFiles = Object.entries(results.stats.byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (topFiles.length > 0) {
    console.log('📊 Top 10 files with most console statements:\n');
    topFiles.forEach(([file, count]) => {
      console.log(`   ${count.toString().padStart(3)} - ${file}`);
    });
  }
  
  console.log('\n========================================\n');
}

// Main execution
const srcDir = path.join(process.cwd(), 'src');
const supabaseDir = path.join(process.cwd(), 'supabase', 'functions');

if (!fs.existsSync(srcDir)) {
  console.error('Error: src directory not found');
  process.exit(1);
}

console.log('Scanning codebase for console statements...\n');

const results = findConsoleStatements(srcDir);

// Also scan supabase functions if they exist
if (fs.existsSync(supabaseDir)) {
  findConsoleStatements(supabaseDir, results);
}

generateReport(results);

// Exit with error code if sensitive issues found
if (results.issues.length > 0) {
  console.log(`⚠️  Found ${results.issues.length} potentially sensitive console statements`);
  console.log('   Review and fix before production deployment\n');
  process.exit(1);
} else {
  console.log('✅ Audit passed - no sensitive console statements found\n');
  process.exit(0);
}
