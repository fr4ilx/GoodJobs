
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, NavItem, UserProfile, UserPreferences, SkillsVisualization, Contact, OutreachDraft, OutreachEmailType } from './types';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import LandingPage from './components/LandingPage';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import PreferencesPage from './components/PreferencesPage';
import ResumeUploadPage from './components/ResumeUploadPage';
import JobDetailModal from './components/JobDetailModal';
import CustomizeJobModal from './components/CustomizeJobModal';
import PreferencesModal from './components/PreferencesModal';
import VisualizeSkillsPage from './components/VisualizeSkillsPage';
import { calculateMatchScore, analyzeSkills, validateGeminiApiKey, generateCustomizedResume, generateOutreachEmail, extractJobKeywordsBatch, generateJobFitAnalysisBatch } from './services/geminiService';
import { findEmailViaApollo } from './services/apolloService';
import { requestGmailAccess, createGmailDraft, isGmailConfigured } from './services/gmailService';
import { useAuth } from './contexts/AuthContext';
import { logOut } from './services/authService';
import { saveUserPreferences, saveResumeData, saveUserProfile, getUserProfile, deleteResumeFile, deleteProjectFile, deleteProjectLink, FileMetadata, saveSkillsVisualization, seedJobsIfEmpty, getJobs, getJobAnalyses, saveJobAnalysis, saveTrackFlowState, getTrackFlowState, migrateJobRecruitersToContacts } from './services/firestoreService';
import { fetchJobsWithFilters } from './services/apifyService';

import { MOCK_JOBS } from './constants';

type SortOption = 'score-desc' | 'score-asc' | 'newest';
type TrackStatus = 'Customize' | 'Connect' | 'Apply' | 'Done';

const TRACK_STORAGE_KEYS = {
  TRACKED_JOBS: 'goodjobs_tracked_jobs_v1',
  CUSTOM_RESUMES: 'goodjobs_custom_resumes_v1',
  RECRUITERS: 'goodjobs_recruiters_v1',
  DRAFTS: 'goodjobs_drafts_v1',
};

const STAGES: { label: string; key: TrackStatus; color: string; bg: string; icon: string; desc: string; accent: string }[] = [
  { label: 'Customize', key: 'Customize', color: 'text-orange-600', bg: 'bg-orange-50', accent: 'bg-orange-500', icon: 'fa-pen-nib', desc: 'Tailor your resume and cover letter.' },
  { label: 'Connect', key: 'Connect', color: 'text-emerald-600', bg: 'bg-emerald-50', accent: 'bg-emerald-500', icon: 'fa-comments', desc: 'Find and reach out to stakeholders.' },
  { label: 'Apply', key: 'Apply', color: 'text-blue-600', bg: 'bg-blue-50', accent: 'bg-blue-500', icon: 'fa-paper-plane', desc: 'Submit application and track status.' },
  { label: 'Done', key: 'Done', color: 'text-pink-700', bg: 'bg-pink-100', accent: 'bg-pink-600', icon: 'fa-circle-check', desc: 'Applications completed.' },
];

