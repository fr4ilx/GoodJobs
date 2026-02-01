
import { GoogleGenAI, Type } from "@google/genai";
import { SkillsVisualization, Recruiter, JobAnalysis, Job, TailoredResumeContent } from "../types";
import { fetchGitHubContent, parseGitHubUrl } from "./githubService";
import { extractTextFromPDF } from "./pdfService";

/**
 * Result of the match analysis.
 */
export interface MatchResult {
  score: number;
  reason: string;
}

/**
 * Helper function to delay execution
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculates a match score between a resume and a job description.
 * Uses Gemini 3 Pro with built-in retry logic for rate limits.
 */
export async function calculateMatchScore(
  resume: string, 
  jobDescription: string, 
  attempt: number = 0
): Promise<MatchResult> {
  if (!resume || !jobDescription) return { score: 0, reason: "Incomplete data" };

  // Always use a new GoogleGenAI instance right before the API call.
  // Support both VITE_GEMINI_API_KEY and GEMINI_API_KEY (user may have either in .env.local)
  const env = import.meta.env as any;
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (process.env as any).API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please add VITE_GEMINI_API_KEY=your_key to your .env.local file (note: Vite requires the VITE_ prefix for client-side access).');
  }
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Compare the following resume and job description. Provide a matching score from 0 to 100 and a brief one-sentence reason for the score.
      
      Resume: ${resume}
      
      Job Description: ${jobDescription}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { 
              type: Type.NUMBER, 
              description: "A number between 0 and 100." 
            },
            reason: { 
              type: Type.STRING, 
              description: "Short explanation for the score." 
            },
          },
          required: ["score", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || '{}');
    return {
      score: result.score || 0,
      reason: result.reason || "Unable to analyze"
    };
  } catch (error: any) {
    // Handle 429 Rate Limit Errors with Exponential Backoff
    if (error?.status === 429 || error?.message?.includes('429')) {
      if (attempt < 3) {
        const backoffTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.warn(`Rate limit hit. Retrying in ${backoffTime}ms... (Attempt ${attempt + 1})`);
        await wait(backoffTime);
        return calculateMatchScore(resume, jobDescription, attempt + 1);
      }
    }
    
    console.error("Gemini API Error:", error);
    return { score: 0, reason: "Error analyzing match" };
  }
}

/**
 * Analyzes user's background (resumes, projects, links) and generates structured skills visualization
 */
