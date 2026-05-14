import { 
  MATRIX, 
  L1, 
  L2, 
  V_SWAP, 
  V_CYCLE_FWD, 
  V_CYCLE_BWD, 
  SMALL_CHARS, 
  SPECIAL_PAIRS 
} from '../constants/meikoku';

export type TokenType = 'kana' | 'special' | 'other';
export type TranslationMode = 'deep' | 'echo' | 'silent' | 'whisper' | 'chaos' | 'eclipse';

export interface Token {
  type: TokenType;
  char: string;
  dakuten: string;
  smallChars: string;
  original: string;
}

const DAKUTEN = '\u3099';
const HANDAKUTEN = '\u309A';

// Extra mapping for SILENT/ECLIPSE modes:
// We use a mix of symbols and characters to avoid visible marks.
const SILENT_EXTRA_ROWS = [
  ['ア', 'イ', 'ウ', 'エ', 'オ'], 
  ['キ', 'シ', 'チ', 'ニ', 'ヒ'], 
  ['ム', 'メ', 'モ', 'ヤ', 'ユ'], 
  ['ラ', 'リ', 'ル', 'レ', 'ロ'], 
  ['ヰ', 'ヱ', 'ヲ', 'ン', 'ヴ'], 
];

const EXTENDED_MATRIX = [
  ...MATRIX,
  ...SILENT_EXTRA_ROWS
];

// Sources of voiced sounds for detection and reconstruction
const VOICED_SOURCES = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'], // 0 -> 10
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'], // 1 -> 11
  ['だ', 'ぢ', 'づ', 'で', 'ど'], // 2 -> 12
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'], // 3 -> 13
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'], // 4 -> 14
];

/**
 * カタカナをひらがなに変換
 */
export function katakanaToHiragana(src: string): string {
  if (!src) return '';
  return src.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
  });
}

/**
 * 子音のシフト（行の移動）
 */
function shiftConsonant(r: number, forward: boolean, rowSet: number[] = [...L1, ...L2]): number {
  const idx = rowSet.indexOf(r);
  if (idx !== -1) {
    return rowSet[(idx + (forward ? 1 : rowSet.length - 1)) % rowSet.length]!;
  }
  return r;
}

/**
 * 拡張された行のシフト（15行モデル）
 */
function shiftConsonantExtended(r: number, forward: boolean): number {
  // Bijective rotation of 0-14
  const rotation = [0, 10, 5, 1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9];
  const idx = rotation.indexOf(r);
  if (idx !== -1) {
    const len = rotation.length;
    return rotation[(idx + (forward ? 1 : len - 1)) % len]!;
  }
  return r;
}

/**
 * 母音のシフト（段の移動）
 */
function shiftVowel(c: number, forward: boolean, mode: TranslationMode): number {
  if (mode === 'echo' || mode === 'whisper') return c; // 段を保持
  
  if (c === 0 || c === 2) return V_SWAP[c] ?? c;
  if (c === 1 || c === 3 || c === 4) {
    return forward ? (V_CYCLE_FWD[c] ?? c) : (V_CYCLE_BWD[c] ?? c);
  }
  return c;
}

/**
 * テキストをトークン分割
 */
