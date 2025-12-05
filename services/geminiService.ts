import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY || '';
    }
  } catch (e) {
    // Ignore if process is not defined
  }
  return '';
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey });

const modelId = 'gemini-2.5-flash';

export const generateRideSafetyBrief = async (origin: string, destination: string): Promise<string> => {
  if (!apiKey) return "AI Safety Analysis requires API Key.";
  
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Provide a very short, 2-sentence safety briefing for a drive from ${origin} to ${destination}, considering general road conditions and weather trends. Keep it professional.`,
    });
    return response.text || "Drive safely and verify passenger ID.";
  } catch (error) {
    console.error("AI Error", error);
    return "Standard safety protocols apply. Verify ID before boarding.";
  }
};

export const optimizeRideDescription = async (from: string, to: string, stops: string[]): Promise<string> => {
  if (!apiKey) return `Trip from ${from} to ${to} via ${stops.join(', ')}.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Write a catchy, friendly, 1-sentence description for a carpool ride from ${from} to ${to} with stops in ${stops.join(', ')}. Emphasize comfort.`,
    });
    return response.text || `Comfortable ride from ${from} to ${to}.`;
  } catch (error) {
    return `Trip from ${from} to ${to}.`;
  }
};

export const calculateAIPrice = async (distance: number, demandLevel: 'low' | 'high'): Promise<number> => {
   const baseRate = 0.15; // per km
   const multiplier = demandLevel === 'high' ? 1.5 : 1.0;
   return Math.round(distance * baseRate * multiplier);
};