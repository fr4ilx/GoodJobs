import { doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { UserPreferences, SkillsVisualization } from '../types';

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