export async function analyzeSkills(
  resumeContent: string,
  resumeFileURLs: string[],
  projectFileURLs: string[],
  projectLinks: string[],
  attempt: number = 0
): Promise<SkillsVisualization> {
  console.log('🚀 analyzeSkills called with:', {
    resumeContentLength: resumeContent?.length || 0,
    resumeFileURLs: resumeFileURLs.length,
    projectFileURLs: projectFileURLs.length,
    projectLinks: projectLinks.length,
    attempt
  });
  
  // Helper to check if resumeContent is valid (not empty and not a placeholder)
  const placeholderMessages = ['Resume files uploaded', 'resume files uploaded'];
  const isValidResumeContent = resumeContent && 
    resumeContent.trim().length > 0 && 
    !placeholderMessages.includes(resumeContent.trim());
  
  // Build the prompt with all available sources
  let sourcesText = '';
  
  if (isValidResumeContent) {
    sourcesText += `RESUME TEXT:\n${resumeContent}\n\n`;
  }
  
  if (resumeFileURLs.length > 0) {
    sourcesText += `RESUME FILES (${resumeFileURLs.length} files):\n`;
    resumeFileURLs.forEach((url, idx) => {
      sourcesText += `Resume ${idx + 1}: ${url}\n`;
    });
    sourcesText += '\n';
  }
  
  if (projectFileURLs.length > 0) {
    sourcesText += `PROJECT FILES (${projectFileURLs.length} files):\n`;
    projectFileURLs.forEach((url, idx) => {
      sourcesText += `Project ${idx + 1}: ${url}\n`;
    });
    sourcesText += '\n';
  }
  
  // Process project links - fetch GitHub content if applicable
  // Note: We fetch content to pass to LLM, but let LLM decide what's inaccessible
  let processedLinksText = '';
  
  if (projectLinks.length > 0) {
    processedLinksText += `PROJECT LINKS:\n`;
    
    // Process each link
    for (const link of projectLinks) {
      const isGitHub = parseGitHubUrl(link);
      
      if (isGitHub) {
        // Try to fetch GitHub content to pass to LLM
        // If we can't fetch it, still pass the URL and let LLM report it as inaccessible
        try {
          const githubContent = await fetchGitHubContent(link);
          if (githubContent.accessible && githubContent.content) {
            // Include the full GitHub repository content for LLM analysis
            processedLinksText += `\n=== GitHub Repository: ${link} ===\n`;
            processedLinksText += `Repository URL: ${link}\n`;
            processedLinksText += `Content:\n${githubContent.content}\n`;
            processedLinksText += `=== End GitHub Repository ===\n\n`;
          } else {
            // We couldn't fetch it, but pass URL to LLM and let it decide/report
            processedLinksText += `Link: ${link} (Note: Could not fetch repository content - ${githubContent.reason || 'unknown reason'})\n`;
          }
        } catch (error) {
          // Error fetching, but still pass URL to LLM
          processedLinksText += `Link: ${link} (Note: Error fetching repository content - ${error instanceof Error ? error.message : 'Unknown error'})\n`;
        }
      } else {
        // Non-GitHub link - just include the URL
        processedLinksText += `Link: ${link}\n`;
      }
    }
    
    sourcesText += processedLinksText + '\n';
  }

  if (!sourcesText.trim()) {
    throw new Error('No resume or project data provided for analysis');
  }

  // Support both VITE_GEMINI_API_KEY and GEMINI_API_KEY (user may have either in .env.local)
  const env = import.meta.env as any;
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (process.env as any).API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please add VITE_GEMINI_API_KEY=your_key to your .env.local file (note: Vite requires the VITE_ prefix for client-side access).');
  }

  // Build the full prompt to check length
  const basePrompt = `You are a skills extraction system. Analyze the following user background materials and extract structured information.

CRITICAL RULES:
1. EXTRACTION ONLY - Extract structured information. Do NOT score, rank, infer seniority beyond evidence, invent relationships, or add unsupported information.
2. XYZ FORMAT - Rewrite accomplishment bullets as "Accomplished [X] as measured by [Y], by doing [Z]" format when possible. If Y (metric) is missing, still attempt XYZ format and mark missing components in the "missing" array.
3. EVIDENCE-BACKED - Only include skills when you have supporting evidence quotes (≤20 words). If no evidence exists for a skill, do NOT include it.
4. CANONICAL SKILLS - Normalize all skills to canonical form:
   - lowercase
   - standard naming (e.g., "react" not "react.js", "kubernetes" not "k8s")
   - No duplicates
   - Provide skill_aliases_map mapping raw mentions → canonical skills
5. INACCESSIBLE SOURCES - If any URL/file cannot be accessed or analyzed (including URLs you cannot fetch content from), add to inaccessible_sources with source_name (use the exact URL or filename), source_type (resume/project/link), and reason. Only report sources that you actually attempted to analyze but could not access.

${sourcesText}

IMPORTANT: Analyze ALL provided sources:
- Resume text and files: Extract professional experiences, skills, and accomplishments
- Project files: Extract project details, technologies used, and achievements
- Project links (including GitHub repositories): Analyze the content provided. For GitHub repositories, extract code patterns, technologies, frameworks, and project structure from the repository content provided. Include the repository URL in source_names when you successfully analyze it.

Extract and structure the following:
- Professional Experiences: Merge identical experiences (same company + title + overlapping dates) across multiple resumes. Preserve all unique bullets and skills. Include source_names array with all resume files/URLs that contributed to this experience.
- Projects: Label each as personal/academic/professional/unknown based on evidence. Extract from both project files AND project links (including GitHub repositories). Include source_names array with all project files/links that contributed to this project.
- Awards/Certificates/Publications: Extract type, name, issuer/venue, date, and evidence.
- All Skills: Create a master list of all canonical skills (deduplicated) across all sections.
- Skill Graphs: For each experience/project, create clusters of related skills. Do NOT invent relationships - only cluster skills that are clearly related based on evidence.

Return ONLY valid JSON matching the exact schema provided.`;

  const fullPromptLength = basePrompt.length;
  
  // Also check if we have multiple GitHub links - they tend to make prompts very long
  // GitHub content can be huge, so chunk if we have more than 2 GitHub links
  let githubLinkCount = 0;
  for (const link of projectLinks) {
    if (parseGitHubUrl(link)) {
      githubLinkCount++;
    }
  }
  const hasMultipleGitHubLinks = githubLinkCount > 2;
  // IMPORTANT: If the user uploaded resume/project files, Gemini cannot fetch Firebase URLs itself.
  // We must use the chunking path so we can extract file text client-side (via `extractTextFromPDF`)
  // and pass the extracted text into Gemini.
  const hasAnyFileURLs = resumeFileURLs.length > 0 || projectFileURLs.length > 0;
  const shouldUseChunking = fullPromptLength > MAX_PROMPT_LENGTH || hasMultipleGitHubLinks || hasAnyFileURLs;
  
  console.log(`📏 Prompt analysis:`, {
    length: fullPromptLength,
    maxAllowed: MAX_PROMPT_LENGTH,
    githubLinks: githubLinkCount,
    shouldChunk: shouldUseChunking,
    reason: shouldUseChunking 
      ? (fullPromptLength > MAX_PROMPT_LENGTH
          ? 'prompt too long'
          : hasMultipleGitHubLinks
            ? 'multiple GitHub links'
            : 'file URLs require client-side extraction')
      : 'within limits'
  });

  // If prompt is too long or has multiple GitHub links, use chunking strategy
  console.log(`🔍 Checking chunking condition: shouldUseChunking=${shouldUseChunking}, fullPromptLength=${fullPromptLength}, MAX_PROMPT_LENGTH=${MAX_PROMPT_LENGTH}, hasMultipleGitHubLinks=${hasMultipleGitHubLinks}`);
  console.log(`🔍 Condition breakdown: ${fullPromptLength} > ${MAX_PROMPT_LENGTH} = ${fullPromptLength > MAX_PROMPT_LENGTH}, githubLinks > 2 = ${githubLinkCount > 2}`);
  
  if (shouldUseChunking) {
    console.log(`✅ ENTERING CHUNKING BLOCK - Using chunking strategy (prompt: ${fullPromptLength} chars, multiple GitHub links: ${hasMultipleGitHubLinks})...`);
    
    // Build chunks
    const chunks: DataChunk[] = [];
    
    // Chunk 1: Resume text (synchronous, no I/O needed)
    // Only include resumeContent if it's not empty and not a placeholder message
    const placeholderMessages = ['Resume files uploaded', 'resume files uploaded'];
    const isValidResumeContent = resumeContent && 
      resumeContent.trim().length > 0 && 
      !placeholderMessages.includes(resumeContent.trim());
    
    if (isValidResumeContent) {
      chunks.push({
        type: 'resume_text',
        content: `RESUME TEXT:\n${resumeContent}`,
        sourceName: 'Resume Text',
        chunkIndex: 1,
        totalChunks: 1,
        originalSource: 'Resume Text'
      });
    }
    
    // Process ALL files and links in parallel (resume files, project files, and links simultaneously)
    console.log(`🚀 Processing all sources in parallel: ${resumeFileURLs.length} resume files, ${projectFileURLs.length} project files, ${projectLinks.length} links...`);
    
    // Chunk 2-N: Resume files (one per file, fetch and extract PDF text in parallel)
    const resumeFilePromises = resumeFileURLs.map(async (url, i) => {
      const fileName = url.split('/').pop()?.split('?')[0] || `Resume ${i + 1}`;
      console.log(`📄 Queuing resume file ${i + 1}/${resumeFileURLs.length}: ${fileName}`);
      
      try {
        const pdfResult = await extractTextFromPDF(url);
        if (pdfResult.success && pdfResult.text) {
          console.log(`✅ Successfully extracted text from ${fileName} (${pdfResult.text.length} chars)`);
          return {
            type: 'resume_file' as const,
            content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nExtracted Text:\n${pdfResult.text}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          };
        } else {
          console.warn(`⚠️ Failed to extract text from ${fileName}: ${pdfResult.error}`);
          return {
            type: 'resume_file' as const,
            content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nNote: Could not extract text from PDF - ${pdfResult.error || 'unknown error'}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          };
        }
      } catch (error) {
        console.error(`❌ Error processing resume file ${fileName}:`, error);
        return {
          type: 'resume_file' as const,
          content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nNote: Error processing file - ${error instanceof Error ? error.message : 'Unknown error'}`,
          sourceName: url,
          chunkIndex: 1,
          totalChunks: 1,
          originalSource: url
        };
      }
    });
    
    // Chunk N+1-M: Project files (one per file, fetch and extract PDF text in parallel)
    const projectFilePromises = projectFileURLs.map(async (url, i) => {
      const fileName = url.split('/').pop()?.split('?')[0] || `Project ${i + 1}`;
      
      try {
        const pdfResult = await extractTextFromPDF(url);
        if (pdfResult.success && pdfResult.text) {
          console.log(`✅ Successfully extracted text from ${fileName} (${pdfResult.text.length} chars)`);
          return {
            type: 'project_file' as const,
            content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nExtracted Text:\n${pdfResult.text}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          };
        } else {
          console.warn(`⚠️ Failed to extract text from ${fileName}: ${pdfResult.error}`);
          return {
            type: 'project_file' as const,
            content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nNote: Could not extract text from PDF - ${pdfResult.error || 'unknown error'}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          };
        }
      } catch (error) {
        console.error(`❌ Error processing project file ${fileName}:`, error);
        return {
          type: 'project_file' as const,
          content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nNote: Error processing file - ${error instanceof Error ? error.message : 'Unknown error'}`,
          sourceName: url,
          chunkIndex: 1,
          totalChunks: 1,
          originalSource: url
        };
      }
    });
    
    // Chunk M+1-P: Project links (process GitHub content for each in parallel, split if too large)
    const MAX_CHUNK_SIZE = 25000; // Max characters per chunk for GitHub content
    
    const projectLinkPromises = projectLinks.map(async (link) => {
      const isGitHub = parseGitHubUrl(link);
      let linkChunks: DataChunk[] = [];
      
      if (isGitHub) {
        try {
          const githubContent = await fetchGitHubContent(link);
          if (githubContent.accessible && githubContent.content) {
            const content = githubContent.content;
            
            // If content is small enough, use one chunk
            if (content.length <= MAX_CHUNK_SIZE) {
              linkChunks.push({
                type: 'project_link',
                content: `PROJECT LINK (GitHub Repository):\nURL: ${link}\n\nRepository Content:\n${content}`,
                sourceName: link,
                chunkIndex: 1,
                totalChunks: 1,
                originalSource: link
              });
            } else {
              // Split into multiple chunks with clear labeling
              const numChunks = Math.ceil(content.length / MAX_CHUNK_SIZE);
              console.log(`📦 Splitting GitHub repo ${link} into ${numChunks} chunks (${content.length} chars)`);
              
              for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
                const start = chunkIdx * MAX_CHUNK_SIZE;
                const end = Math.min(start + MAX_CHUNK_SIZE, content.length);
                const chunkContent = content.substring(start, end);
                
                linkChunks.push({
                  type: 'project_link',
                  content: `PROJECT LINK (GitHub Repository) - PART ${chunkIdx + 1} OF ${numChunks}:\nURL: ${link}\n\nThis is part ${chunkIdx + 1} of ${numChunks} of the repository content.\n\nRepository Content (Part ${chunkIdx + 1}):\n${chunkContent}`,
                  sourceName: `${link} [Part ${chunkIdx + 1}/${numChunks}]`,
                  chunkIndex: chunkIdx + 1,
                  totalChunks: numChunks,
                  originalSource: link
                });
              }
            }
          } else {
            // GitHub content not accessible
            linkChunks.push({
              type: 'project_link',
              content: `PROJECT LINK:\nURL: ${link}\n\nNote: Could not fetch repository content - ${githubContent.reason || 'unknown reason'}`,
              sourceName: link,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: link
            });
          }
        } catch (error) {
          console.error(`❌ Error fetching GitHub content for ${link}:`, error);
          linkChunks.push({
            type: 'project_link',
            content: `PROJECT LINK:\nURL: ${link}\n\nNote: Error fetching repository content - ${error instanceof Error ? error.message : 'Unknown error'}`,
            sourceName: link,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: link
          });
        }
      } else {
        // Non-GitHub link
        linkChunks.push({
          type: 'project_link',
          content: `PROJECT LINK:\nURL: ${link}`,
          sourceName: link,
          chunkIndex: 1,
          totalChunks: 1,
          originalSource: link
        });
      }
      
      return linkChunks;
    });
    
    // Process sources in batches to avoid overwhelming Firebase Storage
    // Firebase Storage has rate limits, so we'll process files in smaller batches
    const BATCH_SIZE = 3; // Process 3 files at a time to avoid rate limits
    console.log(`⏳ Processing sources in batches of ${BATCH_SIZE}: ${resumeFileURLs.length} resume files + ${projectFileURLs.length} project files + ${projectLinks.length} links...`);
    const startTime = Date.now();
    
    // Process resume files in batches
    const resumeChunks: DataChunk[] = [];
    for (let i = 0; i < resumeFilePromises.length; i += BATCH_SIZE) {
      const batch = resumeFilePromises.slice(i, i + BATCH_SIZE);
      console.log(`📄 Processing resume files batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(resumeFilePromises.length / BATCH_SIZE)}...`);
      const batchResults = await Promise.all(batch);
      resumeChunks.push(...batchResults);
    }
    
    // Process project files in batches
    const projectChunks: DataChunk[] = [];
    for (let i = 0; i < projectFilePromises.length; i += BATCH_SIZE) {
      const batch = projectFilePromises.slice(i, i + BATCH_SIZE);
      console.log(`📄 Processing project files batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(projectFilePromises.length / BATCH_SIZE)}...`);
      const batchResults = await Promise.all(batch);
      projectChunks.push(...batchResults);
    }
    
    // Process project links in parallel (they don't hit Firebase Storage, so can be parallel)
    const projectLinkChunksArrays = await Promise.all(projectLinkPromises);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Flatten project link chunks (each link can produce multiple chunks if split)
    const projectLinkChunks = projectLinkChunksArrays.flat();
    
    // Combine all chunks
    chunks.push(...resumeChunks, ...projectChunks, ...projectLinkChunks);
    
    console.log(`✅ All sources processed in ${duration}s: ${resumeChunks.length} resume files, ${projectChunks.length} project files, ${projectLinkChunks.length} link chunks`);
    
    console.log(`📦 Processing ${chunks.length} chunks...`);
    console.log(`📊 Chunk breakdown:`, {
      resumeText: chunks.filter(c => c.type === 'resume_text').length,
      resumeFiles: chunks.filter(c => c.type === 'resume_file').length,
      projectFiles: chunks.filter(c => c.type === 'project_file').length,
      projectLinks: chunks.filter(c => c.type === 'project_link').length,
      splitChunks: chunks.filter(c => (c.totalChunks || 1) > 1).length
    });
    
    // Process ALL chunks in parallel (not in batches)
    console.log(`🚀 Processing all ${chunks.length} chunks in parallel...`);
    
    const chunkPromises = chunks.map((chunk, index) => {
      console.log(`📤 Queuing chunk ${index + 1}/${chunks.length}: ${chunk.sourceName}${chunk.totalChunks && chunk.totalChunks > 1 ? ` (Part ${chunk.chunkIndex}/${chunk.totalChunks})` : ''}`);
      return analyzeChunk(chunk, apiKey).catch(error => {
        console.error(`❌ Error processing chunk ${chunk.sourceName}${chunk.totalChunks && chunk.totalChunks > 1 ? ` (Part ${chunk.chunkIndex}/${chunk.totalChunks})` : ''}:`, error);
        // Return empty result for failed chunks
        return {
          inaccessible_sources: [{
            source_name: chunk.originalSource || chunk.sourceName,
            source_type: chunk.type === 'resume_text' || chunk.type === 'resume_file' ? 'resume' : chunk.type === 'project_file' ? 'project' : 'link',
            reason: error instanceof Error ? error.message : 'Unknown error during analysis'
          }],
          skill_aliases_map: {},
          education_entries: [],
          professional_experiences: [],
          projects: [],
          awards_certificates_publications: [],
          all_skills: []
        } as SkillsVisualization;
      });
    });
    
    // Wait for all chunks to complete
    const chunkResults = await Promise.all(chunkPromises);
    console.log(`✅ All ${chunkResults.length} chunks processed`);
    
    console.log(`✅ Processed ${chunkResults.length} chunks, merging results...`);
    
    // Merge all chunk results
    const merged = mergeResults(chunkResults);
    
    console.log(`🔄 Running final assembly pass...`);
    console.log(`📊 Merged data before final assembly:`, {
      experiences: merged.professional_experiences.length,
      projects: merged.projects.length,
      skills: merged.all_skills.length,
      inaccessible: merged.inaccessible_sources.length,
      skillAliases: Object.keys(merged.skill_aliases_map || {}).length
    });
    
    // Final assembly pass
    let final: SkillsVisualization;
    try {
      final = await finalAssemblyPass(merged, apiKey);
      console.log(`✅ Final assembly complete:`, {
        experiences: final.professional_experiences.length,
        projects: final.projects.length,
        skills: final.all_skills.length,
        inaccessible: final.inaccessible_sources.length
      });
    } catch (error) {
      console.error('❌ Final assembly pass failed, using merged result:', error);
      // Use merged result if final assembly fails
      final = merged;
    }
    
    return final;
  }

  // Original single-pass approach for smaller prompts (when not chunking)
  console.log(`⚠️ NOT using chunking - proceeding with single-pass (shouldUseChunking was false)`);
  const prompt = basePrompt;
  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log('📤 Sending request to Gemini API (single-pass)...');
    console.log('📝 Prompt length:', prompt.length, 'characters');
    console.log('📝 Prompt preview (first 500 chars):', prompt.substring(0, 500));
    console.log('🔑 API Key present:', apiKey ? 'Yes (length: ' + apiKey.length + ')' : 'No');
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            inaccessible_sources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source_name: { type: Type.STRING },
                  source_type: { type: Type.STRING },
                  reason: { type: Type.STRING }
                },
                required: ["source_name", "source_type", "reason"]
              }
            },
            skill_aliases_map: {
              type: Type.OBJECT,
              // Gemini structured output rejects OBJECT schemas with empty `properties`.
              // We keep this as a dynamic map (raw mention -> canonical) via `additionalProperties`,
              // but include a placeholder property to satisfy the validator.
              properties: {
                _placeholder: { type: Type.STRING, description: "Placeholder - actual keys are dynamic" }
              },
              additionalProperties: { type: Type.STRING }
            },
            professional_experiences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  company: { type: Type.STRING },
                  title: { type: Type.STRING },
                  location: { type: Type.STRING },
                  date_range: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.STRING },
                      end: { type: Type.STRING }
                    },
                    required: ["start", "end"]
                  },
                  source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                  xyz_bullets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        is_xyz: { type: Type.BOOLEAN },
                        missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["text", "is_xyz", "missing"]
                    }
                  },
                  non_xyz_bullets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        reason_not_xyz: { type: Type.STRING }
                      },
                      required: ["text", "reason_not_xyz"]
                    }
                  },
                  hard_skills: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skill: { type: Type.STRING },
                        evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["skill", "evidence"]
                    }
                  },
                  soft_skills: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skill: { type: Type.STRING },
                        evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["skill", "evidence"]
                    }
                  },
                  skill_graph: {
                    type: Type.OBJECT,
                    properties: {
                      clusters: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            cluster_name: { type: Type.STRING },
                            skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                          },
                          required: ["cluster_name", "skills"]
                        }
                      }
                    },
                    required: ["clusters"]
                  }
                },
                required: ["id", "company", "title", "location", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  date_range: {
                    type: Type.OBJECT,
                    properties: {
                      start: { type: Type.STRING },
                      end: { type: Type.STRING }
                    },
                    required: ["start", "end"]
                  },
                  source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                  xyz_bullets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        is_xyz: { type: Type.BOOLEAN },
                        missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["text", "is_xyz", "missing"]
                    }
                  },
                  non_xyz_bullets: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        reason_not_xyz: { type: Type.STRING }
                      },
                      required: ["text", "reason_not_xyz"]
                    }
                  },
                  hard_skills: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skill: { type: Type.STRING },
                        evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["skill", "evidence"]
                    }
                  },
                  soft_skills: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        skill: { type: Type.STRING },
                        evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["skill", "evidence"]
                    }
                  },
                  skill_graph: {
                    type: Type.OBJECT,
                    properties: {
                      clusters: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            cluster_name: { type: Type.STRING },
                            skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                          },
                          required: ["cluster_name", "skills"]
                        }
                      }
                    },
                    required: ["clusters"]
                  }
                },
                required: ["id", "name", "type", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
              }
            },
            awards_certificates_publications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING },
                  name: { type: Type.STRING },
                  issuer_or_venue: { type: Type.STRING },
                  date: { type: Type.STRING },
                  evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["id", "type", "name", "issuer_or_venue", "date", "evidence"]
              }
            },
            all_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["inaccessible_sources", "skill_aliases_map", "education_entries", "professional_experiences", "projects", "awards_certificates_publications", "all_skills"]
        }
      }
    });

    console.log('📥 Received response from Gemini API');
    console.log('📄 Response object:', response);
    console.log('📄 Response text:', response.text);
    console.log('📄 Response length:', response.text?.length || 0, 'characters');
    
    if (!response || !response.text || !response.text.trim()) {
      console.error('❌ Empty or invalid response from Gemini API');
      throw new Error('Empty response from Gemini API. The API may be experiencing issues. Check your API key and try again.');
    }
    
    let result: SkillsVisualization;
    try {
      result = JSON.parse(response.text.trim()) as SkillsVisualization;
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError);
      console.error('📄 Raw response:', response.text);
      throw new Error(`Failed to parse Gemini API response as JSON. The response may be malformed. Error: ${parseError instanceof Error ? parseError.message : 'Unknown'}`);
    }
    
    console.log('✅ Parsed skills visualization:', {
      experiences: result.professional_experiences?.length || 0,
      projects: result.projects?.length || 0,
      skills: result.all_skills?.length || 0,
      inaccessible: result.inaccessible_sources?.length || 0
    });
    
    // Return result as-is - LLM has already reported what it could/couldn't access
    // We don't merge our pre-fetch results, we rely entirely on LLM's report
    return result;
  } catch (error: any) {
    // Check if error is due to prompt being too long - if so, retry with chunking
    const isPromptTooLong = error?.status === 400 && (
      error?.message?.includes('too long') || 
      error?.message?.includes('malformed') ||
      error?.message?.includes('invalid request') ||
      error?.response?.includes('token') ||
      error?.response?.includes('length')
    );
    
    if (isPromptTooLong) {
      // Prompt was under our threshold but still too long for API - force chunking
      console.log(`⚠️ Prompt rejected by API (${fullPromptLength} chars), forcing chunking strategy...`);
      // Recursively call with chunking by setting a flag (we'll rebuild with chunking)
      // Actually, we need to rebuild the logic - let's just force chunking by checking length more aggressively
      // For now, let's lower the threshold and retry
      console.log('🔄 Retrying with chunking strategy...');
      
      // Force chunking by temporarily increasing the prompt length check
      const originalMax = MAX_PROMPT_LENGTH;
      // This won't work as MAX_PROMPT_LENGTH is const - we need a different approach
      // Let's just rebuild the chunks and process them
      
      // Use the same chunking strategy as the main path
      // This will handle PDF extraction and proper chunking
      console.log('🔄 Retrying with chunking strategy (after prompt too long error)...');
      
      // Recursively call analyzeSkills with chunking forced
      // But we need to rebuild chunks here - actually, let's just call the chunking logic
      // For simplicity, we'll rebuild the chunks using the same logic
      // (This is a bit redundant, but ensures consistency)
      
      // Build chunks with PDF extraction
      const chunks: DataChunk[] = [];
      
      // Only include resumeContent if it's not empty and not a placeholder message
      const placeholderMessages = ['Resume files uploaded', 'resume files uploaded'];
      const isValidResumeContent = resumeContent && 
        resumeContent.trim().length > 0 && 
        !placeholderMessages.includes(resumeContent.trim());
      
      if (isValidResumeContent) {
        chunks.push({
          type: 'resume_text',
          content: `RESUME TEXT:\n${resumeContent}`,
          sourceName: 'Resume Text',
          chunkIndex: 1,
          totalChunks: 1,
          originalSource: 'Resume Text'
        });
      }
      
      // Resume files with PDF extraction
      for (let i = 0; i < resumeFileURLs.length; i++) {
        const url = resumeFileURLs[i];
        const fileName = url.split('/').pop()?.split('?')[0] || `Resume ${i + 1}`;
        try {
          const pdfResult = await extractTextFromPDF(url);
          if (pdfResult.success && pdfResult.text) {
            chunks.push({
              type: 'resume_file',
              content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nExtracted Text:\n${pdfResult.text}`,
              sourceName: url,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: url
            });
          } else {
            chunks.push({
              type: 'resume_file',
              content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nNote: Could not extract text - ${pdfResult.error || 'unknown error'}`,
              sourceName: url,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: url
            });
          }
        } catch (err) {
          chunks.push({
            type: 'resume_file',
            content: `RESUME FILE: ${fileName}\nSource URL: ${url}\n\nNote: Error processing - ${err instanceof Error ? err.message : 'Unknown error'}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          });
        }
      }
      
      // Project files with PDF extraction
      for (let i = 0; i < projectFileURLs.length; i++) {
        const url = projectFileURLs[i];
        const fileName = url.split('/').pop()?.split('?')[0] || `Project ${i + 1}`;
        try {
          const pdfResult = await extractTextFromPDF(url);
          if (pdfResult.success && pdfResult.text) {
            chunks.push({
              type: 'project_file',
              content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nExtracted Text:\n${pdfResult.text}`,
              sourceName: url,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: url
            });
          } else {
            chunks.push({
              type: 'project_file',
              content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nNote: Could not extract text - ${pdfResult.error || 'unknown error'}`,
              sourceName: url,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: url
            });
          }
        } catch (err) {
          chunks.push({
            type: 'project_file',
            content: `PROJECT FILE: ${fileName}\nSource URL: ${url}\n\nNote: Error processing - ${err instanceof Error ? err.message : 'Unknown error'}`,
            sourceName: url,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: url
          });
        }
      }
      
      // Project links with GitHub content and splitting
      const MAX_CHUNK_SIZE = 25000;
      for (const link of projectLinks) {
        const isGitHub = parseGitHubUrl(link);
        if (isGitHub) {
          try {
            const githubContent = await fetchGitHubContent(link);
            if (githubContent.accessible && githubContent.content) {
              const content = githubContent.content;
              if (content.length <= MAX_CHUNK_SIZE) {
                chunks.push({
                  type: 'project_link',
                  content: `PROJECT LINK (GitHub Repository):\nURL: ${link}\n\nRepository Content:\n${content}`,
                  sourceName: link,
                  chunkIndex: 1,
                  totalChunks: 1,
                  originalSource: link
                });
              } else {
                const numChunks = Math.ceil(content.length / MAX_CHUNK_SIZE);
                for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
                  const start = chunkIdx * MAX_CHUNK_SIZE;
                  const end = Math.min(start + MAX_CHUNK_SIZE, content.length);
                  const chunkContent = content.substring(start, end);
                  chunks.push({
                    type: 'project_link',
                    content: `PROJECT LINK (GitHub Repository) - PART ${chunkIdx + 1} OF ${numChunks}:\nURL: ${link}\n\nRepository Content (Part ${chunkIdx + 1}):\n${chunkContent}`,
                    sourceName: `${link} [Part ${chunkIdx + 1}/${numChunks}]`,
                    chunkIndex: chunkIdx + 1,
                    totalChunks: numChunks,
                    originalSource: link
                  });
                }
              }
            } else {
              chunks.push({
                type: 'project_link',
                content: `PROJECT LINK:\nURL: ${link}\n\nNote: Could not fetch - ${githubContent.reason || 'unknown reason'}`,
                sourceName: link,
                chunkIndex: 1,
                totalChunks: 1,
                originalSource: link
              });
            }
          } catch (err) {
            chunks.push({
              type: 'project_link',
              content: `PROJECT LINK:\nURL: ${link}\n\nNote: Error fetching - ${err instanceof Error ? err.message : 'Unknown error'}`,
              sourceName: link,
              chunkIndex: 1,
              totalChunks: 1,
              originalSource: link
            });
          }
        } else {
          chunks.push({
            type: 'project_link',
            content: `PROJECT LINK:\nURL: ${link}`,
            sourceName: link,
            chunkIndex: 1,
            totalChunks: 1,
            originalSource: link
          });
        }
      }
      
      console.log(`📦 Processing ${chunks.length} chunks (retry after prompt too long error)...`);
      
      // Process all chunks in parallel
      const chunkPromises = chunks.map((chunk, index) => {
        return analyzeChunk(chunk, apiKey).catch(err => {
          console.error(`❌ Error processing chunk ${chunk.sourceName}:`, err);
          return {
            inaccessible_sources: [{
              source_name: chunk.originalSource || chunk.sourceName,
              source_type: chunk.type === 'resume_text' || chunk.type === 'resume_file' ? 'resume' : chunk.type === 'project_file' ? 'project' : 'link',
              reason: err instanceof Error ? err.message : 'Unknown error during analysis'
            }],
            skill_aliases_map: {},
            education_entries: [],
            professional_experiences: [],
            projects: [],
            awards_certificates_publications: [],
            all_skills: []
          } as SkillsVisualization;
        });
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      console.log(`✅ Processed ${chunkResults.length} chunks, merging results...`);
      const merged = mergeResults(chunkResults);
      console.log(`🔄 Running final assembly pass...`);
      const final = await finalAssemblyPass(merged, apiKey);
      
      console.log(`✅ Final assembly complete:`, {
        experiences: final.professional_experiences.length,
        projects: final.projects.length,
        skills: final.all_skills.length,
        inaccessible: final.inaccessible_sources.length
      });
      
      return final;
    }
    
    // Handle 429 Rate Limit Errors with Exponential Backoff
    if (error?.status === 429 || error?.message?.includes('429')) {
      if (attempt < 3) {
        const backoffTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
        console.warn(`Rate limit hit. Retrying in ${backoffTime}ms... (Attempt ${attempt + 1})`);
        await wait(backoffTime);
        return analyzeSkills(resumeContent, resumeFileURLs, projectFileURLs, projectLinks, attempt + 1);
      }
    }
    
    console.error("❌ Gemini API Error:", error);
    console.error("❌ Error type:", typeof error);
    console.error("❌ Error constructor:", error?.constructor?.name);
    console.error("Error details:", {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      statusText: error?.statusText,
      response: error?.response,
      body: error?.body,
      code: error?.code,
      name: error?.name,
      stack: error?.stack
    });
    
    // Try to stringify the error to see all properties
    try {
      console.error("❌ Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error("❌ Could not stringify error:", e);
    }
    
    // Provide more helpful error messages
    if (error?.message?.includes('API_KEY') || error?.message?.includes('api key')) {
      throw new Error('Invalid or missing Gemini API key. Please check your VITE_GEMINI_API_KEY in .env.local');
    } else if (error?.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    } else if (error?.status === 400) {
      throw new Error('Invalid request to Gemini API. The prompt may be too long or malformed.');
    } else if (error?.status === 401) {
      throw new Error('Unauthorized. Please check your Gemini API key is valid.');
    } else if (error?.status === 403) {
      throw new Error('Access forbidden. Please check your Gemini API key permissions.');
    }
    
    throw new Error(`Failed to analyze skills: ${error?.message || 'Unknown error'}. Check browser console for details.`);
  }
}

/**
 * Maximum prompt length before chunking (conservative limit - Gemini has token limits)
 * Using 30K chars as a safe threshold (roughly 7.5K tokens)
 * Gemini's actual limit varies, but this is a safe conservative limit
 */
const MAX_PROMPT_LENGTH = 30000;

/**
 * Interface for a data chunk to be analyzed
 */
interface DataChunk {
  type: 'resume_text' | 'resume_file' | 'project_file' | 'project_link';
  content: string;
  sourceName: string;
  chunkIndex?: number; // For split chunks (e.g., "Part 1 of 3")
  totalChunks?: number; // Total chunks for this source
  originalSource?: string; // Original source name for split chunks
}

/**
 * Analyzes a single chunk of data
 */
async function analyzeChunk(chunk: DataChunk, apiKey: string): Promise<SkillsVisualization> {
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a skills extraction system. Analyze the following user background material and extract structured information.

CRITICAL RULES:
1. EXTRACTION ONLY - Extract structured information. Do NOT score, rank, infer seniority beyond evidence, invent relationships, or add unsupported information.
2. XYZ FORMAT - Rewrite accomplishment bullets as "Accomplished [X] as measured by [Y], by doing [Z]" format when possible. If Y (metric) is missing, still attempt XYZ format and mark missing components in the "missing" array.
3. EVIDENCE-BACKED - Only include skills when you have supporting evidence quotes (≤20 words). If no evidence exists for a skill, do NOT include it.
4. CANONICAL SKILLS - Normalize all skills to canonical form:
   - lowercase
   - standard naming (e.g., "react" not "react.js", "kubernetes" not "k8s")
   - No duplicates
   - Provide skill_aliases_map mapping raw mentions → canonical skills
5. INACCESSIBLE SOURCES - If this source cannot be accessed or analyzed, add to inaccessible_sources with source_name (use the exact URL or filename), source_type (resume/project/link), and reason.

SOURCE TYPE: ${chunk.type}
SOURCE NAME: ${chunk.sourceName}${chunk.totalChunks && chunk.totalChunks > 1 ? ` (Part ${chunk.chunkIndex} of ${chunk.totalChunks})` : ''}
${chunk.originalSource && chunk.originalSource !== chunk.sourceName ? `ORIGINAL SOURCE: ${chunk.originalSource}\n` : ''}

${chunk.content}
${chunk.totalChunks && chunk.totalChunks > 1 ? `\n\nNOTE: This is part ${chunk.chunkIndex} of ${chunk.totalChunks} for the source "${chunk.originalSource}". When extracting information, include the original source name (${chunk.originalSource}) in source_names arrays, not this part identifier.` : ''}

Extract and structure the following:
- Education: Extract school, degree, major (if any), year (graduation), GPA (if mentioned). Include source_names with this source. Organize cleanly - no keyword extraction, just structured data.
- Professional Experiences: Extract company, title, location, date range, bullets (XYZ format when possible), and skills. Include source_names array with this source.
- Projects: Extract name, type (personal/academic/professional/unknown), date range, bullets, and skills. Include source_names array with this source.
- Awards/Certificates/Publications: Extract type, name, issuer/venue, date, and evidence.
- All Skills: Create a list of all canonical skills (deduplicated).
- Skill Graphs: For each experience/project, create clusters of related skills based on evidence.

Return ONLY valid JSON matching the exact schema provided.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          inaccessible_sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source_name: { type: Type.STRING },
                source_type: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["source_name", "source_type", "reason"]
            }
          },
          skill_aliases_map: {
            type: Type.OBJECT,
            properties: {
              _placeholder: { type: Type.STRING, description: "Placeholder - actual keys are dynamic" }
            },
            additionalProperties: { type: Type.STRING }
          },
          education_entries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                school: { type: Type.STRING },
                degree: { type: Type.STRING },
                major: { type: Type.STRING },
                year: { type: Type.STRING },
                gpa: { type: Type.STRING },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "school", "degree", "year", "source_names"]
            }
          },
          professional_experiences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                company: { type: Type.STRING },
                title: { type: Type.STRING },
                location: { type: Type.STRING },
                date_range: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING },
                    end: { type: Type.STRING }
                  },
                  required: ["start", "end"]
                },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      is_xyz: { type: Type.BOOLEAN },
                      missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["text", "is_xyz", "missing"]
                  }
                },
                non_xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      reason_not_xyz: { type: Type.STRING }
                    },
                    required: ["text", "reason_not_xyz"]
                  }
                },
                hard_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                soft_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                skill_graph: {
                  type: Type.OBJECT,
                  properties: {
                    clusters: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          cluster_name: { type: Type.STRING },
                          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["cluster_name", "skills"]
                      }
                    }
                  },
                  required: ["clusters"]
                }
              },
              required: ["id", "company", "title", "location", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
            }
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                date_range: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING },
                    end: { type: Type.STRING }
                  },
                  required: ["start", "end"]
                },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      is_xyz: { type: Type.BOOLEAN },
                      missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["text", "is_xyz", "missing"]
                  }
                },
                non_xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      reason_not_xyz: { type: Type.STRING }
                    },
                    required: ["text", "reason_not_xyz"]
                  }
                },
                hard_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                soft_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                skill_graph: {
                  type: Type.OBJECT,
                  properties: {
                    clusters: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          cluster_name: { type: Type.STRING },
                          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["cluster_name", "skills"]
                      }
                    }
                  },
                  required: ["clusters"]
                }
              },
              required: ["id", "name", "type", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
            }
          },
          awards_certificates_publications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                name: { type: Type.STRING },
                issuer_or_venue: { type: Type.STRING },
                date: { type: Type.STRING },
                evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "type", "name", "issuer_or_venue", "date", "evidence"]
            }
          },
          all_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["inaccessible_sources", "skill_aliases_map", "education_entries", "professional_experiences", "projects", "awards_certificates_publications", "all_skills"]
      }
    }
  });

  if (!response || !response.text || !response.text.trim()) {
    throw new Error('Empty response from Gemini API');
  }

  const parsed = JSON.parse(response.text.trim()) as SkillsVisualization;
  if (!parsed.education_entries) parsed.education_entries = [];
  return parsed;
}

/**
 * Merges multiple SkillsVisualization results into one
 */
function mergeResults(results: SkillsVisualization[]): SkillsVisualization {
  const merged: SkillsVisualization = {
    inaccessible_sources: [],
    skill_aliases_map: {},
    education_entries: [],
    professional_experiences: [],
    projects: [],
    awards_certificates_publications: [],
    all_skills: []
  };

  // Merge inaccessible sources
  const inaccessibleMap = new Map<string, SkillsVisualization['inaccessible_sources'][0]>();
  for (const result of results) {
    for (const source of result.inaccessible_sources || []) {
      inaccessibleMap.set(source.source_name, source);
    }
  }
  merged.inaccessible_sources = Array.from(inaccessibleMap.values());

  // Merge skill aliases
  for (const result of results) {
    Object.assign(merged.skill_aliases_map, result.skill_aliases_map || {});
  }

  // Merge education (merge by school+degree; take most complete entry)
  const educationMap = new Map<string, SkillsVisualization['education_entries'][0]>();
  for (const result of results) {
    for (const ed of result.education_entries || []) {
      const key = `${(ed.school || '').toLowerCase()}_${(ed.degree || '').toLowerCase()}`;
      const existing = educationMap.get(key);
      if (existing) {
        existing.source_names = [...new Set([...existing.source_names, ...ed.source_names])];
        if (!existing.major && ed.major) existing.major = ed.major;
        if (!existing.gpa && ed.gpa) existing.gpa = ed.gpa;
        if (!existing.year && ed.year) existing.year = ed.year;
      } else {
        educationMap.set(key, { ...ed });
      }
    }
  }
  merged.education_entries = Array.from(educationMap.values());

  // Merge professional experiences (merge duplicates by company + title)
  // When merging, use originalSource from chunks to ensure proper source tracking
  const experienceMap = new Map<string, SkillsVisualization['professional_experiences'][0]>();
  for (const result of results) {
    for (const exp of result.professional_experiences || []) {
      const key = `${exp.company.toLowerCase()}_${exp.title.toLowerCase()}`;
      const existing = experienceMap.get(key);
      
      if (existing) {
        // Merge: combine bullets, skills, and source_names
        // Deduplicate bullets by text content
        const existingBulletTexts = new Set(existing.xyz_bullets.map(b => b.text.toLowerCase()));
        const newXYZBullets = exp.xyz_bullets.filter(b => !existingBulletTexts.has(b.text.toLowerCase()));
        existing.xyz_bullets = [...existing.xyz_bullets, ...newXYZBullets];
        
        const existingNonXYZTexts = new Set(existing.non_xyz_bullets.map(b => b.text.toLowerCase()));
        const newNonXYZBullets = exp.non_xyz_bullets.filter(b => !existingNonXYZTexts.has(b.text.toLowerCase()));
        existing.non_xyz_bullets = [...existing.non_xyz_bullets, ...newNonXYZBullets];
        
        // Merge hard skills
        const hardSkillsMap = new Map<string, SkillsVisualization['professional_experiences'][0]['hard_skills'][0]>();
        [...existing.hard_skills, ...exp.hard_skills].forEach(skill => {
          const existingSkill = hardSkillsMap.get(skill.skill.toLowerCase());
          if (existingSkill) {
            existingSkill.evidence = [...new Set([...existingSkill.evidence, ...skill.evidence])];
          } else {
            hardSkillsMap.set(skill.skill.toLowerCase(), { ...skill });
          }
        });
        existing.hard_skills = Array.from(hardSkillsMap.values());
        
        // Merge soft skills
        const softSkillsMap = new Map<string, SkillsVisualization['professional_experiences'][0]['soft_skills'][0]>();
        [...existing.soft_skills, ...exp.soft_skills].forEach(skill => {
          const existingSkill = softSkillsMap.get(skill.skill.toLowerCase());
          if (existingSkill) {
            existingSkill.evidence = [...new Set([...existingSkill.evidence, ...skill.evidence])];
          } else {
            softSkillsMap.set(skill.skill.toLowerCase(), { ...skill });
          }
        });
        existing.soft_skills = Array.from(softSkillsMap.values());
        
        // Merge source names (use Set to deduplicate)
        existing.source_names = [...new Set([...existing.source_names, ...exp.source_names])];
        
        // Merge skill graph clusters
        const clusterMap = new Map<string, string[]>();
        [...existing.skill_graph.clusters, ...exp.skill_graph.clusters].forEach(cluster => {
          const existingCluster = clusterMap.get(cluster.cluster_name.toLowerCase());
          if (existingCluster) {
            clusterMap.set(cluster.cluster_name.toLowerCase(), [...new Set([...existingCluster, ...cluster.skills])]);
          } else {
            clusterMap.set(cluster.cluster_name.toLowerCase(), [...cluster.skills]);
          }
        });
        existing.skill_graph.clusters = Array.from(clusterMap.entries()).map(([name, skills]) => ({
          cluster_name: name,
          skills
        }));
      } else {
        experienceMap.set(key, { ...exp });
      }
    }
  }
  merged.professional_experiences = Array.from(experienceMap.values());

  // Merge projects (deduplicate by name)
  // When merging, ensure source_names from split chunks reference the original source
  const projectMap = new Map<string, SkillsVisualization['projects'][0]>();
  for (const result of results) {
    for (const project of result.projects || []) {
      const key = project.name.toLowerCase();
      const existing = projectMap.get(key);
      
      if (existing) {
        // Merge similar to experiences, with deduplication
        // Deduplicate bullets by text content
        const existingBulletTexts = new Set(existing.xyz_bullets.map(b => b.text.toLowerCase()));
        const newXYZBullets = project.xyz_bullets.filter(b => !existingBulletTexts.has(b.text.toLowerCase()));
        existing.xyz_bullets = [...existing.xyz_bullets, ...newXYZBullets];
        
        const existingNonXYZTexts = new Set(existing.non_xyz_bullets.map(b => b.text.toLowerCase()));
        const newNonXYZBullets = project.non_xyz_bullets.filter(b => !existingNonXYZTexts.has(b.text.toLowerCase()));
        existing.non_xyz_bullets = [...existing.non_xyz_bullets, ...newNonXYZBullets];
        
        const hardSkillsMap = new Map<string, SkillsVisualization['projects'][0]['hard_skills'][0]>();
        [...existing.hard_skills, ...project.hard_skills].forEach(skill => {
          const existingSkill = hardSkillsMap.get(skill.skill.toLowerCase());
          if (existingSkill) {
            existingSkill.evidence = [...new Set([...existingSkill.evidence, ...skill.evidence])];
          } else {
            hardSkillsMap.set(skill.skill.toLowerCase(), { ...skill });
          }
        });
        existing.hard_skills = Array.from(hardSkillsMap.values());
        
        const softSkillsMap = new Map<string, SkillsVisualization['projects'][0]['soft_skills'][0]>();
        [...existing.soft_skills, ...project.soft_skills].forEach(skill => {
          const existingSkill = softSkillsMap.get(skill.skill.toLowerCase());
          if (existingSkill) {
            existingSkill.evidence = [...new Set([...existingSkill.evidence, ...skill.evidence])];
          } else {
            softSkillsMap.set(skill.skill.toLowerCase(), { ...skill });
          }
        });
        existing.soft_skills = Array.from(softSkillsMap.values());
        
        // Merge source names (deduplicate, and normalize split chunk names to original source)
        const normalizedSourceNames = project.source_names.map(name => {
          // If name contains "[Part X/Y]", extract the original source
          const partMatch = name.match(/^(.+?)\s*\[Part\s+\d+\/\d+\]$/);
          return partMatch ? partMatch[1] : name;
        });
        existing.source_names = [...new Set([...existing.source_names, ...normalizedSourceNames])];
        
        const clusterMap = new Map<string, string[]>();
        [...existing.skill_graph.clusters, ...project.skill_graph.clusters].forEach(cluster => {
          const existingCluster = clusterMap.get(cluster.cluster_name.toLowerCase());
          if (existingCluster) {
            clusterMap.set(cluster.cluster_name.toLowerCase(), [...new Set([...existingCluster, ...cluster.skills])]);
          } else {
            clusterMap.set(cluster.cluster_name.toLowerCase(), [...cluster.skills]);
          }
        });
        existing.skill_graph.clusters = Array.from(clusterMap.entries()).map(([name, skills]) => ({
          cluster_name: name,
          skills
        }));
      } else {
        // Normalize source names for new projects too
        const normalizedProject = { ...project };
        normalizedProject.source_names = project.source_names.map(name => {
          const partMatch = name.match(/^(.+?)\s*\[Part\s+\d+\/\d+\]$/);
          return partMatch ? partMatch[1] : name;
        });
        projectMap.set(key, normalizedProject);
      }
    }
  }
  merged.projects = Array.from(projectMap.values());

  // Merge awards/certificates/publications (deduplicate by name + issuer)
  const awardMap = new Map<string, SkillsVisualization['awards_certificates_publications'][0]>();
  for (const result of results) {
    for (const award of result.awards_certificates_publications || []) {
      const key = `${award.name.toLowerCase()}_${award.issuer_or_venue.toLowerCase()}`;
      if (!awardMap.has(key)) {
        awardMap.set(key, { ...award });
      }
    }
  }
  merged.awards_certificates_publications = Array.from(awardMap.values());

  // Merge all skills (deduplicate)
  const skillsSet = new Set<string>();
  for (const result of results) {
    for (const skill of result.all_skills || []) {
      skillsSet.add(skill.toLowerCase());
    }
  }
  merged.all_skills = Array.from(skillsSet);

  return merged;
}

/**
 * Final assembly pass to normalize and deduplicate the merged results
 */
async function finalAssemblyPass(merged: SkillsVisualization, apiKey: string): Promise<SkillsVisualization> {
  console.log('🔄 finalAssemblyPass: Starting...');
  console.log('🔄 Merged data summary:', {
    experiences: merged.professional_experiences.length,
    projects: merged.projects.length,
    skills: merged.all_skills.length,
    inaccessible: merged.inaccessible_sources.length,
    skillAliases: Object.keys(merged.skill_aliases_map || {}).length
  });
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are a skills normalization system. Review the following merged skills visualization and perform final normalization:

CRITICAL TASKS:
1. CANONICAL SKILLS - Ensure all_skills contains only canonical, lowercase, deduplicated skills
2. SKILL ALIASES - Update skill_aliases_map to map all variations to canonical forms
3. EDUCATION - Preserve education_entries, merge duplicates by school+degree
4. SKILL DEDUPLICATION - Remove duplicate skills from professional_experiences and projects, ensuring evidence is merged
5. EXPERIENCE MERGING - If any professional_experiences have the same company + title, merge them completely
6. PROJECT DEDUPLICATION - If any projects have the same name, merge them completely
7. SKILL GRAPH CLUSTERING - Ensure skill graphs don't have duplicate clusters or skills

MERGED DATA:
${JSON.stringify(merged, null, 2)}

Return ONLY valid JSON matching the exact schema, with all normalization applied.`;

  console.log('🔄 finalAssemblyPass: Sending request to Gemini API...');
  console.log('🔄 Prompt length:', prompt.length, 'characters');
  
  try {
    const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          inaccessible_sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source_name: { type: Type.STRING },
                source_type: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["source_name", "source_type", "reason"]
            }
          },
          skill_aliases_map: {
            type: Type.OBJECT,
            properties: {
              _placeholder: { type: Type.STRING, description: "Placeholder - actual keys are dynamic" }
            },
            additionalProperties: { type: Type.STRING }
          },
          education_entries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                school: { type: Type.STRING },
                degree: { type: Type.STRING },
                major: { type: Type.STRING },
                year: { type: Type.STRING },
                gpa: { type: Type.STRING },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "school", "degree", "year", "source_names"]
            }
          },
          professional_experiences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                company: { type: Type.STRING },
                title: { type: Type.STRING },
                location: { type: Type.STRING },
                date_range: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING },
                    end: { type: Type.STRING }
                  },
                  required: ["start", "end"]
                },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      is_xyz: { type: Type.BOOLEAN },
                      missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["text", "is_xyz", "missing"]
                  }
                },
                non_xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      reason_not_xyz: { type: Type.STRING }
                    },
                    required: ["text", "reason_not_xyz"]
                  }
                },
                hard_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                soft_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                skill_graph: {
                  type: Type.OBJECT,
                  properties: {
                    clusters: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          cluster_name: { type: Type.STRING },
                          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["cluster_name", "skills"]
                      }
                    }
                  },
                  required: ["clusters"]
                }
              },
              required: ["id", "company", "title", "location", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
            }
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                date_range: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING },
                    end: { type: Type.STRING }
                  },
                  required: ["start", "end"]
                },
                source_names: { type: Type.ARRAY, items: { type: Type.STRING } },
                xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      is_xyz: { type: Type.BOOLEAN },
                      missing: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["text", "is_xyz", "missing"]
                  }
                },
                non_xyz_bullets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      reason_not_xyz: { type: Type.STRING }
                    },
                    required: ["text", "reason_not_xyz"]
                  }
                },
                hard_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                soft_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      skill: { type: Type.STRING },
                      evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["skill", "evidence"]
                  }
                },
                skill_graph: {
                  type: Type.OBJECT,
                  properties: {
                    clusters: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          cluster_name: { type: Type.STRING },
                          skills: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["cluster_name", "skills"]
                      }
                    }
                  },
                  required: ["clusters"]
                }
              },
              required: ["id", "name", "type", "date_range", "source_names", "xyz_bullets", "non_xyz_bullets", "hard_skills", "soft_skills", "skill_graph"]
            }
          },
          awards_certificates_publications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                name: { type: Type.STRING },
                issuer_or_venue: { type: Type.STRING },
                date: { type: Type.STRING },
                evidence: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "type", "name", "issuer_or_venue", "date", "evidence"]
            }
          },
          all_skills: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["inaccessible_sources", "skill_aliases_map", "education_entries", "professional_experiences", "projects", "awards_certificates_publications", "all_skills"]
      }
    }
  });

    console.log('🔄 finalAssemblyPass: Received response from Gemini API');
    console.log('🔄 Response text length:', response.text?.length || 0);
    
    if (!response || !response.text || !response.text.trim()) {
      console.warn('⚠️ Final assembly pass returned empty response, using merged result');
      return merged;
    }

    try {
      const result = JSON.parse(response.text.trim()) as SkillsVisualization;
      if (!result.education_entries && merged.education_entries?.length) {
        result.education_entries = merged.education_entries;
      }
      console.log('✅ finalAssemblyPass: Successfully parsed response:', {
        education: result.education_entries?.length || 0,
        experiences: result.professional_experiences?.length || 0,
        projects: result.projects?.length || 0,
        skills: result.all_skills?.length || 0,
        inaccessible: result.inaccessible_sources?.length || 0
      });
      return result;
    } catch (parseError) {
      console.error('❌ finalAssemblyPass: Failed to parse JSON response:', parseError);
      console.error('📄 Raw response:', response.text);
      throw parseError;
    }
  } catch (error: any) {
    console.error('❌ finalAssemblyPass: Error calling Gemini API:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      code: error?.code,
      response: error?.response
    });
    
    // If final assembly fails, return the merged result (better than nothing)
    console.warn('⚠️ Final assembly pass failed, returning merged result without final normalization');
    return merged;
  }
}

