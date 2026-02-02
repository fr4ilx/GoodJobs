/**
 * Gmail API integration: OAuth + create drafts in user's Gmail.
 * Uses Google Identity Services for OAuth; Gmail API for drafts.
 */

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const GMAIL_DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

function getGoogleClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!id || id.startsWith('YOUR_') || id === '') {
    console.warn('VITE_GOOGLE_CLIENT_ID not set. Add your Google OAuth Web client ID for Gmail integration.');
    return '';
  }
  return id;
}

/** Encode string to base64url (RFC 4648). */
function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build RFC 2822 message and base64url encode for Gmail API. Gmail sets From from the authenticated user. */
function buildRawMessage(to: string, subject: string, body: string): string {
  const header = `To: ${to}\r\nSubject: ${subject}\r\n`;
  const full = header + '\r\n' + body.replace(/\r?\n/g, '\r\n');
  return base64UrlEncode(full);
}

/**
 * Request Gmail access via Google Identity Services OAuth.
 * Returns access token or null if user denies or config missing.
 */
export function requestGmailAccess(): Promise<string | null> {
  return new Promise((resolve) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      resolve(null);
      return;
    }
    if (typeof window === 'undefined') {
      resolve(null);
      return;
    }
    // Wait briefly for GIS script to load
    const tryInit = (attempt = 0) => {
      if (window.google?.accounts?.oauth2) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GMAIL_SCOPE,
          callback: (response) => resolve(response.access_token || null)
        });
        client.requestAccessToken();
        return;
      }
      if (attempt < 20) {
        setTimeout(() => tryInit(attempt + 1), 100);
      } else {
        console.error('Google Identity Services did not load. Ensure https://accounts.google.com/gsi/client is loaded.');
        resolve(null);
      }
    };
    tryInit();
  });
}

/**
 * Create a draft in the user's Gmail.
 * @param accessToken - OAuth access token with gmail.compose scope
 * @param to - Recipient email
 * @param subject - Email subject
 * @param body - Email body (plain text)
 * @param fromEmail - Optional From address (defaults to user's Gmail when creating via API)
 */
export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id?: string; error?: string }> {
  const raw = buildRawMessage(to, subject, body);
  const response = await fetch(GMAIL_DRAFTS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: { raw } })
  });
  if (!response.ok) {
    const err = await response.text();
    console.error('Gmail API error:', response.status, err);
    return { error: `Gmail API error: ${response.status}` };
  }
  const data = await response.json();
  return { id: data.id };
}

/** Check if Gmail integration is configured. */
export function isGmailConfigured(): boolean {
  return !!getGoogleClientId();
}
