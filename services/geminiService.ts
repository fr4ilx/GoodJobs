
import { GoogleGenAI, Type } from "@google/genai";

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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
