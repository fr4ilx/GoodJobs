import React, { useState, useRef, useEffect } from 'react';
import { UserPreferences } from '../types';
import { JOB_TITLES, LOCATIONS } from '../data/jobTitles';

interface PreferencesModalProps {
  currentPreferences: UserPreferences;
  onSave: (prefs: UserPreferences) => void;
  onCancel: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ currentPreferences, onSave, onCancel }) => {
  const [prefs, setPrefs] = useState<UserPreferences>(currentPreferences);
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
    
    if (targetLower.includes(queryLower)) return true;
    
    let queryIndex = 0;
    for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
      if (targetLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  };

  const filteredJobTitles = JOB_TITLES.filter(title => fuzzyMatch(jobTitleQuery, title)).slice(0, 8);
  const filteredLocations = LOCATIONS.filter(location => fuzzyMatch(locationQuery, location)).slice(0, 8);

  const handleJobTitleSelect = (title: string) => {
    if (!selectedJobTitles.includes(title)) {
      setPrefs({...prefs, jobTitle: [...selectedJobTitles, title]});
    }
    setJobTitleQuery('');
    setShowJobTitleDropdown(false);
    setHighlightedJobIndex(-1);
    jobTitleInputRef.current?.focus();
  };

  const handleLocationSelect = (location: string) => {
    if (!selectedLocations.includes(location)) {
      setPrefs({...prefs, location: [...selectedLocations, location]});
    }
    setLocationQuery('');
    setShowLocationDropdown(false);
    setHighlightedLocationIndex(-1);
    locationInputRef.current?.focus();
  };

  const removeJobTitle = (titleToRemove: string) => {
    setPrefs({
      ...prefs, 
      jobTitle: selectedJobTitles.filter(t => t !== titleToRemove)
    });
  };

  const removeLocation = (locationToRemove: string) => {
    setPrefs({
      ...prefs, 
      location: selectedLocations.filter(l => l !== locationToRemove)
    });
  };

  const handleJobTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJobTitleQuery(value);
    setShowJobTitleDropdown(true);
    setHighlightedJobIndex(-1);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocationQuery(value);
    setShowLocationDropdown(true);
    setHighlightedLocationIndex(-1);
  };

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
      alert('Please select at least one job title and one location');
      return;
    }
    onSave(prefs);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Preferences</h2>
          <p className="text-slate-500 font-medium mt-2">Update your job matching criteria</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Job Title */}
          <div className="space-y-3 relative">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
              Desired Job Title{selectedJobTitles.length > 0 && <span className="ml-1 text-indigo-600">({selectedJobTitles.length} selected)</span>}
            </label>
            <input 
              ref={jobTitleInputRef}
              type="text" 
              value={jobTitleQuery}
              onChange={handleJobTitleChange}
              onFocus={() => setShowJobTitleDropdown(true)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
              placeholder="Type to search and add job titles..." 
              autoComplete="off"
            />
            
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
                      index === highlightedJobIndex ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}

            {selectedJobTitles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedJobTitles.map((title) => (
                  <div 
                    key={title}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border-2 border-indigo-200"
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

          {/* Location */}
          <div className="space-y-3 relative">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
              Preferred Location{selectedLocations.length > 0 && <span className="ml-1 text-purple-600">({selectedLocations.length} selected)</span>}
            </label>
            <div className="relative">
              <i className="fa-solid fa-location-dot absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 z-10"></i>
              <input 
                ref={locationInputRef}
                type="text" 
                value={locationQuery}
                onChange={handleLocationChange}
                onFocus={() => setShowLocationDropdown(true)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                placeholder="Type to search and add locations..." 
                autoComplete="off"
              />
            </div>
            
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
                      index === highlightedLocationIndex ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            )}

            {selectedLocations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedLocations.map((location) => (
                  <div 
                    key={location}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg border-2 border-purple-200"
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

          {/* Work Type & Sponsorship */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Environment</label>
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
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Visa Sponsorship</label>
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
            </div>
          </div>

          {/* Years of Experience & Desired Salary Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                Years of Experience <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['New Graduate', '1-2 years', '2-5 years', '5+ years'].map((exp) => (
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
                Desired Salary <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input 
                  type="number"
                  value={prefs.desiredSalary}
                  onChange={(e) => setPrefs({...prefs, desiredSalary: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-10 pr-6 text-slate-900 font-bold placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all" 
                  placeholder="85000"
                />
              </div>
              <p className="text-[10px] text-slate-400 italic px-2">Annual salary in USD</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-slate-100 text-slate-700 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              Confirm Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PreferencesModal;
