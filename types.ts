
export interface UserPreferences {
  jobTitle: string | string[];
  location: string | string[];
  workType: 'Remote' | 'Hybrid' | 'On-site' | 'All';
  requiresSponsorship: boolean;
  yearsOfExperience: 'New Graduate' | '1-2 years' | '2-5 years' | '5+ years';
  desiredSalary?: string;
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
  resumeFiles?: File[];
  projectFiles?: File[];
  projectLinks?: string[];
}

export enum NavItem {
  Jobs = 'Jobs',
  Resume = 'Resume',
  Profile = 'Profile'
}
