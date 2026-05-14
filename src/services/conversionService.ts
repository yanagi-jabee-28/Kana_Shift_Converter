import { GoogleGenAI } from "@google/genai";
import * as wanakana from 'wanakana';

// Types
export type ConversionEngine = 'celestial' | 'terrestrial' | 'none';

export interface ConversionStatus {
  engine: ConversionEngine;
  isLoading: boolean;
  error?: string;
}

// Global state for Sudachi
let sudachiInstance: any = null;
let isInitializing = false;

/**
 * Initialize Sudachi-WASM and load dictionary
 */
async function initSudachi() {
  if (sudachiInstance !== null) return sudachiInstance;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return sudachiInstance;
  }

  isInitializing = true;
  try {
    // Import the WASM glue code
    const { default: init, loadDictionary } = await import('@f3liz/sudachi-wasm');
    
    // Initialize WASM with the modern object-based signature
    await init({ module_or_path: '/sudachi/sudachi_wasm_bg.wasm' });
    
    // Fetch and load dictionary
    const dicPath = '/sudachi/system_small.dic';
    const dicResponse = await fetch(dicPath);
    if (!dicResponse.ok) {
      throw new Error(`Failed to fetch Sudachi dictionary from ${dicPath} (Status: ${dicResponse.status})`);
    }
    
    const dicData = await dicResponse.arrayBuffer();
    if (dicData.byteLength === 0) {
      throw new Error('Fetched Sudachi dictionary is empty');
    }
    
    // Note: sudachi-wasm (Rust implementation) usually expects .xdic format.
    // If system_small.dic is in standard Java-Sudachi format, this may throw "unreachable".
    try {
      sudachiInstance = loadDictionary(new Uint8Array(dicData));
    } catch (loadErr) {
      // Log specific error but don't crash the whole service initialization
      console.error("Critical: loadDictionary failed. This often means the .dic file is incompatible with sudachi-wasm (needs .xdic format).", loadErr);
      sudachiInstance = null;
      throw loadErr;
    }
    
    return sudachiInstance;
  } catch (err) {
    console.warn("Sudachi (Terrestrial) initialization failed. Offline Kanji analysis will be unavailable.", err);
    isInitializing = false;
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Convert text to Kana reading using Gemini API (Celestial Mode)
 */
async function convertWithGemini(text: string): Promise<string> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error('API key not configured. Please set VITE_GEMINI_API_KEY in .env');
  }

  const ai = new GoogleGenAI(apiKey);
  
  // New Unified SDK API (@google/genai v1.0.0+)
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ parts: [{ text }] }],
    config: {
      systemInstruction: "あなたは入力された日本語テキストの読みをすべてひらがなで返すだけのプログラムです。余計な説明や挨拶は一切行わないでください。カタカナもすべてひらがなに変換してください。"
    }
  });

  // Access content using the new structure
  return response.text?.trim() || text;
}

/**
 * Convert text to Kana reading using Sudachi-WASM (Terrestrial Mode)
 */
async function convertWithSudachi(text: string): Promise<string> {
  const handle = await initSudachi();
  if (!handle) {
    throw new Error('Sudachi engine not available (Dictionary missing or incompatible)');
  }
  const { tokenize } = await import('@f3liz/sudachi-wasm');
  
  // tokenize(handle, text, mode)
  // mode: 0 = Mode A (short), 1 = Mode B (middle), 2 = Mode C (long)
  const tokens = tokenize(handle, text, 0);
  
  let reading = '';
  for (const t of tokens) {
    // Properties, not methods
    const r = t.reading; 
    if (r && r !== '*') {
      reading += wanakana.toHiragana(r);
    } else {
      reading += wanakana.toHiragana(t.surface);
    }
  }
  return reading;
}

/**
 * Main conversion function with failover logic
 */
export async function convertToKanaReading(
  text: string, 
  onStatusChange?: (status: ConversionStatus) => void
): Promise<string> {
  if (!text.trim()) return text;

  // Try Gemini first
  try {
    onStatusChange?.({ engine: 'celestial', isLoading: true });
    const result = await convertWithGemini(text);
    onStatusChange?.({ engine: 'celestial', isLoading: false });
    return result;
  } catch (err) {
    console.warn("Celestial connection lost, falling back to Terrestrial mode...", err);
    
    // Fallback to Sudachi
    try {
      onStatusChange?.({ engine: 'terrestrial', isLoading: true });
      const result = await convertWithSudachi(text);
      onStatusChange?.({ engine: 'terrestrial', isLoading: false });
      return result;
    } catch (fallbackErr) {
      console.error("Terrestrial backup failed:", fallbackErr);
      
      // Final fallback: Just convert existing Kana and leave Kanji as is
      // This is better than returning nothing or crashing.
      onStatusChange?.({ engine: 'none', isLoading: false, error: 'Conversion engines unavailable. Using raw text.' });
      return wanakana.toHiragana(text);
    }
  }
}
