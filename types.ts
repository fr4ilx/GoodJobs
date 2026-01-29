
export interface UserPreferences {
  jobTitle: string | string[];
  location: string | string[];
  workType: 'Remote' | 'Hybrid' | 'On-site' | 'All';
  requiresSponsorship: boolean;
  yearsOfExperience: 'Internship' | 'Entry level' | 'Mid-level' | 'Mid-Senior level' | 'Senior level';
  contractType?: 'Full-time' | 'Part-time' | 'Internship';
  desiredSalary?: string;
  yearsOfExperienceNumber?: number;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  securityClearance?: 'None' | 'Public Trust' | 'Secret' | 'Top Secret' | 'Top Secret/SCI';
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

export interface Recruiter {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email: string;
  relevance: string;
}

export interface UserProfile {
  name: string;
  resumeContent: string;
  email: string;
  preferences?: UserPreferences;
  resumeFiles?: File[];
  projectFiles?: File[];
  projectLinks?: string[];
  yearsOfExperience?: number;
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  securityClearance?: 'None' | 'Public Trust' | 'Secret' | 'Top Secret' | 'Top Secret/SCI';
}

export enum NavItem {
  Jobs = 'Jobs',
  Track = 'Track',
  Connect = 'Connect',
  Resume = 'Resume',
  Profile = 'Profile',
  VisualizeSkills = 'Visualize Skills'
}

// Visualize Skills types
export interface InaccessibleSource {
  source_name: string;
  source_type: 'resume' | 'project' | 'link';
  reason: string;
}

export interface XYZBullet {
  text: string;
  is_xyz: boolean;
  missing: string[];
}

export interface NonXYZBullet {
  text: string;
  reason_not_xyz: string;
}

export interface SkillWithEvidence {
  skill: string;
  evidence: string[];
}

export interface SkillCluster {
  cluster_name: string;
  skills: string[];
}

export interface SkillGraph {
  clusters: SkillCluster[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface ProfessionalExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  date_range: DateRange;
  source_names: string[];
  xyz_bullets: XYZBullet[];
  non_xyz_bullets: NonXYZBullet[];
  hard_skills: SkillWithEvidence[];
  soft_skills: SkillWithEvidence[];
  skill_graph: SkillGraph;
}

export interface Project {
  id: string;
  name: string;
  type: 'personal' | 'academic' | 'professional' | 'unknown';
  date_range: DateRange;
  source_names: string[];
  xyz_bullets: XYZBullet[];
  non_xyz_bullets: NonXYZBullet[];
  hard_skills: SkillWithEvidence[];
  soft_skills: SkillWithEvidence[];
  skill_graph: SkillGraph;
}

export interface AwardCertificatePublication {
  id: string;
  type: 'award' | 'certificate' | 'publication' | 'other';
  name: string;
  issuer_or_venue: string;
  date: string;
  evidence: string[];
}

export interface SkillsVisualization {
  inaccessible_sources: InaccessibleSource[];
  skill_aliases_map: Record<string, string>;
  professional_experiences: ProfessionalExperience[];
  projects: Project[];
  awards_certificates_publications: AwardCertificatePublication[];
  all_skills: string[];
}
