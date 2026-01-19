<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GoodJobs - AI-Powered Job Matching Platform

An intelligent job matching platform that uses AI to match candidates with their ideal positions based on resume analysis and preferences.

View your app in AI Studio: https://ai.studio/apps/drive/1pmzV2WS8KBg1cR_Xp6LjrvXZEg5gh3G4

## Features

- 🔐 **Firebase Authentication** - Email/Password and Google OAuth
- 📝 **Smart Preferences** - Incremental fuzzy search for 254+ job titles and 92+ locations
- 📄 **Resume Upload** - Multiple file formats with drag & drop support
- 🚀 **Project Showcase** - Upload project files and add portfolio links
- 🤖 **AI Job Matching** - Gemini-powered semantic matching
- 💾 **Cloud Storage** - All data persisted in Firebase Firestore and Storage

## Prerequisites

- Node.js (v16 or higher)
- Firebase Account
- Gemini API Key

## Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Keys
Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

### 3. Set Up Firebase
Follow the instructions in [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to:
- Enable Firestore Database
- Enable Firebase Storage
- Configure security rules

### 4. Run the App
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Firebase Setup

**Important:** Before using the app, you must:
1. Enable Firestore Database in Firebase Console
2. Enable Firebase Storage in Firebase Console
3. Add security rules (instructions in FIREBASE_SETUP.md)

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed instructions.

## Project Structure

```
GoodJobs/
├── components/          # React components
│   ├── SignInPage.tsx  # Firebase email/password auth
│   ├── SignUpPage.tsx  # User registration
│   ├── PreferencesPage.tsx  # Job/location preferences with fuzzy search
│   └── ResumeUploadPage.tsx # Resume & project upload
├── services/
│   ├── authService.ts       # Firebase auth operations
│   ├── firestoreService.ts  # Database operations
│   └── geminiService.ts     # AI matching service
├── config/
│   └── firebase.ts          # Firebase configuration
├── data/
│   └── jobTitles.ts         # 254 job titles & 92 locations
└── types.ts                 # TypeScript interfaces
```

## User Flow

1. **Landing Page** → Get Started
2. **Sign Up/Sign In** → Firebase Authentication
3. **Step 1: Preferences**
   - Select job titles (multiple, searchable)
   - Select locations (multiple, searchable)
   - Work environment preferences
   - Visa sponsorship requirements
4. **Step 2: Resume & Projects**
   - Upload resume files (required)
   - Upload project files (optional)
   - Add project links (optional)
5. **Dashboard** → AI-matched job listings

## Deployment

### Deploy to Firebase Hosting

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase:
```bash
firebase init
```

4. Build and deploy:
```bash
npm run build
firebase deploy
```

Your app will be live at: `goodjobs-5f53a.web.app`

## Documentation

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Complete Firebase configuration guide
- [FIREBASE_EMAIL_SETUP.md](FIREBASE_EMAIL_SETUP.md) - Password reset email troubleshooting
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical implementation details

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **AI**: Google Gemini API
- **Build Tool**: Vite
- **Icons**: Font Awesome

## License

MIT

