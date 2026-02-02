
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Job, SkillsVisualization, TailoredResumeContent } from '../types';
import { generateTailoredResume } from '../services/geminiService';
import { getTailoredResume, saveTailoredResume, SavedTailoredResume } from '../services/firestoreService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CustomizeJobModalProps {
  job: Job;
  onClose: () => void;
  mySkills?: string[];
  skillsVisualization: SkillsVisualization | null;
  userName: string;
  userEmail: string;
  userGithub?: string;
  userId: string;
  onSave: (jobId: string) => void;  // moves job to Connect, caller closes modal
}

/** Wrap [placeholder?] text in yellow highlight for user to fill in */
function highlightUncertain(text: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  return escaped.replace(/\[([^\]]+)\]/g, '<span class="resume-uncertain" title="Verify or fill in">[$1]</span>');
}

function tailoredContentToHtml(c: TailoredResumeContent, overrideGithub?: string): string {
  const gh = overrideGithub || c.contact.github || '';
  const contactParts = [escapeHtml(stripMarkdown(c.contact.email))];
  if (gh) contactParts.push(escapeHtml(stripMarkdown(gh)));
  const contactLine = contactParts.join(' | ');
  const lines: string[] = [];
  lines.push(`<div class="resume-header"><div class="resume-name">${escapeHtml(stripMarkdown(c.contact.name))}</div><div class="resume-contact-line">${contactLine}</div></div>`);
  lines.push(`<div class="resume-summary">${highlightUncertain(stripMarkdown(c.summary))}</div>`);
  if (c.experiences?.length) {
    lines.push('<div class="resume-section">Experience</div>');
    c.experiences.forEach(exp => {
      lines.push(`<div class="resume-item"><strong>${escapeHtml(stripMarkdown(exp.title))}</strong>, ${escapeHtml(stripMarkdown(exp.company))}${exp.dates ? ` · ${highlightUncertain(stripMarkdown(exp.dates))}` : ''}</div>`);
      exp.bullets?.forEach(b => lines.push(`<div class="resume-bullet">• ${escapeHtml(stripMarkdown(b))}</div>`));
    });
  }
  if (c.projects?.length) {
    lines.push('<div class="resume-section">Projects</div>');
    c.projects.forEach(p => {
      lines.push(`<div class="resume-item"><strong>${escapeHtml(stripMarkdown(p.name))}</strong>${p.dates ? ` · ${highlightUncertain(stripMarkdown(p.dates))}` : ''}</div>`);
      p.bullets?.forEach(b => lines.push(`<div class="resume-bullet">• ${escapeHtml(stripMarkdown(b))}</div>`));
    });
  }
  if (c.skills?.length) {
    lines.push(`<div class="resume-section">Skills</div><div class="resume-skills">${c.skills.map(s => escapeHtml(stripMarkdown(s))).join(', ')}</div>`);
  }
  const educationEntries = Array.isArray(c.education) ? c.education : c.education ? [c.education] : [];
  if (educationEntries.length > 0) {
    lines.push('<div class="resume-section">Education</div>');
    educationEntries.forEach((ed) => {
      const degreePart = highlightUncertain(stripMarkdown(ed.degree || ''));
      const majorPart = ed.major ? ` in ${highlightUncertain(stripMarkdown(ed.major))}` : '';
      const schoolPart = highlightUncertain(stripMarkdown(ed.school || ''));
      const yearPart = highlightUncertain(stripMarkdown(ed.year || ''));
      lines.push(`<div class="resume-education-item">${degreePart}${majorPart}, ${schoolPart} · ${yearPart}</div>`);
    });
  }
  return lines.join('\n');
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** Strip markdown formatting (bold, italic, etc.) from text */
function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** Print/PDF styles for a professional resume layout */
const RESUME_PRINT_CSS = `
  @page { size: A4; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 9pt; line-height: 1.4; color: #1a1a1a; max-width: 210mm; margin: 0 auto; padding: 5mm; }
  .resume-header { text-align: center; margin-bottom: 6pt; }
  .resume-name { font-size: 16pt; font-weight: 800; letter-spacing: 0.02em; margin-bottom: 3pt; }
  .resume-contact-line { font-size: 8.5pt; color: #333; }
  .resume-summary { margin-bottom: 8pt; text-align: justify; }
  .resume-section { font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 10pt; margin-bottom: 3pt; padding-bottom: 1.5pt; border-bottom: 1.5pt solid #1a1a1a; }
  .resume-item { margin-bottom: 2pt; font-size: 9pt; }
  .resume-education-item { margin-bottom: 6pt; font-size: 9pt; }
  .resume-item strong { font-weight: 700; }
  .resume-bullet { margin-left: 12pt; margin-bottom: 2pt; text-indent: -12pt; padding-left: 12pt; font-size: 9pt; }
  .resume-skills { margin-top: 2pt; font-size: 9pt; }
  .resume-uncertain { background: #fef9c3; padding: 0 2pt; }
`;

/** Extract plain text from HTML for keyword matching */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').toLowerCase();
}

