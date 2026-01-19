import React, { useState, useRef } from 'react';

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
  const [resumeText, setResumeText] = useState('');
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [projectLinks, setProjectLinks] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState<'resume' | 'project' | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Require EITHER text OR files, not both
    if (!resumeText.trim() && resumeFiles.length === 0) {
      alert('Please either upload resume files or paste resume text');
      return;
    }
    
    setIsUploading(true);
    // Simulate processing
    setTimeout(() => {
      onComplete({
        resumeContent: resumeText || 'Resume files uploaded',
        resumeFiles,
        projectFiles,
        projectLinks
      });
      setIsUploading(false);
    }, 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-indigo-100/30 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-5xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
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

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Resume Section */}
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Resume <span className="text-rose-500">*</span> <span className="text-slate-400 text-[10px] font-normal lowercase">(upload files OR paste text)</span>
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Resume Upload Box */}
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
                    className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[200px] ${
                      dragActive === 'resume' 
                        ? 'border-indigo-400 bg-indigo-50' 
                        : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'
                    } group`}
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>
                    </div>
                    <h4 className="font-bold text-slate-900 mb-1">Upload Resume Files</h4>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      PDF, DOC, DOCX, TXT • Max 5MB each
                    </p>
                  </div>

                  {/* Resume Files List */}
                  {resumeFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {resumeFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <i className="fa-solid fa-file-pdf text-indigo-600"></i>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeResumeFile(index)}
                            className="ml-2 text-indigo-400 hover:text-rose-600 transition-colors"
                          >
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resume Text Area */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    Or paste resume text
                  </label>
                  <textarea 
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="flex-1 w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm font-medium text-slate-600 leading-relaxed placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all min-h-[200px]"
                    placeholder="Experience: Software Engineer at Google... Skills: Java, Go, K8s..."
                  />
                </div>
              </div>
            </div>

            {/* Projects Section (Optional) */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Projects <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              
              {/* Project Upload Box */}
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
                  className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive === 'project' 
                      ? 'border-purple-400 bg-purple-50' 
                      : 'border-slate-200 hover:border-purple-400 hover:bg-purple-50/30'
                  } group`}
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <i className="fa-solid fa-folder-open text-2xl"></i>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">Upload Project Files</h4>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">
                    Any format • Documentation, code samples, presentations
                  </p>
                </div>

                {/* Project Files List */}
                {projectFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projectFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <i className="fa-solid fa-file text-purple-600"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeProjectFile(index)}
                          className="ml-2 text-purple-400 hover:text-rose-600 transition-colors"
                        >
                          <i className="fa-solid fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Project Links */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Project Links <span className="text-slate-400">(GitHub, Portfolio, etc.)</span>
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

                {/* Links Display */}
                {projectLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {projectLinks.map((link) => (
                      <div 
                        key={link}
                        className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 bg-purple-50 text-purple-600 rounded-lg border-2 border-purple-200"
                      >
                        <i className="fa-solid fa-link text-[10px]"></i>
                        <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline max-w-[200px] truncate">
                          {link}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeLink(link)}
                          className="hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                        >
                          <i className="fa-solid fa-times text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
