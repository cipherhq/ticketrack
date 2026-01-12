#!/usr/bin/env python3
import re

file_path = '/Users/bajideace/Desktop/ticketrack/supabase/functions/stripe-connect-webhook/index.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Fix console.log` to console.log(`
# The pattern is: console.log` followed by text and ending with `);
content = re.sub(r'console\.log`([^`]+)`\);', r'console.log(`\1`);', content)

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed console.log syntax")
