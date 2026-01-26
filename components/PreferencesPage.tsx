import React, { useState, useRef, useEffect } from 'react';
import { UserPreferences } from '../types';
import { JOB_TITLES, LOCATIONS } from '../data/jobTitles';

interface PreferencesPageProps {
  onComplete: (prefs: UserPreferences) => void;
  onBack?: () => void;
  onSignIn?: () => void;
}

const PreferencesPage: React.FC<PreferencesPageProps> = ({ onComplete, onBack, onSignIn }) => {
  const [prefs, setPrefs] = useState<UserPreferences>({
    jobTitle: [],
    location: [],
    workType: 'All',
    requiresSponsorship: false,
    yearsOfExperience: 'Entry level',
    contractType: 'Full-time',
    yearsOfExperienceNumber: undefined,
    desiredSalaryMin: undefined,
    desiredSalaryMax: undefined,
    securityClearance: 'None',
  });

  const [jobTitleQuery, setJobTitleQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [highlightedJobIndex, setHighlightedJobIndex] = useState(-1);
  const [highlightedLocationIndex, setHighlightedLocationIndex] = useState(-1);

  const jobTitleInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);

  const selectedJobTitles = Array.isArray(prefs.jobTitle) ? prefs.jobTitle : [prefs.jobTitle].filter(Boolean);
  const selectedLocations = Array.isArray(prefs.location) ? prefs.location : [prefs.location].filter(Boolean);

  // Fuzzy search function
  const fuzzyMatch = (query: string, target: string): boolean => {
    if (!query) return true;
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Direct substring match
    if (targetLower.includes(queryLower)) return true;
    
    // Fuzzy match: all characters from query appear in order in target
    let queryIndex = 0;
    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  };

  // Filter job titles based on query
  const filteredJobTitles = JOB_TITLES.filter(title => 
    fuzzyMatch(jobTitleQuery, title)
  ).slice(0, 8);

  // Filter locations based on query
  const filteredLocations = LOCATIONS.filter(location => 
    fuzzyMatch(locationQuery, location)
  ).slice(0, 8);

  // Handle job title selection
  const handleJobTitleSelect = (title: string) => {
    if (!selectedJobTitles.includes(title)) {
      setPrefs({...prefs, jobTitle: [...selectedJobTitles, title]});
    }
    setJobTitleQuery('');
    setShowJobTitleDropdown(false);
    setHighlightedJobIndex(-1);
    jobTitleInputRef.current?.focus();
  };

  // Handle location selection
  const handleLocationSelect = (location: string) => {
    if (!selectedLocations.includes(location)) {
      setPrefs({...prefs, location: [...selectedLocations, location]});
    }
    setLocationQuery('');
    setShowLocationDropdown(false);
    setHighlightedLocationIndex(-1);
    locationInputRef.current?.focus();
  };

  // Remove a specific job title
  const removeJobTitle = (titleToRemove: string) => {
    setPrefs({
      ...prefs, 
      jobTitle: selectedJobTitles.filter(t => t !== titleToRemove)
    });
  };

  // Remove a specific location
  const removeLocation = (locationToRemove: string) => {
    setPrefs({
      ...prefs, 
      location: selectedLocations.filter(l => l !== locationToRemove)
    });
  };

  // Handle job title input change
  const handleJobTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJobTitleQuery(value);
    setShowJobTitleDropdown(true);
    setHighlightedJobIndex(-1);
  };

  // Handle location input change
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationQuery(value);
    setShowLocationDropdown(true);
    setHighlightedLocationIndex(-1);
  };

  // Keyboard navigation for job titles
  const handleJobTitleKeyDown = (e: React.KeyboardEvent) => {
    if (!showJobTitleDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedJobIndex(prev => 
        prev < filteredJobTitles.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedJobIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedJobIndex >= 0) {
      e.preventDefault();
      handleJobTitleSelect(filteredJobTitles[highlightedJobIndex]);
    } else if (e.key === 'Escape') {
      setShowJobTitleDropdown(false);
      setHighlightedJobIndex(-1);
    }
  };

  // Keyboard navigation for locations
  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (!showLocationDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedLocationIndex(prev => 
        prev < filteredLocations.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedLocationIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedLocationIndex >= 0) {
      e.preventDefault();
      handleLocationSelect(filteredLocations[highlightedLocationIndex]);
    } else if (e.key === 'Escape') {
      setShowLocationDropdown(false);
      setHighlightedLocationIndex(-1);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        jobDropdownRef.current && 
        !jobDropdownRef.current.contains(event.target as Node) &&
        !jobTitleInputRef.current?.contains(event.target as Node)
      ) {
        setShowJobTitleDropdown(false);
      }
      if (
        locationDropdownRef.current && 
        !locationDropdownRef.current.contains(event.target as Node) &&
        !locationInputRef.current?.contains(event.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJobTitles.length === 0 || selectedLocations.length === 0) {
      return; // Require at least one selection for each
    }
    onComplete(prefs);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-purple-100/50 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {onBack && (
          <button 
            onClick={onBack}
            className="mb-8 flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-sm transition-colors group"
          >
            <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
            Back
          </button>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-12 border border-slate-100">
          
          {/* Header & Progress */}
          <div className="mb-10 text-center">
             <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-1.5 rounded-full bg-indigo-600"></div>
                <div className="w-8 h-1.5 rounded-full bg-slate-100"></div>
                <div className="w-8 h-1.5 rounded-full bg-slate-100"></div>
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight">Step 1: Your Preferences</h2>
             <p className="text-slate-500 font-medium mt-2">Let's refine what you're looking for.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Target Role with Autocomplete */}
            <div className="space-y-3 relative">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Target Role <span className="text-rose-500">*</span>{selectedJobTitles.length > 0 && <span className="ml-1 text-indigo-600">({selectedJobTitles.length} selected)</span>}
              </label>
              <input 
                ref={jobTitleInputRef}
                type="text" 
                value={jobTitleQuery}
                onChange={handleJobTitleChange}
                onFocus={() => setShowJobTitleDropdown(true)}
                onKeyDown={handleJobTitleKeyDown}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                placeholder="Type to search and add job titles..." 
                autoComplete="off"
              />
              
              {/* Dropdown */}
              {showJobTitleDropdown && filteredJobTitles.length > 0 && (
                <div 
                  ref={jobDropdownRef}
                  className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto"
                >
                  {filteredJobTitles.filter(title => !selectedJobTitles.includes(title)).map((title, index) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => handleJobTitleSelect(title)}
                      className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${
                        index === highlightedJobIndex
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-slate-700 hover:bg-slate-50'
                      } ${index === 0 ? 'rounded-t-2xl' : ''} ${
                        index === filteredJobTitles.filter(t => !selectedJobTitles.includes(t)).length - 1 ? 'rounded-b-2xl' : ''
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Job Titles Display */}
              {selectedJobTitles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedJobTitles.map((title) => (
                    <div 
                      key={title}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border-2 border-indigo-200 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <span>{title}</span>
                      <button
                        type="button"
                        onClick={() => removeJobTitle(title)}
                        className="hover:bg-indigo-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                      >
                        <i className="fa-solid fa-times text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Location with Autocomplete */}
            <div className="space-y-3 relative">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Preferred Location <span className="text-rose-500">*</span>{selectedLocations.length > 0 && <span className="ml-1 text-purple-600">({selectedLocations.length} selected)</span>}
              </label>
              <div className="relative">
                <i className="fa-solid fa-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 z-10"></i>
                <input 
                  ref={locationInputRef}
                  type="text" 
                  value={locationQuery}
                  onChange={handleLocationChange}
                  onFocus={() => setShowLocationDropdown(true)}
                  onKeyDown={handleLocationKeyDown}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-slate-900 font-bold placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                  placeholder="Anywhere in US" 
                  autoComplete="off"
                />
              </div>
              
              {/* Dropdown */}
              {showLocationDropdown && filteredLocations.length > 0 && (
                <div 
                  ref={locationDropdownRef}
                  className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto"
                >
                  {filteredLocations.filter(location => !selectedLocations.includes(location)).map((location, index) => (
                    <button
                      key={location}
                      type="button"
                      onClick={() => handleLocationSelect(location)}
                      className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${
                        index === highlightedLocationIndex
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-slate-700 hover:bg-slate-50'
                      } ${index === 0 ? 'rounded-t-2xl' : ''} ${
                        index === filteredLocations.filter(l => !selectedLocations.includes(l)).length - 1 ? 'rounded-b-2xl' : ''
                      }`}
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Locations Display */}
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedLocations.map((location) => (
                    <div 
                      key={location}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg border-2 border-purple-200 animate-in fade-in zoom-in-95 duration-200"
                    >
                      <span>{location}</span>
                      <button
                        type="button"
                        onClick={() => removeLocation(location)}
                        className="hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                      >
                        <i className="fa-solid fa-times text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Working Modality & Sponsorship Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Working Modality <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {['Remote', 'Hybrid', 'On-site', 'All'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPrefs({...prefs, workType: type as any})}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        prefs.workType === type 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Visa Sponsorship <span className="text-rose-500">*</span></label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 relative h-[52px]">
                   <div 
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${prefs.requiresSponsorship ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
                  ></div>
                  <button 
                    type="button"
                    onClick={() => setPrefs({...prefs, requiresSponsorship: false})}
                    className={`flex-1 relative z-10 text-xs font-black uppercase tracking-widest transition-colors ${!prefs.requiresSponsorship ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    Not Needed
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPrefs({...prefs, requiresSponsorship: true})}
                    className={`flex-1 relative z-10 text-xs font-black uppercase tracking-widest transition-colors ${prefs.requiresSponsorship ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    Required
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic px-2">Do you require visa sponsorship to work in the target location?</p>
              </div>
            </div>

            {/* Experience Level & Contract Type Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Experience Level <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Internship', 'Entry level', 'Mid-level', 'Mid-Senior level', 'Senior level'].map((exp) => (
                    <button
                      key={exp}
                      type="button"
                      onClick={() => setPrefs({...prefs, yearsOfExperience: exp as any})}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        prefs.yearsOfExperience === exp 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-100'
                      }`}
                    >
                      {exp}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Contract Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {['Full-time', 'Part-time', 'Internship'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPrefs({...prefs, contractType: type as any})}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        prefs.contractType === type 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-blue-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Years of Experience & Desired Salary Range Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Years of Experience (Number) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={prefs.yearsOfExperienceNumber?.toString() || ''}
                  onChange={(e) => setPrefs({...prefs, yearsOfExperienceNumber: e.target.value ? parseInt(e.target.value) : undefined})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all"
                  placeholder="e.g. 5"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Desired Salary Range (USD) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      value={prefs.desiredSalaryMin?.toString() || ''}
                      onChange={(e) => setPrefs({...prefs, desiredSalaryMin: e.target.value ? parseInt(e.target.value) : undefined})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-8 pr-3 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all text-sm"
                      placeholder="Min"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      value={prefs.desiredSalaryMax?.toString() || ''}
                      onChange={(e) => setPrefs({...prefs, desiredSalaryMax: e.target.value ? parseInt(e.target.value) : undefined})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-8 pr-3 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all text-sm"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Security Clearance Row */}
            <div className="pt-4">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                  Security Clearance <span className="text-rose-500">*</span>
                </label>
                <select
                  value={prefs.securityClearance || 'None'}
                  onChange={(e) => setPrefs({...prefs, securityClearance: e.target.value as any})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all"
                >
                  <option value="None">None</option>
                  <option value="Public Trust">Public Trust</option>
                  <option value="Secret">Secret</option>
                  <option value="Top Secret">Top Secret</option>
                  <option value="Top Secret/SCI">Top Secret/SCI</option>
                </select>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
            >
              Continue to Resume
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>

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
        </div>
      </div>
    </div>
  );
};

export default PreferencesPage;
