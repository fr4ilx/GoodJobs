# Secrets audit and how to remove them from git history

## Audit (current working tree – no code changed)

### Current state: no secrets in tracked files

- **Extension**: `extension/lib/firebase-config.js` and all bundles use placeholders (`YOUR_FIREBASE_API_KEY`, `YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com`). No real keys in the repo right now.
- **Main app**: Gemini, Apollo, Apify, Gmail use `import.meta.env.VITE_*` only. No hardcoded API keys in tracked `.ts`/`.tsx`/`.js` files.
- **Examples**: `config/firebase.example.ts` has placeholders only.
- **Docs**: Only example values (e.g. `your_apollo_api_key_here`) and project IDs like `goodjobs-5f53a` (not secret).

### Local-only (gitignored) – keep that way

- **config/firebase.ts** – Contains real Firebase API key and config. It is in `.gitignore`, so it is not in the current commit. If it was ever committed in the past, it still exists in **git history**.

### What was committed before (and may still be in history)

You mentioned committing the client ID (and previously the extension had real Firebase config). So in **past commits**, the following may appear:

1. **Firebase Web API key**: `AIzaSyB62ucftX4DyuyJdDcaVIosSjHAT-Kvx8c`
2. **Google OAuth Web client ID**: `68652844033-bicc32945qc9isggb0g9ojp67i6o4ofo.apps.googleusercontent.com` (or similar)
3. **Firebase config**: projectId `goodjobs-5f53a`, appId, etc. (project ID is not secret; API key and client ID are.)

To be safe, assume anything that was ever committed is still in history until you rewrite history and rotate the credentials.

---

## How to remove secrets from git history

You have to **rewrite history** so that no commit ever contains the secret values. After that, **rotate every credential** that ever appeared in the repo.

### Option A: git-filter-repo (recommended)

1. **Install**  
   - macOS: `brew install git-filter-repo`  
   - Or: https://github.com/newren/git-filter-repo

2. **Back up the repo**  
   ```bash
   cd /path/to/GoodJobs
   cp -r . ../GoodJobs-backup
   ```

3. **Replace secrets in history with placeholders**  
   Replace the exact strings that were committed (use the real values you know you committed):

   ```bash
   cd /Users/syeo/Documents/GoodJobs

   git filter-repo --replace-text <(cat <<'EOF'
   AIzaSyB62ucftX4DyuyJdDcaVIosSjHAT-Kvx8c==>YOUR_FIREBASE_API_KEY
   68652844033-bicc32945qc9isggb0g9ojp67i6o4ofo.apps.googleusercontent.com==>YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com
   EOF
   )
   ```

   If your client ID was different, change the left side to the exact string that was in the repo. You can add more lines for any other secrets (e.g. other API keys) in the same format: `exact_value==>replacement`.

4. **Force-push (destroys old history on the remote)**  
   ```bash
   git remote add origin <your-remote-url>   # if needed after filter-repo
   git push --force --all origin
   git push --force --tags origin
   ```

5. **Tell anyone else who cloned the repo** to re-clone; their history will no longer match.

### Option B: BFG Repo-Cleaner

1. **Install**: https://rtyley.github.io/bfg-repo-cleaner/

2. **Create a file** with one secret per line, e.g. `secrets.txt`:
   ```
   AIzaSyB62ucftX4DyuyJdDcaVIosSjHAT-Kvx8c
   68652844033-bicc32945qc9isggb0g9ojp67i6o4ofo.apps.googleusercontent.com
   ```

3. **Run** (from the repo root):
   ```bash
   java -jar bfg.jar --replace-text secrets.txt .git
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force --all origin
   ```
   BFG will replace those strings with `***REMOVED***` (or similar). If you prefer a specific placeholder, check BFG’s `--replace-text` docs.

### Option C: git filter-branch (built-in, slower)

```bash
git filter-branch --force --tree-filter '
  find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i "" "s/AIzaSyB62ucftX4DyuyJdDcaVIosSjHAT-Kvx8c/YOUR_FIREBASE_API_KEY/g" {} \;
  find . -type f \( -name "*.js" -o -name "*.ts" \) -exec sed -i "" "s/68652844033-bicc32945qc9isggb0g9ojp67i6o4ofo\.apps\.googleusercontent\.com/YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com/g" {} \;
' --tag-name-filter cat -- --all
```

Then:

```bash
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force --all origin
```

(On Linux, use `sed -i` instead of `sed -i ""`.)

---

## After rewriting history: rotate credentials

History rewrite only removes the old values from the repo. Anyone who ever saw a commit with the secrets could have copied them, so you must treat those credentials as compromised.

1. **Firebase / Google Cloud**
   - Google Cloud Console → APIs & Services → Credentials.
   - **Web API key** (Firebase): restrict it (e.g. by HTTP referrer / app ID) or create a new key and replace it in `config/firebase.ts` and any env/config.
   - **OAuth 2.0 Client ID** (Web client): the client ID itself is often considered public; if you ever committed the **client secret**, revoke/regenerate it. Restrict the client by redirect URIs / authorized domains.

2. **Any other keys**
   - If you ever committed Gemini, Apollo, Apify, or other API keys, rotate them in the respective dashboards and update `.env.local` (and never commit that file).

---

## Keeping secrets out going forward

- **config/firebase.ts** – Stays in `.gitignore`. Do not remove it.
- **.env.local** – Stays in `.gitignore`. All `VITE_*` keys stay there.
- **extension/lib/firebase-config.js** – Repo keeps **placeholders** only. Generate the real file with `node extension/scripts/set-firebase-config.js` (using env vars) and do **not** commit the generated file if it contains real keys; or keep the repo version as placeholders and document that in EXTENSION_SETUP.md.
- Before pushing, run:  
  `git diff --cached` and a quick search for `AIzaSy`, `apps.googleusercontent.com`, and token-like strings in staged files.
