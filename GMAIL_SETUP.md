# Gmail Integration Setup

The Connect section can save outreach drafts directly to your Gmail. Users click **Connect Gmail** to authorize, then **Save to Gmail** to create a draft in their Gmail drafts folder.

## 1. Enable Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the project linked to your Firebase app (e.g. `goodjobs-5f53a`)
3. Go to **APIs & Services** → **Library**
4. Search for **Gmail API** and click **Enable**

## 2. Get OAuth Client ID

You need a **Web application** OAuth 2.0 Client ID (the same one used for Firebase Auth or a new one):

1. **APIs & Services** → **Credentials**
2. If you have a **Web client** from Firebase Auth, use that Client ID. Otherwise create one: **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Add **Authorized JavaScript origins** (e.g. `http://localhost:3000`, `https://your-domain.web.app`)
5. Copy the **Client ID** (e.g. `123456789-xxxx.apps.googleusercontent.com`)

## 3. OAuth Consent Screen

1. **APIs & Services** → **OAuth consent screen**
2. Add the Gmail scope: `https://www.googleapis.com/auth/gmail.compose` (to create drafts)
3. Add your app to the **Scopes** and save

## 4. Environment Variable

In `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your_oauth_web_client_id_here
```

Use the **Client ID** from step 2 (not the Client secret).

## 5. Restart Dev Server

```bash
npm run dev
```

## Usage

1. In the **Connect** tab, open a job and add a contact.
2. Click **Draft Email** to generate an outreach draft.
3. In the workbench header, click **Connect Gmail** and authorize in the Google popup.
4. Edit subject/body as needed.
5. Click **Save to Gmail** to create the draft in your Gmail drafts folder.
6. Open Gmail to view and send the draft.

## Troubleshooting

- **"Gmail integration not configured"** – Add `VITE_GOOGLE_CLIENT_ID` to `.env.local` and restart.
- **Popup blocked** – Allow popups for your app’s origin.
- **Access denied / 403** – Ensure Gmail API is enabled and the OAuth consent screen includes the Gmail scope.
- **Token expires** – The access token lasts about an hour. Click **Connect Gmail** again if needed.
