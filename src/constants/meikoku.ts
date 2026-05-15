/**
 * 冥刻語 数学的変換マトリクス
 */
export const MATRIX: string[][] = [
  ['あ', 'い', 'う', 'え', 'お'], // 0
  ['か', 'き', 'く', 'け', 'こ'], // 1
  ['さ', 'し', 'す', 'せ', 'そ'], // 2
  ['た', 'ち', 'つ', 'て', 'と'], // 3
  ['な', 'に', 'ぬ', 'ね', 'の'], // 4
  ['は', 'ひ', 'ふ', 'へ', 'ほ'], // 5
  ['ま', 'み', 'む', 'め', 'も'], // 6
  ['や', 'やぃ', 'ゆ', 'やぇ', 'よ'], // 7
  ['ら', 'り', 'る', 'れ', 'ろ'], // 8
  ['わ', 'ゐ', 'わぅ', 'ゑ', 'を']  // 9
];

export const L1 = [0, 4, 8, 2, 6];
export const L2 = [1, 5, 9, 3, 7];

export const V_SWAP: Record<number, number> = { 0: 2, 2: 0 };
export const V_CYCLE_FWD: Record<number, number> = { 1: 4, 4: 3, 3: 1 };
export const V_CYCLE_BWD: Record<number, number> = { 1: 3, 3: 4, 4: 1 };

export const SMALL_CHARS = ['ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', 'ゅ', 'ょ', 'ゎ'];

export const SPECIAL_PAIRS: Record<string, string> = {
  'ん': 'ゔ',
  'ゔ': 'ん',
  'っ': 'が',
  'が': 'っ'
};
export const NUMBERS = '0123456789';
export const ALPHA_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const ALPHA_LOWER = 'abcdefghijklmnopqrstuvwxyz';
