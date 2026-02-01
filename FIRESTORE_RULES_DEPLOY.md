# Fix Firestore "Missing or insufficient permissions"

To resolve the Firestore permission errors, deploy the security rules:

## Option 1: Firebase CLI (recommended)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Init (if not done): `firebase init firestore` — select existing project, use `firestore.rules`
4. Deploy rules: `firebase deploy --only firestore:rules`

## Option 2: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Firestore Database → Rules
3. Copy the contents of `firestore.rules` and paste into the editor
4. Click "Publish"
