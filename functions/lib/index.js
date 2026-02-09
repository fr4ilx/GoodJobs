/**
 * Apollo proxy - calls Apollo API from the server to avoid CORS.
 * API key is stored securely in Firebase Secrets (APOLLO_API_KEY).
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
const apolloApiKey = defineSecret("APOLLO_API_KEY");
const APOLLO_BASE = "https://api.apollo.io/api/v1";
export const apolloFindEmail = onCall({ secrets: [apolloApiKey] }, async (request) => {
    const key = apolloApiKey.value();
    if (!key) {
        throw new HttpsError("failed-precondition", "Apollo API key not configured. Run: firebase functions:secrets:set APOLLO_API_KEY");
    }
    const data = request.data;
    const firstName = data?.firstName?.trim();
    const lastName = data?.lastName?.trim();
    const organizationName = data?.organizationName?.trim();
    if (!firstName || !lastName || !organizationName) {
        throw new HttpsError("invalid-argument", "firstName, lastName, and organizationName are required");
    }
    const params = new URLSearchParams({
        first_name: firstName,
        last_name: lastName,
        organization_name: organizationName,
        run_waterfall_email: "false",
        run_waterfall_phone: "false",
        reveal_personal_emails: "true",
        reveal_phone_number: "false",
    });
    const response = await fetch(`${APOLLO_BASE}/people/match?${params.toString()}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Accept: "application/json",
            "x-api-key": key,
        },
        body: "{}",
    });
    if (!response.ok) {
        const text = await response.text();
        console.error("Apollo people/match error:", response.status, text);
        return null;
    }
    const result = await response.json();
    const person = result?.person;
    if (!person)
        return null;
    return {
        email: person.email,
        title: person.title,
        photo_url: person.photo_url,
    };
});
//# sourceMappingURL=index.js.map