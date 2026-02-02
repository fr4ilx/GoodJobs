# Apollo.io API Setup

Apollo.io is used in the **Connect** tab to **find email** for contacts you add manually. Networking is manual: you add contacts by name and company, then optionally find their email via Apollo and draft outreach via Gemini.

## Networking flow (manual)

1. **Add contact** – Enter first name, last name, and company name or URL for a job. You can add multiple contacts per job.
2. **Find email** – Click **Find email** on a contact to call Apollo’s **people/match** API (first name, last name, organization). If found, the contact’s email (and optionally title/photo) is filled in.
3. **Draft email** – Click **Draft email** to generate a personalized outreach draft with Gemini. You can then edit and use it to reach out.

## Apollo usage

- **Find email** uses `POST https://api.apollo.io/api/v1/people/match` with `first_name`, `last_name`, `organization_name` (from the contact’s company name or URL), and `reveal_personal_emails=true`. This consumes Apollo credits.
- **Without API key**: The **Find email** button still appears; the request will not return an email until `VITE_APOLLO_API_KEY` is set.

## 1. Create Apollo.io account

1. Sign up at [Apollo.io](https://www.apollo.io/)
2. Choose a plan (free trial available; paid plans have higher limits)

## 2. Get your API key

1. Log in to Apollo.io
2. Go to **Settings** → **API Keys**
3. Click **Create New Key** → select **Master API Key**
4. Copy the API key

## 3. Add to your environment

In `.env.local`:

```env
VITE_APOLLO_API_KEY=your_apollo_api_key_here
```

## 4. Restart dev server

```bash
npm run dev
```

## Troubleshooting

- **"Apollo API key not set"** – Add `VITE_APOLLO_API_KEY` to `.env.local` and restart the dev server.
- **API errors** – Ensure the key is a **Master API Key** (not a regular API key).
- **No email found** – Check first/last name and company name (or URL) for typos; Apollo may not have the person in their database.
- **Rate limits** – Check your Apollo plan or wait for the limit to reset.
