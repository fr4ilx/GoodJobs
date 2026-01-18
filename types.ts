
export interface UserPreferences {
  jobTitle: string;
  location: string;
  workType: 'Remote' | 'Hybrid' | 'On-site' | 'All';
  requiresSponsorship: boolean;
  minSalary?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  logo: string;
  description: string;
  matchScore?: number;
  matchReason?: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Remote';
  category: string;
}

export interface UserProfile {
  name: string;
  resumeContent: string;
  email: string;
  preferences?: UserPreferences;
}

export enum NavItem {
  Jobs = 'Jobs',
  Resume = 'Resume',
  Profile = 'Profile'
}
