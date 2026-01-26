import React, { useState, useMemo, useEffect } from 'react';
import { SkillsVisualization, ProfessionalExperience, Project, AwardCertificatePublication } from '../types';
import { FileMetadata, saveSkillsVisualization } from '../services/firestoreService';

interface VisualizeSkillsPageProps {
  data: SkillsVisualization;
  resumeFiles?: FileMetadata[];
  projectFiles?: FileMetadata[];
  projectLinks?: string[];
  userId: string;
  onDataUpdate?: (data: SkillsVisualization) => void;
}

const VisualizeSkillsPage: React.FC<VisualizeSkillsPageProps> = ({ data, resumeFiles = [], projectFiles = [], projectLinks = [], userId, onDataUpdate }) => {
  const [expandedExperiences, setExpandedExperiences] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [hoveredSkill, setHoveredSkill] = useState<{ skill: string; evidence: string[]; x: number; y: number } | null>(null);
  
  // Editable state - start with a deep copy of the data
  const [editableData, setEditableData] = useState<SkillsVisualization>(() => JSON.parse(JSON.stringify(data)));
  const [isSaving, setIsSaving] = useState(false);
  
  // Update editable data when prop data changes
  useEffect(() => {
    setEditableData(JSON.parse(JSON.stringify(data)));
  }, [data]);
  
  // Update all_skills whenever skills are modified
  useEffect(() => {
    const allSkillsSet = new Set<string>();
    
    // Collect skills from professional experiences
    editableData.professional_experiences.forEach(exp => {
      exp.hard_skills.forEach(skill => allSkillsSet.add(skill.skill));
      exp.soft_skills.forEach(skill => allSkillsSet.add(skill.skill));
    });
    
    // Collect skills from projects
    editableData.projects.forEach(proj => {
      proj.hard_skills.forEach(skill => allSkillsSet.add(skill.skill));
      proj.soft_skills.forEach(skill => allSkillsSet.add(skill.skill));
    });
    
    // Merge with existing all_skills (preserve manually added ones)
    editableData.all_skills.forEach(skill => allSkillsSet.add(skill));
    
    const newAllSkills = Array.from(allSkillsSet).sort();
    if (JSON.stringify(newAllSkills) !== JSON.stringify(editableData.all_skills)) {
      setEditableData(prev => ({
        ...prev,
        all_skills: newAllSkills
      }));
    }
  }, [editableData.professional_experiences, editableData.projects]);

  // Auto-resize all textareas on mount and when data changes
  useEffect(() => {
    const resizeTextareas = () => {
      const textareas = document.querySelectorAll('textarea[class*="border-b-2"]');
      textareas.forEach((textarea) => {
        const el = textarea as HTMLTextAreaElement;
        // Reset to minimal height first
        el.style.height = '1.5rem';
        // Then set to exact content height
        el.style.height = `${el.scrollHeight}px`;
      });
    };
    
    // Resize after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(resizeTextareas, 100);
    return () => clearTimeout(timeoutId);
  }, [editableData, expandedExperiences, expandedProjects]);

  // Determine source status (accessible, inaccessible, or not used)
  const sourceStatus = useMemo(() => {
    const status: Record<string, 'success' | 'failed' | 'not_used'> = {};
    
    // Collect all successfully used source names from experiences and projects
    const usedSources = new Set<string>();
    editableData.professional_experiences.forEach(exp => {
      exp.source_names.forEach(name => usedSources.add(name));
    });
    editableData.projects.forEach(proj => {
      proj.source_names.forEach(name => usedSources.add(name));
    });
    
    // Mark inaccessible sources as failed (use original data for this)
    data.inaccessible_sources.forEach(source => {
      status[source.source_name] = 'failed';
    });
    
    // Mark successfully used sources
    usedSources.forEach(name => {
      if (!status[name]) {
        status[name] = 'success';
      }
    });
    
    return status;
  }, [editableData.professional_experiences, editableData.projects, data.inaccessible_sources]);

  // Helper to normalize URLs for matching (extract key parts)
  const normalizeForMatching = (url: string): string => {
    try {
      // If it's a full URL, extract the path/filename
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || url;
    } catch {
      // If not a valid URL, return as-is
      return url;
    }
  };

  // Helper to get file name and URL from a source name
  // Always returns a usable {name,url} (falls back to sourceName).
  const getSourceInfo = (sourceName: string): { name: string; url: string } => {
    // Try to match with resume files
    for (const file of resumeFiles) {
      if (file.url === sourceName || sourceName.includes(file.url) || file.url.includes(sourceName)) {
        return { name: file.name, url: file.url };
      }
      // Also try matching by filename in URL
      const urlFilename = file.url.split('/').pop()?.split('?')[0];
      const sourceFilename = sourceName.split('/').pop()?.split('?')[0];
      if (urlFilename && sourceFilename && (urlFilename === sourceFilename || urlFilename.includes(sourceFilename) || sourceFilename.includes(urlFilename))) {
        return { name: file.name, url: file.url };
      }
    }
    
    // Try to match with project files
    for (const file of projectFiles) {
      if (file.url === sourceName || sourceName.includes(file.url) || file.url.includes(sourceName)) {
        return { name: file.name, url: file.url };
      }
      // Also try matching by filename in URL
      const urlFilename = file.url.split('/').pop()?.split('?')[0];
      const sourceFilename = sourceName.split('/').pop()?.split('?')[0];
      if (urlFilename && sourceFilename && (urlFilename === sourceFilename || urlFilename.includes(sourceFilename) || sourceFilename.includes(urlFilename))) {
        return { name: file.name, url: file.url };
      }
    }
    
    // Try to match with project links
    for (const link of projectLinks) {
      if (link === sourceName || sourceName.includes(link) || link.includes(sourceName)) {
        // Extract a readable name from the link
        try {
          const url = new URL(link);
          const name = url.hostname + url.pathname;
          return { name: name, url: link };
        } catch {
          return { name: link, url: link };
        }
      }
    }
    
    // If no match found, return the source name as-is (fallback)
    return { name: sourceName.split('/').pop()?.split('?')[0] || sourceName, url: sourceName };
  };

  // Helper to get status for a source (matches by URL or name)
  const getSourceStatus = (sourceIdentifier: string): 'success' | 'failed' | 'not_used' => {
    // Direct match
    if (sourceStatus[sourceIdentifier]) {
      return sourceStatus[sourceIdentifier];
    }
    
    // Normalize for matching
    const normalized = normalizeForMatching(sourceIdentifier);
    
    // Try to match by URL (check if sourceIdentifier is contained in any source_name or vice versa)
    for (const [sourceName, status] of Object.entries(sourceStatus)) {
      const normalizedSource = normalizeForMatching(sourceName);
      if (
        sourceIdentifier === sourceName ||
        sourceIdentifier.includes(sourceName) ||
        sourceName.includes(sourceIdentifier) ||
        normalized === normalizedSource ||
        normalized.includes(normalizedSource) ||
        normalizedSource.includes(normalized)
      ) {
        return status;
      }
    }
    
    // Check if it's in used sources (from experiences/projects)
    const usedSources = new Set<string>();
    editableData.professional_experiences.forEach(exp => {
      exp.source_names.forEach(name => usedSources.add(name));
    });
    editableData.projects.forEach(proj => {
      proj.source_names.forEach(name => usedSources.add(name));
    });
    
    for (const usedSource of usedSources) {
      const normalizedUsed = normalizeForMatching(usedSource);
      if (
        sourceIdentifier === usedSource ||
        sourceIdentifier.includes(usedSource) ||
        usedSource.includes(sourceIdentifier) ||
        normalized === normalizedUsed ||
        normalized.includes(normalizedUsed) ||
        normalizedUsed.includes(normalized)
      ) {
        return 'success';
      }
    }
    
    return 'not_used';
  };

  const toggleExperience = (id: string) => {
    const newSet = new Set(expandedExperiences);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedExperiences(newSet);
  };

  const toggleProject = (id: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedProjects(newSet);
  };


  // Save function
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSkillsVisualization(userId, editableData);
      if (onDataUpdate) {
        onDataUpdate(editableData);
      }
      alert('✅ Changes saved successfully!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('❌ Error saving changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions for editing XYZ bullets
  const updateXYZBullet = (expId: string, bulletIdx: number, newText: string) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              xyz_bullets: exp.xyz_bullets.map((bullet, idx) =>
                idx === bulletIdx ? { ...bullet, text: newText } : bullet
              )
            }
          : exp
      )
    }));
  };

  const deleteXYZBullet = (expId: string, bulletIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              xyz_bullets: exp.xyz_bullets.filter((_, idx) => idx !== bulletIdx)
            }
          : exp
      )
    }));
  };

  const addXYZBullet = (expId: string) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              xyz_bullets: [
                ...exp.xyz_bullets,
                { text: '', is_xyz: true, missing: [] }
              ]
            }
          : exp
      )
    }));
  };

  // Helper functions for editing non-XYZ bullets (experiences)
  const updateNonXYZBullet = (expId: string, bulletIdx: number, newText: string) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              non_xyz_bullets: exp.non_xyz_bullets.map((bullet, idx) =>
                idx === bulletIdx ? { ...bullet, text: newText } : bullet
              )
            }
          : exp
      )
    }));
  };

  const deleteNonXYZBullet = (expId: string, bulletIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              non_xyz_bullets: exp.non_xyz_bullets.filter((_, idx) => idx !== bulletIdx)
            }
          : exp
      )
    }));
  };

  const addNonXYZBullet = (expId: string) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              non_xyz_bullets: [
                ...exp.non_xyz_bullets,
                { text: '', reason_not_xyz: 'User added' }
              ]
            }
          : exp
      )
    }));
  };

  // Helper functions for editing project bullets
  const updateProjectXYZBullet = (projectId: string, bulletIdx: number, newText: string) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              xyz_bullets: proj.xyz_bullets.map((bullet, idx) =>
                idx === bulletIdx ? { ...bullet, text: newText } : bullet
              )
            }
          : proj
      )
    }));
  };

  const deleteProjectXYZBullet = (projectId: string, bulletIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              xyz_bullets: proj.xyz_bullets.filter((_, idx) => idx !== bulletIdx)
            }
          : proj
      )
    }));
  };

  const addProjectXYZBullet = (projectId: string) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              xyz_bullets: [
                ...proj.xyz_bullets,
                { text: '', is_xyz: true, missing: [] }
              ]
            }
          : proj
      )
    }));
  };

  const updateProjectNonXYZBullet = (projectId: string, bulletIdx: number, newText: string) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              non_xyz_bullets: proj.non_xyz_bullets.map((bullet, idx) =>
                idx === bulletIdx ? { ...bullet, text: newText } : bullet
              )
            }
          : proj
      )
    }));
  };

  const deleteProjectNonXYZBullet = (projectId: string, bulletIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              non_xyz_bullets: proj.non_xyz_bullets.filter((_, idx) => idx !== bulletIdx)
            }
          : proj
      )
    }));
  };

  const addProjectNonXYZBullet = (projectId: string) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              non_xyz_bullets: [
                ...proj.non_xyz_bullets,
                { text: '', reason_not_xyz: 'User added' }
              ]
            }
          : proj
      )
    }));
  };

  // Helper functions for editing skills
  const deleteSkill = (expId: string, category: 'hard_skills' | 'soft_skills', skillIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              [category]: exp[category].filter((_, idx) => idx !== skillIdx)
            }
          : exp
      )
    }));
  };

  const deleteProjectSkill = (projectId: string, category: 'hard_skills' | 'soft_skills', skillIdx: number) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              [category]: proj[category].filter((_, idx) => idx !== skillIdx)
            }
          : proj
      )
    }));
  };

  const addSkill = (expId: string, category: 'hard_skills' | 'soft_skills', skillName: string) => {
    setEditableData(prev => ({
      ...prev,
      professional_experiences: prev.professional_experiences.map(exp =>
        exp.id === expId
          ? {
              ...exp,
              [category]: [
                ...exp[category],
                { skill: skillName, evidence: [] }
              ]
            }
          : exp
      )
    }));
  };

  const addProjectSkill = (projectId: string, category: 'hard_skills' | 'soft_skills', skillName: string) => {
    setEditableData(prev => ({
      ...prev,
      projects: prev.projects.map(proj =>
        proj.id === projectId
          ? {
              ...proj,
              [category]: [
                ...proj[category],
                { skill: skillName, evidence: [] }
              ]
            }
          : proj
      )
    }));
  };

  // Add skill to all_skills section
  const addToAllSkills = (skillName: string) => {
    if (skillName.trim() && !editableData.all_skills.includes(skillName.trim())) {
      setEditableData(prev => ({
        ...prev,
        all_skills: [...prev.all_skills, skillName.trim()].sort()
      }));
    }
  };

  // Delete skill from all_skills section
  const deleteFromAllSkills = (skillName: string) => {
    setEditableData(prev => ({
      ...prev,
      all_skills: prev.all_skills.filter(s => s !== skillName)
    }));
  };

  const renderSkills = (skills: Array<{ skill: string; evidence: string[] }>, expId?: string, category?: 'hard_skills' | 'soft_skills') => {
    return (
      <div className="flex flex-wrap gap-2">
        {skills.map((item, idx) => (
          <div 
            key={idx} 
            className="relative group inline-flex items-center gap-1"
          >
            <span
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredSkill({
                  skill: item.skill,
                  evidence: item.evidence,
                  x: rect.left + rect.width / 2,
                  y: rect.top
                });
              }}
              onMouseLeave={() => setHoveredSkill(null)}
            >
              {item.skill}
            </span>
            {expId && category && (
              <button
                onClick={() => {
                  // Check if it's a project or experience by checking if it exists in projects
                  const isProject = editableData.projects.some(p => p.id === expId);
                  if (isProject) {
                    deleteProjectSkill(expId, category, idx);
                  } else {
                    deleteSkill(expId, category, idx);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 -ml-1"
                title="Delete skill"
              >
                <i className="fa-solid fa-times-circle text-sm"></i>
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] p-8">
      <div className="max-w-7xl mx-auto flex gap-8">
        {/* Main Content */}
        <div className="flex-1">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-[#1a1a3a] mb-2">Skills Visualization</h1>
          <p className="text-slate-500 font-medium">Your structured background analysis</p>
        </div>

        {/* Inaccessible Sources */}
        {editableData.inaccessible_sources.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-black text-amber-900 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation"></i>
              Inaccessible Sources ({editableData.inaccessible_sources.length})
            </h2>
            <div className="space-y-2">
              {editableData.inaccessible_sources.map((source, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 border border-amber-200">
                  <p className="text-sm font-bold text-slate-900">{source.source_name}</p>
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">Type:</span> {source.source_type} • 
                    <span className="font-bold ml-2">Reason:</span> {source.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Professional Experiences */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-8">
          <h2 className="text-2xl font-extrabold text-[#1a1a3a] mb-6">
            Professional Experiences ({editableData.professional_experiences.length})
          </h2>
          <div className="space-y-6">
            {editableData.professional_experiences.map((exp: ProfessionalExperience) => (
              <div key={exp.id} className="border-2 border-slate-200 rounded-2xl p-6 hover:border-indigo-300 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-900 mb-1">{exp.title}</h3>
                    <p className="text-lg font-bold text-indigo-600 mb-1">{exp.company}</p>
                    <p className="text-sm text-slate-500">
                      {exp.location} • {exp.date_range.start} - {exp.date_range.end || 'Present'}
                    </p>
                    {exp.source_names.length > 0 && (
                      <div className="text-xs text-slate-400 mt-2">
                        <span className="font-semibold">Sources: </span>
                        <span className="flex flex-wrap gap-1.5">
                          {exp.source_names.map((sourceName, idx) => {
                            const sourceInfo = getSourceInfo(sourceName);
                            return (
                              <a
                                key={idx}
                                href={sourceInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                                title={sourceInfo.url}
                              >
                                {sourceInfo.name}
                                {idx < exp.source_names.length - 1 && ','}
                              </a>
                            );
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleExperience(exp.id)}
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-sm"
                  >
                    {expandedExperiences.has(exp.id) ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {expandedExperiences.has(exp.id) && (
                  <div className="space-y-6 pt-4 border-t border-slate-200">
                    {/* XYZ Bullets */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          XYZ Accomplishments
                        </h4>
                        <button
                          onClick={() => addXYZBullet(exp.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      </div>
                      {exp.xyz_bullets.length > 0 && (
                        <ul className="space-y-2">
                          {exp.xyz_bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 group">
                              <span className="text-indigo-600 font-bold leading-[1.5rem]">•</span>
                              <div className="flex-1">
                                <textarea
                                  value={bullet.text}
                                  onChange={(e) => {
                                    updateXYZBullet(exp.id, idx, e.target.value);
                                    // Auto-resize - reset first, then set to exact height
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  className="text-sm font-medium text-slate-900 leading-relaxed w-full bg-transparent border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-400 focus:outline-none px-1 -ml-1 resize-none overflow-hidden"
                                  placeholder="Enter XYZ accomplishment..."
                                  style={{ 
                                    minHeight: '1.5rem',
                                    maxHeight: 'none'
                                  }}
                                  onFocus={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      // Set to minimal height first, then expand if needed
                                      el.style.height = '1.5rem';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                                {bullet.missing.length > 0 && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Missing: {bullet.missing.join(', ')}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteXYZBullet(exp.id, idx)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 ml-2"
                                title="Delete bullet"
                              >
                                <i className="fa-solid fa-times-circle text-sm"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Non-XYZ Bullets */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          Other Accomplishments
                        </h4>
                        <button
                          onClick={() => addNonXYZBullet(exp.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      </div>
                      {exp.non_xyz_bullets.length > 0 && (
                        <ul className="space-y-2">
                          {exp.non_xyz_bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 group">
                              <span className="text-slate-400 font-bold leading-[1.5rem]">•</span>
                              <div className="flex-1">
                                <textarea
                                  value={bullet.text}
                                  onChange={(e) => {
                                    updateNonXYZBullet(exp.id, idx, e.target.value);
                                    // Auto-resize - reset first, then set to exact height
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  className="text-sm font-medium text-slate-700 leading-relaxed w-full bg-transparent border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-400 focus:outline-none px-1 -ml-1 resize-none overflow-hidden"
                                  placeholder="Enter accomplishment..."
                                  style={{ 
                                    minHeight: '1.5rem',
                                    maxHeight: 'none'
                                  }}
                                  onFocus={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      // Set to minimal height first, then expand if needed
                                      el.style.height = '1.5rem';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                                <p className="text-xs text-slate-500 mt-1 italic">
                                  Reason: {bullet.reason_not_xyz}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteNonXYZBullet(exp.id, idx)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 ml-2"
                                title="Delete bullet"
                              >
                                <i className="fa-solid fa-times-circle text-sm"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Skills */}
                    <div>
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                        Skills
                      </h4>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500">Hard Skills</p>
                          <button
                            onClick={() => {
                              const skillName = prompt('Enter skill name:');
                              if (skillName) addSkill(exp.id, 'hard_skills', skillName);
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-plus"></i> Add
                          </button>
                        </div>
                        {exp.hard_skills.length > 0 && renderSkills(exp.hard_skills, exp.id, 'hard_skills')}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500">Soft Skills</p>
                          <button
                            onClick={() => {
                              const skillName = prompt('Enter skill name:');
                              if (skillName) addSkill(exp.id, 'soft_skills', skillName);
                            }}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-plus"></i> Add
                          </button>
                        </div>
                        {exp.soft_skills.length > 0 && renderSkills(exp.soft_skills, exp.id, 'soft_skills')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-8">
          <h2 className="text-2xl font-extrabold text-[#1a1a3a] mb-6">
            Projects ({editableData.projects.length})
          </h2>
          <div className="space-y-6">
            {editableData.projects.map((project: Project) => (
              <div key={project.id} className="border-2 border-slate-200 rounded-2xl p-6 hover:border-purple-300 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-black text-slate-900">{project.name}</h3>
                      <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-200">
                        {project.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {project.date_range.start} - {project.date_range.end || 'Present'}
                    </p>
                    {project.source_names.length > 0 && (
                      <div className="text-xs text-slate-400 mt-2">
                        <span className="font-semibold">Sources: </span>
                        <span className="flex flex-wrap gap-1.5">
                          {project.source_names.map((sourceName, idx) => {
                            const sourceInfo = getSourceInfo(sourceName);
                            return (
                              <a
                                key={idx}
                                href={sourceInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-700 hover:underline font-medium"
                                title={sourceInfo.url}
                              >
                                {sourceInfo.name}
                                {idx < project.source_names.length - 1 && ','}
                              </a>
                            );
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="text-purple-600 hover:text-purple-700 font-bold text-sm"
                  >
                    {expandedProjects.has(project.id) ? 'Collapse' : 'Expand'}
                  </button>
                </div>

                {expandedProjects.has(project.id) && (
                  <div className="space-y-6 pt-4 border-t border-slate-200">
                    {/* XYZ Bullets */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          XYZ Accomplishments
                        </h4>
                        <button
                          onClick={() => addProjectXYZBullet(project.id)}
                          className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      </div>
                      {project.xyz_bullets.length > 0 && (
                        <ul className="space-y-2">
                          {project.xyz_bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 group">
                              <span className="text-purple-600 font-bold leading-[1.5rem]">•</span>
                              <div className="flex-1">
                                <textarea
                                  value={bullet.text}
                                  onChange={(e) => {
                                    updateProjectXYZBullet(project.id, idx, e.target.value);
                                    // Auto-resize - reset first, then set to exact height
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  className="text-sm font-medium text-slate-900 leading-relaxed w-full bg-transparent border-b-2 border-transparent hover:border-purple-200 focus:border-purple-400 focus:outline-none px-1 -ml-1 resize-none overflow-hidden"
                                  placeholder="Enter XYZ accomplishment..."
                                  style={{ 
                                    minHeight: '1.5rem',
                                    maxHeight: 'none'
                                  }}
                                  onFocus={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      // Set to minimal height first, then expand if needed
                                      el.style.height = '1.5rem';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                                {bullet.missing.length > 0 && (
                                  <p className="text-xs text-amber-600 mt-1">
                                    Missing: {bullet.missing.join(', ')}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteProjectXYZBullet(project.id, idx)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 ml-2"
                                title="Delete bullet"
                              >
                                <i className="fa-solid fa-times-circle text-sm"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Non-XYZ Bullets */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                          Other Details
                        </h4>
                        <button
                          onClick={() => addProjectNonXYZBullet(project.id)}
                          className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      </div>
                      {project.non_xyz_bullets.length > 0 && (
                        <ul className="space-y-2">
                          {project.non_xyz_bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 group">
                              <span className="text-slate-400 font-bold leading-[1.5rem]">•</span>
                              <div className="flex-1">
                                <textarea
                                  value={bullet.text}
                                  onChange={(e) => {
                                    updateProjectNonXYZBullet(project.id, idx, e.target.value);
                                    // Auto-resize - reset first, then set to exact height
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  className="text-sm font-medium text-slate-700 leading-relaxed w-full bg-transparent border-b-2 border-transparent hover:border-purple-200 focus:border-purple-400 focus:outline-none px-1 -ml-1 resize-none overflow-hidden"
                                  placeholder="Enter detail..."
                                  style={{ 
                                    minHeight: '1.5rem',
                                    maxHeight: 'none'
                                  }}
                                  onFocus={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '1.5rem';
                                    target.style.height = `${target.scrollHeight}px`;
                                  }}
                                  ref={(el) => {
                                    if (el) {
                                      // Set to minimal height first, then expand if needed
                                      el.style.height = '1.5rem';
                                      el.style.height = `${el.scrollHeight}px`;
                                    }
                                  }}
                                />
                                <p className="text-xs text-slate-500 mt-1 italic">
                                  Reason: {bullet.reason_not_xyz}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteProjectNonXYZBullet(project.id, idx)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700 ml-2"
                                title="Delete bullet"
                              >
                                <i className="fa-solid fa-times-circle text-sm"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Skills */}
                    <div>
                      <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">
                        Skills
                      </h4>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500">Hard Skills</p>
                          <button
                            onClick={() => {
                              const skillName = prompt('Enter skill name:');
                              if (skillName) addProjectSkill(project.id, 'hard_skills', skillName);
                            }}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-plus"></i> Add
                          </button>
                        </div>
                        {project.hard_skills.length > 0 && renderSkills(project.hard_skills, project.id, 'hard_skills')}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-500">Soft Skills</p>
                          <button
                            onClick={() => {
                              const skillName = prompt('Enter skill name:');
                              if (skillName) addProjectSkill(project.id, 'soft_skills', skillName);
                            }}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-plus"></i> Add
                          </button>
                        </div>
                        {project.soft_skills.length > 0 && renderSkills(project.soft_skills, project.id, 'soft_skills')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Awards / Certificates / Publications */}
        {editableData.awards_certificates_publications.length > 0 && (
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-8">
            <h2 className="text-2xl font-extrabold text-[#1a1a3a] mb-6">
              Awards / Certificates / Publications ({editableData.awards_certificates_publications.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {editableData.awards_certificates_publications.map((item: AwardCertificatePublication) => (
                <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-bold border border-teal-200">
                      {item.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mb-1">{item.name}</h3>
                  <p className="text-xs text-slate-600 mb-1">
                    <span className="font-bold">Issuer:</span> {item.issuer_or_venue}
                  </p>
                  <p className="text-xs text-slate-500 mb-2">{item.date}</p>
                  {item.evidence.length > 0 && (
                    <div className="space-y-1">
                      {item.evidence.map((ev, idx) => (
                        <p key={idx} className="text-xs text-slate-600 italic">"{ev}"</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Skills Master List */}
        <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
          <h2 className="text-2xl font-extrabold text-[#1a1a3a] mb-6">
            All Skills ({editableData.all_skills.length})
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {editableData.all_skills.map((skill, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border-2 border-indigo-200">
                  {skill}
                </span>
                <button
                  onClick={() => deleteFromAllSkills(skill)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:text-rose-700"
                  title="Delete skill"
                >
                  <i className="fa-solid fa-times-circle"></i>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add new skill..."
              className="flex-1 px-4 py-2 border-2 border-indigo-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  addToAllSkills(input.value);
                  input.value = '';
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                addToAllSkills(input.value);
                input.value = '';
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
          </div>
        </section>
        </div>

        {/* Right Sidebar - Source Status */}
        <aside className="w-80 flex-shrink-0">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100 sticky top-8">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-3 rounded-xl mb-6 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk"></i>
                  <span>Save</span>
                </>
              )}
            </button>
            <h2 className="text-xl font-extrabold text-[#1a1a3a] mb-6">Source Status</h2>
            
            {/* Resume Files */}
            {resumeFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-file-lines text-indigo-600"></i>
                  Resume Files ({resumeFiles.length})
                </h3>
                <div className="space-y-2">
                  {resumeFiles.map((file) => {
                    const status = getSourceStatus(file.url);
                    return (
                      <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-shrink-0">
                          {status === 'success' && (
                            <i className="fa-solid fa-check-circle text-emerald-500 text-sm"></i>
                          )}
                          {status === 'failed' && (
                            <i className="fa-solid fa-times-circle text-rose-500 text-sm"></i>
                          )}
                          {status === 'not_used' && (
                            <i className="fa-solid fa-circle text-slate-300 text-sm"></i>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate flex-1" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Project Files */}
            {projectFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-folder text-purple-600"></i>
                  Project Files ({projectFiles.length})
                </h3>
                <div className="space-y-2">
                  {projectFiles.map((file) => {
                    const status = getSourceStatus(file.url);
                    return (
                      <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-shrink-0">
                          {status === 'success' && (
                            <i className="fa-solid fa-check-circle text-emerald-500 text-sm"></i>
                          )}
                          {status === 'failed' && (
                            <i className="fa-solid fa-times-circle text-rose-500 text-sm"></i>
                          )}
                          {status === 'not_used' && (
                            <i className="fa-solid fa-circle text-slate-300 text-sm"></i>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate flex-1" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Project Links */}
            {projectLinks.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-link text-teal-600"></i>
                  Links ({projectLinks.length})
                </h3>
                <div className="space-y-2">
                  {projectLinks.map((link, idx) => {
                    const status = getSourceStatus(link);
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-shrink-0">
                          {status === 'success' && (
                            <i className="fa-solid fa-check-circle text-emerald-500 text-sm"></i>
                          )}
                          {status === 'failed' && (
                            <i className="fa-solid fa-times-circle text-rose-500 text-sm"></i>
                          )}
                          {status === 'not_used' && (
                            <i className="fa-solid fa-circle text-slate-300 text-sm"></i>
                          )}
                        </div>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-700 truncate flex-1 hover:text-indigo-600 hover:underline"
                          title={link}
                        >
                          {link}
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Legend</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-check-circle text-emerald-500 text-xs"></i>
                  <span className="text-xs text-slate-600">Successfully accessed</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-times-circle text-rose-500 text-xs"></i>
                  <span className="text-xs text-slate-600">Failed to access</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle text-slate-300 text-xs"></i>
                  <span className="text-xs text-slate-600">Not used in analysis</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Skill Evidence Tooltip - Only show in list view */}
      {hoveredSkill && hoveredSkill.evidence.length > 0 && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border-2 border-indigo-200 p-4 max-w-sm pointer-events-none transition-opacity duration-200"
          style={{
            left: `${hoveredSkill.x}px`,
            top: `${hoveredSkill.y - 15}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-indigo-200"></div>
          </div>
          <h4 className="text-sm font-black text-indigo-600 mb-2">{hoveredSkill.skill}</h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Evidence:</p>
            {hoveredSkill.evidence.map((ev, idx) => (
              <p key={idx} className="text-xs text-slate-700 italic leading-relaxed">"{ev}"</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizeSkillsPage;