/**
 * Validates that the Gemini API key is valid by making a simple test request
 */
export async function validateGeminiApiKey(): Promise<{ valid: boolean; error?: string }> {
  const env = import.meta.env as any;
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (process.env as any).API_KEY;
  
  if (!apiKey) {
    return { valid: false, error: 'API key not found. Please add VITE_GEMINI_API_KEY to your .env.local file.' };
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Make a minimal test request
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: 'Say "OK" if you can read this.',
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    if (response && response.text) {
      return { valid: true };
    } else {
      return { valid: false, error: 'API returned empty response' };
    }
  } catch (error: any) {
    console.error('API key validation error:', error);
    
    if (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('API key') || error?.message?.includes('authentication')) {
      return { valid: false, error: 'Invalid API key. Please check your VITE_GEMINI_API_KEY in .env.local' };
    } else if (error?.status === 403 || error?.message?.includes('403')) {
      return { valid: false, error: 'API key does not have permission to access Gemini API' };
    } else if (error?.status === 429 || error?.message?.includes('429')) {
      return { valid: false, error: 'Rate limit exceeded. Please wait a moment and try again.' };
    } else {
      return { valid: false, error: `API validation failed: ${error?.message || 'Unknown error'}` };
    }
  }
}

function getGeminiApiKey(): string {
  const env = import.meta.env as any;
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || (process.env as any).API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not set. Add VITE_GEMINI_API_KEY to .env.local');
  }
  return apiKey;
}

