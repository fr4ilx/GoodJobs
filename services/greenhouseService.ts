import { Job } from '../types';

interface GreenhouseJob {
  id: number;
  title: string;
  location: {
    name: string;
  };
  departments?: Array<{
    name: string;
  }>;
  offices?: Array<{
    name: string;
  }>;
  content: string;
  absolute_url: string;
  updated_at: string;
  [key: string]: any;
}

// Popular Greenhouse board tokens for tech companies
// You can add more board tokens here
const GREENHOUSE_BOARDS = [
  'stripe',           // Stripe
  'airbnb',           // Airbnb
  'github',           // GitHub
  'dropbox',          // Dropbox
  'reddit',           // Reddit
  'pinterest',        // Pinterest
  'coinbase',         // Coinbase
  'shopify',          // Shopify
  'databricks',       // Databricks
  'asana',            // Asana
  'notion',           // Notion
  'figma',            // Figma
  'discord',          // Discord
  'robinhood',        // Robinhood
  'twitch',           // Twitch
];

/**
 * Fetches jobs from a single Greenhouse board
 */
async function fetchGreenhouseBoard(boardToken: string): Promise<GreenhouseJob[]> {
  try {
    const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.warn(`Failed to fetch from ${boardToken}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.jobs || [];
  } catch (error) {
    console.warn(`Error fetching from ${boardToken}:`, error);
    return [];
  }
}

/**
 * Fetches jobs from multiple Greenhouse boards in parallel
 */
async function fetchAllGreenhouseJobs(): Promise<GreenhouseJob[]> {
  console.log('Fetching jobs from Greenhouse boards...');
  
  // Fetch from all boards in parallel
  const boardPromises = GREENHOUSE_BOARDS.map(board => fetchGreenhouseBoard(board));
  const results = await Promise.all(boardPromises);
  
  // Flatten and combine all jobs
  const allJobs = results.flat();
  console.log(`Fetched ${allJobs.length} jobs from Greenhouse`);
  
  return allJobs;
}

/**
 * Maps Greenhouse job data to your Job interface
 */
function mapGreenhouseJobToJob(greenhouseJob: GreenhouseJob, companyName: string, index: number): Job {
  // Extract location
  const location = greenhouseJob.location?.name || 
                   greenhouseJob.offices?.[0]?.name || 
                   'Location not specified';

  // Determine job type based on location and content
  let type: 'Full-time' | 'Contract' | 'Remote' = 'Full-time';
  const locationLower = location.toLowerCase();
  const contentLower = (greenhouseJob.content || '').toLowerCase();
  
  if (contentLower.includes('contract') || contentLower.includes('part-time')) {
    type = 'Contract';
  } else if (locationLower.includes('remote') || contentLower.includes('remote')) {
    type = 'Remote';
  }

  // Extract department/category
  const category = greenhouseJob.departments?.[0]?.name || 
                   greenhouseJob.title?.split(' ')[0] || 
                   'General';

  // Clean description
  let description = greenhouseJob.content || 'No description available';
  description = description
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[ \t]+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
    .trim();

  return {
    id: `greenhouse-${greenhouseJob.id}`,
    title: greenhouseJob.title || 'Job Title',
    company: companyName,
    logo: '', // Empty logo - we display company initial instead
    description: description,
    location: location,
    type: type,
    category: category
  };
}

/**
 * Extracts company name from Greenhouse board token or job data
 */
function getCompanyNameFromBoard(boardToken: string, job: GreenhouseJob): string {
  // Try to get company name from job metadata, otherwise capitalize board token
  const companyName = (job as any).company?.name || 
                      (job as any).company_name ||
                      boardToken.charAt(0).toUpperCase() + boardToken.slice(1);
  return companyName;
}

/**
 * Fetches jobs from Greenhouse with filters based on user preferences
 */
export async function fetchJobsWithFilters(
  preferences?: {
    jobTitle?: string | string[];
    location?: string | string[];
    workType?: string;
  },
  onProgress?: (status: string) => void
): Promise<Job[]> {
  onProgress?.('Fetching jobs from Greenhouse...');
  
  // Normalize preferences for early filtering
  const jobTitles = preferences?.jobTitle 
    ? (Array.isArray(preferences.jobTitle) ? preferences.jobTitle : [preferences.jobTitle])
        .map(t => String(t).toLowerCase().trim())
        .filter(t => t.length > 0)
    : [];
  
  const locations = preferences?.location
    ? (Array.isArray(preferences.location) ? preferences.location : [preferences.location])
        .map(l => String(l).toLowerCase().trim())
        .filter(l => l.length > 0)
    : [];
  
  // Log preferences for debugging
  if (jobTitles.length > 0 || locations.length > 0) {
    console.log('Applying filters:', {
      jobTitles,
      locations,
      workType: preferences?.workType
    });
  }
  
  // Fetch all jobs from Greenhouse boards
  const greenhouseJobs = await fetchAllGreenhouseJobs();
  
  if (greenhouseJobs.length === 0) {
    onProgress?.('No jobs found');
    return [];
  }

  onProgress?.(`Processing ${greenhouseJobs.length} jobs...`);

  // Apply soft matching filters on raw Greenhouse jobs BEFORE mapping
  let filteredGreenhouseJobs = greenhouseJobs;
  
  if (jobTitles.length > 0 || locations.length > 0) {
    onProgress?.('Applying soft matching filters...');
    
    filteredGreenhouseJobs = greenhouseJobs.filter(job => {
      // Soft match by job title
      if (jobTitles.length > 0) {
        const jobTitleLower = (job.title || '').toLowerCase();
        const jobDeptLower = (job.departments?.[0]?.name || '').toLowerCase();
        
        const matchesTitle = jobTitles.some(prefTitle => {
          // Split preference into words for flexible matching
          const words = prefTitle.split(/\s+/);
          return words.some(word => 
            jobTitleLower.includes(word) || 
            jobDeptLower.includes(word) ||
            jobTitleLower.includes(prefTitle) ||
            // Match if first significant word matches
            (word.length > 3 && jobTitleLower.split(' ').some(jobWord => 
              jobWord.startsWith(word) || word.startsWith(jobWord)
            ))
          );
        });
        
        if (!matchesTitle) {
          return false;
        }
      }

      // Soft match by location
      if (locations.length > 0) {
        const jobLocationLower = (job.location?.name || '').toLowerCase();
        const jobOfficeLower = (job.offices?.[0]?.name || '').toLowerCase();
        const combinedLocation = `${jobLocationLower} ${jobOfficeLower}`.toLowerCase();
        
        const matchesLocation = locations.some(prefLocation => {
          // Handle special cases
          if (prefLocation === 'remote') {
            return combinedLocation.includes('remote');
          }
          
          if (prefLocation === 'anywhere in us' || prefLocation === 'anywhere') {
            return true; // Accept all locations
          }
          
          // Soft match: split location into words (city, state, country)
          const prefWords = prefLocation.split(/[,\s]+/).filter(w => w.length > 2);
          return prefWords.some(word => 
            combinedLocation.includes(word) ||
            // Match city names (first part before comma)
            combinedLocation.includes(prefLocation.split(',')[0].trim())
          ) || combinedLocation.includes(prefLocation);
        });
        
        if (!matchesLocation) {
          return false;
        }
      }

      return true;
    });
    
    onProgress?.(`Filtered to ${filteredGreenhouseJobs.length} matching jobs...`);
  }

  // Map Greenhouse jobs to our Job interface
  // Group by board to get company names
  const jobsByBoard: { [key: string]: GreenhouseJob[] } = {};
  
  filteredGreenhouseJobs.forEach(job => {
    // Try to determine which board this job came from
    // We'll use a simple approach: check the absolute_url
    const url = job.absolute_url || '';
    const boardMatch = GREENHOUSE_BOARDS.find(board => url.includes(board));
    const board = boardMatch || 'unknown';
    
    if (!jobsByBoard[board]) {
      jobsByBoard[board] = [];
    }
    jobsByBoard[board].push(job);
  });

  // Map jobs with company names
  let mappedJobs: Job[] = [];
  Object.entries(jobsByBoard).forEach(([board, jobs]) => {
    const companyName = board.charAt(0).toUpperCase() + board.slice(1);
    const boardJobs = jobs.map((job, idx) => 
      mapGreenhouseJobToJob(job, companyName, idx)
    );
    mappedJobs = mappedJobs.concat(boardJobs);
  });

  // Apply work type filter (already filtered by title and location above)
  if (preferences?.workType && preferences.workType !== 'All') {
    mappedJobs = mappedJobs.filter(job => {
      if (preferences.workType === 'Remote') {
        return job.type === 'Remote' || job.location.toLowerCase().includes('remote');
      }
      if (preferences.workType === 'Hybrid' || preferences.workType === 'On-site') {
        return job.type !== 'Remote' && !job.location.toLowerCase().includes('remote');
      }
      return true;
    });
  }

  // Limit to 50 jobs for performance
  mappedJobs = mappedJobs.slice(0, 50);

  onProgress?.(`Found ${mappedJobs.length} matching jobs`);
  return mappedJobs;
}
