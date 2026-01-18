
import React, { useState } from 'react';

interface ResumeUploadPageProps {
  onComplete: (resumeContent: string) => void;
  onBack: () => void;
}

const ResumeUploadPage: React.FC<ResumeUploadPageProps> = ({ onComplete, onBack }) => {
  const [resumeText, setResumeText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim()) return;
    
    setIsUploading(true);
    // Simulate processing
    setTimeout(() => {
      onComplete(resumeText);
      setIsUploading(false);
    }, 2000);
  };

  const handleSimulateUpload = () => {
    setIsUploading(true);
    // Simulate "parsing" a PDF
    setTimeout(() => {
      setResumeText(`Experienced Software Professional
Skills: React, TypeScript, Node.js, Cloud Architecture
Experience:
- Senior Engineer at TechFlow (3 years)
- Developer at WebLogic (2 years)
Education: BS in Computer Science`);
      setIsUploading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[50%] h-[50%] bg-indigo-100/30 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-3xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
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
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Step 2: Upload Your Resume</h2>
             <p className="text-slate-500 font-medium mt-2">The AI needs your background to find the perfect semantic matches.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Upload Box */}
            <div 
              onClick={handleSimulateUpload}
              className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                {isUploading ? <i className="fa-solid fa-circle-notch animate-spin text-2xl"></i> : <i className="fa-solid fa-cloud-arrow-up text-2xl"></i>}
              </div>
              <h4 className="font-bold text-slate-900 mb-1">Click to upload PDF</h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">Max size 5MB. We'll extract your skills automatically.</p>
            </div>

            {/* Paste Box */}
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Or paste your resume text</label>
              <textarea 
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="flex-1 w-full bg-slate-50 border border-slate-100 rounded-2xl p-6 text-sm font-medium text-slate-600 leading-relaxed placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all min-h-[160px]"
                placeholder="Experience: Software Engineer at Google... Skills: Java, Go, K8s..."
              />
            </div>
          </div>

          <button 
            disabled={!resumeText.trim() || isUploading}
            onClick={handleSubmit}
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
        </div>
      </div>
    </div>
  );
};

export default ResumeUploadPage;
