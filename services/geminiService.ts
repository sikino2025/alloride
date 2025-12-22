
import { GoogleGenAI } from "@google/genai";

// Helper to safely get the AI instance. 
// This prevents the app from crashing on load if process is undefined (common in browser builds).
const getAI = () => {
  try {
    // Only access process.env.API_KEY when actually needed
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API Key is missing");
      return null;
    }
    return new GoogleGenAI({ apiKey: apiKey });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI", error);
    return null;
  }
};

/**
 * Generates a short safety briefing for a ride between two locations.
 */
export const generateRideSafetyBrief = async (origin: string, destination: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Drive safely and verify passenger ID.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a very short, 2-sentence safety briefing for a drive from ${origin} to ${destination}, considering general road conditions and weather trends. Keep it professional.`,
    });
    return response.text || "Drive safely and verify passenger ID.";
  } catch (error) {
    console.error("AI Error", error);
    return "Standard safety protocols apply. Verify ID before boarding.";
  }
};

/**
 * Optimizes the ride description to be catchy and friendly.
 */
export const optimizeRideDescription = async (from: string, to: string, stops: string[]): Promise<string> => {
  const ai = getAI();
  if (!ai) return `Trip from ${from} to ${to}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a catchy, friendly, 1-sentence description for a carpool ride from ${from} to ${to} with stops in ${stops.join(', ')}. Emphasize comfort.`,
    });
    return response.text || `Comfortable ride from ${from} to ${to}.`;
  } catch (error) {
    return `Trip from ${from} to ${to}.`;
  }
};

/**
 * Calculates a suggested price based on distance and demand.
 */
export const calculateAIPrice = async (distance: number, demandLevel: 'low' | 'high'): Promise<number> => {
   const baseRate = 0.15; // per km
   const multiplier = demandLevel === 'high' ? 1.5 : 1.0;
   return Math.round(distance * baseRate * multiplier);
};

/**
 * Resolves a natural language meeting point description into a specific address or place name.
 */
export const resolvePickupLocation = async (description: string, defaultOrigin: string) => {
  const defaultUri = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(defaultOrigin)}`;
  const ai = getAI();
  
  if (!ai) return { address: defaultOrigin, uri: defaultUri };
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Identify the specific physical meeting point or address mentioned in this ride description: "${description}". 
      Return only the specific address or place name with city context. 
      Example: If description is "Wait at Tim Hortons", and origin is Montreal, return "Tim Hortons, Montreal, QC".
      If no specific place is mentioned, return "${defaultOrigin}".`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const address = response.text?.trim() || defaultOrigin;
    
    // Extract a Google Maps URI from grounding metadata if available.
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let uri = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    
    if (chunks && Array.isArray(chunks)) {
        for (const chunk of chunks) {
            if (chunk.maps?.uri) {
                uri = chunk.maps.uri;
                break;
            }
        }
    }

    return { address, uri };
  } catch (error) {
    console.error("Location resolution error", error);
    return { address: defaultOrigin, uri: defaultUri };
  }
};

/**
 * Returns a static map URL for a given address using Google Maps Static Maps API.
 */
export const getStaticMapUrl = (address: string) => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) return `https://picsum.photos/800/600?random=${Date.now()}`;
        return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=15&size=800x600&maptype=roadmap&markers=color:red%7C${encodeURIComponent(address)}&key=${apiKey}`;
    } catch (e) {
        return `https://picsum.photos/800/600?random=${Date.now()}`;
    }
};
