# Fix npm Permissions (EACCES Error)

If you're getting `EACCES: permission denied` errors when installing npm packages globally, here are solutions:

## Solution 1: Use npx (Recommended - No Installation Needed)

Instead of installing packages globally, use `npx` to run them:

```bash
# Instead of: npm install -g supabase
# Use:
npx supabase login
npx supabase link --project-ref bkvbvggngttrizbchygy
npx supabase functions deploy send-birthday-emails
```

This works without any installation or permission fixes.

## Solution 2: Fix npm Permissions (Recommended for Global Installs)

Configure npm to use a directory you own:

```bash
# Create a directory for global packages
mkdir ~/.npm-global

# Configure npm to use this directory
npm config set prefix '~/.npm-global'

# Add to your PATH (for zsh)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc

# Reload your shell configuration
source ~/.zshrc

# Now you can install globally without sudo
npm install -g supabase
```

## Solution 3: Use sudo (Not Recommended)

If you must use the system directory:

```bash
sudo npm install -g supabase
```

**Warning**: Using sudo can cause permission issues later. Solution 2 is better.

## Solution 4: Fix Existing npm Directory Permissions

If you want to fix the existing `/usr/local/lib/node_modules` directory:

```bash
# Change ownership of npm directories
sudo chown -R $(whoami) /usr/local/lib/node_modules
sudo chown -R $(whoami) /usr/local/bin
sudo chown -R $(whoami) /usr/local/share

# Then try installing again
npm install -g supabase
```

## For Your Current Situation

Since Supabase CLI is already installed at `/usr/local/bin/supabase`, you can use it directly:

```bash
# Check version
supabase --version

# Login
supabase login

# Link project
supabase link --project-ref bkvbvggngttrizbchygy

# Deploy function
supabase functions deploy send-birthday-emails
```

No need to reinstall!
