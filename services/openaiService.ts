
import { GPTIntentResponse } from '../types';

export const transcribeAudio = async (audioBlob: Blob, apiKey: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-1");
  formData.append("language", "zh"); // Hint to transcribe in Traditional Chinese

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
        const errorBody = await response.json();
        if (errorBody.error && errorBody.error.message) {
            errorMessage = errorBody.error.message;
        }
    } catch (e) {
        // If JSON parsing fails, stick to statusText or status code
    }
    throw new Error(`Whisper API Error: ${errorMessage || response.status}`);
  }

  const data = await response.json();
  return data.text;
};

export const determineIntent = async (userText: string, apiKey: string): Promise<GPTIntentResponse> => {
  // Get current time in Taiwan
  const now = new Date();
  const taiwanTime = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour12: false });
  const taiwanDayOfWeek = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', weekday: 'long' });

  const systemPrompt = `
  You are a helpful assistant for Taiwanese elders. 
  Current Time in Taiwan: ${taiwanTime} (${taiwanDayOfWeek}).
  Analyze the user's input and determine the intent: "traffic", "memo", or "chat".
  
  Response Format: JSON ONLY.
  
  Rules:
  1. Reply field must be in Traditional Chinese (zh-TW), warm and polite.
  2. **Language Localization Rule**: When mentioning transport, ALWAYS use Taiwanese common terms:
     - Use "高鐵" (HSR) instead of "高速火車".
     - Use "捷運" (MRT) instead of "地下鐵".
     - Use "公車" instead of "巴士".
  3. If Intent is 'traffic': 
     - extract 'origin' and 'destination'. If unknown, infer from context or use "unknown".
     - extract 'preferred_mode': 
       - If user explicitly mentions "Train" (火車), "HSR" (高鐵), "Rail" (鐵路), set to "TRAIN".
       - If user explicitly mentions "Bus" (公車/客運), set to "BUS".
       - If user explicitly mentions "MRT" (捷運/地鐵), set to "SUBWAY".
       - If unspecified, set to null.
     - extract 'departure_time':
       - If user says "now" or implies immediate departure, set to "now".
       - If user specifies a time (e.g. "5 PM", "tomorrow morning"), calculate the absolute ISO 8601 Date String based on Current Taiwan Time. 
         Example: If Taiwan time is 2023-10-27 10:00 and user says "tomorrow 1pm", output "2023-10-28T13:00:00".
  4. If Intent is 'memo': extract the core 'memo_content'.
  
  Example JSON:
  {
    "intent": "traffic",
    "reply": "好喔，我幫您查去台北的火車。",
    "origin": "台中",
    "destination": "台北",
    "preferred_mode": "TRAIN",
    "departure_time": "2023-10-27T17:00:00"
  }
  `;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
        const errorBody = await response.json();
        if (errorBody.error && errorBody.error.message) {
            errorMessage = errorBody.error.message;
        }
    } catch (e) {
        // Ignore JSON errors
    }
    throw new Error(`GPT API Error: ${errorMessage || response.status}`);
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    throw new Error("Failed to parse AI response");
  }
};