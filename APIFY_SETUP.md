# Apify API Setup Guide

## 🔑 Why You Need This

The job scraping functionality uses **Apify** to fetch real LinkedIn job listings. You need an Apify API token to use this feature.

## 📋 Quick Setup (5 minutes)

### Step 1: Create Apify Account

1. Go to: https://apify.com/
2. Click **"Sign Up"** (top right)
3. Sign up with Google/GitHub or email
4. **Free tier includes $5 credit** (enough for testing)

### Step 2: Get Your API Token

1. After signing up, go to: https://console.apify.com/account/integrations
2. Scroll to **"API tokens"** section
3. Click **"Create token"**
4. Give it a name (e.g., "GoodJobs Development")
5. **Copy the token** (you'll only see it once!)

### Step 3: Add Token to Your Project

1. Open your `.env.local` file in the project root
2. Add this line:
   ```
   VITE_APIFY_TOKEN=your_apify_token_here
   ```
3. Replace `your_apify_token_here` with the token you copied
4. **Save the file**

### Step 4: Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## ✅ Verify It's Working

1. Go to **Profile** tab
2. Click **"Modify"** in preferences
3. Make any change (or just confirm)
4. Go to **Jobs** tab
5. You should see: **"Loading jobs from LinkedIn..."**
6. Jobs should appear within 30-60 seconds

## 🐛 Troubleshooting

### Error: "Missing VITE_APIFY_TOKEN"

**Solution:**
- Check `.env.local` exists in project root
- Verify the token is on one line: `VITE_APIFY_TOKEN=apify_xxxxx`
- **Restart dev server** after adding token
- Make sure there are no spaces around the `=`

### Error: "Failed to start Apify run"

**Possible causes:**
- Invalid API token (check it's correct)
- Apify account needs verification
- Rate limit exceeded (free tier has limits)

**Solution:**
- Verify token at: https://console.apify.com/account/integrations
- Check Apify account status
- Wait a few minutes and try again

### No Jobs Appearing

**Check:**
1. Open browser **Developer Console** (F12)
2. Look for error messages
3. Check if you see: `"Starting LinkedIn job scrape..."`
4. Check if you see: `"Fetched X jobs from Apify"`

**Common issues:**
- Token not loaded (restart dev server)
- Preferences too restrictive (try broader search)
- Apify actor temporarily unavailable

## 💰 Apify Pricing

### Free Tier
- **$5 credit** per month
- ~50-100 job scrapes (depending on size)
- Perfect for development and testing

### Paid Plans
- **Starter**: $49/month - 1,000 actor units
- **Professional**: $499/month - 10,000 actor units

**Note:** For production, you'll likely need a paid plan.

## 🔒 Security

- ✅ **Never commit** `.env.local` to git
- ✅ Token is already in `.gitignore`
- ✅ Keep your token secret
- ✅ Rotate token if exposed

## 📚 Additional Resources

- Apify Docs: https://docs.apify.com/
- LinkedIn Scraper: https://apify.com/bebity/linkedin-jobs-scraper
- API Reference: https://apify.com/docs/api/v2

## 🆘 Still Having Issues?

1. **Check console logs** - Look for detailed error messages
2. **Verify token** - Test at: https://console.apify.com/account/integrations
3. **Check Apify status** - https://status.apify.com/
4. **Try manual test** - Use Apify console to run scraper manually

## 🎯 Quick Test

After setup, you should see in console:
```
🚀 Starting Apify run with EXACT flat structure: {...}
Apify Run Started: [run-id]
Scraping jobs... (RUNNING)
Fetched X jobs from Apify
```

If you see these logs, it's working! 🎉