/**
 * Generates a job-tailored resume from master resume + job description.
 */
export async function generateCustomizedResume(
  masterResume: string,
  jobDescription: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Rewrite the following resume to be perfectly tailored for this job description.
Focus on highlighting relevant skills and experiences found in the job description while maintaining the truth of the original resume.
Format the output as clean, professional plain text with clear headings.

Master Resume: ${masterResume}

Job Description: ${jobDescription}`,
    });
    return response.text?.trim() || 'Failed to generate tailored resume.';
  } catch (error) {
    console.error('Tailoring Error:', error);
    return 'Error generating customized resume. Please try again.';
  }
}

/** Input for generateTailoredResume */
export interface TailoredResumeInput {
  skillsVisualization: SkillsVisualization;
  job: Job;
  userName: string;
  userEmail: string;
  userGithub?: string;
}

/**
 * Generates a job-tailored resume in one API call. Uses XYZ format, targets 85%+ keyword match.
 * Output is structured JSON for editable display and PDF export.
 */
export async function generateTailoredResume(input: TailoredResumeInput): Promise<TailoredResumeContent> {
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const { skillsVisualization, job, userName, userEmail, userGithub } = input;
  const analysis = job.analysis;
  const keywords = analysis?.keywords ?? [];
  const whatLooksGood = analysis?.whatLooksGood ?? '';
  const whatIsMissing = analysis?.whatIsMissing ?? '';

  const expText = skillsVisualization.professional_experiences.map(e => {
    const xyz = e.xyz_bullets.map(b => b.text).join('\n');
    const nonXyz = e.non_xyz_bullets.map(b => b.text).join('\n');
    const skills = [...e.hard_skills.map(s => s.skill), ...e.soft_skills.map(s => s.skill)].join(', ');
    return `[${e.title} at ${e.company} (${e.date_range?.start || ''}-${e.date_range?.end || ''})]\nBullets (XYZ): ${xyz}\nOther: ${nonXyz}\nSkills: ${skills}`;
  }).join('\n\n');

  const projText = skillsVisualization.projects.map(p => {
    const xyz = p.xyz_bullets.map(b => b.text).join('\n');
    const nonXyz = p.non_xyz_bullets.map(b => b.text).join('\n');
    const skills = [...p.hard_skills.map(s => s.skill), ...p.soft_skills.map(s => s.skill)].join(', ');
    return `[${p.name} (${p.type}) ${p.date_range?.start || ''}-${p.date_range?.end || ''}]\nBullets: ${xyz}\n${nonXyz}\nSkills: ${skills}`;
  }).join('\n\n');

  const educationEntries = skillsVisualization.education_entries || [];
  const eduText = educationEntries.length > 0
    ? educationEntries.map(e => `- ${e.degree}${e.major ? ` in ${e.major}` : ''}, ${e.school} · ${e.year}${e.gpa ? ` (GPA: ${e.gpa})` : ''}`).join('\n')
    : 'None provided';

  const prompt = `You are an expert resume writer. Create a ONE-PAGE tailored resume for the candidate applying to this job.

FORMATTING RULES (Google recruiter guidelines):
- PDF-ready, black text, clean consistent font
- NO objective section (they know you want the job)
- Use bullet points only - no long paragraphs
- Keep resume to 1 page - be ruthless. If a bullet spills to a second line, shorten it.
- Education before experience if recent grad (<3 years); otherwise experience first (reverse chronological)
- Contact info (name, email) prominent at top. Include GitHub if technical role.
- For technical roles: list programming languages prominently

XYZ BULLET FORMAT (critical - use for every bullet):
"Accomplished [X] as measured by [Y], by doing [Z]"
- X = accomplishment/result
- Y = metric/scale (numbers, %, time)
- Z = how you did it (action)

Examples:
- OK: "Won second place in hackathon"
- Better: "Won second place out of 50 teams in hackathon"
- Best: "Won second place out of 50 teams in hackathon at NJ Tech by developing an app that synchronizes mobile calendars with two colleagues"

KEYWORD TARGET (CRITICAL - YOU MUST REACH 85%+): Target 85%+ keyword match. Rules:
1. DO NOT change or remove the candidate's existing experiences, projects, or bullets. Preserve everything they have.
2. ADD as many new bullets as needed to hit 85%+ - you may add 2-3 extra bullets per experience/project. Weave missing keywords into NEW bullets. Incorporate synonyms and related terms: NoSQL/relational→databases, Kafka→messaging systems, LlamaIndex/Haystack→RAG/LLM libraries/vector, TensorFlow→PyTorch/ML frameworks, etc. If they use Python for ML, add TensorFlow/LLM libraries where it fits. Every blue/missing keyword that can reasonably fit MUST be woven in.
3. Be realistic: no exaggerated claims (e.g., "saved $20M"). Use credible metrics.
4. Every bullet: XYZ format. Accomplished [X] as measured by [Y], by doing [Z].

OUTPUT RULES - NO INTERNAL THINKING:
- Output ONLY the final clean data. NEVER include reasoning, inference notes, or chain-of-thought in any JSON field.
- For contact.github: Use the GitHub URL provided below EXACTLY. Do NOT infer or guess. If provided, copy it verbatim. If not provided, use empty string.
- For education: Use the EDUCATION data from USER BACKGROUND exactly. If education was provided, output it. If "None provided", omit education or use empty strings. For any missing field use [Placeholder?]. NEVER output reasoning.

=== USER BACKGROUND ===
Name: ${userName}
Email: ${userEmail}
${userGithub ? `GitHub (use this EXACT URL, do not change): ${userGithub}` : 'GitHub: (not provided - leave empty)'}

EDUCATION (use this data exactly for the education section; do NOT infer or invent):
${eduText}

PROFESSIONAL EXPERIENCES:
${expText || 'None'}

PROJECTS:
${projText || 'None'}

ALL SKILLS: ${skillsVisualization.all_skills.join(', ')}

=== TARGET JOB ===
Title: ${job.title}
Company: ${job.company}
Keywords to incorporate: ${keywords.join(', ')}
What looks good (leverage this): ${whatLooksGood}
What is missing (address gaps): ${whatIsMissing}

Job Description:
${job.description}

Return valid JSON. Use exact keys. NO reasoning in any field. For education: use [Placeholder?] for uncertain values.
{
  "contact": { "name": "string", "email": "string", "github": "exact URL from above or empty" },
  "summary": "2-3 sentence tailored summary",
  "experiences": [
    { "company": "string", "title": "string", "location": "string", "dates": "string", "bullets": ["XYZ bullet", "..."] }
  ],
  "projects": [
    { "name": "string", "type": "string", "dates": "string", "bullets": ["XYZ bullet", "..."] }
  ],
  "skills": ["skill1", "skill2"],
  "education": { "school": "string", "degree": "string", "major": "string", "year": "string (use [Year?] if uncertain)" }
}
You may add up to 5-6 bullets per experience/project to hit keyword target. Ensure 1-page fit.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contact: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                email: { type: Type.STRING },
                github: { type: Type.STRING }
              },
              required: ['name', 'email']
            },
            summary: { type: Type.STRING },
            experiences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  title: { type: Type.STRING },
                  location: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['company', 'title', 'dates', 'bullets']
              }
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'bullets']
              }
            },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            education: {
              type: Type.OBJECT,
              properties: {
                school: { type: Type.STRING },
                degree: { type: Type.STRING },
                major: { type: Type.STRING },
                year: { type: Type.STRING }
              }
            }
          },
          required: ['contact', 'summary', 'experiences', 'projects', 'skills']
        }
      }
    });
    const rawText = response.text?.trim() || '{}';
    let parsed: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch (e) {
      console.error('generateTailoredResume JSON parse error:', e);
      throw new Error('Failed to parse resume response');
    }
    return {
      contact: {
        name: parsed.contact?.name || userName,
        email: parsed.contact?.email || userEmail,
        github: parsed.contact?.github || userGithub || ''
      },
      summary: parsed.summary || '',
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      education: parsed.education
    };
  } catch (error) {
    console.error('generateTailoredResume error:', error);
    throw error;
  }
}

