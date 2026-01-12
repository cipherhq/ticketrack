#!/usr/bin/env python3

file_path = '/Users/bajideace/Desktop/ticketrack/supabase/functions/stripe-connect-webhook/index.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Replace console.log` with console.log(` 
# The backtick after log should be preceded by (
old = 'console.log`'
new = 'console.log(`'
content = content.replace(old, new)

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed!")
