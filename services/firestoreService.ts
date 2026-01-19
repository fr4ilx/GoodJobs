import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { UserPreferences } from '../types';

interface UserData {
  email: string;
  name: string;
  preferences?: UserPreferences;
  resumeContent?: string;
  resumeFileURLs?: string[];
  projectFileURLs?: string[];
  projectLinks?: string[];
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

// Upload file to Firebase Storage
export const uploadFile = async (
  userId: string, 
  file: File, 
  folder: 'resumes' | 'projects'
): Promise<string> => {
  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `users/${userId}/${folder}/${fileName}`);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Upload multiple files
export const uploadMultipleFiles = async (
  userId: string,
  files: File[],
  folder: 'resumes' | 'projects'
): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadFile(userId, file, folder));
    const urls = await Promise.all(uploadPromises);
    return urls;
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

// Save resume data (text, files, projects, links)
export const saveResumeData = async (
  userId: string,
  data: {
    resumeContent: string;
    resumeFiles: File[];
    projectFiles: File[];
    projectLinks: string[];
  }
) => {
  try {
    // Upload resume files
    let resumeFileURLs: string[] = [];
    if (data.resumeFiles.length > 0) {
      resumeFileURLs = await uploadMultipleFiles(userId, data.resumeFiles, 'resumes');
    }

    // Upload project files
    let projectFileURLs: string[] = [];
    if (data.projectFiles.length > 0) {
      projectFileURLs = await uploadMultipleFiles(userId, data.projectFiles, 'projects');
    }

    // Save to Firestore
    await saveUserProfile(userId, {
      resumeContent: data.resumeContent,
      resumeFileURLs,
      projectFileURLs,
      projectLinks: data.projectLinks
    });

    return {
      resumeFileURLs,
      projectFileURLs
    };
  } catch (error) {
    console.error('Error saving resume data:', error);
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
