import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveResumeData } from '../services/firestoreService';

interface ResumeUploadPageProps {
  onComplete: (data: {
    resumeContent: string;
    resumeFiles: File[];
    projectFiles: File[];
    projectLinks: string[];
  }) => void;
  onBack: () => void;
  onSignIn?: () => void;
}

const ResumeUploadPage: React.FC<ResumeUploadPageProps> = ({ onComplete, onBack, onSignIn }) => {
  const { currentUser } = useAuth();
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeText, setResumeText] = useState('');
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [projectLinks, setProjectLinks] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState<'resume' | 'project' | null>(null);
  const [showAllResumes, setShowAllResumes] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  // Handle resume file drop/upload
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

  // Handle project file drop/upload
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

  // Remove files
  const removeResumeFile = (index: number) => {
    setResumeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeProjectFile = (index: number) => {
    setProjectFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle links
  const addLink = () => {
    if (linkInput.trim() && !projectLinks.includes(linkInput.trim())) {
      setProjectLinks(prev => [...prev, linkInput.trim()]);
      setLinkInput('');
    }
  };

  const removeLink = (link: string) => {
    setProjectLinks(prev => prev.filter(l => l !== link));
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLink();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Require EITHER text OR files, not both
    if (!resumeText.trim() && resumeFiles.length === 0) {
      alert('Please either upload resume files or paste resume text');
      return;
    }
    
    setIsUploading(true);
    try {
      // Save to database (same as Apply Changes in Resume & Projects section)
      if (currentUser) {
        await saveResumeData(currentUser.uid, {
          resumeContent: resumeText || '',
          resumeFiles,
          projectFiles,
          projectLinks,
          savedResumeFiles: [], // No saved files in Step 2
          savedProjectFiles: [] // No saved files in Step 2
        });
      }
      
      // Call onComplete to proceed to dashboard
      // Only include resumeContent if there's actual text (not placeholder)
      onComplete({
        resumeContent: resumeText?.trim() || '',
        resumeFiles,
        projectFiles,
        projectLinks
      });
    } catch (error) {
      console.error('Error saving resume data:', error);
      alert('Failed to save resume data. Please try again.');
    } finally {
      setIsUploading(false);
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

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-indigo-100/30 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-7xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors group"
        >
          <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          Back to preferences
        </button>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-12 border border-slate-100">
          <div className="mb-10 text-center">
             <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-1.5 rounded-full bg-indigo-600"></div>
                <div className="w-8 h-1.5 rounded-full bg-indigo-600"></div>
                <div className="w-8 h-1.5 rounded-full bg-indigo-600"></div>
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Step 2: Your Background</h2>
             <p className="text-slate-500 font-medium mt-2">Upload your resume and optionally add projects to help AI find the perfect matches.</p>
          </div>

          <form onSubmit={handleSubmit}>
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
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
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
                      onKeyDown={handleLinkKeyDown}
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
              </div>

              {/* Right Column: Thumbnails */}
              <div className="lg:col-span-1 space-y-6">
                {/* Resume Files Thumbnails */}
                <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                  <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-file-pdf text-indigo-600"></i>
                    Resume Files ({resumeFiles.length})
                  </h3>
                  {resumeFiles.length > 0 ? (
                    <>
                      {(() => {
                        const totalFiles = resumeFiles.length;
                        const displayFiles = showAllResumes ? resumeFiles : resumeFiles.slice(0, 6);
                        const hasMore = totalFiles > 6;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {displayFiles.map((file, displayIndex) => {
                                const originalIndex = resumeFiles.indexOf(file);
                                const thumbnail = createFileThumbnail(file);
                                return (
                                  <div key={originalIndex} className="bg-white rounded-xl p-2 border border-slate-200 group hover:border-indigo-300 transition-all relative">
                                    {/* Delete button - top right */}
                                    <button
                                      type="button"
                                      onClick={() => removeResumeFile(originalIndex)}
                                      className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                      title="Delete file"
                                    >
                                      <i className="fa-solid fa-times text-[10px]"></i>
                                    </button>
                                    {thumbnail ? (
                                      <img 
                                        src={thumbnail} 
                                        alt={file.name}
                                        className="w-full h-16 object-cover rounded-lg mb-1.5"
                                      />
                                    ) : (
                                      <div className="w-full h-16 bg-indigo-50 rounded-lg flex items-center justify-center mb-1.5">
                                        <i className={`fa-solid ${getFileIcon(file.name)} text-xl text-indigo-600`}></i>
                                      </div>
                                    )}
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-900 truncate">{file.name}</p>
                                        <p className="text-[9px] text-slate-500">{formatFileSize(file.size)}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
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
                    Project Files ({projectFiles.length})
                  </h3>
                  {projectFiles.length > 0 ? (
                    <>
                      {(() => {
                        const totalFiles = projectFiles.length;
                        const displayFiles = showAllProjects ? projectFiles : projectFiles.slice(0, 6);
                        const hasMore = totalFiles > 6;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {displayFiles.map((file, displayIndex) => {
                                const originalIndex = projectFiles.indexOf(file);
                                const thumbnail = createFileThumbnail(file);
                                return (
                                  <div key={originalIndex} className="bg-white rounded-xl p-2 border border-slate-200 group hover:border-purple-300 transition-all relative">
                                    {/* Delete button - top right */}
                                    <button
                                      type="button"
                                      onClick={() => removeProjectFile(originalIndex)}
                                      className="absolute top-1 right-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                                      title="Delete file"
                                    >
                                      <i className="fa-solid fa-times text-[10px]"></i>
                                    </button>
                                    {thumbnail ? (
                                      <img 
                                        src={thumbnail} 
                                        alt={file.name}
                                        className="w-full h-16 object-cover rounded-lg mb-1.5"
                                      />
                                    ) : (
                                      <div className="w-full h-16 bg-purple-50 rounded-lg flex items-center justify-center mb-1.5">
                                        <i className={`fa-solid ${getFileIcon(file.name)} text-xl text-purple-600`}></i>
                                      </div>
                                    )}
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-900 truncate">{file.name}</p>
                                        <p className="text-[9px] text-slate-500">{formatFileSize(file.size)}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
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
                    Links ({projectLinks.length})
                  </h3>
                  {projectLinks.length > 0 ? (
                    <div className="space-y-2">
                      {projectLinks.map((link) => (
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
                              onClick={() => removeLink(link)}
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

            <button 
              type="submit"
              disabled={(!resumeText.trim() && resumeFiles.length === 0) || isUploading}
              className="w-full mt-10 bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <i className="fa-solid fa-sparkles animate-pulse"></i>
                  AI is Analyzing Your Profile...
                </>
              ) : (
                <>
                  Continue to Dashboard
                  <i className="fa-solid fa-rocket"></i>
                </>
              )}
            </button>

            {onSignIn && (
              <div className="mt-6 text-center">
                <p className="text-slate-500 text-sm">
                  Already have an account?{' '}
                  <button 
                    onClick={onSignIn}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResumeUploadPage;
