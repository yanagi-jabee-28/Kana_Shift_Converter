import { 
  MATRIX, 
  L1, 
  L2, 
  V_SWAP, 
  V_CYCLE_FWD, 
  V_CYCLE_BWD, 
  SMALL_CHARS, 
  SPECIAL_PAIRS,
  NUMBERS,
  ALPHA_UPPER,
  ALPHA_LOWER
} from '../constants/meikoku';

export type TokenType = 'kana' | 'special' | 'number' | 'alpha' | 'other';
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

const SPECIAL_ROW = ['ん', 'っ', 'ゔ', 'ー', '・'];
const SILENT_SPECIAL_ROW = ['ン', 'ッ', 'ヴ', 'ー', '・'];

const EXTENDED_MATRIX = [
  ...MATRIX,
  ...SILENT_EXTRA_ROWS,
  SILENT_SPECIAL_ROW
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
  const text = rawText.normalize('NFC');
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 1. カナのチェック (Matrix, Extended, Voiced, SpecialRow)
    const allKanas = [
      ...KATAKANA_LIST,
      ...HIRAGANA_LIST,
      ...MATRIX.flat(),
      ...EXTENDED_MATRIX.flat(),
      ...VOICED_SOURCES.flat(),
      ...SPECIAL_ROW
    ];
    
    const candidates = allKanas.filter(k => text.startsWith(k, i)).sort((a, b) => b.length - a.length);
    
    if (candidates.length > 0) {
      const match = candidates[0]!;
      const token: Token = { type: 'kana', char: match, dakuten: '', smallChars: '', original: match };
      i += match.length;
      
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

    if (matched) continue;

    // 2. 数字のチェック
    if (NUMBERS.includes(text[i]!)) {
      tokens.push({ type: 'number', char: text[i]!, dakuten: '', smallChars: '', original: text[i]! });
      i++;
      matched = true;
      continue;
    }

    // 3. アルファベットのチェック
    if (ALPHA_UPPER.includes(text[i]!) || ALPHA_LOWER.includes(text[i]!)) {
      tokens.push({ type: 'alpha', char: text[i]!, dakuten: '', smallChars: '', original: text[i]! });
      i++;
      matched = true;
      continue;
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
 * 動的なオフセットの計算
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
  let transformedCount = 0;
  
  return tokens.map(token => {
    const isDynamic = mode === 'chaos' || mode === 'eclipse';
    
    if (token.type === 'number') {
      const offset = isDynamic ? getDynamicOffset(transformedCount, 15) : 1;
      transformedCount++;
      const set = NUMBERS;
      const idx = set.indexOf(token.char);
      const len = set.length;
      const newIdx = (idx + (forward ? offset : len - (offset % len))) % len;
      return set[newIdx]!;
    }

    if (token.type === 'alpha') {
      const offset = isDynamic ? getDynamicOffset(transformedCount, 15) : 1;
      transformedCount++;
      const isUpper = ALPHA_UPPER.includes(token.char);
      const set = isUpper ? ALPHA_UPPER : ALPHA_LOWER;
      const idx = set.indexOf(token.char);
      const len = set.length;
      const newIdx = (idx + (forward ? offset : len - (offset % len))) % len;
      return set[newIdx]!;
    }
    
    if (token.type === 'kana') {
      let r = -1, c = -1;
      let targetChar = token.char;
      
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
        let jSpec = SPECIAL_ROW.indexOf(char);
        if (jSpec !== -1) return { r: 15, c: jSpec };
        let jSilentSpec = SILENT_SPECIAL_ROW.indexOf(char);
        if (jSilentSpec !== -1) return { r: 15, c: jSilentSpec };
        return null;
      };

      let coords = findInExtended(targetChar);
      if (!coords) coords = findInExtended(katakanaToHiragana(targetChar));
      
      if (coords) {
        r = coords.r;
        c = coords.c;
      }
      
      if (r !== -1 && c !== -1) {
        const offset = isDynamic ? getDynamicOffset(transformedCount, 15) : 1;
        transformedCount++;

        if (mode === 'silent' || mode === 'whisper' || mode === 'eclipse' || mode === 'echo') {
          const rotation = [0, 10, 5, 15, 1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9];
          const idx = rotation.indexOf(r);
          const len = rotation.length;
          const newR_idx = (idx + (forward ? offset : len - (offset % len))) % len;
          const newR = rotation[newR_idx]!;
          const newC = shiftVowel(c, forward, mode);
          
          if (mode === 'echo') {
            if (newR < 10) return (MATRIX[newR]![newC]! + token.smallChars).normalize('NFC');
            if (newR < 15) return (VOICED_SOURCES[newR - 10]![newC]! + token.smallChars).normalize('NFC');
            return (SPECIAL_ROW[newC]! + token.smallChars).normalize('NFC');
          } else {
            if (!forward) {
              if (newR < 10) return (MATRIX[newR]![newC]! + token.smallChars).normalize('NFC');
              if (newR < 15) return (VOICED_SOURCES[newR - 10]![newC]! + token.smallChars).normalize('NFC');
              return (SPECIAL_ROW[newC]! + token.smallChars).normalize('NFC');
            }
            return EXTENDED_MATRIX[newR]![newC]! + token.smallChars;
          }
        } else {
          let baseR = r;
          let mark = '';
          if (r >= 10 && r <= 13) { baseR = [1, 2, 3, 5][r - 10]!; mark = DAKUTEN; }
          else if (r === 14) { baseR = 5; mark = HANDAKUTEN; }
          
          const rowSet = [...L1, ...L2, 15];
          const idx = rowSet.indexOf(baseR);
          const len = rowSet.length;
          const newR_idx = (idx + (forward ? offset : len - (offset % len))) % len;
          const newR = rowSet[newR_idx]!;
          const newC = shiftVowel(c, forward, mode);
          
          if (newR === 15) return (SPECIAL_ROW[newC]! + token.smallChars).normalize('NFC');
          return (MATRIX[newR]![newC]! + mark + token.smallChars).normalize('NFC');
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
    const rowLimit = mode === 'eclipse' ? 3 : 15; // Eclipseは代表のみ表示
    for (let r = 0; r < rowLimit; r++) {
      for (let c = 0; c < 5; c++) {
        const srcChar = r < 10 ? MATRIX[r]![c]! : VOICED_SOURCES[r - 10]![c]!;
        const isDynamic = mode === 'eclipse';
        const offset = isDynamic ? getDynamicOffset(0, 15) : 1;
        
        // 16行モデルでの回転
        const rotation = [0, 10, 5, 15, 1, 11, 6, 2, 12, 7, 3, 13, 8, 4, 14, 9];
        const idx = rotation.indexOf(r);
        const len = rotation.length;
        const newR_idx = (idx + (forward ? offset : len - offset)) % len;
        const newR = rotation[newR_idx]!;

        const newC = shiftVowel(c, forward, mode);
        
        let resultChar = '';
        if (newR < 10) resultChar = MATRIX[newR]![newC]!;
        else if (newR < 15) resultChar = VOICED_SOURCES[newR - 10]![newC]!;
        else resultChar = SPECIAL_ROW[newC]!;
        
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
  
  // 数字の追加
  const numLimit = mode === 'echo' ? 10 : 5;
  for (let i = 0; i < numLimit; i++) {
    const char = NUMBERS[i]!;
    const isDynamic = mode === 'eclipse' || mode === 'chaos';
    const offset = isDynamic ? getDynamicOffset(0, 15) : 1;
    const idx = NUMBERS.indexOf(char);
    const len = NUMBERS.length;
    const newIdx = (idx + (forward ? offset : len - (offset % len))) % len;
    map[char] = NUMBERS[newIdx]!;
  }

  // アルファベットの追加
  const alphaLimit = mode === 'echo' ? 15 : 5;
  for (let i = 0; i < alphaLimit; i++) {
    const char = ALPHA_UPPER[i]!;
    const isDynamic = mode === 'eclipse' || mode === 'chaos';
    const offset = isDynamic ? getDynamicOffset(0, 15) : 1;
    const idx = ALPHA_UPPER.indexOf(char);
    const len = ALPHA_UPPER.length;
    const newIdx = (idx + (forward ? offset : len - (offset % len))) % len;
    map[char] = ALPHA_UPPER[newIdx]!;
  }
  
  // 特殊文字
  for (const [k, v] of Object.entries(SPECIAL_PAIRS)) {
    map[k] = v;
  }
  
  return map;
}


/**
 * 翻訳の整合性（全単射性）を検証する
 */
export function verifyBijectivity(text: string, mode: TranslationMode): {
  ok: boolean;
  forward: string;
  backward: string;
  diffIdx: number;
} {
  const forward = translate(text, true, mode);
  const backward = translate(forward, false, mode);
  
  let ok = true;
  let diffIdx = -1;
  
  // 文字列の正規化（比較のため）
  const originalNorm = text.normalize('NFC');
  const backwardNorm = backward.normalize('NFC');

  if (originalNorm !== backwardNorm) {
    ok = false;
    for (let i = 0; i < Math.max(originalNorm.length, backwardNorm.length); i++) {
      if (originalNorm[i] !== backwardNorm[i]) {
        diffIdx = i;
        break;
      }
    }
  }
  
  return { ok, forward, backward, diffIdx };
}
