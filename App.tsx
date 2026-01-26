
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, NavItem, UserProfile, UserPreferences, SkillsVisualization } from './types';
import Sidebar from './components/Sidebar';
import JobCard from './components/JobCard';
import LandingPage from './components/LandingPage';
import SignInPage from './components/SignInPage';
import SignUpPage from './components/SignUpPage';
import PreferencesPage from './components/PreferencesPage';
import ResumeUploadPage from './components/ResumeUploadPage';
import JobDetailModal from './components/JobDetailModal';
import PreferencesModal from './components/PreferencesModal';
import VisualizeSkillsPage from './components/VisualizeSkillsPage';
import { calculateMatchScore, analyzeSkills, validateGeminiApiKey } from './services/geminiService';
import { useAuth } from './contexts/AuthContext';
import { logOut } from './services/authService';
import { saveUserPreferences, saveResumeData, saveUserProfile, getUserProfile, deleteResumeFile, deleteProjectFile, deleteProjectLink, FileMetadata, saveSkillsVisualization } from './services/firestoreService';
import { fetchJobsWithFilters } from './services/apifyService';

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
  const [isAnalyzingSkills, setIsAnalyzingSkills] = useState(false);
  const [isValidatingApiKey, setIsValidatingApiKey] = useState(false);
  const [apiKeyValidationResult, setApiKeyValidationResult] = useState<{ valid: boolean; error?: string } | null>(null); 
  
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
          // Load their data - use name from Firestore if available, otherwise use displayName
          setUserProfile(prev => ({
            ...prev,
            name: userData.name || currentUser.displayName || prev.name, // Prefer Firestore name
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

  // Load jobs from Apify when user completes onboarding
  useEffect(() => {
    const loadJobs = async () => {
      if (!currentUser || !isPreferencesComplete || !isResumeComplete) {
        return;
      }

      try {
        setJobsLoading(true);
        setJobsLoadingStatus('Preparing to fetch jobs...');

        const fetchedJobs = await fetchJobsWithFilters(
          {
            jobTitle: userProfile.preferences?.jobTitle,
            location: userProfile.preferences?.location,
            workType: userProfile.preferences?.workType,
            yearsOfExperience: userProfile.preferences?.yearsOfExperience,
            contractType: userProfile.preferences?.contractType
          },
          (status) => setJobsLoadingStatus(status)
        );

        setJobs(fetchedJobs);
        setJobsLoadingStatus('');
      } catch (error) {
        console.error('Error loading jobs from Apify:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load jobs';
        setJobsLoadingStatus(`Error: ${errorMessage}`);
        
        // Show user-friendly error alert
        if (errorMessage.includes('VITE_APIFY_TOKEN')) {
          alert('Missing Apify API Token!\n\nPlease add VITE_APIFY_TOKEN to your .env.local file.\n\nSee APIFY_SETUP.md for instructions.');
        } else {
          console.error('Full error details:', error);
        }
        
        // Keep existing jobs or set empty array
        if (jobs.length === 0) {
          setJobs([]);
        }
      } finally {
        setJobsLoading(false);
      }
    };

    loadJobs();
  }, [currentUser, isPreferencesComplete, isResumeComplete, userProfile.preferences]);

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
      
      // Clear existing jobs to show loading state
      setJobs([]);
      
      // ALWAYS reload jobs with new preferences - this triggers a NEW API request
      console.log('📡 Starting API call with updated preferences:', {
        jobTitle: newPrefs.jobTitle,
        location: newPrefs.location,
        workType: newPrefs.workType,
        yearsOfExperience: newPrefs.yearsOfExperience,
        contractType: newPrefs.contractType
      });
      
      setJobsLoading(true);
      setJobsLoadingStatus('Fetching jobs with updated preferences...');
      
      try {
        const fetchedJobs = await fetchJobsWithFilters(
          {
            jobTitle: newPrefs.jobTitle,
            location: newPrefs.location,
            workType: newPrefs.workType,
            yearsOfExperience: newPrefs.yearsOfExperience,
            contractType: newPrefs.contractType
          },
          (status) => {
            console.log('📊 Progress update:', status);
            setJobsLoadingStatus(status);
          }
        );
        
        console.log(`✅ Successfully fetched ${fetchedJobs.length} jobs with new preferences`);
        console.log('📋 Jobs being set to state:', fetchedJobs.map(j => ({ id: j.id, title: j.title, company: j.company })));
        setJobs(fetchedJobs);
        setJobsLoadingStatus('');
      } catch (error) {
        console.error('❌ Error reloading jobs:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to reload jobs';
        setJobsLoadingStatus(`Error: ${errorMessage}`);
        
        // Show user-friendly error alert
        if (errorMessage.includes('VITE_APIFY_TOKEN')) {
          alert('Missing Apify API Token!\n\nPlease add VITE_APIFY_TOKEN to your .env.local file.\n\nSee APIFY_SETUP.md for instructions.');
        } else {
          alert(`Failed to load jobs: ${errorMessage}\n\nCheck the console for more details.`);
        }
        // Keep existing jobs if there was an error
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

  useEffect(() => {
    if (currentUser && isPreferencesComplete && isResumeComplete && jobs.length > 0 && !jobsLoading) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isPreferencesComplete, isResumeComplete, jobs.length, jobsLoading]);

  const filteredJobs = useMemo(() => {
    // Since the API already filters by preferences, just return all jobs
    // The API handles: title, location, workType, experienceLevel, contractType
    console.log(`📊 Displaying ${jobs.length} jobs (no additional client-side filtering)`);
    return jobs;
  }, [jobs]);

  const isMatching = analysisProgress !== null;

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

  return (
    <div className="min-h-screen bg-[#f8f9fe] animate-in fade-in duration-1000">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} onSignOut={handleSignOut} />

      <main className="ml-64 p-12 max-w-7xl mx-auto">
        {activeNav === NavItem.Jobs && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-10">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-8">
                <div>
                  <p className="text-slate-400 font-medium mb-1 text-sm tracking-wide">AI-CURATED FEED</p>
                  <h1 className="text-4xl font-extrabold text-[#1a1a3a] tracking-tight">Personalized for You</h1>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Matching Identity</p>
                      <p className="text-sm font-bold text-indigo-600">{userProfile.name}</p>
                   </div>
                   <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                      <i className="fa-solid fa-user-gear"></i>
                   </div>
                </div>
              </div>

              {/* Preferences Summary */}
              {userProfile.preferences && (() => {
                const jobTitles = Array.isArray(userProfile.preferences.jobTitle) 
                  ? userProfile.preferences.jobTitle 
                  : [userProfile.preferences.jobTitle].filter(Boolean);
                const locations = Array.isArray(userProfile.preferences.location) 
                  ? userProfile.preferences.location 
                  : [userProfile.preferences.location].filter(Boolean);
                
                return (
                  <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-700">
                    {jobTitles.map((title, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                        <i className="fa-solid fa-briefcase text-indigo-500"></i>
                        {title}
                      </div>
                    ))}
                    {locations.map((location, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                        <i className="fa-solid fa-location-dot text-purple-500"></i>
                        {location}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                      <i className="fa-solid fa-house-laptop text-emerald-500"></i>
                      {userProfile.preferences.workType}
                    </div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-100 shadow-sm text-slate-600">
                      <i className="fa-solid fa-calendar-check text-teal-500"></i>
                      {userProfile.preferences.yearsOfExperience}
                    </div>
                    {userProfile.preferences.requiresSponsorship && (
                      <div className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2.5 rounded-2xl text-xs font-bold border border-rose-100/50 shadow-sm">
                        <i className="fa-solid fa-passport opacity-70"></i>
                        Visa Support Required
                      </div>
                    )}
                  </div>
                );
              })()}
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
                  <div className="bg-indigo-600 text-white text-[11px] font-black px-8 py-3 rounded-full shadow-2xl shadow-indigo-200 flex items-center gap-3 animate-bounce">
                    <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                    <span className="tracking-widest uppercase">
                      Gemini Neural Matching {analysisProgress.current} / {analysisProgress.total}
                    </span>
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
                ) : filteredJobs.length > 0 ? (
                  filteredJobs.map(job => (
                    <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
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
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {/* Preferences Edit Modal */}
      {showPreferencesModal && userProfile.preferences && (
        <PreferencesModal 
          currentPreferences={userProfile.preferences}
          onSave={handleUpdatePreferences}
          onCancel={() => setShowPreferencesModal(false)}
        />
      )}

    </div>
  );
};

export default App;
