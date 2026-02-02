/**
 * Apollo.io API service for finding recruiters.
 * Workflow: mixed_companies/search (find company by name) → mixed_people/api_search (find recruiters)
 *           → people/match (enrich each person for email).
 * Docs: https://docs.apollo.io/reference/people-api-search
 *       https://docs.apollo.io/reference/organization-search
 */

import { Recruiter } from '../types';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';
const APOLLO_API_KEY = import.meta.env.VITE_APOLLO_API_KEY || '';

interface ApolloOrganization {
  id: string;
  name: string;
  primary_domain?: string;
}

interface ApolloCompanySearchResponse {
  organizations: ApolloOrganization[];
  pagination?: { total_entries: number; total_pages: number };
}

interface ApolloPersonSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  linkedin_url?: string;
  title: string;
  organization_name?: string;
  city?: string;
  state?: string;
  country?: string;
  photo_url?: string;
}

interface ApolloPeopleSearchResponse {
  people: ApolloPersonSearchResult[];
  pagination?: { page: number; per_page: number; total_entries: number; total_pages: number };
}

interface ApolloPeopleMatchResponse {
  person?: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    email?: string;
    linkedin_url?: string;
    title?: string;
    organization_name?: string;
    photo_url?: string;
  };
}

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
  'accept': 'application/json',
  'x-api-key': APOLLO_API_KEY
};

/**
 * 1. Find company by name using mixed_companies/search.
 */
async function searchCompany(companyName: string): Promise<ApolloOrganization | null> {
  const response = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      q_organization_name: companyName,
      per_page: 1,
      page: 1
    })
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('Apollo mixed_companies/search error:', response.status, text);
    throw new Error(`Apollo company search failed: ${response.status}`);
  }
  const data: ApolloCompanySearchResponse = await response.json();
  const org = data.organizations?.[0] ?? null;
  if (!org) return null;
  return org;
}

/**
 * 2. Find recruiters at the organization using mixed_people/api_search.
 */
async function searchPeopleAtOrg(
  organizationName: string,
  location?: string
): Promise<ApolloPersonSearchResult[]> {
  const body: Record<string, unknown> = {
    q_organization_name: organizationName,
    person_titles: [
      'recruiter',
      'recruiting manager',
      'talent acquisition',
      'technical recruiter',
      'hr recruiter',
      'staffing'
    ],
    per_page: 10,
    page: 1
  };
  if (location) body.organization_locations = [location];

  const response = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('Apollo mixed_people/api_search error:', response.status, text);
    throw new Error(`Apollo people search failed: ${response.status}`);
  }
  const data: ApolloPeopleSearchResponse = await response.json();
  return data.people ?? [];
}

/**
 * 3. Enrich a person (get email) using people/match.
 */
async function enrichPerson(
  firstName: string,
  lastName: string,
  organizationName: string
): Promise<ApolloPeopleMatchResponse | null> {
  const params = new URLSearchParams({
    first_name: firstName,
    last_name: lastName,
    organization_name: organizationName,
    run_waterfall_email: 'false',
    run_waterfall_phone: 'false',
    reveal_personal_emails: 'true',
    reveal_phone_number: 'false'
  });
  const response = await fetch(`${APOLLO_BASE}/people/match?${params.toString()}`, {
    method: 'POST',
    headers: COMMON_HEADERS,
    body: '{}'
  });
  if (!response.ok) return null;
  const data: ApolloPeopleMatchResponse = await response.json();
  return data;
}

/** Result of Find Email via Apollo people/match (for manual contacts). */
export interface FindEmailResult {
  email?: string;
  title?: string;
  photo_url?: string;
}

/**
 * Find email for a contact using Apollo people/match (first name, last name, company name or URL).
 */
