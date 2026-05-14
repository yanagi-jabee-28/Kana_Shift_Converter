import { GoogleGenAI } from "@google/genai";
import * as wanakana from 'wanakana';

// Types
export type ConversionEngine = 'celestial' | 'terrestrial' | 'none';

export interface ConversionStatus {
  engine: ConversionEngine;
  isLoading: boolean;
  error?: string;
}

import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

// Global state for Kuroshiro
let kuroshiroInstance: any = null;
let isInitializing = false;
let initFailed = false;

/**
 * Initialize Kuroshiro and load Kuromoji dictionary
 */
async function initKuroshiro() {
  if (kuroshiroInstance !== null) return kuroshiroInstance;
  if (initFailed) return null; // Prevent retry loops
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return kuroshiroInstance;
  }

  isInitializing = true;
  try {
    const kuroshiro = new Kuroshiro();
    const baseUrl = (import.meta as any).env.BASE_URL || '/';
    // Kuromoji needs the path to the dictionary directory containing .dat.gz files
    const dictPath = `${baseUrl}dict/`;
    
    await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
    kuroshiroInstance = kuroshiro;
    return kuroshiroInstance;
  } catch (err) {
    console.warn("Terrestrial Mode (Kuroshiro) is disabled due to initialization failure. Kanji will not be analyzed.", err);
    initFailed = true;
    kuroshiroInstance = null;
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

  const ai = new GoogleGenAI({ apiKey });
  
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
 * Convert text to Kana reading using Kuroshiro (Terrestrial Mode)
 */
async function convertWithKuroshiro(text: string): Promise<string> {
  const kuroshiro = await initKuroshiro();
  if (!kuroshiro) {
    throw new Error('Kuroshiro engine not available (Dictionary missing or incompatible)');
  }
  
  // Convert to hiragana
  const reading = await kuroshiro.convert(text, { to: 'hiragana' });
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
    
    // Fallback to Kuroshiro
    try {
      onStatusChange?.({ engine: 'terrestrial', isLoading: true });
      const result = await convertWithKuroshiro(text);
      onStatusChange?.({ engine: 'terrestrial', isLoading: false });
      return result;
    } catch (fallbackErr) {
      // Avoid excessive error logging on every keystroke if Kuroshiro is already known to be broken
      if (initFailed) {
        // Just fail silently if we already know Kuroshiro isn't loaded
      } else {
        console.error("Terrestrial backup failed:", fallbackErr);
      }
      
      onStatusChange?.({ engine: 'none', isLoading: false, error: 'Conversion engines unavailable. Using raw text.' });
      return wanakana.toHiragana(text);
    }
  }
}
