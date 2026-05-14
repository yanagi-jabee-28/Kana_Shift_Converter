<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 冥刻翻訳碑 | Meikoku Shift

日本語の読みを解析し、状況に応じて「Celestial（Gemini API）」と「Terrestrial（Kuroshiro/Kuromoji）」を使い分けるハイブリッド変換エンジン。

- **Live Demo:** [https://yanagi-jabee-28.github.io/Kana_Shift_Converter/](https://yanagi-jabee-28.github.io/Kana_Shift_Converter/)
- **Repository:** [https://github.com/yanagi-jabee-28/Kana_Shift_Converter](https://github.com/yanagi-jabee-28/Kana_Shift_Converter)

## Project Information
このプロジェクトは、オフライン環境下での動作を保証しつつ、ネットワーク接続時には高精度なAI変換を提供する「堅牢な日本語処理」をテーマに構築されています。
内部構造の詳細は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照してください。

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