export async function findEmailViaApollo(
  firstName: string,
  lastName: string,
  companyNameOrUrl: string
): Promise<FindEmailResult | null> {
  if (!APOLLO_API_KEY) {
    console.warn('Apollo API key not set. Set VITE_APOLLO_API_KEY in .env.local');
    return null;
  }
  const orgName = companyNameOrUrl.trim();
  if (!firstName?.trim() || !lastName?.trim() || !orgName) return null;
  try {
    const data = await enrichPerson(firstName.trim(), lastName.trim(), orgName);
    const person = data?.person;
    if (!person) return null;
    return {
      email: person.email,
      title: person.title,
      photo_url: person.photo_url
    };
  } catch (e) {
    console.error('Apollo findEmailViaApollo error:', e);
    return null;
  }
}

/**
 * Find recruiters at a company: company search → people search → enrich (people/match) for email.
 */
export async function findRecruitersViaApollo(
  companyName: string,
  _jobTitle: string,
  location?: string
): Promise<Recruiter[]> {
  if (!APOLLO_API_KEY) {
    console.warn('Apollo API key not set. Set VITE_APOLLO_API_KEY in .env.local');
    return [];
  }

  try {
    // 1. Find company by name
    const org = await searchCompany(companyName);
    const orgName = org?.name ?? companyName;

    // 2. Find recruiters at that org
    const people = await searchPeopleAtOrg(orgName, location);
    if (people.length === 0) {
      console.log('Apollo: no recruiters found for', orgName);
      return [];
    }

    // 3. Enrich up to 5 people with people/match for email (consumes credits)
    const toEnrich = people.slice(0, 5);
    const recruiters: Recruiter[] = [];

    for (const person of toEnrich) {
      const first = person.first_name?.trim() || '';
      const last = person.last_name?.trim() || '';
      let email = '';
      try {
        const match = await enrichPerson(first, last, orgName);
        email = match?.person?.email || '';
      } catch {
        // leave email empty if enrich fails
      }
      if (!email) {
        const slug = `${(first || 'contact').toLowerCase()}.${(last || 'recruiter').toLowerCase()}`;
        const domain = (org?.primary_domain || companyName.toLowerCase().replace(/[^a-z0-9.-]/g, '') + '.com').replace(/^\.+/, '');
        email = `${slug}@${domain}`;
      }
      recruiters.push({
        id: person.id || `apollo-${recruiters.length}-${Date.now()}`,
        name: person.name || `${first} ${last}`.trim() || 'Recruiter',
        role: person.title || 'Recruiter',
        email,
        relevance: `${person.title || 'Recruiter'} at ${person.organization_name || orgName}${person.city ? ` (${person.city})` : ''}. LinkedIn: ${person.linkedin_url || 'N/A'}`,
        avatar: person.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name || 'Recruiter')}&background=random&size=200`
      });
    }

    // Add remaining people without enrichment (no email from API)
    for (let i = 5; i < people.length; i++) {
      const person = people[i];
      const first = person.first_name?.trim() || '';
      const last = person.last_name?.trim() || '';
      const slug = `${(first || 'contact').toLowerCase()}.${(last || 'recruiter').toLowerCase()}`;
      const domain = (org?.primary_domain || companyName.toLowerCase().replace(/[^a-z0-9.-]/g, '') + '.com').replace(/^\.+/, '');
      recruiters.push({
        id: person.id || `apollo-${recruiters.length}-${Date.now()}`,
        name: person.name || `${first} ${last}`.trim() || 'Recruiter',
        role: person.title || 'Recruiter',
        email: `${slug}@${domain}`,
        relevance: `${person.title || 'Recruiter'} at ${person.organization_name || orgName}${person.city ? ` (${person.city})` : ''}. LinkedIn: ${person.linkedin_url || 'N/A'}`,
        avatar: person.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name || 'Recruiter')}&background=random&size=200`
      });
    }

    console.log('Apollo: found', recruiters.length, 'recruiters for', orgName);
    return recruiters;
  } catch (error) {
    console.error('Apollo API error:', error);
    throw error;
  }
}