const CustomizeJobModal: React.FC<CustomizeJobModalProps> = ({
  job,
  onClose,
  mySkills = [],
  skillsVisualization,
  userName,
  userEmail,
  userGithub,
  userId,
  onSave
}) => {
  const mySkillsSet = new Set(mySkills.map(s => s.toLowerCase().trim()));
  const analysis = job.analysis;
  const jobKeywords = analysis?.keywords ?? [];
  const matchedKeywords = jobKeywords.filter(k => mySkillsSet.has(k.toLowerCase().trim()));
  const missingKeywords = jobKeywords.filter(k => !mySkillsSet.has(k.toLowerCase().trim()));
  const displayScore = analysis?.keywordMatchScore ?? job.matchScore;

  const [saved, setSaved] = useState<SavedTailoredResume | null>(null);
  const [tailoredContent, setTailoredContent] = useState<TailoredResumeContent | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const [contentJustLoaded, setContentJustLoaded] = useState(false);

  // Classify keywords for right side: green (had), purple (added in tailored), blue (still missing)
  const keywordClassification = useCallback(() => {
    const text = htmlContent ? htmlToPlainText(htmlContent) : (tailoredContent ? htmlToPlainText(tailoredContentToHtml(tailoredContent, userGithub)) : '');
    const green: string[] = [];
    const purple: string[] = [];
    const blue: string[] = [];
    jobKeywords.forEach(k => {
      const kw = k.toLowerCase().trim();
      const inResume = text.includes(kw);
      const hadBefore = mySkillsSet.has(kw);
      if (inResume && hadBefore) green.push(k);
      else if (inResume && !hadBefore) purple.push(k);
      else blue.push(k);
    });
    return { green, purple, blue };
  }, [jobKeywords, mySkillsSet, htmlContent, tailoredContent]);

  const { green: rightGreen, purple: rightPurple, blue: rightBlue } = keywordClassification();
  const rightMatchCount = rightGreen.length + rightPurple.length;
  const rightMatchScore = jobKeywords.length > 0 ? Math.round((rightMatchCount / jobKeywords.length) * 100) : 0;

  const handleRegenerate = useCallback(async () => {
    if (!skillsVisualization) {
      setError('Complete Visualize Skills first.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const content = await generateTailoredResume({
        skillsVisualization,
        job,
        userName,
        userEmail,
        userGithub
      });
      setTailoredContent(content);
      const html = tailoredContentToHtml(content, userGithub);
      setHtmlContent(html);
      setContentJustLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate resume');
    } finally {
      setIsGenerating(false);
    }
  }, [skillsVisualization, job, userName, userEmail, userGithub]);

  // On open: fetch from Firebase first; only generate via API if none exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      const existing = await getTailoredResume(userId, job.id);
      if (cancelled) return;
      if (existing) {
        setSaved(existing);
        setTailoredContent(existing.content);
        const html = existing.htmlContent || tailoredContentToHtml(existing.content, userGithub);
        setHtmlContent(html);
        setContentJustLoaded(true);
        return;
      }
      if (!skillsVisualization) {
        setError('Complete Visualize Skills first.');
        return;
      }
      setIsGenerating(true);
      try {
        const content = await generateTailoredResume({
          skillsVisualization,
          job,
          userName,
          userEmail,
          userGithub
        });
        if (cancelled) return;
        setTailoredContent(content);
        const html = tailoredContentToHtml(content, userGithub);
        setHtmlContent(html);
        setContentJustLoaded(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to generate resume');
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, job.id, skillsVisualization, job, userName, userEmail, userGithub]);

  // Sync loaded/generated html into contentEditable (only when we first load, not on user edit)
  useEffect(() => {
    if (contentJustLoaded && htmlContent && editableRef.current) {
      editableRef.current.innerHTML = htmlContent;
      setContentJustLoaded(false);
    }
  }, [contentJustLoaded, htmlContent]);

  const handleSave = async () => {
    const contentToSave = tailoredContent;
    if (!contentToSave) return;
    const currentHtml = editableRef.current?.innerHTML || htmlContent;
    setIsSaving(true);
    setError(null);
    try {
      // 1. Save to Firebase (persist for this user + job)
      await saveTailoredResume(userId, job.id, {
        content: contentToSave,
        htmlContent: currentHtml
      }, (saved?.version ?? 0) + 1);

      // 2. Convert to PDF and download directly (jspdf + html2canvas)
      const pdfWrap = document.createElement('div');
      pdfWrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:210mm;padding:5mm;background:#fff;font-family:Georgia,Times New Roman,serif;font-size:9pt;line-height:1.4;color:#1a1a1a;';
      pdfWrap.innerHTML = `<style>${RESUME_PRINT_CSS}</style>${currentHtml}`;
      document.body.appendChild(pdfWrap);

      const canvas = await html2canvas(pdfWrap, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      document.body.removeChild(pdfWrap);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      
      // Account for margins (5mm on all sides)
      const margin = 5;
      const contentW = pageW - (2 * margin);
      const contentH = pageH - (2 * margin);
      
      // Calculate image dimensions when scaled to fit content area width
      const imgW = contentW;
      const imgH = (canvas.height * contentW) / canvas.width;

      // Split across pages if needed
      if (imgH <= contentH) {
        // Fits on one page
        pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgH);
      } else {
        // Multiple pages needed
        let currentY = 0;
        let pageNum = 0;
        
        while (currentY < imgH) {
          if (pageNum > 0) pdf.addPage();
          
          // For each page, show a vertical slice of the image
          const yOffset = margin - currentY;
          pdf.addImage(imgData, 'JPEG', margin, yOffset, imgW, imgH);
          
          currentY += contentH;
          pageNum++;
        }
      }

      const fileName = `Resume_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      onSave(job.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = (tailoredContent || htmlContent) && rightMatchScore >= 85 && rightBlue.length / Math.max(jobKeywords.length, 1) <= 0.15;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
      <div
        className="relative w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-all z-20 shadow-lg shadow-rose-200"
          title="Close"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="pt-10 pb-4 px-10 flex-shrink-0">
          <h2 className="text-2xl font-black text-slate-900 leading-tight pr-14">Let&apos;s create an ideal resume for this job.</h2>
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left half: job detail */}
          <div className="w-1/2 flex flex-col overflow-hidden border-r border-slate-100">
            <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6 custom-scrollbar">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-2xl">{job.company ? job.company.charAt(0).toUpperCase() : '?'}</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">{job.title}</h3>
                  <p className="text-indigo-600 font-bold">{job.company}</p>
                  <p className="text-slate-500 font-medium text-sm">{job.location}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                  <p className="font-bold text-slate-700">{job.location}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employment</p>
                  <p className="font-bold text-slate-700">{job.type}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                  <p className="font-bold text-slate-700">{job.category}</p>
                </div>
              </div>

              {(displayScore !== undefined || analysis?.keywords?.length) ? (
                <div className="space-y-4">
                  {displayScore !== undefined && (
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-xl shadow-indigo-100">
                      <div className="flex items-end gap-3">
                        <span className="text-4xl font-black leading-none">{displayScore}%</span>
                        <span className="text-sm font-bold opacity-80 mb-1">Keyword match</span>
                      </div>
                    </div>
                  )}
                  {analysis?.keywords?.length ? (
                    <div>
                      <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-tags text-indigo-500"></i> Extracted keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matchedKeywords.map((k, i) => (
                          <span key={`ok-${i}`} className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold">{k}</span>
                        ))}
                        {missingKeywords.map((k, i) => (
                          <span key={`mk-${i}`} className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold">{k}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 mr-1 align-middle"></span> You have
                        <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-3 mr-1 align-middle"></span> Job requires
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {analysis && (analysis.whatLooksGood || analysis.whatIsMissing) && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-circle-check"></i> What looks good
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{analysis.whatLooksGood || '—'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <i className="fa-solid fa-lightbulb"></i> What is missing
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{analysis.whatIsMissing || '—'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-align-left text-indigo-500 text-sm"></i> Job Description
                </h4>
                <div className="text-slate-600 leading-relaxed font-medium text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
                  {job.description}
                </div>
              </div>
            </div>
          </div>

          {/* Right half: tailored resume + keyword bubbles + Save */}
          <div className="w-1/2 flex flex-col bg-slate-50/50 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                  <p className="font-bold">Generating tailored resume...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-rose-600">
                  <i className="fa-solid fa-triangle-exclamation text-4xl mb-4"></i>
                  <p className="font-bold text-center">{error}</p>
                </div>
              ) : htmlContent ? (
                <>
                  {/* Custom resume keyword score + bubbles */}
                  <div className="mb-6">
                    <div className={`rounded-2xl p-5 mb-4 ${rightMatchScore >= 85 ? 'bg-emerald-100' : 'bg-amber-100'} border ${rightMatchScore >= 85 ? 'border-emerald-200' : 'border-amber-200'}`}>
                      <div className="flex items-end gap-3">
                        <span className="text-4xl font-black text-slate-900">{rightMatchScore}%</span>
                        <span className="text-sm font-bold text-slate-600 mb-1">Custom resume keyword match</span>
                      </div>
                      {rightMatchScore < 85 && (
                        <p className="text-xs text-amber-800 mt-2">Target 85%+ — add more job keywords to your bullets.</p>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Keywords in tailored resume</h4>
                    <div className="flex flex-wrap gap-2">
                      {rightGreen.map((k, i) => (
                        <span key={`g-${i}`} className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs font-bold">{k}</span>
                      ))}
                      {rightPurple.map((k, i) => (
                        <span key={`p-${i}`} className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 text-xs font-bold">{k}</span>
                      ))}
                      {rightBlue.map((k, i) => (
                        <span key={`b-${i}`} className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold">{k}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      <span className="inline-block w-3 h-3 rounded-full bg-emerald-400 mr-1 align-middle"></span> From experience
                      <span className="inline-block w-3 h-3 rounded-full bg-purple-400 ml-3 mr-1 align-middle"></span> Added in tailored resume
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-400 ml-3 mr-1 align-middle"></span> Not yet included
                    </p>
                  </div>

                  {/* Editable resume (1-page style) */}
                  <div
                    ref={editableRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="resume-editable bg-white rounded-2xl p-6 border border-slate-200 text-slate-900 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[300px]"
                    style={{ fontFamily: 'Georgia, serif' }}
                    onInput={() => setHtmlContent(editableRef.current?.innerHTML || '')}
                  />
                </>
              ) : null}
            </div>

            <div className="p-6 border-t border-slate-200 flex-shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving || isGenerating || !canSave}
                  className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                  Save this resume
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating || !skillsVisualization}
                  className="px-6 py-4 rounded-2xl bg-purple-600 text-white font-black text-sm uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                  title="Generate a new tailored resume (e.g. if previous had errors or generation failed)"
                >
                  {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-rotate"></i>}
                  Regenerate new custom resume
                </button>
              </div>
              {!canSave && (tailoredContent || htmlContent) && rightMatchScore < 85 && (
                <p className="text-xs text-amber-600 mt-2 text-center">Reach 85%+ keyword match to save.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .resume-editable .resume-contact { font-size: 1.1rem; margin-bottom: 0.5rem; }
        .resume-editable .resume-summary { margin-bottom: 1rem; }
        .resume-editable .resume-section { font-weight: bold; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; margin-top: 1rem; margin-bottom: 0.25rem; }
        .resume-editable .resume-item { margin-bottom: 0.25rem; }
        .resume-editable .resume-bullet { margin-left: 1rem; margin-bottom: 0.15rem; }
        .resume-editable .resume-skills { margin-bottom: 0.5rem; }
        .resume-editable .resume-uncertain { background: rgba(250,204,21,0.5); padding: 0 2px; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default CustomizeJobModal;
