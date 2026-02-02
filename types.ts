
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

/** Job analysis: ATS keywords + fit insights (persisted per user) */
export interface JobAnalysis {
  keywords: string[];           // ATS-normalized keywords from responsibilities, qualifications, preferred
  keywordMatchScore: number;    // (my skills ∩ keywords) / keywords.length * 100
  whatLooksGood: string;        // Skills I have, similar experiences, alignment
  whatIsMissing: string;        // Missing keywords, maturity gaps, detailed notes
}

export interface Job {
  id: string;
  title: string;
  company: string;
  logo: string;
  description: string;
  matchScore?: number;          // Legacy: Gemini resume vs job match
  matchReason?: string;
  location: string;
  type: 'Full-time' | 'Contract' | 'Remote';
  category: string;
  jobUrl?: string;
  /** Keyword-based analysis (from "Get matching score") */
  analysis?: JobAnalysis;
}

export interface Recruiter {
  id: string;
  name: string;
  role: string;
  avatar: string;
  email: string;
  relevance: string;
}

/** Manual networking contact (add by name + company; optional Find email via Apollo; Draft email via Gemini). */
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  companyNameOrUrl: string;
  email?: string;
  role?: string;
  avatar?: string;
}

/** Outreach email draft: subject + body (Gmail-style). */
export interface OutreachDraft {
  subject: string;
  body: string;
}

/** Type of outreach email to draft. */
export type OutreachEmailType = 'coffee-chat' | 'referral' | 'hiring-manager-intro';

export interface UserProfile {
  name: string;
  resumeContent: string;
  email: string;
  githubUrl?: string;  // User's GitHub profile URL (from connection or project links)
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
  Customize = 'Customize',
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

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  major?: string;
  year: string;
  gpa?: string;
  source_names: string[];
}

export interface SkillsVisualization {
  inaccessible_sources: InaccessibleSource[];
  skill_aliases_map: Record<string, string>;
  education_entries: EducationEntry[];
  professional_experiences: ProfessionalExperience[];
  projects: Project[];
  awards_certificates_publications: AwardCertificatePublication[];
  all_skills: string[];
}

/** Structured resume content for tailored resumes (from generateTailoredResume) */
export interface TailoredResumeContent {
  contact: { name: string; email: string; github?: string };
  summary: string;
  experiences: Array<{ company: string; title: string; location?: string; dates: string; bullets: string[] }>;
  projects: Array<{ name: string; type?: string; dates?: string; bullets: string[] }>;
  skills: string[];
  education?: Array<{ school: string; degree: string; major?: string; year: string }>;
}
