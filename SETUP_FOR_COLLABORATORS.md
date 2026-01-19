# Setup Guide for Collaborators

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GoodJobs
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

   **Get your Gemini API key:**
   - Go to: https://ai.google.dev/
   - Sign in with Google
   - Click "Get API Key"
   - Create a new API key or use existing
   - Copy and paste into `.env.local`

### 4. Firebase Configuration (Already Set Up!)

The Firebase configuration is already included in the project at `config/firebase.ts`.

**Important:** These Firebase API keys are **public and safe** to commit. They are:
- Client-side keys (meant to be public)
- Protected by Firebase Security Rules
- Cannot access your Firebase project without proper authentication

**No Firebase setup needed** - it's already configured and ready to use!

### 5. Run the Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

## 📋 What You Need

### Required
- ✅ **Gemini API Key** - For AI job matching (add to `.env.local`)
- ✅ **Node.js** (v16+) - JavaScript runtime

### Already Configured (Nothing to do!)
- ✅ **Firebase** - Already set up in the code
- ✅ **Firestore Database** - Shared database (already enabled)
- ✅ **Firebase Storage** - Shared file storage (already enabled)
- ✅ **Firebase Authentication** - Shared auth (already enabled)

## 🔑 Important Notes

### About Firebase
- The Firebase project is **shared** between collaborators
- All users connect to the **same database**
- Authentication, storage, and database are all shared
- Firebase API keys in the code are **safe and meant to be public**

### About API Keys
- **Gemini API Key**: Each developer needs their own (free tier available)
- **Firebase Keys**: Already in the code, shared between all developers

### What's in `.gitignore`
The following are **NOT** tracked in git (for security):
- `.env.local` - Your personal API keys
- `node_modules/` - Dependencies (installed via npm)
- `dist/` - Build output
- IDE settings

## 🧪 Testing the Setup

1. **Start the app**: `npm run dev`
2. **Sign up**: Create a test account
3. **Complete onboarding**: Add preferences and resume
4. **View jobs**: You should see AI-matched job listings

If everything works, you're all set! 🎉

## 🆘 Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Gemini API not working
- Check `.env.local` has `GEMINI_API_KEY=...`
- Restart dev server after adding the key
- Verify API key at: https://ai.google.dev/

### Firebase errors
- Should not happen (already configured)
- If you see auth errors, check FIREBASE_SETUP.md

## 📚 Documentation

- [README.md](README.md) - Project overview
- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Firebase configuration details
- [FIREBASE_EMAIL_SETUP.md](FIREBASE_EMAIL_SETUP.md) - Email troubleshooting
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details

## 🤝 Development Workflow

1. Pull latest changes: `git pull`
2. Install new dependencies: `npm install`
3. Make your changes
4. Test locally: `npm run dev`
5. Commit and push:
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```

## ⚠️ Never Commit

- ❌ `.env.local` - Contains your Gemini API key
- ❌ `node_modules/` - Large folder, installed via npm
- ✅ Firebase config is fine - it's meant to be public!

Happy coding! 🚀