/**
 * Discovers recruiters/stakeholders for a company and role (Gemini-simulated).
 */
export async function findRecruiters(companyName: string, jobTitle: string): Promise<Recruiter[]> {
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Generate 3 realistic professional profiles for recruiters or engineering managers at ${companyName} who would be interested in a ${jobTitle}.
Return a JSON array of objects with: name, role, email (simulated, e.g. firstname.lastname@company.com), relevance (why they are a good contact), and avatarSeed (short unique string for avatar).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              email: { type: Type.STRING },
              relevance: { type: Type.STRING },
              avatarSeed: { type: Type.STRING },
            },
            required: ['name', 'role', 'email', 'relevance', 'avatarSeed'],
          },
        },
      },
    });
    const text = response.text?.trim() || '[]';
    const results = JSON.parse(text) as { name: string; role: string; email: string; relevance: string; avatarSeed: string }[];
    return results.map((r, i) => ({
      id: `rec-${i}-${Date.now()}`,
      name: r.name,
      role: r.role,
      email: r.email,
      relevance: r.relevance,
      avatar: `https://picsum.photos/seed/${r.avatarSeed}/200/200`,
    }));
  } catch (error) {
    console.error('Discovery Error:', error);
    return [];
  }
}

/** Input for batch job keyword extraction */
export interface JobKeywordInput {
  jobId: string;
  title: string;
  company: string;
  description: string;
}

