// --- App State Types ---

export interface ApiKeys {
    openai: string;
    taigi: string; // Unified key for Translation and TTS
    googleMaps: string;
  }
  
  export interface Memo {
    id: number;
    content: string;
    timestamp: number;
    displayTime: string;
  }
  
  export interface TrafficStep {
    type: 'TRANSIT' | 'WALK' | 'OTHER';
    instructions: string; // HTML string from Google Maps
    distance: string;
    duration: string;
    vehicle?: string; // e.g., "Bus 307" or "Train"
    transitDetails?: {
        lineName: string; // e.g., "自強號"
        headsign: string; // e.g., "往 台東"
        numStops: number;
    };
    exitInfo?: string; // e.g., "M3 出口"
  }
  
  export interface TrafficResult {
    origin: string;
    destination: string;
    totalDuration: string;
    steps: TrafficStep[];
    // New Rich Fields
    departureTime?: string; // e.g., "17:00"
    arrivalTime?: string;   // e.g., "20:30"
    fare?: string;          // e.g., "$500"
    mainVehicle?: string;   // Summary for TTS, e.g., "自強號"
    bestExit?: string;      // Summary exit for TTS
  }
  
  export type AppView = 'home' | 'traffic' | 'memo';
  export type ProcessingState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'translating' | 'speaking';
  
  // --- OpenAI Types ---
  
  export interface GPTIntentResponse {
    intent: 'traffic' | 'memo' | 'chat';
    reply: string; // The text to be spoken (Chinese)
    // For traffic
    origin?: string;
    destination?: string;
    departure_time?: string; // "now" or ISO date string
    preferred_mode?: 'TRAIN' | 'BUS' | 'SUBWAY'; // New: Extract preference
    // For memo
    memo_content?: string;
  }
  
  // --- Taigi API Types ---
  
  export interface TaigiTranslateResponse {
    outputText: string;
    tokens: number;
    taiwaneseInvolved: boolean;
  }
  
  export interface TaigiTTSResponse {
    converted_audio_url: string;
  }