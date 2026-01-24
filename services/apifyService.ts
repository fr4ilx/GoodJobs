import { Job } from '../types';

interface ApifyRunInput {
  title?: string;
  location?: string;
  rows?: number;
  workType?: string; // "1" = On-site, "2" = Remote, "3" = Hybrid
  contractType?: string; // "F" = Full-time, "P" = Part-time
  experienceLevel?: string; // "1" = Internship, "2" = Entry level, "3" = Mid-level, "4" = Senior
  publishedAt?: string; // e.g., "r86400" for past 24 hours
}

interface ApifyJobItem {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  jobUrl?: string;
  postedDate?: string;
  employmentType?: string;
  [key: string]: any; // Allow other fields
}

// IMPORTANT: Never hardcode API tokens in source control.
// Set this in `.env.local` as `VITE_APIFY_TOKEN=...` (and keep `.env*` ignored).
const APIFY_TOKEN: string | undefined = import.meta.env.VITE_APIFY_TOKEN;

function requireApifyToken(): string {
  if (!APIFY_TOKEN) {
    console.error('❌ APIFY_TOKEN is missing!');
    console.error('Current import.meta.env:', import.meta.env);
    console.error('VITE_APIFY_TOKEN value:', import.meta.env.VITE_APIFY_TOKEN);
    throw new Error('Missing VITE_APIFY_TOKEN. Set it in .env.local and restart the dev server.');
  }
  console.log('✅ Apify token loaded successfully');
  return APIFY_TOKEN;
}
const ACTOR_ID = 'bebity/linkedin-jobs-scraper';

/**
 * Starts an Apify actor run for LinkedIn jobs
 */
export async function runLinkedInJobsScraper(input: ApifyRunInput): Promise<string> {
  // Encode actor ID for URL (replace / with ~)
  const encodedActorId = ACTOR_ID.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${encodedActorId}/runs`;
  
  // Build the actor input object (flat structure as expected by the actor)
  const actorInput: any = {
    rows: input.rows || 10,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"]
    }
  };

  // Only include fields that have values in the actor input
  if (input.title) {
    actorInput.title = input.title;
  }

  if (input.location) {
    actorInput.location = input.location;
  }

  if (input.workType) {
    actorInput.workType = input.workType;
  }

  if (input.contractType) {
    actorInput.contractType = input.contractType;
  }

  if (input.experienceLevel) {
    actorInput.experienceLevel = input.experienceLevel;
  }

  if (input.publishedAt) {
    actorInput.publishedAt = input.publishedAt;
  }

  // Use flat structure as specified - DO NOT wrap in "input"
  // The structure must match exactly:
  // {
  //   "contractType": "P",
  //   "experienceLevel": "5",
  //   "location": "Seattle",
  //   "proxy": {...},
  //   "publishedAt": "r2592000",
  //   "rows": 20,
  //   "title": "Software Engineer",
  //   "workType": "2"
  // }
  const requestBody = actorInput;

  console.log('🚀 Starting Apify run with EXACT flat structure:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${requireApifyToken()}`,
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  console.log('Apify API Response Status:', response.status, response.statusText);
  console.log('Apify API Response:', responseText);

  if (!response.ok) {
    try {
      const error = JSON.parse(responseText);
      throw new Error(`Failed to start Apify run: ${error.error?.message || error.message || response.statusText}`);
    } catch (parseError) {
      throw new Error(`Failed to start Apify run: ${response.statusText} - ${responseText}`);
    }
  }

  const data = JSON.parse(responseText);
  console.log('Apify Run Started:', data.data?.id);
  return data.data.id; // Run ID
}

/**
 * Gets the status of an Apify actor run
 */
export async function getRunStatus(runId: string): Promise<'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'READY' | 'TIMED-OUT'> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: {
      'Authorization': `Bearer ${requireApifyToken()}`,
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to get run status: ${response.statusText}`, errorText);
    throw new Error(`Failed to get run status: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Run Status:', runId, data.data?.status);
  return data.data.status;
}

/**
 * Gets the dataset ID from a completed run
 */
export async function getRunDatasetId(runId: string): Promise<string> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: {
      'Authorization': `Bearer ${requireApifyToken()}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get run dataset: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.defaultDatasetId;
}

/**
 * Fetches job results from Apify dataset
 */
export async function getJobsFromDataset(datasetId: string): Promise<ApifyJobItem[]> {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
    headers: {
      'Authorization': `Bearer ${requireApifyToken()}`,
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch dataset: ${response.statusText}`, errorText);
    throw new Error(`Failed to fetch dataset: ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Fetched ${data.length} jobs from dataset`);
  return data;
}