/**
 * Extract ATS-normalized keywords from multiple job descriptions in one API call.
 * Focuses on: responsibilities, qualifications, preferred qualifications.
 * Keywords are normalized: lowercase, standard naming (e.g., "react" not "react.js").
 */
export async function extractJobKeywordsBatch(
  jobs: JobKeywordInput[]
): Promise<Record<string, string[]>> {
  if (jobs.length === 0) return {};
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const jobsBlock = jobs.map((j, i) => `
=== JOB ${i + 1} [ID: ${j.jobId}] ===
Title: ${j.title}
Company: ${j.company}
Description:
${j.description}
=== END JOB ${i + 1} ===`).join('\n\n');

  const prompt = `You are an ATS (Applicant Tracking System) keyword extraction system. Extract skills and qualifications from job descriptions using ATS-style normalized keywords.

RULES:
1. Focus ONLY on: Responsibilities, Qualifications, and Preferred Qualifications sections.
2. Normalize keywords: lowercase, standard naming (e.g., "react" not "react.js", "kubernetes" not "k8s", "python" not "Python").
3. Extract: technologies, frameworks, languages, tools, concepts, methodologies.
4. No duplicates. No generic filler words.
5. Return one array of keywords per job, in the same order as input.

Return valid JSON: { "results": [ ["keyword1","keyword2",...], ... ] }
Each inner array corresponds to job 1, 2, 3... in order.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `${prompt}\n\n${jobsBlock}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          },
          required: ['results']
        }
      }
    });
    const rawText = response.text?.trim() || '';
    let parsed: { results?: string[][] } = { results: [] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('extractJobKeywordsBatch JSON parse error:', parseErr, 'Raw:', rawText?.slice(0, 500));
    }
    const results: Record<string, string[]> = {};
    const resultsArr = parsed.results || [];
    jobs.forEach((job, i) => {
      const kw = resultsArr[i];
      results[job.jobId] = Array.isArray(kw) ? kw : [];
    });
    console.log('extractJobKeywordsBatch:', { jobCount: jobs.length, keywordCounts: Object.fromEntries(Object.entries(results).map(([id, kws]) => [id, kws.length])) });
    return results;
  } catch (error) {
    console.error('extractJobKeywordsBatch error:', error);
    throw error;
  }
}

