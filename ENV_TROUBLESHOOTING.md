# Environment Variables Troubleshooting

## 🔧 Quick Fixes

### Issue: App Not Seeing Environment Variables

**Solution 1: Restart Dev Server**
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

**Solution 2: Clear Vite Cache**
```bash
rm -rf node_modules/.vite
npm run dev
```

**Solution 3: Verify .env.local Format**
Make sure your `.env.local` file looks exactly like this:
```bash
GEMINI_API_KEY=your_gemini_key_here
VITE_APIFY_TOKEN=your_apify_token_here
```

**Important:**
- ✅ No spaces around `=`
- ✅ No quotes needed
- ✅ One variable per line
- ✅ File must be named `.env.local` (not `.env` or `.env.local.txt`)

## 🐛 Common Issues

### "Missing VITE_APIFY_TOKEN" Error

**Check:**
1. File is named `.env.local` (exactly)
2. Token is on its own line: `VITE_APIFY_TOKEN=apify_xxxxx`
3. No extra spaces or quotes
4. Dev server was restarted after adding

**Test:**
```bash
# Check if Vite can see it:
npm run dev
# Then in browser console, check:
console.log(import.meta.env.VITE_APIFY_TOKEN)
```

### Variables Not Loading

**Vite requires:**
- Variables must start with `VITE_` prefix
- Dev server must be restarted after changes
- File must be in project root (same level as `package.json`)

**Verify location:**
```bash
ls -la .env.local
# Should show file in project root
```

### Still Not Working?

1. **Check file location:**
   ```bash
   pwd  # Should be in GoodJobs directory
   ls .env.local  # Should exist
   ```

2. **Check file contents:**
   ```bash
   cat .env.local
   # Should show your tokens
   ```

3. **Clear all caches:**
   ```bash
   rm -rf node_modules/.vite
   rm -rf dist
   npm run dev
   ```

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for error messages
   - Check if `import.meta.env.VITE_APIFY_TOKEN` is undefined

## ✅ Verification

After adding tokens and restarting:

1. **Open browser console** (F12)
2. **Type:** `import.meta.env.VITE_APIFY_TOKEN`
3. **Should show:** Your token (not `undefined`)

If it shows `undefined`, the token isn't loading. Try:
- Double-check `.env.local` format
- Restart dev server again
- Clear Vite cache

## 📝 Correct .env.local Format

```bash
# Gemini API Key
GEMINI_API_KEY=AIzaSy...

# Apify API Token  
VITE_APIFY_TOKEN=apify_api_...

# No spaces, no quotes, one per line
```

## 🔄 After Making Changes

**Always restart dev server:**
```bash
# Stop: Ctrl+C
# Start: npm run dev
```

Vite only reads `.env.local` when the server starts!
