# Firebase Storage CORS Configuration

## Problem
Your app is getting CORS errors when trying to fetch PDF files from Firebase Storage. This happens because Firebase Storage doesn't allow requests from your local dev origins (for example `http://localhost:3001`) by default.

## Solution: Configure CORS in Firebase Storage

You need to configure CORS for your Firebase Storage bucket to allow requests from your local development server.

### Quick Setup (Recommended)

I've created a `cors.json` file in your project root. Follow these steps:

### Step 1: Install Google Cloud SDK (if not already installed)

**On macOS:**
```bash
brew install google-cloud-sdk
```

**On Linux/Windows:**
Download from: https://cloud.google.com/sdk/docs/install

### Step 2: Authenticate with Google Cloud

```bash
gcloud auth login
```

This will open a browser window for you to sign in with your Google account (the one that has access to the Firebase project).

### Step 3: Set Your Project

```bash
gcloud config set project goodjobs-5f53a
```

### Step 4: Apply CORS Configuration

**Using gcloud (recommended):**
```bash
gcloud storage buckets update gs://goodjobs-5f53a.firebasestorage.app --cors-file=cors.json
```

**Or using gsutil (legacy):**
```bash
gsutil cors set cors.json gs://goodjobs-5f53a.firebasestorage.app
```

### Step 5: Verify CORS Configuration

```bash
gcloud storage buckets describe gs://goodjobs-5f53a.firebasestorage.app --format="value(cors)"
```

Or with gsutil:
```bash
gsutil cors get gs://goodjobs-5f53a.firebasestorage.app
```

This should show your CORS configuration.

## After Configuration

1. **Restart your dev server** (important!)
2. Try fetching PDFs again - CORS errors should be gone

## Troubleshooting

If you get permission errors:
- Make sure you're logged in with the correct Google account
- Ensure your account has "Storage Admin" or "Owner" role on the Firebase project
- You can check permissions in: Firebase Console → Project Settings → Users and permissions

## For Production

The `cors.json` file already includes production domains. If you add a new domain, update it and re-apply:

```json
[
  {
    "origin": [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "https://job-studio.net",
      "https://www.job-studio.net",
      "https://goodjobs-5f53a.web.app",
      "https://goodjobs-5f53a.firebaseapp.com"
    ],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

Then run the same `gcloud storage buckets update` command again.

## Important: Apply CORS for PDF Extraction

If you see **"Firebase Storage request timeout"** or **"Could not extract text from PDF"** when using Apply Changes on the Resume page:

1. Ensure CORS is configured with your app's origin (including production domain)
2. Run: `gcloud storage buckets update gs://goodjobs-5f53a.firebasestorage.app --cors-file=cors.json`
3. Refresh the app and try again
