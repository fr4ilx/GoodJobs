import { doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteField, collection, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { UserPreferences, SkillsVisualization, Job, JobAnalysis, TailoredResumeContent, Contact, OutreachDraft } from '../types';

export interface FileMetadata {
  name: string;
  url: string;
  id: string; // Unique ID to handle duplicates
}

interface UserData {
  email: string;
  name: string;
  preferences?: UserPreferences;
  resumeContent?: string;
  resumeFileURLs?: string[];
  resumeFiles?: FileMetadata[]; // New: stores name + URL
  projectFileURLs?: string[];
  projectFiles?: FileMetadata[]; // New: stores name + URL
  projectLinks?: string[];
  skillsVisualization?: SkillsVisualization; // Structured skills data
  githubToken?: string; // User's GitHub OAuth token (encrypted in production)
  githubUsername?: string; // GitHub username for display
  createdAt?: any;
  updatedAt?: any;
}

// Create or update user profile
export const saveUserProfile = async (userId: string, data: Partial<UserData>) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new user
      await setDoc(userRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};

// Upload file to Firebase Storage and return metadata
export const uploadFile = async (
  userId: string, 
  file: File, 
  folder: 'resumes' | 'projects'
): Promise<FileMetadata> => {
  try {
    const timestamp = Date.now();
    const uniqueId = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
    // Preserve original filename, but use unique ID to handle duplicates
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFileName = `${uniqueId}_${sanitizedFileName}`;
    const storageRef = ref(storage, `users/${userId}/${folder}/${storageFileName}`);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    
    return {
      name: file.name, // Original filename
      url: downloadURL,
      id: uniqueId
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Upload multiple files and return metadata
export const uploadMultipleFiles = async (
  userId: string,
  files: File[],
  folder: 'resumes' | 'projects'
): Promise<FileMetadata[]> => {
  try {
    const uploadPromises = files.map(file => uploadFile(userId, file, folder));
    const fileMetadata = await Promise.all(uploadPromises);
    return fileMetadata;
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    throw error;
  }
};

// Save user preferences
export const saveUserPreferences = async (userId: string, preferences: UserPreferences) => {
  try {
    await saveUserProfile(userId, { preferences });
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
};

// Save resume data - REPLACES with current state (includes deletions)
export const saveResumeData = async (
  userId: string,
  data: {
    resumeContent: string;
    resumeFiles: File[];
    projectFiles: File[];
    projectLinks: string[];
    savedResumeFiles: FileMetadata[];
    savedProjectFiles: FileMetadata[];
  }
) => {
  try {
    // Upload new resume files
    let newResumeFiles: FileMetadata[] = [];
    if (data.resumeFiles.length > 0) {
      newResumeFiles = await uploadMultipleFiles(userId, data.resumeFiles, 'resumes');
    }

    // Upload new project files
    let newProjectFiles: FileMetadata[] = [];
    if (data.projectFiles.length > 0) {
      newProjectFiles = await uploadMultipleFiles(userId, data.projectFiles, 'projects');
    }

    // Combine saved files with newly uploaded ones (this is the complete current state)
    const allResumeFiles = [...data.savedResumeFiles, ...newResumeFiles];
    const allProjectFiles = [...data.savedProjectFiles, ...newProjectFiles];

    // Also maintain backward compatibility with URL arrays
    const allResumeFileURLs = allResumeFiles.map(f => f.url);
    const allProjectFileURLs = allProjectFiles.map(f => f.url);

    // Save complete current state to Firestore
    // Clear skillsVisualization so it gets regenerated with new data (overwrite, not append)
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Update existing user - explicitly delete skillsVisualization field
      await updateDoc(userRef, {
        resumeContent: data.resumeContent,
        resumeFiles: allResumeFiles,
        resumeFileURLs: allResumeFileURLs,
        projectFiles: allProjectFiles,
        projectFileURLs: allProjectFileURLs,
        projectLinks: data.projectLinks,
        skillsVisualization: deleteField(), // Clear old visualization - will be overwritten by new analysis
        updatedAt: serverTimestamp()
      });
    } else {
      // Create new user (shouldn't happen in normal flow, but handle it)
      await setDoc(userRef, {
        resumeContent: data.resumeContent,
        resumeFiles: allResumeFiles,
        resumeFileURLs: allResumeFileURLs,
        projectFiles: allProjectFiles,
        projectFileURLs: allProjectFileURLs,
        projectLinks: data.projectLinks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    return {
      resumeFiles: newResumeFiles,
      projectFiles: newProjectFiles
    };
  } catch (error) {
    console.error('Error saving resume data:', error);
    throw error;
  }
};

// Delete a resume file URL from user profile
export const deleteResumeFile = async (userId: string, fileURL: string) => {
  try {
    const existingData = await getUserProfile(userId);
    if (!existingData) return;

    const updatedResumeURLs = (existingData.resumeFileURLs || []).filter(url => url !== fileURL);
    
    await saveUserProfile(userId, {
      resumeFileURLs: updatedResumeURLs
    });
  } catch (error) {
    console.error('Error deleting resume file:', error);
    throw error;
  }
};

// Delete a project file URL from user profile
export const deleteProjectFile = async (userId: string, fileURL: string) => {
  try {
    const existingData = await getUserProfile(userId);
    if (!existingData) return;

    const updatedProjectURLs = (existingData.projectFileURLs || []).filter(url => url !== fileURL);
    
    await saveUserProfile(userId, {
      projectFileURLs: updatedProjectURLs
    });
  } catch (error) {
    console.error('Error deleting project file:', error);
    throw error;
  }
};

// Delete a project link from user profile
export const deleteProjectLink = async (userId: string, link: string) => {
  try {
    const existingData = await getUserProfile(userId);
    if (!existingData) return;

    const updatedLinks = (existingData.projectLinks || []).filter(l => l !== link);
    
    await saveUserProfile(userId, {
      projectLinks: updatedLinks
    });
  } catch (error) {
    console.error('Error deleting project link:', error);
    throw error;
  }
};

// Get user profile
export const getUserProfile = async (userId: string): Promise<UserData | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// Save skills visualization
export const saveSkillsVisualization = async (userId: string, visualization: SkillsVisualization) => {
  try {
    console.log('💾 Saving skills visualization to Firestore for user:', userId);
    await saveUserProfile(userId, {
      skillsVisualization: visualization
    });
    console.log('✅ Skills visualization saved successfully');
  } catch (error) {
    console.error('❌ Error saving skills visualization:', error);
    throw error;
  }
};

// ========== Jobs (global) ==========
const JOBS_COLLECTION = 'jobs';

/** Seed jobs to Firestore (idempotent - only adds if collection is empty). Returns [] on permission error. */
export const seedJobsIfEmpty = async (jobs: Job[]): Promise<Job[]> => {
  try {
    const jobsRef = collection(db, JOBS_COLLECTION);
    const snapshot = await getDocs(jobsRef);
    if (snapshot.empty) {
      const batch = writeBatch(db);
      for (const job of jobs) {
        const { analysis, ...baseJob } = job as Job & { analysis?: any };
        const jobRef = doc(db, JOBS_COLLECTION, job.id);
        batch.set(jobRef, { ...baseJob, createdAt: serverTimestamp() });
      }
      await batch.commit();
      console.log('✅ Seeded', jobs.length, 'jobs to Firestore');
      return jobs;
    }
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job));
  } catch (error) {
    return [];
  }
};

/** Get all jobs from Firestore. Returns [] on permission error. */
export const getJobs = async (): Promise<Job[]> => {
  try {
    const jobsRef = collection(db, JOBS_COLLECTION);
    const snapshot = await getDocs(jobsRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Job));
  } catch {
    return [];
  }
};

// ========== Job analyses (per user) ==========

const JOB_ANALYSES_STORAGE_KEY = (uid: string) => `goodjobs_job_analyses_${uid}`;

/** Save job analysis for a user (Firestore with localStorage fallback) */
export const saveJobAnalysis = async (userId: string, jobId: string, analysis: JobAnalysis) => {
  try {
    const ref = doc(db, 'users', userId, 'jobAnalyses', jobId);
    await setDoc(ref, { ...analysis, updatedAt: serverTimestamp() });
  } catch {
    try {
      const key = JOB_ANALYSES_STORAGE_KEY(userId);
      const stored = localStorage.getItem(key);
      const map: Record<string, JobAnalysis> = stored ? JSON.parse(stored) : {};
      map[jobId] = analysis;
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
      console.error('localStorage save failed:', e);
      throw e;
    }
  }
};

/** Get all job analyses for a user (Firestore with localStorage fallback) */
export const getJobAnalyses = async (userId: string): Promise<Record<string, JobAnalysis>> => {
  try {
    const ref = collection(db, 'users', userId, 'jobAnalyses');
    const snapshot = await getDocs(ref);
    const map: Record<string, JobAnalysis> = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      map[d.id] = {
        keywords: data.keywords || [],
        keywordMatchScore: data.keywordMatchScore ?? 0,
        whatLooksGood: data.whatLooksGood || '',
        whatIsMissing: data.whatIsMissing || ''
      };
    });
    return map;
  } catch {
    try {
      const key = JOB_ANALYSES_STORAGE_KEY(userId);
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
};

// ========== Track Flow State (per user) ==========

export interface TrackFlowState {
  trackedJobs: Record<string, 'Customize' | 'Connect' | 'Apply' | 'Done'>;
  customizedResumes: Record<string, string>;
  jobContacts: Record<string, Contact[]>;
  contactDrafts: Record<string, OutreachDraft>;
}

const TRACK_FLOW_STORAGE_KEY = (uid: string) => `goodjobs_track_flow_${uid}`;

/** Normalize contactDrafts: legacy string → { subject: '', body } */
function normalizeContactDrafts(raw: Record<string, unknown> | undefined): Record<string, OutreachDraft> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, OutreachDraft> = {};
  for (const [id, val] of Object.entries(raw)) {
    if (typeof val === 'string') out[id] = { subject: '', body: val };
    else if (val && typeof val === 'object' && 'body' in val) out[id] = { subject: String((val as OutreachDraft).subject ?? ''), body: String((val as OutreachDraft).body ?? '') };
  }
  return out;
}

/** Migrate legacy jobRecruiters (Recruiter[]) to jobContacts (Contact[]). */
export function migrateJobRecruitersToContacts(
  jobRecruiters: Record<string, { id: string; name: string; email?: string; role?: string; avatar?: string; relevance?: string }[]> | undefined
): Record<string, Contact[]> {
  if (!jobRecruiters || typeof jobRecruiters !== 'object') return {};
  const out: Record<string, Contact[]> = {};
  for (const [jobId, recs] of Object.entries(jobRecruiters)) {
    if (!Array.isArray(recs)) continue;
    out[jobId] = recs.map((r) => {
      const parts = (r.name || '').trim().split(/\s+/);
      const firstName = parts[0] ?? '';
      const lastName = parts.slice(1).join(' ') ?? '';
      return {
        id: r.id,
        firstName,
        lastName,
        companyNameOrUrl: '',
        email: r.email,
        role: r.role,
        avatar: r.avatar
      };
    });
  }
  return out;
}

/** Save track flow state to Firestore. Debounce calls from the caller. */
export const saveTrackFlowState = async (userId: string, state: TrackFlowState): Promise<void> => {
  try {
    const ref = doc(db, 'users', userId, 'trackFlow', 'state');
    await setDoc(ref, {
      ...state,
      updatedAt: serverTimestamp()
    });
  } catch {
    try {
      localStorage.setItem(TRACK_FLOW_STORAGE_KEY(userId), JSON.stringify(state));
    } catch (e) {
      console.error('Track flow save failed:', e);
      throw e;
    }
  }
};

/** Get track flow state from Firestore. Falls back to localStorage. */
export const getTrackFlowState = async (userId: string): Promise<TrackFlowState | null> => {
  try {
    const ref = doc(db, 'users', userId, 'trackFlow', 'state');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      const jobContacts = d.jobContacts ?? migrateJobRecruitersToContacts(d.jobRecruiters);
      const contactDrafts = normalizeContactDrafts((d.contactDrafts ?? d.recruiterDrafts) as Record<string, unknown>);
      return {
        trackedJobs: d.trackedJobs ?? {},
        customizedResumes: d.customizedResumes ?? {},
        jobContacts: jobContacts ?? {},
        contactDrafts
      };
    }
  } catch {
    /* fall through */
  }
  try {
    const stored = localStorage.getItem(TRACK_FLOW_STORAGE_KEY(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const jobContacts = parsed.jobContacts ?? migrateJobRecruitersToContacts(parsed.jobRecruiters);
    const contactDrafts = normalizeContactDrafts((parsed.contactDrafts ?? parsed.recruiterDrafts) as Record<string, unknown>);
    return {
      trackedJobs: parsed.trackedJobs ?? {},
      customizedResumes: parsed.customizedResumes ?? {},
      jobContacts: jobContacts ?? {},
      contactDrafts
    };
  } catch {
    return null;
  }
};

// ========== Tailored Resumes (per user, per job) ==========

const TAILORED_RESUMES_STORAGE_KEY = (uid: string) => `goodjobs_tailored_resumes_${uid}`;

/** Saved tailored resume document */
export interface SavedTailoredResume {
  content: TailoredResumeContent;
  htmlContent?: string;  // edited HTML; used for display/PDF when present
  version?: number;
}

/** Save tailored resume for a job. Firestore with localStorage fallback. */
export const saveTailoredResume = async (
  userId: string,
  jobId: string,
  data: { content: TailoredResumeContent; htmlContent?: string },
  version?: number
): Promise<void> => {
  try {
    const ref = doc(db, 'users', userId, 'tailoredResumes', jobId);
    await setDoc(ref, {
      content: data.content,
      htmlContent: data.htmlContent,
      version: version ?? 1,
      updatedAt: serverTimestamp()
    });
  } catch {
    try {
      const key = TAILORED_RESUMES_STORAGE_KEY(userId);
      const stored = localStorage.getItem(key);
      const map: Record<string, SavedTailoredResume> = stored ? JSON.parse(stored) : {};
      map[jobId] = { content: data.content, htmlContent: data.htmlContent, version: version ?? 1 };
      localStorage.setItem(key, JSON.stringify(map));
    } catch (e) {
      console.error('Tailored resume save failed:', e);
      throw e;
    }
  }
};

/** Get tailored resume for a job. Returns null if not found. Firestore with localStorage fallback. */
export const getTailoredResume = async (
  userId: string,
  jobId: string
): Promise<SavedTailoredResume | null> => {
  try {
    const ref = doc(db, 'users', userId, 'tailoredResumes', jobId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      return {
        content: d.content as TailoredResumeContent,
        htmlContent: d.htmlContent,
        version: d.version
      };
    }
  } catch {
    /* fall through to localStorage */
  }
  try {
    const key = TAILORED_RESUMES_STORAGE_KEY(userId);
    const stored = localStorage.getItem(key);
    const map: Record<string, SavedTailoredResume> = stored ? JSON.parse(stored) : {};
    return map[jobId] ?? null;
  } catch {
    return null;
  }
};
