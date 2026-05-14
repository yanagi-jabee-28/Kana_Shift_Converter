import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function convertToKanaReading(text: string): Promise<string> {
  if (!text) return text;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `以下の日本語テキストの「読み」を全てひらがなで出力してください。漢字はすべてひらがなに開き、カタカナもひらがなに変換してください。句読点や記号はそのままで構いません。ルビや括弧書きなどの説明は一切省略し、変換後のテキストのみを出力してください。\n\nテキスト: ${text}`,
      config: {
        systemInstruction: "あなたは入力されたテキストの読みをひらがなで返すだけのプログラムです。余計な説明や挨拶は絶対に行わないでください。",
      }
    });
    return response.text?.trim() || text;
  } catch (err) {
    console.error("Gemini API Error:", err);
    return text;
  }
}
