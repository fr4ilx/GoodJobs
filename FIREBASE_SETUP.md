# Firebase Setup Guide

## Firebase Services Enabled

### 1. Authentication
- Email/Password authentication
- Google OAuth
- Located in: Firebase Console → Authentication

### 2. Firestore Database
- NoSQL database for user profiles
- Located in: Firebase Console → Firestore Database

### 3. Storage
- File storage for resumes and projects
- Located in: Firebase Console → Storage

## Firestore Database Structure

### Collection: `users`
Document ID: `{userId}` (Firebase Auth UID)

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "preferences": {
    "jobTitle": ["Software Engineer", "Full Stack Developer"],
    "location": ["San Francisco, CA", "Remote"],
    "workType": "Remote",
    "requiresSponsorship": false
  },
  "resumeContent": "Experience: Software Engineer...",
  "resumeFileURLs": [
    "https://firebasestorage.../users/{userId}/resumes/123_resume.pdf"
  ],
  "projectFileURLs": [
    "https://firebasestorage.../users/{userId}/projects/456_project.zip"
  ],
  "projectLinks": [
    "https://github.com/username/project",
    "https://portfolio.com"
  ],
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## Firebase Storage Structure

```
users/
  {userId}/
    resumes/
      {timestamp}_resume.pdf
      {timestamp}_resume.docx
    projects/
      {timestamp}_project.zip
      {timestamp}_presentation.pptx
```

## Setup Instructions

### Step 1: Enable Firestore
1. Go to Firebase Console: https://console.firebase.google.com/project/goodjobs-5f53a
2. Click "Firestore Database" in the left sidebar
3. Click "Create database"
4. Choose "Start in production mode" (we'll add security rules next)
5. Select a location (us-central or your preferred region)
6. Click "Enable"

### Step 2: Add Firestore Security Rules
Go to Firestore → Rules and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Job analyses (matching scores) per user
      match /jobAnalyses/{jobId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    // Jobs collection: anyone can read, only authenticated can write (for seeding)
    match /jobs/{jobId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

### Step 3: Enable Storage
1. Click "Storage" in the left sidebar
2. Click "Get Started"
3. Use default security rules for now
4. Select same location as Firestore
5. Click "Done"

### Step 4: Add Storage Security Rules
Go to Storage → Rules and paste this:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## What Gets Stored

### On Sign Up/Sign In
- Email and name are saved to Firestore
- User document created in `users` collection

### On Preferences Page Completion
- Job titles (array)
- Locations (array)
- Work type preference
- Visa sponsorship requirement
- Saved to user's Firestore document

### On Resume Page Completion
- **Resume text** (required) → stored in Firestore
- **Resume files** (optional) → uploaded to Storage, URLs saved in Firestore
- **Project files** (optional) → uploaded to Storage, URLs saved in Firestore
- **Project links** (optional) → saved directly in Firestore

## Features

- ✅ Multiple resume files support (PDF, DOC, DOCX, TXT)
- ✅ Multiple project files support (any format)
- ✅ Multiple project links (GitHub, portfolio, etc.)
- ✅ Drag and drop file upload
- ✅ File size tracking
- ✅ Individual file removal
- ✅ Automatic file URL generation
- ✅ Persistent storage across sessions

## Testing

After setup, test by:
1. Creating a new account
2. Completing preferences (should save to Firestore)
3. Uploading resume + projects (should upload to Storage)
4. Check Firestore Console to see the data
5. Check Storage Console to see the uploaded files
