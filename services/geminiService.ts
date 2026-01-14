
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface MatchResult {
  score: number;
  reason: string;
}

export async function calculateMatchScore(resume: string, jobDescription: string): Promise<MatchResult> {
  if (!resume || !jobDescription) return { score: 0, reason: "Incomplete data" };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Compare the following resume and job description. Provide a matching score from 0 to 100 and a brief one-sentence reason for the score.
      
      Resume: ${resume}
      
      Job Description: ${jobDescription}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "A number between 0 and 100." },
            reason: { type: Type.STRING, description: "Short explanation for the score." },
          },
          required: ["score", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    return {
      score: result.score || 0,
      reason: result.reason || "Unable to analyze"
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { score: 0, reason: "Error analyzing match" };
  }
}