/**
 * Polls until the run completes, then returns the jobs
 */
export async function fetchLinkedInJobs(
  input: ApifyRunInput,
  onProgress?: (status: string) => void
): Promise<ApifyJobItem[]> {
  // Start the run
  onProgress?.('Starting LinkedIn job scrape...');
  const runId = await runLinkedInJobsScraper(input);

  // Poll until complete (max 5 minutes)
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  const pollInterval = 3000; // Check every 3 seconds

  while (Date.now() - startTime < maxWaitTime) {
    const status = await getRunStatus(runId);
    
    if (status === 'SUCCEEDED') {
      onProgress?.('Fetching results...');
      const datasetId = await getRunDatasetId(runId);
      const jobs = await getJobsFromDataset(datasetId);
      return jobs;
    }
    
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status.toLowerCase()}`);
    }

    onProgress?.(`Scraping jobs... (${status})`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Run timed out after 5 minutes');
}

/**
 * Maps Apify job data to your Job interface
 */
export function mapApifyJobToJob(apifyJob: ApifyJobItem, index: number): Job {
  // Log first job to see structure
  if (index === 0) {
    console.log('Sample Apify Job Data:', JSON.stringify(apifyJob, null, 2));
  }
  
  // Extract company name - check multiple possible field names from Apify
  const companyName = apifyJob.company 
    || (apifyJob as any).companyName 
    || (apifyJob as any).company_name 
    || (apifyJob as any).employer
    || (apifyJob as any).companyName
    || '';
  
  // Determine job type
  let type: 'Full-time' | 'Contract' | 'Remote' = 'Full-time';
  const description = (apifyJob.description || '').toLowerCase();
  const employmentType = (apifyJob.employmentType || '').toLowerCase();
  
  if (employmentType.includes('contract') || employmentType.includes('part-time') || 
      description.includes('contract') || description.includes('part-time')) {
    type = 'Contract';
  } else if (description.includes('remote') || 
             (apifyJob.location || '').toLowerCase().includes('remote')) {
    type = 'Remote';
  }

  // Extract location exactly as Apify returns it - check multiple possible field names
  const location = apifyJob.location 
    || (apifyJob as any).jobLocation
    || (apifyJob as any).job_location
    || (apifyJob as any).city
    || (apifyJob as any).place
    || 'Location not specified';

  // Use first word of title as category fallback
  const category = apifyJob.title?.split(' ')[0] || 'General';

  // Get full description without truncation
  let fullDescription = apifyJob.description || 'No description available';
  
  // Clean up excessive whitespace but preserve line breaks and structure
  // Replace multiple spaces with single space, but keep newlines
  fullDescription = fullDescription
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
    .trim();

  // Extract job URL - prefer applyUrl if available, otherwise use jobUrl
  const jobUrl = (apifyJob as any).applyUrl 
    || apifyJob.jobUrl 
    || (apifyJob as any).job_url
    || '';

  return {
    id: apifyJob.jobUrl?.split('/').pop() || apifyJob.jobUrl || `job-${index}`,
    title: apifyJob.title || 'Job Title',
    company: companyName.trim() || 'Company Name Not Available', // Use actual company name from Apify JSON
    logo: '', // Empty logo - we display company initial instead
    description: fullDescription, // Full description, no truncation
    location: location,
    type: type,
    category: category,
    jobUrl: jobUrl // Job URL for applying
  };
}

/**
 * Maps workType preference to API value
 * 1 = On-site, 2 = Hybrid, 3 = Remote
 */
function mapWorkTypeToApi(workType?: string): string | undefined {
  if (!workType || workType === 'All') return undefined;
  
  const mapping: Record<string, string> = {
    'On-site': '1',
    'Hybrid': '2',
    'Remote': '3'
  };
  
  return mapping[workType];
}

/**
 * Maps yearsOfExperience preference to API experienceLevel
 * "1" = Internship, "2" = Entry level, "3" = mid-level, "4" = mid-senior level, "5" = senior level
 */
function mapExperienceToApi(yearsOfExperience?: string): string | undefined {
  if (!yearsOfExperience) return undefined;
  
  const mapping: Record<string, string> = {
    'Internship': '1',
    'Entry level': '2',
    'Mid-level': '3',
    'Mid-Senior level': '4',
    'Senior level': '5'
  };
  
  return mapping[yearsOfExperience];
}

/**
 * Maps contractType preference to API value
 * "P" = Part-time, "F" = Fulltime, "I" = Internship
 */
function mapContractTypeToApi(contractType?: string): string | undefined {
  if (!contractType) return undefined;
  
  const mapping: Record<string, string> = {
    'Part-time': 'P',
    'Full-time': 'F',
    'Internship': 'I'
  };
  
  return mapping[contractType];
}

export async function fetchJobsWithFilters(
  preferences?: {
    jobTitle?: string | string[];
    location?: string | string[];
    workType?: string;
    yearsOfExperience?: string;
    contractType?: string;
  },
  onProgress?: (status: string) => void
): Promise<Job[]> {
  // Extract title from preferences
  let title = '';
  if (preferences?.jobTitle) {
    const titles = Array.isArray(preferences.jobTitle) 
      ? preferences.jobTitle 
      : [preferences.jobTitle];
    // Use first title for the title field
    title = titles[0];
  }

  // Extract location from preferences
  let location = '';
  if (preferences?.location) {
    const locations = Array.isArray(preferences.location) 
      ? preferences.location 
      : [preferences.location];
    // Filter out "Remote" and "Anywhere in US" for location field
    const validLocations = locations.filter(loc => 
      loc.toLowerCase() !== 'remote' && 
      loc.toLowerCase() !== 'anywhere in us'
    );
    if (validLocations.length > 0) {
      location = validLocations[0]; // Use first location
    }
  }

  // Build input object with new API format
  const input: ApifyRunInput = {
    rows: 10 // Limit to 10 jobs as requested
  };

  // Set title
  if (title && title.trim()) {
    input.title = title.trim();
  }

  // Set location
  if (location && location.trim()) {
    input.location = location.trim();
  }

  // Map workType to API format
  const workTypeApi = mapWorkTypeToApi(preferences?.workType);
  if (workTypeApi) {
    input.workType = workTypeApi;
  }

  // Map experience level
  const experienceLevelApi = mapExperienceToApi(preferences?.yearsOfExperience);
  if (experienceLevelApi) {
    input.experienceLevel = experienceLevelApi;
  }

  // Map contract type from preferences
  const contractTypeApi = mapContractTypeToApi(preferences?.contractType);
  if (contractTypeApi) {
    input.contractType = contractTypeApi;
  } else {
    // Default to Full-time if not specified
    input.contractType = 'F';
  }

  // Set publishedAt (optional - can be "r86400" for past 24 hours, or leave empty)
  // input.publishedAt = "r86400"; // Uncomment if you want to filter by date

  console.log('🔍 Apify request parameters being sent:', {
    rawPreferences: preferences,
    extractedTitle: title,
    extractedLocation: location,
    mappedWorkType: input.workType,
    mappedExperienceLevel: input.experienceLevel,
    finalInput: {
      title: input.title,
      location: input.location,
      workType: input.workType,
      contractType: input.contractType,
      experienceLevel: input.experienceLevel,
      publishedAt: input.publishedAt,
      rows: input.rows
    }
  });

  // Track if we used job titles in the API request (so we can skip redundant filtering)
  const usedJobTitleInApi = !!(preferences?.jobTitle && title);

  onProgress?.('Fetching jobs from LinkedIn...');
  const apifyJobs = await fetchLinkedInJobs(input, onProgress);
  
  console.log(`Fetched ${apifyJobs.length} jobs from Apify`);
  if (apifyJobs.length > 0) {
    console.log('Sample job titles:', apifyJobs.slice(0, 3).map(j => j.title));
  }
  
  // Map to Job interface
  let mappedJobs = apifyJobs.map((job, idx) => mapApifyJobToJob(job, idx));
  
  console.log(`Mapped ${mappedJobs.length} jobs`);
  if (mappedJobs.length > 0) {
    console.log('Mapped job titles:', mappedJobs.slice(0, 3).map(j => j.title));
  }

  // Apply soft matching filters based on preferences
  if (preferences) {
    // Normalize preferences
    const jobTitles = preferences.jobTitle 
      ? (Array.isArray(preferences.jobTitle) ? preferences.jobTitle : [preferences.jobTitle])
          .map(t => String(t).toLowerCase().trim())
          .filter(t => t.length > 0)
      : [];
    
    const locations = preferences.location
      ? (Array.isArray(preferences.location) ? preferences.location : [preferences.location])
          .map(l => String(l).toLowerCase().trim())
          .filter(l => l.length > 0)
      : [];

    onProgress?.(`Applying soft matching filters to ${mappedJobs.length} jobs...`);
    
    console.log('Filtering with preferences:', {
      jobTitles,
      locations,
      workType: preferences.workType,
      usedJobTitleInApi
    });

    mappedJobs = mappedJobs.filter(job => {
      // Skip title filtering if Apify already filtered by title field
      // Only do minimal title check if job titles weren't sent to API
      if (jobTitles.length > 0 && !usedJobTitleInApi) {
        const jobTitleLower = job.title.toLowerCase();
        const jobCategoryLower = job.category.toLowerCase();
        
        const matchesTitle = jobTitles.some(prefTitle => {
          const prefTitleLower = String(prefTitle).toLowerCase().trim();
          
          // Direct substring match - most lenient
          if (jobTitleLower.includes(prefTitleLower) || prefTitleLower.includes(jobTitleLower)) {
            return true;
          }
          
          // Extract significant words (length > 2) from preference
          const prefWords = prefTitleLower.split(/\s+/).filter(w => w.length > 2);
          
          if (prefWords.length === 0) {
            // If no significant words, just check if the whole string appears
            return jobTitleLower.includes(prefTitleLower);
          }
          
          // Check if ANY significant word from preference appears in job title or category
          // This is very lenient - we accept if any word matches
          return prefWords.some(word => {
            // Direct word match
            if (jobTitleLower.includes(word) || jobCategoryLower.includes(word)) {
              return true;
            }
            
            // Check if word appears as part of any word in job title
            const jobWords = jobTitleLower.split(/\s+/);
            return jobWords.some(jobWord => 
              jobWord.includes(word) || 
              word.includes(jobWord) ||
              jobWord.startsWith(word) ||
              word.startsWith(jobWord.substring(0, Math.min(word.length, jobWord.length)))
            );
          });
        });
        
        if (!matchesTitle) {
          console.log(`❌ Job filtered out: "${job.title}" (looking for: ${jobTitles.join(' OR ')})`);
          return false;
        } else {
          console.log(`✅ Job matched: "${job.title}" (matched: ${jobTitles.join(' OR ')})`);
        }
      } else if (jobTitles.length > 0 && usedJobTitleInApi) {
        // Apify already filtered by title field, so we trust those results
        // Just log for debugging
        console.log(`✅ Job accepted (already filtered by Apify title): "${job.title}"`);
      }

      // Soft match by location - flexible location matching
      if (locations.length > 0) {
        const jobLocationLower = job.location.toLowerCase();
        const jobTypeLower = job.type.toLowerCase();
        
        const matchesLocation = locations.some(prefLocation => {
          // Handle special cases
          if (prefLocation === 'remote') {
            return jobLocationLower.includes('remote') || 
                   jobTypeLower === 'remote' ||
                   jobLocationLower === 'remote';
          }
          
          if (prefLocation === 'anywhere in us' || prefLocation === 'anywhere') {
            return true; // Accept all locations
          }
          
          // Soft match: split location into words (city, state, country)
          const prefWords = prefLocation.split(/[,\s]+/).filter(w => w.length > 2);
          return prefWords.some(word => 
            jobLocationLower.includes(word) ||
            // Match city names (first part before comma)
            jobLocationLower.includes(prefLocation.split(',')[0].trim())
          ) || jobLocationLower.includes(prefLocation);
        });
        
        if (!matchesLocation) {
          return false;
        }
      }

      // Work type filtering is handled by the API, so we trust the API results
      // The API's workType filter (1=On-site, 2=Hybrid, 3=Remote) already handles this
      // No need for additional client-side workType filtering

      return true;
    });
  }

  // Limit to 10 jobs (already limited by API, but ensure we don't exceed)
  mappedJobs = mappedJobs.slice(0, 10);

  console.log(`🎯 Final result: ${mappedJobs.length} jobs to return`);
  if (mappedJobs.length > 0) {
    console.log('📋 Final jobs:', mappedJobs.map(j => ({ id: j.id, title: j.title, company: j.company, location: j.location })));
  } else {
    console.warn('⚠️ No jobs returned after filtering!');
    console.log('Debug info:', {
      apifyJobsCount: apifyJobs.length,
      mappedJobsCountBeforeFilter: apifyJobs.map((job, idx) => mapApifyJobToJob(job, idx)).length,
      preferences: preferences
    });
  }

  onProgress?.(`Found ${mappedJobs.length} matching jobs`);
  return mappedJobs;
}
