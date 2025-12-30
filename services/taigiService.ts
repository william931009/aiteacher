import { TAIGI_ENDPOINTS, TAIGI_CONFIG } from '../constants';
import { TaigiTranslateResponse, TaigiTTSResponse } from '../types';

/**
 * Step 1: Translate Traditional Chinese to Taigi
 */
export const translateToTaigi = async (text: string, apiKey: string): Promise<string> => {
  try {
    const response = await fetch(TAIGI_ENDPOINTS.TRANSLATE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        inputText: text,
        inputLan: "zhtw",
        outputLan: "tw"
      })
    });

    if (!response.ok) {
        // Handle specific Taigi error codes if needed
        const err = await response.text();
        console.error("Taigi Translate Error:", err);
        throw new Error(`Taigi Translation Failed: ${response.status}`);
    }

    const data: TaigiTranslateResponse = await response.json();
    return data.outputText;
  } catch (error) {
    console.error("Translation logic error", error);
    // Fallback: If translation fails, return original text so TTS attempts to read it (though it might sound weird)
    return text;
  }
};

/**
 * Step 2: Convert Taigi Text to Speech
 * Enforces Model 7 as requested.
 */
export const generateTaigiAudio = async (taigiText: string, apiKey: string): Promise<string> => {
  const response = await fetch(TAIGI_ENDPOINTS.TTS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      text: taigiText,
      model: TAIGI_CONFIG.MODEL,
      voice_label: TAIGI_CONFIG.VOICE_LABEL,
      // Optional parameters
      speed: 1.0
    })
  });

  if (!response.ok) {
     const err = await response.text();
     console.error("Taigi TTS Error:", err);
     throw new Error(`Taigi TTS Failed: ${response.status}`);
  }

  const data: TaigiTTSResponse = await response.json();
  return data.converted_audio_url;
};

/**
 * Orchestrator: Chinese Text -> Taigi Text -> Audio URL
 */
export const getTaigiVoiceUrl = async (chineseText: string, apiKey: string): Promise<string> => {
    // 1. Translate
    const taigiText = await translateToTaigi(chineseText, apiKey);
    
    // 2. TTS
    const audioUrl = await generateTaigiAudio(taigiText, apiKey);
    
    return audioUrl;
};
