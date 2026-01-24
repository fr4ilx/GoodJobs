
export interface UserPreferences {
  jobTitle: string | string[];
  location: string | string[];
  workType: 'Remote' | 'Hybrid' | 'On-site' | 'All';
  requiresSponsorship: boolean;
  yearsOfExperience: 'Internship' | 'Entry level' | 'Mid-level' | 'Mid-Senior level' | 'Senior level';
  contractType?: 'Full-time' | 'Part-time' | 'Internship';
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
  jobUrl?: string;
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