/** Input for batch fit analysis */
export interface JobFitInput {
  jobId: string;
  title: string;
  company: string;
  keywords: string[];
  mySkills: string[];
  matchedKeywords: string[];
}

/**
 * Generate "What looks good" and "What is missing" for multiple jobs in one API call.
 */
export async function generateJobFitAnalysisBatch(
  jobs: JobFitInput[],
  skillsVisualization: SkillsVisualization
): Promise<Record<string, { whatLooksGood: string; whatIsMissing: string }>> {
  if (jobs.length === 0) return {};
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const userSummary = `User's skills: ${skillsVisualization.all_skills.join(', ')}
Professional experiences: ${skillsVisualization.professional_experiences.map(e => `${e.title} at ${e.company}`).join('; ')}
Projects: ${skillsVisualization.projects.map(p => p.name).join('; ')}`;

  const jobsBlock = jobs.map((j, i) => `
=== JOB ${i + 1} [ID: ${j.jobId}] ===
Title: ${j.title} at ${j.company}
Job keywords: ${j.keywords.join(', ')}
Matched (user has): ${j.matchedKeywords.join(', ')}
Missing (user does not have): ${j.keywords.filter(k => !j.matchedKeywords.includes(k)).join(', ')}
=== END JOB ${i + 1} ===`).join('\n\n');

  const prompt = `Based on the user profile and each job's keywords (matched vs missing), produce structured analysis.

For EACH job, provide:
1. what_looks_good: Skills the user has, similar experiences, how their experience progression aligns with what the company wants. Be specific and encouraging.
2. what_is_missing: Missing keywords, maturity/depth gaps in projects or skills, detailed notes on what experiences/projects/skills would increase their chances. Be constructive.

Return valid JSON: { "results": [ { "what_looks_good": "...", "what_is_missing": "..." }, ... ] }
Same order as input jobs.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `USER PROFILE:\n${userSummary}\n\nJOBS:\n${jobsBlock}\n\n${prompt}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  what_looks_good: { type: Type.STRING },
                  what_is_missing: { type: Type.STRING }
                },
                required: ['what_looks_good', 'what_is_missing']
              }
            }
          },
          required: ['results']
        }
      }
    });
    const rawText = response.text?.trim() || '';
    let parsed: { results?: any[] } = { results: [] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{"results":[]}');
    } catch (e) {
      console.error('generateJobFitAnalysisBatch JSON parse error:', e);
    }
    const out: Record<string, { whatLooksGood: string; whatIsMissing: string }> = {};
    (parsed.results || []).forEach((r: any, i: number) => {
      if (jobs[i]) {
        out[jobs[i].jobId] = {
          whatLooksGood: r?.what_looks_good || '',
          whatIsMissing: r?.what_is_missing || ''
        };
      }
    });
    return out;
  } catch (error) {
    console.error('generateJobFitAnalysisBatch error:', error);
    return {};
  }
}

/**
 * Generates a personalized outreach email draft to a recruiter.
 */
export async function generateOutreachEmail(
  userName: string,
  resume: string,
  jobTitle: string,
  company: string,
  recruiterName: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Write a high-converting, concise cold email from ${userName} to ${recruiterName} (at ${company}) regarding a ${jobTitle} position.
Use the candidate's resume context to mention one specific value-add. Keep it under 150 words.

Candidate Resume: ${resume}`,
    });
    return response.text?.trim() || 'Failed to generate draft.';
  } catch (error) {
    console.error('Drafting Error:', error);
    return 'Error generating draft.';
  }
}
