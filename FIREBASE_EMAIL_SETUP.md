# Firebase Email Configuration Guide

## Why You're Not Receiving Password Reset Emails

Firebase Authentication can send password reset emails, but there are some setup requirements and common issues:

## Required Setup in Firebase Console

### Step 1: Verify Email Templates are Enabled

1. Go to: https://console.firebase.google.com/project/goodjobs-5f53a/authentication/emails
2. Click on **"Templates"** tab
3. Find **"Password reset"** template
4. Click **"Edit"** (pencil icon)
5. Verify it's enabled and customize if needed:
   - **Sender name**: GoodJobs (or your company name)
   - **Reply-to email**: Your support email
   - You can customize the message template

### Step 2: Check Authentication Settings

1. Go to: https://console.firebase.google.com/project/goodjobs-5f53a/authentication/settings
2. Under **"Authorized domains"**:
   - Make sure `goodjobs-5f53a.firebaseapp.com` is listed
   - Add `localhost` if testing locally
   - Add your production domain when deployed

### Step 3: Verify the Email Address Exists

Firebase will only send password reset emails to registered users. Make sure:
- The email address you're using is actually registered
- Try with an email you used to sign up

## Common Issues & Solutions

### Issue 1: Email Goes to Spam
- Check your **Spam/Junk folder**
- Add `noreply@goodjobs-5f53a.firebaseapp.com` to your contacts

### Issue 2: Firebase Free Tier Email Limits
Firebase free tier has daily limits:
- **100 emails per day** for password resets
- If exceeded, emails won't send until next day

### Issue 3: Email Not Registered
- Password reset emails only work for existing users
- Firebase won't send emails to non-existent accounts (by design, for security)

### Issue 4: Email Provider Blocking
Some email providers (especially corporate emails) may block Firebase emails:
- Try with a Gmail, Outlook, or Yahoo email
- Check with your IT department if using corporate email

## Testing Password Reset

1. **Create a test account** with a real email you can access
2. Sign out
3. Click "Forgot Password"
4. Enter the email you just registered with
5. Check your inbox (and spam folder)
6. Click the reset link in the email
7. Set a new password

## Email Template Example

The default Firebase password reset email looks like this:

```
Subject: Reset your password for GoodJobs

Hello,

Follow this link to reset your GoodJobs password for your [email] account.

[Reset Password Button/Link]

If you didn't ask to reset your password, you can ignore this email.

Thanks,
Your GoodJobs team
```

## Advanced: Custom Email Handler (Optional)

For production apps, consider:
1. **SendGrid** - Professional email service
2. **Custom SMTP** - Your own email server
3. **Firebase Cloud Functions** - Custom email templates

## Troubleshooting Checklist

- [ ] Email address is registered in Firebase Authentication
- [ ] Checked spam/junk folder
- [ ] Tried with a common email provider (Gmail, Outlook)
- [ ] Verified authentication is enabled in Firebase Console
- [ ] Checked daily email limit hasn't been exceeded
- [ ] Waited 5-10 minutes (sometimes delayed)
- [ ] Authorized domains include your domain

## Quick Test

To verify Firebase email is working:

1. **Create a new account** with your personal Gmail
2. Immediately try **password reset** with that email
3. If it works → Email system is fine, original email might be blocked
4. If it doesn't work → Check Firebase Console settings above

## Need Help?

If emails still don't work after following this guide:
1. Check Firebase Console → Authentication → Users (verify user exists)
2. Try with a different email provider
3. Check browser console for errors
4. Verify you're not hitting rate limits