const App: React.FC = () => {
  const { currentUser } = useAuth();
  const [isStarted, setIsStarted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isFromSignup, setIsFromSignup] = useState(false); // Track if user came from signup
  const isFromSignupRef = useRef(false); // Ref to preserve through logout
  const isNavigatingBackRef = useRef(false); // Flag to prevent useEffect from resetting during navigation
  const [isPreferencesComplete, setIsPreferencesComplete] = useState(false);
  const [isResumeComplete, setIsResumeComplete] = useState(false);
  
  const [activeNav, setActiveNav] = useState<NavItem>(NavItem.Jobs);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [usePreferencesFilter] = useState(true);
  const [skillsVisualization, setSkillsVisualization] = useState<SkillsVisualization | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('score-desc');
  const [trackedJobs, setTrackedJobs] = useState<Record<string, TrackStatus>>({});
  const [customizedResumes, setCustomizedResumes] = useState<Record<string, string>>({});
  const [jobContacts, setJobContacts] = useState<Record<string, Contact[]>>({});
  const [contactDrafts, setContactDrafts] = useState<Record<string, OutreachDraft>>({});
  const [findingEmailContactId, setFindingEmailContactId] = useState<string | null>(null);
  const [addContactFirst, setAddContactFirst] = useState('');
  const [addContactLast, setAddContactLast] = useState('');
  const [addContactCompany, setAddContactCompany] = useState('');
  const [contactDraftTypes, setContactDraftTypes] = useState<Record<string, OutreachEmailType>>({});
  const [activeTrackStage, setActiveTrackStage] = useState<TrackStatus | null>(null);
  const [customizingJob, setCustomizingJob] = useState<Job | null>(null);
  const [connectingJob, setConnectingJob] = useState<Job | null>(null);
  const [viewingDraft, setViewingDraft] = useState<{ contact: Contact; draft: OutreachDraft } | null>(null);
  const [isTailoring, setIsTailoring] = useState(false);
  const [isDrafting, setIsDrafting] = useState<string | null>(null);
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailSaving, setGmailSaving] = useState(false);
  const [isAnalyzingSkills, setIsAnalyzingSkills] = useState(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false);
  const [apiKeyValidationResult, setApiKeyValidationResult] = useState<{ valid: boolean; error?: string } | null>(null); 
  const [isGettingMatchingScore, setIsGettingMatchingScore] = useState(false);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsLoadingStatus, setJobsLoadingStatus] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState<{current: number, total: number} | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Steven',
    email: 'steven@example.com',
    resumeContent: '' 
  });

  // Resume tab state
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [dragActive, setDragActive] = useState<'resume' | 'project' | null>(null);
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [savedResumeFileURLs, setSavedResumeFileURLs] = useState<string[]>([]);
  const [savedProjectFileURLs, setSavedProjectFileURLs] = useState<string[]>([]);
  const [savedResumeFiles, setSavedResumeFiles] = useState<FileMetadata[]>([]);
  const [savedProjectFiles, setSavedProjectFiles] = useState<FileMetadata[]>([]);
  const [showAllResumes, setShowAllResumes] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Update user profile when Firebase user changes
  useEffect(() => {
    if (currentUser) {
      // Use displayName from Firebase Auth (set during signup) or fallback to email
      const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
      const email = currentUser.email || '';
      
      setUserProfile(prev => ({
        ...prev,
        name,
        email
      }));

      // Load user's onboarding state from Firestore
      getUserProfile(currentUser.uid).then(userData => {
        if (userData) {
          // User exists, check if they completed onboarding
          if (userData.preferences) {
            setIsPreferencesComplete(true);
          }
          if (userData.resumeContent || userData.resumeFileURLs?.length) {
            setIsResumeComplete(true);
          }
          // GitHub URL: from OAuth connection (githubUsername) or first GitHub project link
          let githubUrl = '';
          if (userData.githubUsername) {
            githubUrl = `https://github.com/${userData.githubUsername}`;
          } else if (userData.projectLinks?.length) {
            const ghMatch = userData.projectLinks.find((l: string) => l.includes('github.com'))?.match(/github\.com\/([^/]+)/);
            if (ghMatch) githubUrl = `https://github.com/${ghMatch[1]}`;
          }
          // Load their data - use name from Firestore if available, otherwise use displayName
          setUserProfile(prev => ({
            ...prev,
            name: userData.name || currentUser.displayName || prev.name, // Prefer Firestore name
            githubUrl: githubUrl || prev.githubUrl,
            preferences: userData.preferences,
            resumeContent: userData.resumeContent || '',
            projectLinks: userData.projectLinks || []
          }));
          
          // Load saved file URLs for display (backward compatibility)
          if (userData.resumeFileURLs) {
            setSavedResumeFileURLs(userData.resumeFileURLs);
          }
          if (userData.projectFileURLs) {
            setSavedProjectFileURLs(userData.projectFileURLs);
          }
          
          // Load saved files with metadata (new format)
          if (userData.resumeFiles) {
            setSavedResumeFiles(userData.resumeFiles);
          } else if (userData.resumeFileURLs) {
            // Migrate old format to new format
            const migratedFiles = userData.resumeFileURLs.map((url, index) => ({
              name: url.split('/').pop()?.split('_').slice(1).join('_') || `Resume ${index + 1}`,
              url,
              id: `${Date.now()}_${index}`
            }));
            setSavedResumeFiles(migratedFiles);
          }
          
          if (userData.projectFiles) {
            setSavedProjectFiles(userData.projectFiles);
          } else if (userData.projectFileURLs) {
            // Migrate old format to new format
            const migratedFiles = userData.projectFileURLs.map((url, index) => ({
              name: url.split('/').pop()?.split('_').slice(1).join('_') || `Project ${index + 1}`,
              url,
              id: `${Date.now()}_${index}`
            }));
            setSavedProjectFiles(migratedFiles);
          }
          
          // Load skills visualization if available
          if (userData.skillsVisualization) {
            console.log('📊 Loading skills visualization from Firestore');
            setSkillsVisualization(userData.skillsVisualization);
          } else {
            console.log('ℹ️ No skills visualization found in Firestore');
          }
        } else {
          // New user - save basic info with name from displayName (set during signup from Full Name field)
          // displayName is set in signUpWithEmail from the Full Name input field
          const nameToSave = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          saveUserProfile(currentUser.uid, { name: nameToSave, email }).catch(console.error);
        }
      }).catch(console.error);
    } else {
      // User logged out - reset onboarding state
      // Only reset isFromSignup if we're not intentionally navigating back
      if (!isNavigatingBackRef.current) {
        setIsFromSignup(false);
        isFromSignupRef.current = false;
      }
      setIsPreferencesComplete(false);
      setIsResumeComplete(false);
    }
  }, [currentUser]);

  // Load jobs from Firestore when user completes onboarding
  useEffect(() => {
    const loadJobs = async () => {
      if (!currentUser || !isPreferencesComplete || !isResumeComplete) {
        return;
      }

      try {
        setJobsLoading(true);
        setJobsLoadingStatus('Loading jobs...');

        await seedJobsIfEmpty(MOCK_JOBS);
        const firestoreJobs = await getJobs();
        const jobsToShow = firestoreJobs.length > 0 ? firestoreJobs : MOCK_JOBS;
        const analyses: Record<string, import('./types').JobAnalysis> = await getJobAnalyses(currentUser.uid).catch(() => ({}));

        const merged = jobsToShow.map((job) => ({
          ...job,
          analysis: analyses[job.id]
        })) as Job[];
        setJobs(merged);
        setJobsLoadingStatus('');
      } catch (error) {
        console.error('Error loading jobs:', error);
        setJobsLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Failed to load jobs'}`);
        setJobs(MOCK_JOBS);
      } finally {
        setJobsLoading(false);
      }
    };

    loadJobs();
  }, [currentUser, isPreferencesComplete, isResumeComplete]);

  const trackStoragePrefix = () => `goodjobs_track_${currentUser?.uid || 'anon'}_`;
  // Load track flow: prefer Firestore, fallback to localStorage
  useEffect(() => {
    if (!currentUser?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const state = await getTrackFlowState(currentUser.uid);
        if (cancelled) return;
        if (state) {
          setTrackedJobs((state.trackedJobs || {}) as Record<string, TrackStatus>);
          setCustomizedResumes(state.customizedResumes || {});
          setJobContacts(state.jobContacts || {});
          setContactDrafts(state.contactDrafts || {});
          return;
        }
      } catch (_) {}
      if (cancelled) return;
      const prefix = trackStoragePrefix();
      try {
        const t = localStorage.getItem(prefix + 'tracked');
        const r = localStorage.getItem(prefix + 'resumes');
        const rec = localStorage.getItem(prefix + 'contacts') || localStorage.getItem(prefix + 'recruiters');
        const d = localStorage.getItem(prefix + 'contactDrafts') || localStorage.getItem(prefix + 'drafts');
        if (t) setTrackedJobs(JSON.parse(t));
        if (r) setCustomizedResumes(JSON.parse(r));
        if (rec) {
          const parsed = JSON.parse(rec);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const firstArr = Object.values(parsed)[0] as unknown[];
            const isLegacy = Array.isArray(firstArr) && firstArr[0] != null && typeof (firstArr[0] as { firstName?: string }).firstName !== 'string';
            type LegacyRecruiters = Record<string, { id: string; name: string; email?: string; role?: string; avatar?: string; relevance?: string }[]>;
            setJobContacts(isLegacy ? migrateJobRecruitersToContacts(parsed as LegacyRecruiters) : (parsed as Record<string, Contact[]>));
          }
        }
        if (d) {
          const parsed = JSON.parse(d) as Record<string, unknown>;
          const normalized: Record<string, OutreachDraft> = {};
          for (const [k, v] of Object.entries(parsed || {})) {
            if (typeof v === 'string') normalized[k] = { subject: '', body: v };
            else if (v && typeof v === 'object' && 'body' in v) normalized[k] = { subject: String((v as OutreachDraft).subject ?? ''), body: String((v as OutreachDraft).body ?? '') };
          }
          setContactDrafts(normalized);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  // Save track flow: localStorage immediately, Firestore debounced
  useEffect(() => {
    if (!currentUser?.uid) return;
    const prefix = trackStoragePrefix();
    try {
      localStorage.setItem(prefix + 'tracked', JSON.stringify(trackedJobs));
      localStorage.setItem(prefix + 'resumes', JSON.stringify(customizedResumes));
      localStorage.setItem(prefix + 'contacts', JSON.stringify(jobContacts));
      localStorage.setItem(prefix + 'contactDrafts', JSON.stringify(contactDrafts));
    } catch (_) {}
    const t = setTimeout(() => {
      saveTrackFlowState(currentUser.uid, {
        trackedJobs,
        customizedResumes,
        jobContacts,
        contactDrafts
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [trackedJobs, customizedResumes, jobContacts, contactDrafts, currentUser?.uid]);

  const handleStart = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setIsStarted(true);
    const fromSignup = mode === 'signup';
    setIsFromSignup(fromSignup);
    isFromSignupRef.current = fromSignup; // Also store in ref
  };

  const handlePreferencesComplete = async (prefs: UserPreferences) => {
    setUserProfile(prev => ({ ...prev, preferences: prefs }));
    
    // Save preferences to Firestore
    if (currentUser) {
      try {
        await saveUserPreferences(currentUser.uid, prefs);
        setIsPreferencesComplete(true);
      } catch (error) {
        console.error('Error saving preferences:', error);
        alert('Failed to save preferences. Please try again.');
      }
    } else {
      setIsPreferencesComplete(true);
    }
  };

  const handleResumeComplete = async (data: {
    resumeContent: string;
    resumeFiles: File[];
    projectFiles: File[];
    projectLinks: string[];
  }) => {
    // Save resume data to Firestore
    if (currentUser) {
      try {
        // Save the data (this uploads files and saves to Firestore)
        await saveResumeData(currentUser.uid, {
          resumeContent: data.resumeContent,
          resumeFiles: data.resumeFiles,
          projectFiles: data.projectFiles,
          projectLinks: data.projectLinks,
          savedResumeFiles: [],
          savedProjectFiles: []
        });
        
        // Clear old skills visualization from state (new data will generate new visualization)
        console.log('🗑️ Clearing old skills visualization (new data uploaded)...');
        setSkillsVisualization(null);
        
        // Reload user data to get the uploaded file metadata
        const userData = await getUserProfile(currentUser.uid);
        if (userData) {
          console.log('📁 Reloaded user data after Step 2:', {
            resumeFiles: userData.resumeFiles?.length || 0,
            projectFiles: userData.projectFiles?.length || 0,
            projectLinks: userData.projectLinks?.length || 0
          });
          
          // Update state with saved files
          setUserProfile(prev => ({
            ...prev,
            resumeContent: userData.resumeContent || data.resumeContent,
            projectLinks: userData.projectLinks || data.projectLinks
          }));
          
          // Load saved files with metadata
          if (userData.resumeFiles && userData.resumeFiles.length > 0) {
            console.log('✅ Setting saved resume files:', userData.resumeFiles);
            setSavedResumeFiles(userData.resumeFiles);
          } else {
            console.log('⚠️ No resume files found in userData');
          }
          
          if (userData.projectFiles && userData.projectFiles.length > 0) {
            console.log('✅ Setting saved project files:', userData.projectFiles);
            setSavedProjectFiles(userData.projectFiles);
          } else {
            console.log('⚠️ No project files found in userData');
          }
          
          // Also update URL arrays for backward compatibility
          if (userData.resumeFileURLs) {
            setSavedResumeFileURLs(userData.resumeFileURLs);
          }
          if (userData.projectFileURLs) {
            setSavedProjectFileURLs(userData.projectFileURLs);
          }
        } else {
          console.error('❌ No user data found after saving');
        }
        
        setIsResumeComplete(true);
        
        // Trigger skills analysis and redirect to Visualize Skills
        await triggerSkillsAnalysis();
      } catch (error) {
        console.error('Error saving resume data:', error);
        alert('Failed to save resume data. Please try again.');
      }
    } else {
      setIsResumeComplete(true);
    }
  };

  // Trigger skills analysis
  const triggerSkillsAnalysis = async () => {
    if (!currentUser) {
      console.error('❌ No current user, cannot analyze skills');
      return;
    }
    
    console.log('🚀 triggerSkillsAnalysis called');
    setIsAnalyzingSkills(true);
    try {
      // Check API key first (support both GEMINI_API_KEY and VITE_GEMINI_API_KEY)
      const env = import.meta.env as any;
      const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (process.env as any).API_KEY;
      console.log('🔑 API Key check:', {
        hasViteKey: !!env.VITE_GEMINI_API_KEY,
        hasGeminiKey: !!env.GEMINI_API_KEY,
        hasProcessKey: !!(process.env as any).API_KEY,
        finalKeyLength: apiKey ? apiKey.length : 0
      });
      
      if (!apiKey) {
        throw new Error('Gemini API key is not set. Please add VITE_GEMINI_API_KEY=your_key to your .env.local file (note: Vite requires the VITE_ prefix for client-side access). Restart the dev server after adding it.');
      }
      
      // Get all resume and project file URLs
      console.log('📥 Fetching user data from Firestore...');
      const userData = await getUserProfile(currentUser.uid);
      if (!userData) {
        throw new Error('No user data found. Please save your resume data first.');
      }
      
      const resumeFileURLs = userData.resumeFileURLs || [];
      const projectFileURLs = userData.projectFileURLs || [];
      const projectLinks = userData.projectLinks || [];
      const resumeContent = userData.resumeContent || '';
      
      console.log('🔍 Starting skills analysis with:', {
        resumeContent: resumeContent ? `${resumeContent.length} chars` : 'empty',
        resumeFiles: resumeFileURLs.length,
        projectFiles: projectFileURLs.length,
        projectLinks: projectLinks.length
      });
      console.log('📋 Detailed data:', {
        resumeFileURLs: resumeFileURLs,
        projectFileURLs: projectFileURLs,
        projectLinks: projectLinks
      });
      
      // Check if we have any data to analyze
      if (!resumeContent && resumeFileURLs.length === 0 && projectFileURLs.length === 0 && projectLinks.length === 0) {
        throw new Error('No resume or project data to analyze. Please upload resumes, projects, or add links first.');
      }
      
      // Analyze skills using Gemini
      console.log('📞 Calling analyzeSkills...');
      const visualization = await analyzeSkills(
        resumeContent,
        resumeFileURLs,
        projectFileURLs,
        projectLinks
      );
      
      console.log('✅ Skills analysis completed:', {
        experiences: visualization.professional_experiences.length,
        projects: visualization.projects.length,
        skills: visualization.all_skills.length,
        inaccessible: visualization.inaccessible_sources.length
      });
      
      // Save to Firestore (this overwrites any existing skillsVisualization)
      console.log('💾 Saving skills visualization to Firestore (overwriting existing)...');
      await saveSkillsVisualization(currentUser.uid, visualization);
      setSkillsVisualization(visualization);
      
      // Redirect to Visualize Skills page
      console.log('✅ Skills analysis complete, redirecting to Visualize Skills page');
      setActiveNav(NavItem.VisualizeSkills);
    } catch (error) {
      console.error('❌ Error analyzing skills:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error.cause : undefined
      });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to analyze skills: ${errorMessage}\n\nPlease check:\n1. VITE_GEMINI_API_KEY is set in .env.local\n2. You have resume/project data saved\n3. Check browser console for details`);
    } finally {
      setIsAnalyzingSkills(false);
    }
  };

  // Validate Gemini API key
  const handleValidateApiKey = async () => {
    setIsValidatingApiKey(true);
    setApiKeyValidationResult(null);
    try {
      const result = await validateGeminiApiKey();
      setApiKeyValidationResult(result);
      if (result.valid) {
        alert('✅ Gemini API key is valid!');
      } else {
        alert(`❌ API key validation failed:\n\n${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApiKeyValidationResult({ valid: false, error: errorMessage });
      alert(`❌ Error validating API key:\n\n${errorMessage}`);
    } finally {
      setIsValidatingApiKey(false);
    }
  };

  const handleGetMatchingScore = async () => {
    if (!currentUser || !skillsVisualization) {
      alert('Please complete your Visualize Skills analysis first. Save your resume data and run the skills analysis.');
      return;
    }
    if (jobs.length === 0) {
      alert('No jobs to analyze.');
      return;
    }
    setIsGettingMatchingScore(true);
    try {
      const mySkillsSet = new Set(skillsVisualization.all_skills.map(s => s.toLowerCase().trim()));
      const keywordInputs = jobs.map(j => ({
        jobId: j.id,
        title: j.title,
        company: j.company,
        description: j.description
      }));
      const keywordMap = await extractJobKeywordsBatch(keywordInputs);
      const fitInputs = jobs.map(j => {
        const keywords = keywordMap[j.id] || [];
        const matched = keywords.filter(k => mySkillsSet.has(k.toLowerCase().trim()));
        return {
          jobId: j.id,
          title: j.title,
          company: j.company,
          keywords,
          mySkills: skillsVisualization.all_skills,
          matchedKeywords: matched
        };
      });
      const fitMap = await generateJobFitAnalysisBatch(fitInputs, skillsVisualization);
      const newAnalyses: Record<string, import('./types').JobAnalysis> = {};
      for (const j of jobs) {
        const fit = fitMap[j.id];
        const keywords = keywordMap[j.id] || [];
        const matched = keywords.filter(k => mySkillsSet.has(k.toLowerCase().trim()));
        const score = keywords.length > 0 ? Math.round((matched.length / keywords.length) * 100) : 0;
        const analysis: import('./types').JobAnalysis = {
          keywords,
          keywordMatchScore: score,
          whatLooksGood: fit?.whatLooksGood || '',
          whatIsMissing: fit?.whatIsMissing || ''
        };
        newAnalyses[j.id] = analysis;
        await saveJobAnalysis(currentUser.uid, j.id, analysis);
      }
      setJobs(prev => prev.map(job => ({ ...job, analysis: newAnalyses[job.id] ?? job.analysis })));
    } catch (error) {
      console.error('Get matching score error:', error);
      alert(`Failed to compute matching scores: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGettingMatchingScore(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setIsStarted(false);
      setIsPreferencesComplete(false);
      setIsResumeComplete(false);
      setIsFromSignup(false); // Reset signup tracking
      setActiveNav(NavItem.Jobs);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleUpdatePreferences = async (newPrefs: UserPreferences) => {
    console.log('🚀 handleUpdatePreferences called with:', newPrefs);
    console.log('👤 currentUser:', currentUser ? 'exists' : 'null');
    
    try {
      // Update user profile state immediately
      setUserProfile(prev => ({ ...prev, preferences: newPrefs }));
      
      // Save preferences to Firestore (if user is logged in)
      if (currentUser) {
        console.log('💾 Saving preferences to Firestore...');
        await saveUserPreferences(currentUser.uid, newPrefs);
      } else {
        console.warn('⚠️ No currentUser, skipping Firestore save');
      }
      
      // Close the modal
      setShowPreferencesModal(false);
      
      // Reload jobs from Firestore (fallback to MOCK_JOBS if Firestore fails)
      setJobs([]);
      setJobsLoading(true);
      setJobsLoadingStatus('Loading jobs...');
      try {
        let firestoreJobs: Job[] = [];
        try {
          await seedJobsIfEmpty(MOCK_JOBS);
          firestoreJobs = await getJobs();
        } catch (fsError) {
          console.warn('Firestore jobs load failed:', fsError);
        }
        const jobsToShow = firestoreJobs.length > 0 ? firestoreJobs : MOCK_JOBS;
        const analyses: Record<string, import('./types').JobAnalysis> = currentUser ? await getJobAnalyses(currentUser.uid).catch(() => ({})) : {};
        const merged = jobsToShow.map((job) => ({
          ...job,
          analysis: analyses[job.id]
        })) as Job[];
        setJobs(merged);
        setJobsLoadingStatus('');
      } catch (error) {
        console.error('❌ Error reloading jobs:', error);
        setJobs(MOCK_JOBS);
      } finally {
        setJobsLoading(false);
      }
    } catch (error) {
      console.error('❌ Error in handleUpdatePreferences:', error);
      alert('Failed to update preferences. Please try again.');
    }
  };

  const runAnalysis = useCallback(async () => {
    if (!userProfile.resumeContent) return;
    
    setAnalysisProgress({ current: 0, total: jobs.length });
    const updatedJobs = [...jobs];
    
    for (let i = 0; i < updatedJobs.length; i++) {
      setAnalysisProgress({ current: i + 1, total: jobs.length });
      const job = updatedJobs[i];
      const result = await calculateMatchScore(userProfile.resumeContent, job.description);
      
      updatedJobs[i] = { 
        ...job, 
        matchScore: result.score, 
        matchReason: result.reason 
      };
      setJobs([...updatedJobs]);

      if (i < updatedJobs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const finalSorted = [...updatedJobs].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    setJobs(finalSorted);
    setAnalysisProgress(null);
  }, [jobs, userProfile.resumeContent]);

  // Disabled: old AI match score that progressively updated to 0.
  // Matching scores now come only from "Get matching score" (keyword-based).
  // useEffect(() => {
  //   if (currentUser && isPreferencesComplete && isResumeComplete && jobs.length > 0 && !jobsLoading) {
  //     runAnalysis();
  //   }
  // }, [currentUser, isPreferencesComplete, isResumeComplete, jobs.length, jobsLoading]);

  const filteredJobs = useMemo(() => {
    // Since the API already filters by preferences, just return all jobs
    // The API handles: title, location, workType, experienceLevel, contractType
    console.log(`📊 Displaying ${jobs.length} jobs (no additional client-side filtering)`);
    return jobs;
  }, [jobs]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const scoreA = a.analysis?.keywordMatchScore ?? a.matchScore ?? -1;
      const scoreB = b.analysis?.keywordMatchScore ?? b.matchScore ?? -1;
      if (sortBy === 'score-desc') return scoreB - scoreA;
      if (sortBy === 'score-asc') return scoreA - scoreB;
      return parseInt(b.id, 10) - parseInt(a.id, 10);
    });
  }, [filteredJobs, sortBy]);

  const isMatching = analysisProgress !== null;

  const trackJob = (id: string) => {
    if (!trackedJobs[id]) setTrackedJobs((prev) => ({ ...prev, [id]: 'Customize' }));
  };
  const moveJob = (id: string, status: TrackStatus) => {
    setTrackedJobs((prev) => ({ ...prev, [id]: status }));
  };
  const untrackJob = (id: string) => {
    setTrackedJobs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const handleTailor = async (job: Job) => {
    if (!userProfile.resumeContent) return;
    setIsTailoring(true);
    try {
      const tailored = await generateCustomizedResume(userProfile.resumeContent, job.description);
      setCustomizedResumes((prev) => ({ ...prev, [job.id]: tailored }));
    } finally {
      setIsTailoring(false);
    }
  };
  const handleAddContact = (jobId: string, firstName: string, lastName: string, companyNameOrUrl: string) => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedCompany = companyNameOrUrl.trim();
    if (!trimmedFirst || !trimmedLast || !trimmedCompany) return;
    const newContact: Contact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      companyNameOrUrl: trimmedCompany
    };
    setJobContacts((prev) => ({
      ...prev,
      [jobId]: [...(prev[jobId] || []), newContact]
    }));
  };

  const handleFindEmail = async (contact: Contact) => {
    setFindingEmailContactId(contact.id);
    try {
      const result = await findEmailViaApollo(contact.firstName, contact.lastName, contact.companyNameOrUrl);
      if (result) {
        setJobContacts((prev) => {
          const next = { ...prev };
          for (const [jobId, list] of Object.entries(next)) {
            const idx = list.findIndex((c) => c.id === contact.id);
            if (idx >= 0) {
              const updated = [...list];
              updated[idx] = {
                ...updated[idx],
                email: result.email ?? updated[idx].email,
                role: result.title ?? updated[idx].role,
                avatar: result.photo_url ?? updated[idx].avatar
              };
              next[jobId] = updated;
              break;
            }
          }
          return next;
        });
      }
    } finally {
      setFindingEmailContactId(null);
    }
  };

  const handleDraftEmail = async (job: Job, contact: Contact) => {
    setIsDrafting(contact.id);
    try {
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();
      const draft: OutreachDraft = await generateOutreachEmail(
        userProfile.name,
        userProfile.resumeContent || '',
        job.title,
        job.company,
        contactName,
        contactDraftTypes[contact.id] ?? 'coffee-chat'
      );
      setContactDrafts((prev) => ({ ...prev, [contact.id]: draft }));
      setViewingDraft({ contact, draft });
    } finally {
      setIsDrafting(null);
    }
  };

  const updateViewingDraft = (updates: Partial<OutreachDraft>) => {
    if (!viewingDraft) return;
    const draft: OutreachDraft = { ...viewingDraft.draft, ...updates };
    setViewingDraft({ ...viewingDraft, draft });
    setContactDrafts((prev) => ({ ...prev, [viewingDraft.contact.id]: draft }));
  };

  const handleConnectGmail = async () => {
    if (!isGmailConfigured()) {
      alert('Gmail integration not configured. Add VITE_GOOGLE_CLIENT_ID to .env.local. See GMAIL_SETUP.md.');
      return;
    }
    setGmailConnecting(true);
    try {
      const token = await requestGmailAccess();
      if (token) setGmailAccessToken(token);
    } finally {
      setGmailConnecting(false);
    }
  };

  const handleSaveToGmail = async () => {
    if (!viewingDraft) return;
    const to = viewingDraft.contact.email;
    if (!to) {
      alert('No email for this contact. Use "Find email" first or add it manually.');
      return;
    }
    let token = gmailAccessToken;
    if (!token && isGmailConfigured()) {
      setGmailConnecting(true);
      token = await requestGmailAccess();
      setGmailConnecting(false);
      if (token) setGmailAccessToken(token);
    }
    if (!token) return;
    setGmailSaving(true);
    try {
      const result = await createGmailDraft(token, to, viewingDraft.draft.subject, viewingDraft.draft.body);
      if (result.error) alert(`Could not save to Gmail: ${result.error}`);
      else alert('Draft saved to Gmail. Open Gmail to view and send.');
    } finally {
      setGmailSaving(false);
    }
  };

  const allContacts = useMemo(() => {
    return Object.entries(jobContacts).flatMap(([jobId, list]) => {
      const job = jobs.find((j) => j.id === jobId);
      return list.map((c) => ({ ...c, jobCompany: job?.company, jobTitle: job?.title }));
    });
  }, [jobContacts, jobs]);

  // Resume section handlers
  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(null);
    const files = Array.from(e.dataTransfer.files);
    setResumeFiles(prev => [...prev, ...files]);
  };

  const handleResumeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setResumeFiles(prev => [...prev, ...files]);
    }
  };

  const handleProjectDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(null);
    const files = Array.from(e.dataTransfer.files);
    setProjectFiles(prev => [...prev, ...files]);
  };

  const handleProjectFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setProjectFiles(prev => [...prev, ...files]);
    }
  };

  const removeResumeFile = (index: number) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeProjectFile = (index: number) => {
    setProjectFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    if (linkInput.trim() && !userProfile.projectLinks?.includes(linkInput.trim())) {
      const newLinks = [...(userProfile.projectLinks || []), linkInput.trim()];
      setUserProfile(prev => ({ ...prev, projectLinks: newLinks }));
      setLinkInput('');
    }
  };

  const removeLink = (link: string) => {
    const newLinks = (userProfile.projectLinks || []).filter(l => l !== link);
    setUserProfile(prev => ({ ...prev, projectLinks: newLinks }));
  };

  const handleDeleteSavedResumeFile = (fileId: string) => {
    // Only update local state - changes will be persisted when "Apply Changes" is clicked
    setSavedResumeFiles(prev => prev.filter(file => file.id !== fileId));
    setSavedResumeFileURLs(prev => {
      const fileToDelete = savedResumeFiles.find(f => f.id === fileId);
      return fileToDelete ? prev.filter(url => url !== fileToDelete.url) : prev;
    });
  };

  const handleDeleteSavedProjectFile = (fileId: string) => {
    // Only update local state - changes will be persisted when "Apply Changes" is clicked
    setSavedProjectFiles(prev => prev.filter(file => file.id !== fileId));
    setSavedProjectFileURLs(prev => {
      const fileToDelete = savedProjectFiles.find(f => f.id === fileId);
      return fileToDelete ? prev.filter(url => url !== fileToDelete.url) : prev;
    });
  };

  const handleDeleteLink = (link: string) => {
    // Only update local state - changes will be persisted when "Apply Changes" is clicked
    setUserProfile(prev => ({
      ...prev,
      projectLinks: (prev.projectLinks || []).filter(l => l !== link)
    }));
  };

  const handleSaveResume = async () => {
    if (!currentUser) return;
    
    setIsSavingResume(true);
    try {
      const result = await saveResumeData(currentUser.uid, {
        resumeContent: userProfile.resumeContent || '',
        resumeFiles,
        projectFiles,
        projectLinks: userProfile.projectLinks || [],
        savedResumeFiles, // Include current saved files with metadata (deletions already reflected)
        savedProjectFiles // Include current saved files with metadata (deletions already reflected)
      });
      
      // Update saved files with newly uploaded ones
      if (result.resumeFiles.length > 0) {
        setSavedResumeFiles(prev => [...prev, ...result.resumeFiles]);
      }
      if (result.projectFiles.length > 0) {
        setSavedProjectFiles(prev => [...prev, ...result.projectFiles]);
      }
      
      // Clear file arrays after successful save (they're now in saved files)
      setResumeFiles([]);
      setProjectFiles([]);
      
      // Reload user profile to get updated data
      const userData = await getUserProfile(currentUser.uid);
      if (userData) {
        setUserProfile(prev => ({
          ...prev,
          resumeContent: userData.resumeContent || prev.resumeContent,
          projectLinks: userData.projectLinks || prev.projectLinks
        }));
        if (userData.resumeFiles) {
          setSavedResumeFiles(userData.resumeFiles);
        } else if (userData.resumeFileURLs) {
          // Migrate old format
          const migratedFiles = userData.resumeFileURLs.map((url, index) => ({
            name: url.split('/').pop()?.split('_').slice(1).join('_') || `Resume ${index + 1}`,
            url,
            id: `${Date.now()}_${index}`
          }));
          setSavedResumeFiles(migratedFiles);
        }
        if (userData.projectFiles) {
          setSavedProjectFiles(userData.projectFiles);
        } else if (userData.projectFileURLs) {
          // Migrate old format
          const migratedFiles = userData.projectFileURLs.map((url, index) => ({
            name: url.split('/').pop()?.split('_').slice(1).join('_') || `Project ${index + 1}`,
            url,
            id: `${Date.now()}_${index}`
          }));
          setSavedProjectFiles(migratedFiles);
        }
      }
      
      // Clear old skills visualization from state (will be overwritten by new analysis)
      console.log('🗑️ Clearing old skills visualization (will be overwritten by new analysis)...');
      setSkillsVisualization(null);
      
      // Trigger skills analysis and redirect to Visualize Skills
      await triggerSkillsAnalysis();
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Failed to save resume data. Please try again.');
    } finally {
      setIsSavingResume(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext || '')) return 'fa-file-word';
    if (['txt'].includes(ext || '')) return 'fa-file-lines';
    if (['zip', 'rar', '7z'].includes(ext || '')) return 'fa-file-zipper';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return 'fa-file-image';
    return 'fa-file';
  };

  const createFileThumbnail = (file: File): string => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return '';
  };

  // Landing page - show when not started
  if (!isStarted) return <LandingPage onStart={handleStart} />;
  
  // Auth pages - show when started but not authenticated
  if (!currentUser) {
    if (authMode === 'signup') {
      return (
        <SignUpPage 
          onBack={() => setIsStarted(false)} 
          onSwitchToSignIn={() => setAuthMode('login')}
        />
      );
    }
    return (
      <SignInPage 
        onBack={() => setIsStarted(false)} 
        onSwitchToSignUp={() => setAuthMode('signup')}
      />
    );
  }
  
  // Handler to go back to sign in (signs out current user)
  const handleBackToSignIn = async () => {
    await logOut();
    setAuthMode('login');
    setIsStarted(true);
  };

  // Handler to go back from Step 1
  const handleBackFromPreferences = async () => {
    // Preserve the signup flag from ref (since logout resets state)
    const wasFromSignup = isFromSignupRef.current;
    
    // Set flag to prevent useEffect from resetting isFromSignup
    isNavigatingBackRef.current = true;
    
    // Always log out to go back
    await logOut();
    
    // After logout, restore the signup state if needed
    if (wasFromSignup) {
      // If came from signup, show signup page after logout
      setAuthMode('signup');
      setIsStarted(true);
      setIsFromSignup(true);
      isFromSignupRef.current = true; // Restore ref too
    } else {
      // Otherwise, return to landing
      setIsStarted(false);
      setIsFromSignup(false);
      isFromSignupRef.current = false;
    }
    
    setIsPreferencesComplete(false);
    
    // Reset the navigation flag after a short delay
    setTimeout(() => {
      isNavigatingBackRef.current = false;
    }, 500);
  };

  // Onboarding steps - show after authentication
  if (!isPreferencesComplete) {
    return (
      <PreferencesPage 
        onComplete={handlePreferencesComplete}
        onBack={handleBackFromPreferences}
        onSignIn={handleBackToSignIn}
      />
    );
  }
  
  if (!isResumeComplete) {
    return (
      <ResumeUploadPage 
        onComplete={handleResumeComplete} 
        onBack={() => setIsPreferencesComplete(false)}
        onSignIn={handleBackToSignIn}
      />
    );
  }

  const handleNavigate = (nav: NavItem) => {
    setActiveTrackStage(null);
    if (nav !== NavItem.Track && nav !== NavItem.Customize && nav !== NavItem.Connect) {
      setCustomizingJob(null);
      setConnectingJob(null);
      setViewingDraft(null);
    }
    setActiveNav(nav);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] animate-in fade-in duration-1000">
      <Sidebar activeItem={activeNav} onNavigate={handleNavigate} onSignOut={handleSignOut} />

      <main className={`ml-72 p-12 ${activeNav === NavItem.Track || activeNav === NavItem.Customize ? 'w-[calc(100vw-18rem)] max-w-none' : 'max-w-7xl mx-auto'}`}>
        {activeNav === NavItem.Jobs && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <header className="mb-12">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-8">
                <div>
                  <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-[0.3em]">AI Intelligence Feed</p>
                  <h1 className="text-4xl font-black text-[#1a1a3a] tracking-tight">Personalized Recommendations</h1>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Active Identity</p>
                    <p className="text-sm font-bold text-indigo-600">{userProfile.name}</p>
                  </div>
                  <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <i className="fa-solid fa-bolt-lightning"></i>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap w-full">
                <div className="flex items-center gap-3 bg-white border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
                  <i className="fa-solid fa-arrow-down-short-wide text-slate-400 text-xs"></i>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="text-xs font-black text-slate-600 bg-transparent border-none outline-none appearance-none cursor-pointer uppercase tracking-widest"
                  >
                    <option value="score-desc">Best Match</option>
                    <option value="score-asc">Lowest Match</option>
                    <option value="newest">Recent</option>
                  </select>
                </div>
                <button
                  onClick={handleGetMatchingScore}
                  disabled={isGettingMatchingScore || !skillsVisualization || jobs.length === 0}
                  className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 transition-all ml-auto"
                >
                  {isGettingMatchingScore ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-percent"></i>
                      Get matching score
                    </>
                  )}
                </button>
              </div>
            </header>

            <div className="relative">
              {jobsLoading && (
                <div className="sticky top-0 mb-8 flex justify-center z-20">
                  <div className="bg-blue-600 text-white text-[11px] font-black px-8 py-3 rounded-full shadow-2xl shadow-blue-200 flex items-center gap-3 animate-bounce">
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                    <span className="tracking-widest uppercase">
                      {jobsLoadingStatus || 'Loading jobs from LinkedIn...'}
                    </span>
                  </div>
                </div>
              )}
              
              {isMatching && !jobsLoading && (
                <div className="sticky top-0 mb-8 flex justify-center z-20">
                  <div className="bg-indigo-600 text-white text-[10px] font-black px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
                    <i className="fa-solid fa-dna animate-pulse"></i>
                    <span className="tracking-widest uppercase">Analyzing DNA...</span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                {jobsLoading ? (
                  <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <i className="fa-solid fa-circle-notch animate-spin text-2xl text-blue-600"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Loading Jobs from LinkedIn</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto">{jobsLoadingStatus || 'Fetching latest job listings...'}</p>
                  </div>
                ) : sortedJobs.length > 0 ? (
                  sortedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => setSelectedJob(job)}
                      onTrack={() => trackJob(job.id)}
                      isTracked={!!trackedJobs[job.id]}
                    />
                  ))
                ) : (
                  <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <i className="fa-solid fa-magnifying-glass text-2xl text-slate-200"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No jobs currently match your criteria</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto">Try updating your preferences in the profile tab to broaden your search results.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {(activeNav === NavItem.Track || activeNav === NavItem.Customize) && (
          <section className="animate-in fade-in duration-500 h-full">
            {customizingJob ? (
              <CustomizeJobModal
                job={customizingJob}
                onClose={() => setCustomizingJob(null)}
                mySkills={skillsVisualization?.all_skills}
                skillsVisualization={skillsVisualization}
                userName={userProfile.name}
                userEmail={userProfile.email}
                userGithub={userProfile.githubUrl}
                userId={currentUser?.uid ?? ''}
                onSave={(jobId) => {
                  moveJob(jobId, 'Connect');
                  setCustomizingJob(null);
                }}
              />
            ) : connectingJob ? (
              <div className="animate-in slide-in-from-right-12 duration-500 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
                <header className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setConnectingJob(null)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 leading-tight">Networking: {connectingJob.company}</h2>
                      <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">{connectingJob.title}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { moveJob(connectingJob.id, 'Apply'); setConnectingJob(null); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
                      Move to Apply
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </header>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden pb-8">
                  <div className="space-y-4 overflow-y-auto pr-4 custom-scrollbar">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Add contact</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <input type="text" placeholder="First name" value={addContactFirst} onChange={(e) => setAddContactFirst(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                        <input type="text" placeholder="Last name" value={addContactLast} onChange={(e) => setAddContactLast(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                        <input type="text" placeholder="Company name or URL" value={addContactCompany} onChange={(e) => setAddContactCompany(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 sm:col-span-1" />
                      </div>
                      <button onClick={() => { handleAddContact(connectingJob.id, addContactFirst, addContactLast, addContactCompany); setAddContactFirst(''); setAddContactLast(''); setAddContactCompany(''); }} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
                        Add contact
                      </button>
                    </div>
                    {(jobContacts[connectingJob.id] || []).map((contact) => (
                      <div key={contact.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4 group hover:border-emerald-100 transition-all">
                        <div className="flex items-center gap-5 flex-wrap">
                          <img src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.firstName + ' ' + contact.lastName)}&background=random&size=200`} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-100" />
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h4 className="font-black text-slate-900 leading-tight">{contact.firstName} {contact.lastName}</h4>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {(['coffee-chat', 'referral', 'hiring-manager-intro'] as const).map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); setContactDraftTypes((prev) => ({ ...prev, [contact.id]: type })); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${(contactDraftTypes[contact.id] ?? 'coffee-chat') === type ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title={type === 'coffee-chat' ? 'Coffee chat' : type === 'referral' ? 'Referral' : 'Hiring manager intro'}>
                                  {type === 'coffee-chat' ? 'Chat' : type === 'referral' ? 'Referral' : 'Intro'}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs font-bold text-emerald-600 mb-0 w-full sm:w-auto">{contact.companyNameOrUrl}</p>
                            {contact.role && <p className="text-[10px] text-slate-400 font-medium">{contact.role}</p>}
                            {contact.email ? <p className="text-[10px] text-slate-500 font-medium">{contact.email}</p> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!contact.email ? (
                            <button onClick={() => handleFindEmail(contact)} disabled={findingEmailContactId === contact.id} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                              {findingEmailContactId === contact.id ? <i className="fa-solid fa-spinner animate-spin"></i> : null} Find email
                            </button>
                          ) : null}
                          <button onClick={() => handleDraftEmail(connectingJob, contact)} disabled={isDrafting === contact.id} className="flex-none bg-emerald-50 text-emerald-600 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50">
                            {isDrafting === contact.id ? 'Thinking...' : (contactDrafts[contact.id] ? 'Review Draft' : 'Draft Email')}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!(jobContacts[connectingJob.id] || []).length && (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center border-4 border-dashed border-slate-100 rounded-[3rem] bg-white/50">
                        <i className="fa-solid fa-address-book text-4xl text-slate-200 mb-6"></i>
                        <h4 className="text-xl font-black text-slate-300 tracking-tight">No contacts yet</h4>
                        <p className="text-slate-400 font-bold mt-2">Add a contact above (first name, last name, company or URL). Then use Find email and Draft email.</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outreach Workbench</span>
                      <div className="flex items-center gap-2">
                        {!gmailAccessToken ? (
                          <button onClick={handleConnectGmail} disabled={gmailConnecting} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1.5 border border-red-200">
                            {gmailConnecting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                            Connect Gmail
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1.5"><i className="fa-brands fa-google"></i> Gmail connected</span>
                        )}
                        <i className="fa-solid fa-pen-nib text-emerald-400"></i>
                      </div>
                    </div>
                    {viewingDraft ? (
                      <div className="flex-1 flex flex-col overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">To</span>
                            <span className="text-sm text-slate-700 truncate">{viewingDraft.contact.firstName} {viewingDraft.contact.lastName}{viewingDraft.contact.email ? ` <${viewingDraft.contact.email}>` : ' (no email)'}</span>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Subject</label>
                            <input type="text" value={viewingDraft.draft.subject} onChange={(e) => updateViewingDraft({ subject: e.target.value })} className="flex-1 min-w-0 text-sm font-medium text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-400" placeholder="Email subject" />
                          </div>
                          <div className="flex-1 flex flex-col min-h-0 p-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Body</label>
                            <textarea value={viewingDraft.draft.body} onChange={(e) => updateViewingDraft({ body: e.target.value })} className="flex-1 min-h-[120px] w-full text-sm font-normal leading-relaxed text-slate-700 border border-slate-200 rounded-xl p-4 resize-none outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400" placeholder="Write your message..." />
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button className="flex-1 min-w-[140px] bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-paper-plane"></i>
                            Send to contact
                          </button>
                          <button onClick={handleSaveToGmail} disabled={gmailSaving || !viewingDraft.contact.email} className="px-5 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-2" title={!viewingDraft.contact.email ? 'Add contact email first' : 'Save draft to your Gmail'}>
                            {gmailSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                            Save to Gmail
                          </button>
                          <button onClick={() => setViewingDraft(null)} className="px-6 border border-slate-200 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Dismiss</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                          <i className="fa-solid fa-envelope-open-text text-2xl"></i>
                        </div>
                        <h4 className="text-lg font-black text-slate-300 tracking-tight">Workbench Empty</h4>
                        <p className="text-slate-400 font-bold mt-2">Select a contact to generate or review a personalized outreach draft.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeNav === NavItem.Customize ? (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
                <header className="mb-12">
                  <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-[0.3em]">Tailor Your Application</p>
                  <h2 className="text-4xl font-black text-[#1a1a3a] tracking-tight">Customize</h2>
                  <p className="text-slate-500 text-sm mt-2">Jobs to tailor. Click &quot;Track Job&quot; in the Jobs tab to add jobs here.</p>
                </header>
                <div className="grid grid-cols-1 gap-4">
                  {jobs.filter((j) => trackedJobs[j.id] === 'Customize').length > 0 ? (
                    jobs.filter((j) => trackedJobs[j.id] === 'Customize').map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onClick={() => setCustomizingJob(job)}
                        isTracked={true}
                        onRemove={() => untrackJob(job.id)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                      <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fa-solid fa-pen-nib text-2xl text-orange-200"></i>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">No jobs to customize</h3>
                      <p className="text-slate-400 font-medium max-w-xs mx-auto">Track jobs from the Jobs tab to add them here. Then tailor your resume for each role.</p>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="animate-in fade-in duration-500 w-full">
                <header className="mb-8">
                  <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-[0.3em]">Application Board</p>
                  <h2 className="text-3xl font-black text-[#1a1a3a] tracking-tight">Current Progress</h2>
                  <p className="text-slate-500 text-sm mt-2">Jobs appear here when you click &quot;Track Job&quot; in the Jobs tab or the track button in a job detail.</p>
                </header>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {STAGES.map((s) => {
                    const stageJobs = jobs.filter((j) => trackedJobs[j.id] === s.key);
                    return (
                      <div key={s.key} className={`flex flex-col rounded-2xl border border-slate-100 min-h-[500px] overflow-hidden flex-1 min-w-0 ${s.key === 'Done' ? 'bg-pink-50/60' : 'bg-slate-50/80'}`}>
                        <div className={`px-5 py-4 ${s.bg} ${s.color} rounded-t-2xl border-b border-slate-100 flex items-center justify-center gap-2 relative`}>
                          <i className={`fa-solid ${s.icon} text-lg`}></i>
                          <h3 className="font-black text-slate-900 uppercase tracking-wider text-sm">{s.label}</h3>
                          <span className="absolute right-4 bg-white/60 text-slate-700 font-black text-sm w-8 h-8 rounded-lg flex items-center justify-center">{stageJobs.length}</span>
                        </div>
                        <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar min-h-[400px]">
                          {stageJobs.map((job) => (
                            <div
                              key={job.id}
                              onClick={() => {
                                if (s.key === 'Customize') setCustomizingJob(job);
                                if (s.key === 'Connect') setConnectingJob(job);
                                if (s.key === 'Apply' || s.key === 'Done') setSelectedJob(job);
                              }}
                              className="relative bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); untrackJob(job.id); }}
                                className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all z-10"
                                title="Remove from pipeline"
                              >
                                <i className="fa-solid fa-xmark text-sm"></i>
                              </button>
                              <div className="flex items-start gap-3 pr-8">
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {job.logo && job.logo.startsWith('http') ? <img src={job.logo} alt="" className="w-full h-full object-contain" /> : <span className="text-slate-400 font-black text-sm">{job.company?.charAt(0) || '?'}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 transition-colors">{job.title}</h4>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 truncate">{job.company}</p>
                                  {job.analysis?.keywordMatchScore !== undefined && (
                                    <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black">{job.analysis.keywordMatchScore}% match</span>
                                  )}
                                  {s.key === 'Apply' && (
                                    <button onClick={(e) => { e.stopPropagation(); moveJob(job.id, 'Done'); }} className="mt-3 w-full py-2 rounded-lg bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                      Apply
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {stageJobs.length === 0 && (
                            <div className="py-8 text-center text-slate-300">
                              <i className={`fa-solid ${s.icon} text-2xl mb-2 block opacity-50`}></i>
                              <p className="text-xs font-bold">No jobs</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {activeNav === NavItem.Connect && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            {connectingJob ? (
              <div className="animate-in slide-in-from-right-12 duration-500 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
                <header className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setConnectingJob(null)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 leading-tight">Networking: {connectingJob.company}</h2>
                      <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest">{connectingJob.title}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { moveJob(connectingJob.id, 'Apply'); setConnectingJob(null); }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl">
                      Move to Apply
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </header>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden pb-8">
                  <div className="space-y-4 overflow-y-auto pr-4 custom-scrollbar">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Add contact</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <input type="text" placeholder="First name" value={addContactFirst} onChange={(e) => setAddContactFirst(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                        <input type="text" placeholder="Last name" value={addContactLast} onChange={(e) => setAddContactLast(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                        <input type="text" placeholder="Company name or URL" value={addContactCompany} onChange={(e) => setAddContactCompany(e.target.value)} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 sm:col-span-1" />
                      </div>
                      <button onClick={() => { handleAddContact(connectingJob.id, addContactFirst, addContactLast, addContactCompany); setAddContactFirst(''); setAddContactLast(''); setAddContactCompany(''); }} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
                        Add contact
                      </button>
                    </div>
                    {(jobContacts[connectingJob.id] || []).map((contact) => (
                      <div key={contact.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4 group hover:border-emerald-100 transition-all">
                        <div className="flex items-center gap-5 flex-wrap">
                          <img src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.firstName + ' ' + contact.lastName)}&background=random&size=200`} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-100" />
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h4 className="font-black text-slate-900 leading-tight">{contact.firstName} {contact.lastName}</h4>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {(['coffee-chat', 'referral', 'hiring-manager-intro'] as const).map((type) => (
                                <button key={type} onClick={(e) => { e.stopPropagation(); setContactDraftTypes((prev) => ({ ...prev, [contact.id]: type })); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${(contactDraftTypes[contact.id] ?? 'coffee-chat') === type ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title={type === 'coffee-chat' ? 'Coffee chat' : type === 'referral' ? 'Referral' : 'Hiring manager intro'}>
                                  {type === 'coffee-chat' ? 'Chat' : type === 'referral' ? 'Referral' : 'Intro'}
                                </button>
                              ))}
                            </div>
                            <p className="text-xs font-bold text-emerald-600 mb-0 w-full sm:w-auto">{contact.companyNameOrUrl}</p>
                            {contact.role && <p className="text-[10px] text-slate-400 font-medium">{contact.role}</p>}
                            {contact.email ? <p className="text-[10px] text-slate-500 font-medium">{contact.email}</p> : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!contact.email ? (
                            <button onClick={() => handleFindEmail(contact)} disabled={findingEmailContactId === contact.id} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">
                              {findingEmailContactId === contact.id ? <i className="fa-solid fa-spinner animate-spin"></i> : null} Find email
                            </button>
                          ) : null}
                          <button onClick={() => handleDraftEmail(connectingJob, contact)} disabled={isDrafting === contact.id} className="flex-none bg-emerald-50 text-emerald-600 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50">
                            {isDrafting === contact.id ? 'Thinking...' : (contactDrafts[contact.id] ? 'Review Draft' : 'Draft Email')}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!(jobContacts[connectingJob.id] || []).length && (
                      <div className="h-full flex flex-col items-center justify-center p-12 text-center border-4 border-dashed border-slate-100 rounded-[3rem] bg-white/50">
                        <i className="fa-solid fa-address-book text-4xl text-slate-200 mb-6"></i>
                        <h4 className="text-xl font-black text-slate-300 tracking-tight">No contacts yet</h4>
                        <p className="text-slate-400 font-bold mt-2">Add a contact above (first name, last name, company or URL). Then use Find email and Draft email.</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Outreach Workbench</span>
                      <div className="flex items-center gap-2">
                        {!gmailAccessToken ? (
                          <button onClick={handleConnectGmail} disabled={gmailConnecting} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1.5 border border-red-200">
                            {gmailConnecting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                            Connect Gmail
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1.5"><i className="fa-brands fa-google"></i> Gmail connected</span>
                        )}
                        <i className="fa-solid fa-pen-nib text-emerald-400"></i>
                      </div>
                    </div>
                    {viewingDraft ? (
                      <div className="flex-1 flex flex-col overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">To</span>
                            <span className="text-sm text-slate-700 truncate">{viewingDraft.contact.firstName} {viewingDraft.contact.lastName}{viewingDraft.contact.email ? ` <${viewingDraft.contact.email}>` : ' (no email)'}</span>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-14 shrink-0">Subject</label>
                            <input type="text" value={viewingDraft.draft.subject} onChange={(e) => updateViewingDraft({ subject: e.target.value })} className="flex-1 min-w-0 text-sm font-medium text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-400" placeholder="Email subject" />
                          </div>
                          <div className="flex-1 flex flex-col min-h-0 p-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Body</label>
                            <textarea value={viewingDraft.draft.body} onChange={(e) => updateViewingDraft({ body: e.target.value })} className="flex-1 min-h-[120px] w-full text-sm font-normal leading-relaxed text-slate-700 border border-slate-200 rounded-xl p-4 resize-none outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400" placeholder="Write your message..." />
                          </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <button className="flex-1 min-w-[140px] bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-paper-plane"></i>
                            Send to contact
                          </button>
                          <button onClick={handleSaveToGmail} disabled={gmailSaving || !viewingDraft.contact.email} className="px-5 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-2" title={!viewingDraft.contact.email ? 'Add contact email first' : 'Save draft to your Gmail'}>
                            {gmailSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                            Save to Gmail
                          </button>
                          <button onClick={() => setViewingDraft(null)} className="px-6 border border-slate-200 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Dismiss</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                          <i className="fa-solid fa-envelope-open-text text-2xl"></i>
                        </div>
                        <h4 className="text-lg font-black text-slate-300 tracking-tight">Workbench Empty</h4>
                        <p className="text-slate-400 font-bold mt-2">Select a contact to generate or review a personalized outreach draft.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <>
            <header className="mb-12 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-[0.3em]">Network Intelligence</p>
                <h2 className="text-4xl font-black text-[#1a1a3a] tracking-tight">Connect</h2>
                <p className="text-slate-500 text-sm mt-2">Jobs ready for stakeholder outreach. Save a tailored resume in Customize to add jobs here.</p>
              </div>
              {!gmailAccessToken ? (
                <button onClick={handleConnectGmail} disabled={gmailConnecting} className="shrink-0 px-5 py-3 rounded-xl bg-red-50 text-red-600 border border-red-200 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-2">
                  {gmailConnecting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-brands fa-google"></i>}
                  Connect Gmail
                </button>
              ) : (
                <span className="shrink-0 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold uppercase flex items-center gap-2"><i className="fa-brands fa-google"></i> Gmail connected</span>
              )}
            </header>
            <div className="grid grid-cols-1 gap-4 mb-12">
              {jobs.filter((j) => trackedJobs[j.id] === 'Connect').length > 0 ? (
                jobs.filter((j) => trackedJobs[j.id] === 'Connect').map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => setConnectingJob(job)}
                    isTracked={true}
                    onRemove={() => untrackJob(job.id)}
                  />
                ))
              ) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-comments text-2xl text-emerald-200"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No jobs in Connect</h3>
                  <p className="text-slate-400 font-medium max-w-xs mx-auto">Save a tailored resume in the Customize tab to move jobs here. Then reach out to stakeholders.</p>
                  <button onClick={() => handleNavigate(NavItem.Customize)} className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all">
                    Go to Customize
                  </button>
                </div>
              )}
            </div>
            {allContacts.length > 0 && (
              <>
                <h3 className="text-xl font-black text-slate-900 mb-6">Your Relationship Pipeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allContacts.map((c) => (
                    <div key={c.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col hover:border-emerald-100 transition-all shadow-sm group">
                      <div className="flex items-center gap-5 mb-6">
                        <img src={c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.firstName + ' ' + c.lastName)}&background=random&size=200`} alt="" className="w-16 h-16 rounded-[1.5rem] object-cover border border-slate-100" />
                        <div>
                          <h4 className="text-xl font-black text-slate-900 leading-tight">{c.firstName} {c.lastName}</h4>
                          <p className="text-xs font-bold text-emerald-600">{c.jobCompany}</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl mb-6 flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company</p>
                        <p className="text-sm font-bold text-slate-700 leading-snug">{c.companyNameOrUrl}</p>
                        {c.role && <p className="text-xs text-slate-500 mt-1">{c.role}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const job = jobs.find((j) => j.company === c.jobCompany);
                            if (job) { setConnectingJob(job); setViewingDraft(contactDrafts[c.id] ? { contact: c, draft: contactDrafts[c.id] } : null); }
                          }}
                          className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:underline"
                        >
                          Manage Connection
                        </button>
                        {contactDrafts[c.id] && (
                          <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-xs">
                            <i className="fa-solid fa-file-lines"></i>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </>
            )}
          </section>
        )}

        {activeNav === NavItem.Resume && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
            <h2 className="text-3xl font-extrabold text-[#1a1a3a] mb-6 tracking-tight">Resume and Project Intelligence</h2>
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Inputs */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Resume Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                        Resume <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button
                          type="button"
                          onClick={() => setResumeMode('upload')}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            resumeMode === 'upload'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-500 hover:text-indigo-600'
                          }`}
                        >
                          Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setResumeMode('paste')}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            resumeMode === 'paste'
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-500 hover:text-indigo-600'
                          }`}
                        >
                          Paste
                        </button>
                      </div>
                    </div>

                    {resumeMode === 'upload' ? (
                      <div>
                        <input
                          ref={resumeInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleResumeFileSelect}
                          className="hidden"
                        />
                        <div 
                          onClick={() => resumeInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setDragActive('resume'); }}
                          onDragLeave={() => setDragActive(null)}
                          onDrop={handleResumeDrop}
                          className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[180px] ${
                            dragActive === 'resume' 
                              ? 'border-indigo-400 bg-indigo-50' 
                              : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'
                          } group`}
                        >
                          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                          </div>
                          <h4 className="font-bold text-slate-900 mb-1">Drop files or click to upload</h4>
                          <p className="text-xs text-slate-400 font-medium leading-relaxed">
                            PDF, DOC, DOCX, TXT • Max 5MB each
                          </p>
                        </div>
                      </div>
                    ) : (
                      <textarea 
                        value={userProfile.resumeContent || ''}
                        onChange={(e) => setUserProfile({ ...userProfile, resumeContent: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm font-medium text-slate-600 leading-relaxed placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all min-h-[180px]"
                        placeholder="Experience: Software Engineer at Google... Skills: Java, Go, K8s..."
                      />
                    )}
                  </div>

                  {/* Projects Section */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Projects <span className="text-slate-400 text-[10px]">(Optional)</span>
                    </label>
                    
                    <div>
                      <input
                        ref={projectInputRef}
                        type="file"
                        multiple
                        onChange={handleProjectFileSelect}
                        className="hidden"
                      />
                      <div 
                        onClick={() => projectInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragActive('project'); }}
                        onDragLeave={() => setDragActive(null)}
                        onDrop={handleProjectDrop}
                        className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[120px] ${
                          dragActive === 'project' 
                            ? 'border-purple-400 bg-purple-50' 
                            : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50/30'
                        } group`}
                      >
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 mb-3 group-hover:bg-purple-600 group-hover:text-white transition-all">
                          <i className="fa-solid fa-folder-open text-xl"></i>
                        </div>
                        <h4 className="font-bold text-slate-900 mb-1 text-sm">Drop project files or click to upload</h4>
                        <p className="text-xs text-slate-400 font-medium">
                          Any format • Documentation, code samples, presentations
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Links Section */}
                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Add Links <span className="text-slate-400 text-[10px]">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLink();
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-3 px-6 text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all"
                        placeholder="https://github.com/username/project"
                      />
                      <button
                        type="button"
                        onClick={addLink}
                        disabled={!linkInput.trim()}
                        className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                      >
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </div>
                  </div>

                  {/* API Key Validation Button */}
                  <button 
                    onClick={handleValidateApiKey}
                    disabled={isValidatingApiKey}
                    className="w-full mt-6 bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isValidatingApiKey ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                        Validating...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-key"></i>
                        Validate Gemini API Key
                      </>
                    )}
                  </button>
                  
                  {/* Validation Result */}
                  {apiKeyValidationResult && (
                    <div className={`mt-3 p-3 rounded-xl text-sm font-medium ${
                      apiKeyValidationResult.valid 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {apiKeyValidationResult.valid ? (
                        <span><i className="fa-solid fa-check-circle mr-2"></i>API key is valid</span>
                      ) : (
                        <span><i className="fa-solid fa-times-circle mr-2"></i>{apiKeyValidationResult.error}</span>
                      )}
                    </div>
                  )}

                  {/* Apply Changes Button */}
                  <button 
                    onClick={handleSaveResume}
                    disabled={isSavingResume || (!userProfile.resumeContent?.trim() && resumeFiles.length === 0 && savedResumeFiles.length === 0)}
                    className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-black text-base shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSavingResume ? (
                      <>
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                        Applying...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i>
                        Apply Changes
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column: Thumbnails */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Resume Files Thumbnails */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-file-pdf text-indigo-600"></i>
                      Resume Files ({resumeFiles.length + savedResumeFiles.length})
                    </h3>
                    {resumeFiles.length > 0 || savedResumeFiles.length > 0 ? (
                      <>
                        {/* Combine new and saved files */}
                        {(() => {
                          const allFiles: Array<{ type: 'new' | 'saved', file?: File, fileMetadata?: { name: string; url: string; id: string }, index: number }> = [];
                          
                          // Add new files
                          resumeFiles.forEach((file, index) => {
                            allFiles.push({ type: 'new', file, index });
                          });
                          
                          // Add saved files with metadata
                          savedResumeFiles.forEach((fileMetadata, index) => {
                            allFiles.push({ type: 'saved', fileMetadata, index });
                          });
                          
                          const totalFiles = allFiles.length;
                          const displayFiles = showAllResumes ? allFiles : allFiles.slice(0, 6);
                          const hasMore = totalFiles > 6;
                          
                          return (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {displayFiles.map((item, idx) => {
                                  if (item.type === 'new' && item.file) {
                                    const thumbnail = createFileThumbnail(item.file);
                                    return (
                                      <div key={`new-${item.index}`} className="bg-white rounded-xl p-2 border border-slate-200 group hover:border-indigo-300 transition-all relative">
                                        {/* Delete button - top right */}
                                        <button
                                          type="button"
                                          onClick={() => removeResumeFile(item.index)}
                                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                          title="Delete file"
                                        >
                                          <i className="fa-solid fa-times text-[10px]"></i>
                                        </button>
                                        {thumbnail ? (
                                          <img 
                                            src={thumbnail} 
                                            alt={item.file.name}
                                            className="w-full h-16 object-cover rounded-lg mb-1.5"
                                          />
                                        ) : (
                                          <div className="w-full h-16 bg-indigo-50 rounded-lg flex items-center justify-center mb-1.5">
                                            <i className={`fa-solid ${getFileIcon(item.file.name)} text-xl text-indigo-600`}></i>
                                          </div>
                                        )}
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-900 truncate">{item.file.name}</p>
                                            <p className="text-[9px] text-slate-500">{formatFileSize(item.file.size)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else if (item.type === 'saved' && item.fileMetadata) {
                                    return (
                                      <div key={`saved-${item.fileMetadata.id}`} className="bg-white rounded-xl p-2 border border-indigo-200 group hover:border-indigo-300 transition-all relative">
                                        {/* Delete button - top right */}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSavedResumeFile(item.fileMetadata!.id)}
                                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                          title="Delete file"
                                        >
                                          <i className="fa-solid fa-times text-[10px]"></i>
                                        </button>
                                        <div className="w-full h-16 bg-indigo-50 rounded-lg flex items-center justify-center mb-1.5">
                                          <i className="fa-solid fa-file-pdf text-xl text-indigo-600"></i>
                                        </div>
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-900 truncate" title={item.fileMetadata.name}>{item.fileMetadata.name}</p>
                                            <p className="text-[9px] text-slate-500">Saved</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                              {hasMore && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllResumes(!showAllResumes)}
                                  className="w-full mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-indigo-50 transition-all"
                                >
                                  {showAllResumes ? (
                                    <>
                                      <i className="fa-solid fa-chevron-up"></i>
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-chevron-down"></i>
                                      Show All ({totalFiles - 6} more)
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <i className="fa-solid fa-file-circle-question text-3xl mb-2"></i>
                        <p className="text-xs font-medium">No resume files yet</p>
                      </div>
                    )}
                  </div>

                  {/* Project Files Thumbnails */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-folder text-purple-600"></i>
                      Project Files ({projectFiles.length + savedProjectFiles.length})
                    </h3>
                    {projectFiles.length > 0 || savedProjectFiles.length > 0 ? (
                      <>
                        {/* Combine new and saved files */}
                        {(() => {
                          const allFiles: Array<{ type: 'new' | 'saved', file?: File, fileMetadata?: { name: string; url: string; id: string }, index: number }> = [];
                          
                          // Add new files
                          projectFiles.forEach((file, index) => {
                            allFiles.push({ type: 'new', file, index });
                          });
                          
                          // Add saved files with metadata
                          savedProjectFiles.forEach((fileMetadata, index) => {
                            allFiles.push({ type: 'saved', fileMetadata, index });
                          });
                          
                          const totalFiles = allFiles.length;
                          const displayFiles = showAllProjects ? allFiles : allFiles.slice(0, 6);
                          const hasMore = totalFiles > 6;
                          
                          return (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {displayFiles.map((item, idx) => {
                                  if (item.type === 'new' && item.file) {
                                    const thumbnail = createFileThumbnail(item.file);
                                    return (
                                      <div key={`new-${item.index}`} className="bg-white rounded-xl p-2 border border-slate-200 group hover:border-purple-300 transition-all relative">
                                        {/* Delete button - top right */}
                                        <button
                                          type="button"
                                          onClick={() => removeProjectFile(item.index)}
                                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                          title="Delete file"
                                        >
                                          <i className="fa-solid fa-times text-[10px]"></i>
                                        </button>
                                        {thumbnail ? (
                                          <img 
                                            src={thumbnail} 
                                            alt={item.file.name}
                                            className="w-full h-16 object-cover rounded-lg mb-1.5"
                                          />
                                        ) : (
                                          <div className="w-full h-16 bg-purple-50 rounded-lg flex items-center justify-center mb-1.5">
                                            <i className={`fa-solid ${getFileIcon(item.file.name)} text-xl text-purple-600`}></i>
                                          </div>
                                        )}
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-900 truncate">{item.file.name}</p>
                                            <p className="text-[9px] text-slate-500">{formatFileSize(item.file.size)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else if (item.type === 'saved' && item.fileMetadata) {
                                    return (
                                      <div key={`saved-${item.fileMetadata.id}`} className="bg-white rounded-xl p-2 border border-purple-200 group hover:border-purple-300 transition-all relative">
                                        {/* Delete button - top right */}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSavedProjectFile(item.fileMetadata!.id)}
                                          className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                          title="Delete file"
                                        >
                                          <i className="fa-solid fa-times text-[10px]"></i>
                                        </button>
                                        <div className="w-full h-16 bg-purple-50 rounded-lg flex items-center justify-center mb-1.5">
                                          <i className="fa-solid fa-file text-xl text-purple-600"></i>
                                        </div>
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-900 truncate" title={item.fileMetadata.name}>{item.fileMetadata.name}</p>
                                            <p className="text-[9px] text-slate-500">Saved</p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                              {hasMore && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllProjects(!showAllProjects)}
                                  className="w-full mt-3 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-purple-50 transition-all"
                                >
                                  {showAllProjects ? (
                                    <>
                                      <i className="fa-solid fa-chevron-up"></i>
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-chevron-down"></i>
                                      Show All ({totalFiles - 6} more)
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <i className="fa-solid fa-folder-open text-3xl mb-2"></i>
                        <p className="text-xs font-medium">No project files yet</p>
                      </div>
                    )}
                  </div>

                  {/* Links Section */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                      <i className="fa-solid fa-link text-teal-600"></i>
                      Links ({(userProfile.projectLinks || []).length})
                    </h3>
                    {(userProfile.projectLinks || []).length > 0 ? (
                      <div className="space-y-2">
                        {(userProfile.projectLinks || []).map((link) => (
                          <div 
                            key={link}
                            className="bg-white rounded-xl p-3 border border-slate-200 group hover:border-teal-300 transition-all relative"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <a 
                                href={link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex-1 min-w-0 flex items-center gap-2 text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline truncate"
                              >
                                <i className="fa-solid fa-external-link text-[10px] flex-shrink-0"></i>
                                <span className="truncate">{link}</span>
                              </a>
                              {/* Delete button - center right */}
                              <button
                                type="button"
                                onClick={() => handleDeleteLink(link)}
                                className="w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 shadow-sm"
                                title="Delete link"
                              >
                                <i className="fa-solid fa-times text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400">
                        <i className="fa-solid fa-link-slash text-3xl mb-2"></i>
                        <p className="text-xs font-medium">No links added yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeNav === NavItem.VisualizeSkills && (
          <>
            {isAnalyzingSkills ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <i className="fa-solid fa-sparkles text-6xl text-indigo-600 mb-6 animate-pulse"></i>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Analyzing Your Skills</h2>
                <p className="text-slate-500 font-medium">AI is processing your resumes, projects, and links...</p>
              </div>
            ) : skillsVisualization ? (
              <VisualizeSkillsPage 
                data={skillsVisualization}
                resumeFiles={savedResumeFiles}
                projectFiles={savedProjectFiles}
                projectLinks={userProfile.projectLinks || []}
                userId={currentUser.uid}
                onDataUpdate={(updatedData) => {
                  setSkillsVisualization(updatedData);
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <i className="fa-solid fa-diagram-project text-6xl text-slate-300 mb-6"></i>
                <h2 className="text-2xl font-black text-slate-900 mb-2">No Skills Data Available</h2>
                <p className="text-slate-500 font-medium">Upload resumes and projects, then click "Apply Changes" to generate your skills visualization.</p>
              </div>
            )}
          </>
        )}

        {activeNav === NavItem.Profile && (
           <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-8">
             <h2 className="text-3xl font-extrabold text-[#1a1a3a] tracking-tight">Account & Career Setup</h2>
             
             <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                <div className="flex items-center gap-8 mb-10">
                  <div className="relative">
                    <img src={`https://picsum.photos/seed/${userProfile.name}/200/200`} alt="Avatar" className="w-28 h-28 rounded-[2.5rem] object-cover ring-8 ring-slate-50" />
                    <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <i className="fa-solid fa-camera text-sm"></i>
                    </button>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{userProfile.name}</h3>
                    <p className="text-slate-500 font-medium">{userProfile.email}</p>
                    <div className="flex gap-2 mt-3">
                       <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Premium Plan</span>
                       <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Verified</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Display Name</label>
                     <input type="text" value={userProfile.name} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" readOnly />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Email Address</label>
                     <input type="email" value={userProfile.email} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" readOnly />
                   </div>
                </div>
             </div>

             {userProfile.preferences && (() => {
               const jobTitles = Array.isArray(userProfile.preferences.jobTitle) 
                 ? userProfile.preferences.jobTitle 
                 : [userProfile.preferences.jobTitle].filter(Boolean);
               const locations = Array.isArray(userProfile.preferences.location) 
                 ? userProfile.preferences.location 
                 : [userProfile.preferences.location].filter(Boolean);
               
               return (
                 <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 relative overflow-hidden group">
                   <div className="flex items-center justify-between mb-8">
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">Active Matching Preferences</h4>
                      <button 
                        onClick={() => setShowPreferencesModal(true)}
                        className="text-indigo-600 text-sm font-black uppercase tracking-widest hover:underline"
                      >
                        Modify
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Target Roles ({jobTitles.length})</p>
                         <div className="flex flex-wrap gap-2">
                           {jobTitles.map((title, idx) => (
                             <span key={idx} className="text-xs font-bold text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                               {title}
                             </span>
                           ))}
                         </div>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Location Preferences ({locations.length})</p>
                         <div className="flex flex-wrap gap-2">
                           {locations.map((location, idx) => (
                             <span key={idx} className="text-xs font-bold text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                               {location}
                             </span>
                           ))}
                         </div>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Work Modality</p>
                         <p className="font-bold text-slate-900 truncate">{userProfile.preferences.workType}</p>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Visa Sponsorship</p>
                         <p className="font-bold text-slate-900 truncate">{userProfile.preferences.requiresSponsorship ? 'Required' : 'Not Needed'}</p>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Experience Level</p>
                         <p className="font-bold text-slate-900 truncate">{userProfile.preferences.yearsOfExperience}</p>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Years of Experience</p>
                         <p className="font-bold text-slate-900 truncate">
                           {userProfile.preferences.yearsOfExperienceNumber !== undefined 
                             ? `${userProfile.preferences.yearsOfExperienceNumber} ${userProfile.preferences.yearsOfExperienceNumber === 1 ? 'year' : 'years'}`
                             : 'Not specified'}
                         </p>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Desired Salary Range</p>
                         <p className="font-bold text-slate-900 truncate">
                           {userProfile.preferences.desiredSalaryMin && userProfile.preferences.desiredSalaryMax
                             ? `$${userProfile.preferences.desiredSalaryMin.toLocaleString()} - $${userProfile.preferences.desiredSalaryMax.toLocaleString()}`
                             : userProfile.preferences.desiredSalaryMin
                             ? `$${userProfile.preferences.desiredSalaryMin.toLocaleString()}+`
                             : userProfile.preferences.desiredSalaryMax
                             ? `Up to $${userProfile.preferences.desiredSalaryMax?.toLocaleString()}`
                             : 'Not specified'}
                         </p>
                      </div>
                      <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Security Clearance</p>
                         <p className="font-bold text-slate-900 truncate">
                           {userProfile.preferences.securityClearance || 'Not specified'}
                         </p>
                      </div>
                   </div>
                 </div>
               );
             })()}

             <div className="pt-4 flex gap-4">
               <button 
                  onClick={handleSignOut}
                  className="flex-1 bg-rose-50 text-rose-600 py-5 rounded-[2rem] font-black text-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-3"
               >
                 <i className="fa-solid fa-arrow-right-from-bracket"></i>
                 Sign Out Securely
               </button>
             </div>
           </section>
        )}
      </main>

      {/* Global Job Detail Overlay */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onTrack={() => {
            trackJob(selectedJob.id);
            handleNavigate(NavItem.Track);
            setSelectedJob(null);
          }}
          isTracked={!!trackedJobs[selectedJob.id]}
          mySkills={skillsVisualization?.all_skills}
        />
      )}

      {/* Preferences Edit Modal */}
      {showPreferencesModal && userProfile.preferences && (
        <PreferencesModal 
          currentPreferences={userProfile.preferences}
          onSave={handleUpdatePreferences}
          onCancel={() => setShowPreferencesModal(false)}
        />
      )}

      <style>{`
        .custom-dark-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-dark-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