export function tokenize(rawText: string): Token[] {
  // 文字列の正規化（結合済みの濁点・半濁点を考慮しつつNFCで一貫性を保つ）
  const text = rawText.normalize('NFC');

  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 1. 特殊文字 (ん, っ, ゔ) 優先
    for (const [marker, result] of Object.entries(SPECIAL_PAIRS)) {
      if (text.startsWith(marker, i)) {
        tokens.push({ type: 'special', char: marker, dakuten: '', smallChars: '', original: marker });
        i += marker.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2. カナのチェック (Matrix, Extended, Voiced)
    const allKanas = [
      ...KATAKANA_LIST,
      ...HIRAGANA_LIST,
      ...MATRIX.flat(),
      ...EXTENDED_MATRIX.flat(),
      ...VOICED_SOURCES.flat()
    ];
    
    // 長い順にマッチを試みる
    const candidates = allKanas.filter(k => text.startsWith(k, i)).sort((a, b) => b.length - a.length);
    
    if (candidates.length > 0) {
      const match = candidates[0]!;
      const token: Token = { type: 'kana', char: match, dakuten: '', smallChars: '', original: match };
      i += match.length;
      
      // 付属文字
      while (i < text.length) {
        if (SMALL_CHARS.includes(text[i]!)) {
          token.smallChars += text[i];
          i++;
        } else {
          break;
        }
      }
      tokens.push(token);
      matched = true;
    }

    if (!matched) {
      tokens.push({ type: 'other', char: text[i]!, dakuten: '', smallChars: '', original: text[i]! });
      i++;
    }
  }
  return tokens;
}

const KATAKANA_LIST = Array.from({ length: 0x56 }, (_, i) => String.fromCharCode(0x30A1 + i));
const HIRAGANA_LIST = Array.from({ length: 0x53 }, (_, i) => String.fromCharCode(0x3041 + i));

/**
 * 動的なオフセットの計算（解析困難化のため）
 */
function getDynamicOffset(index: number, max: number): number {
  return (index * 13 + 7) % max;
}

/**
 * 相互翻訳の核となる論理
 */
export function translate(text: string, forward: boolean, mode: TranslationMode = 'deep'): string {
  if (!text) return '';
  const tokens = tokenize(text);
  let kanaCount = 0;
  
  return tokens.map(token => {
    if (token.type === 'special') {
      return SPECIAL_PAIRS[token.char] ?? token.char;
    }
    
    if (token.type === 'kana') {
      let r = -1, c = -1;
      let targetChar = token.char;
      
      // 座標特定
      const findInExtended = (char: string) => {
        for (let i = 0; i < 10; i++) {
          let j = MATRIX[i]!.indexOf(char);
          if (j !== -1) return { r: i, c: j };
        }
        for (let i = 0; i < VOICED_SOURCES.length; i++) {
          let j = VOICED_SOURCES[i]!.indexOf(char);
          if (j !== -1) return { r: i + 10, c: j };
        }
        for (let i = 10; i < 15; i++) {
          let j = EXTENDED_MATRIX[i]!.indexOf(char);
          if (j !== -1) return { r: i, c: j };
        }
        return null;
      };

      let coords = findInExtended(targetChar);
      if (!coords) coords = findInExtended(katakanaToHiragana(targetChar));
      
      if (coords) {
        r = coords.r;
        c = coords.c;
      }
      
      if (r !== -1 && c !== -1) {
        const isDynamic = mode === 'chaos' || mode === 'eclipse';
        const offset = isDynamic ? getDynamicOffset(kanaCount, 15) : 1;
        kanaCount++;

        if (mode === 'silent' || mode === 'whisper' || mode === 'eclipse' || mode === 'echo') {
          // 15行モデル
          const rotation = [0, 10, 5, 1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9];
          const idx = rotation.indexOf(r);
          const len = rotation.length;
          
          let newR_idx;
          if (forward) {
            newR_idx = (idx + offset) % len;
          } else {
            newR_idx = (idx - offset + len) % len;
          }
          const newR = rotation[newR_idx]!;

          const newC = shiftVowel(c, forward, mode); // Whisper/Eclipse/Echo might preserve vowel differently
          
          if (mode === 'echo') {
            // Echo mode outputs natural Hiragana (including natively voiced ones) for both directions
            if (newR < 10) return (MATRIX[newR]![newC]! + token.smallChars).normalize('NFC');
            return (VOICED_SOURCES[newR - 10]![newC]! + token.smallChars).normalize('NFC');
          } else {
            // Silent/Whisper/Eclipse mode hides marks by using EXTENDED_MATRIX (Katakana) in forward direction
            if (!forward) {
              if (newR < 10) return (MATRIX[newR]![newC]! + token.smallChars).normalize('NFC');
              return (VOICED_SOURCES[newR - 10]![newC]! + token.smallChars).normalize('NFC');
            }
            return EXTENDED_MATRIX[newR]![newC]! + token.smallChars;
          }
        } else {
          // Deep/Chaosモード
          let baseR = r;
          let mark = '';
          if (r >= 10 && r <= 13) { 
            baseR = [1, 2, 3, 5][r - 10]!; 
            mark = DAKUTEN; 
          } else if (r === 14) { 
            baseR = 5; 
            mark = HANDAKUTEN; 
          }
          
          const rowSet = [...L1, ...L2];
          const idx = rowSet.indexOf(baseR);
          const len = rowSet.length;
          
          let newR_idx;
          if (forward) {
            newR_idx = (idx + offset) % len;
          } else {
            newR_idx = (idx - offset + len) % len;
          }
          const newR = rowSet[newR_idx]!;

          const newC = shiftVowel(c, forward, mode);
          const newChar = MATRIX[newR]![newC]!;
          return (newChar + mark + token.smallChars).normalize('NFC');
        }
      }
      return token.original;
    }
    
    return token.original;
  }).join('');
}

/**
 * キャラクター変換マップの生成（監査用）
 */
export function getTransformationMap(forward: boolean, mode: TranslationMode = 'deep') {
  const map: Record<string, string> = {};
  
  if (mode === 'silent' || mode === 'whisper' || mode === 'eclipse' || mode === 'echo') {
    // 15 rows: (Base Hiragana 0-9) + (Voiced Sources 10-14)
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 5; c++) {
        const srcChar = r < 10 ? MATRIX[r]![c]! : VOICED_SOURCES[r - 10]![c]!;
        const isDynamic = mode === 'eclipse';
        const offset = isDynamic ? getDynamicOffset(0, 15) : 1; // 監査用マップはインデックス0を基準
        
        // 15行モデルでの回転
        const rotation = [0, 10, 5, 1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9];
        const idx = rotation.indexOf(r);
        const len = rotation.length;
        const newR_idx = (idx + (forward ? offset : len - offset)) % len;
        const newR = rotation[newR_idx]!;

        const newC = shiftVowel(c, forward, mode);
        const resultChar = newR < 10 ? MATRIX[newR]![newC]! : VOICED_SOURCES[newR - 10]![newC]!;
        
        if (mode === 'echo') {
           map[srcChar] = resultChar;
        } else {
           if (!forward) {
              const targetChar = EXTENDED_MATRIX[r]![c]!;
              map[targetChar] = resultChar;
           } else {
              map[srcChar] = EXTENDED_MATRIX[newR]![newC]!;
           }
        }
      }
    }
  } else {
    // 10 rows: (Base Hiragana 0-9)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 5; c++) {
        const srcChar = MATRIX[r]![c]!;
        const isDynamic = mode === 'chaos';
        const offset = isDynamic ? getDynamicOffset(0, 15) : 1; // 監査用マップはインデックス0を基準
        
        const rowSet = [...L1, ...L2];
        const idx = rowSet.indexOf(r);
        const len = rowSet.length;
        const newR_idx = (idx + (forward ? offset : len - offset)) % len;
        const newR = rowSet[newR_idx]!;

        const newC = shiftVowel(c, forward, mode);
        const newChar = MATRIX[newR]![newC]!;
        map[srcChar] = newChar;
      }
    }
  }
  
  // 特殊文字
  for (const [k, v] of Object.entries(SPECIAL_PAIRS)) {
    map[k] = v;
  }
  
  return map;
}

