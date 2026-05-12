const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;


/**
 * Standard TTS Generation
 */
export async function generateSpeech(text: string, voiceId: string = "pNInz6obpgDQGcFmaJgB") {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) throw new Error("ElevenLabs API error");
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("ElevenLabs TTS Error:", error);
    return null;
  }
}

/**
 * Helper to get the conversation URL for the widget/SDK
 * Note: For the most advanced "Call" feel, we'll use the @elevenlabs/elevenlabs-js SDK
 * in the component directly.
 */
export const getAgentId = () => import.meta.env.VITE_ELEVENLABS_AGENT_ID;
