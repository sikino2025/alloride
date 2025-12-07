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

export const resolvePickupLocation = async (description: string, defaultOrigin: string) => {
  if (!apiKey) return { address: defaultOrigin, uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(defaultOrigin)}` };

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Identify the specific physical meeting point or address mentioned in this ride description: "${description}". Return only the specific address or place name. Include city/context if possible. If no specific place is mentioned, return "${defaultOrigin}".`,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    const address = response.text?.trim() || defaultOrigin;
    
    // Default to a Directions intent
    let uri = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    
    // Attempt to extract a Google Maps URI from grounding metadata if available
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as any[];
    if (chunks && chunks.length > 0) {
        for (const chunk of chunks) {
            if (chunk.maps?.uri) {
                // We prefer the direct URI if it exists, but for navigation 'dir' intent is often better for buttons.
                // However, if the model returns a specific place ID link, we can use it.
                // For this use case (Guiding passenger), a search/dir link to the text address is often safer 
                // than a potentially halluncinated specific place URI, but we trust the grounding.
                uri = chunk.maps.uri; 
                break;
            }
        }
    }

    return { address, uri };
  } catch (error) {
    console.error("Location resolution error", error);
    return { address: defaultOrigin, uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(defaultOrigin)}` };
  }
};

export const getStaticMapUrl = (address: string) => {
    if (!apiKey) return `https://picsum.photos/800/600?random=${Date.now()}`;
    // Use the API key for Static Maps
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=15&size=800x600&maptype=roadmap&markers=color:red%7C${encodeURIComponent(address)}&key=${apiKey}`;
};