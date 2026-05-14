import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeftRight, 
  Copy, 
  Trash2, 
  ChevronDown, 
  ShieldCheck,
  Check,
  RotateCw,
  History,
  Keyboard,
  Clipboard,
  Share2,
  X,
  Link2
} from 'lucide-react';
import { translate, getTransformationMap, katakanaToHiragana, TranslationMode } from './lib/meikoku-engine';
import { convertToKanaReading, ConversionStatus } from './services/conversionService';

// --- Types ---

interface HistoryItem {
  id: string;
  input: string;
  output: string;
  direction: 'jp2mk' | 'mk2jp';
  mode: TranslationMode;
  timestamp: number;
}

// --- Components ---

const Header = () => (
  <motion.header 
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 mt-2 text-center px-4"
  >
    <div className="inline-block relative">
      <h1 className="text-2xl md:text-3xl font-bold tracking-[0.4em] font-serif text-transparent bg-clip-text bg-gradient-to-r from-emerald-800 via-emerald-300 to-emerald-800 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] uppercase">
        冥刻翻訳碑
      </h1>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent mt-2" />
    </div>
  </motion.header>
);

const CharacterAudit = ({ direction, mode }: { direction: 'jp2mk' | 'mk2jp', mode: TranslationMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isJpToMk = direction === 'jp2mk';
  const transMap = useMemo(() => getTransformationMap(isJpToMk, mode), [isJpToMk, mode]);
  
  return (
    <div className="w-full max-w-3xl px-4 mt-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-[10px] text-emerald-800 hover:text-emerald-500 transition-colors tracking-[0.2em] font-bold border border-emerald-900/30 rounded-lg bg-emerald-950/10"
      >
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" />
          数学的一意性の監査 (BIJECTIVE AUDIT: {mode.toUpperCase()})
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden glass-morphism rounded-b-lg border-t-0 p-4"
          >
            <p className="text-[10px] text-emerald-700 mb-4 leading-relaxed">
              {mode === 'deep' && '深淵変換: 子音と母音を共に回転させ、原義を深淵へ埋没させます。'}
              {mode === 'echo' && '残響変換: 母音の段を保持しつつ子音のみを回転。発音の響きが幽かに残ります。'}
              {mode === 'chaos' && '渾沌変換: 文脈依存の動的シフト。同じ文字でも位置により変換先が変わり、解析を困難にします。'}
              {mode === 'silent' && '沈黙変換: 濁点・半濁点を行列へ吸収。記号の露出を抑えた高度な隠蔽型です。'}
              {mode === 'whisper' && '幽玄変換: 記号を隠蔽しつつ母音を保持。暗号性と可読性の幽かな均衡を保ちます。'}
              {mode === 'eclipse' && '蝕変換: 記号隠蔽と動的シフトの融合。秩序ある無秩序が、法則の発見を拒絶します。'}
            </p>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(transMap).slice(0, 18).map(([src, dest]) => (
                <div key={src} className="flex flex-col items-center p-2 bg-black/20 rounded border border-emerald-900/10">
                  <span className="text-[10px] text-emerald-900">{src}</span>
                  <div className="h-px w-2 bg-emerald-900 my-1" />
                  <span className="text-xs text-emerald-400 font-bold">{dest}</span>
                </div>
              ))}
              <div className="flex flex-col items-center p-2 bg-emerald-900/10 rounded border border-emerald-400/20 col-span-2">
                 <span className="text-[8px] text-emerald-300 font-bold mb-1">
                   {mode === 'silent' ? '吸収監査: ぱ' : '半濁音 監査: ぱ'}
                 </span>
                 <div className="flex items-center gap-2">
                   <span className="text-xs text-emerald-900">ぱ</span>
                   <ArrowLeftRight className="w-2 h-2 text-emerald-700" />
                   <span className="text-xs text-emerald-400 font-bold">{translate('ぱ', isJpToMk, mode)}</span>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [direction, setDirection] = useState<'jp2mk' | 'mk2jp'>('jp2mk');
  const [mode, setMode] = useState<TranslationMode>('deep');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>({ engine: 'none', isLoading: false });

  const [pasteError, setPasteError] = useState(false);

  // Load initial state from URL and history from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlInput = params.get('t');
    const urlMode = params.get('m') as TranslationMode;
    const urlDir = params.get('d') as 'jp2mk' | 'mk2jp';

    if (urlInput) {
      setInput(urlInput);
      // Auto translate after a small delay to ensure mode/dir are set
      setTimeout(() => {
        handleTranslate();
      }, 500);
    }
    if (urlMode && ['deep', 'echo', 'silent', 'whisper', 'chaos', 'eclipse'].includes(urlMode)) setMode(urlMode);
    if (urlDir && ['jp2mk', 'mk2jp'].includes(urlDir)) setDirection(urlDir);

    const saved = localStorage.getItem('meikoku_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history');
      }
    }
  }, []);

  const handleShareLink = () => {
    const params = new URLSearchParams();
    if (input) params.set('t', input);
    params.set('m', mode);
    params.set('d', direction);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const saveHistory = useCallback((item: HistoryItem) => {
    const newHistory = [item, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('meikoku_history', JSON.stringify(newHistory));
  }, [history]);

  const handleTranslate = useCallback(async () => {
    if (!input.trim()) return;
    
    setIsTranslating(true);
    
    try {
      let translated = '';
      if (direction === 'jp2mk') {
        const kanaText = await convertToKanaReading(input, setConversionStatus);
        const phoneticText = katakanaToHiragana(kanaText);
        translated = translate(phoneticText, true, mode);
      } else {
        translated = translate(input, false, mode);
      }
      
      setOutput(translated);
      
      saveHistory({
        id: Math.random().toString(36).substr(2, 9),
        input,
        output: translated,
        direction,
        mode,
        timestamp: Date.now()
      });
    } finally {
      setIsTranslating(false);
    }
  }, [input, direction, mode, saveHistory]);


  const handleSwap = () => {
    setDirection(prev => prev === 'jp2mk' ? 'mk2jp' : 'jp2mk');
    setInput(output);
    setOutput(input);
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setPasteError(false);
    } catch (err) {
      console.error('Failed to read clipboard', err);
      setPasteError(true);
      setTimeout(() => setPasteError(false), 3000);
    }
  };

  const handleShare = async () => {
    if (!output) return;
    try {
      await navigator.share({
        title: '冥刻翻訳',
        text: output,
      });
    } catch (err) {
      // Fallback if share is not supported
      handleCopy();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleTranslate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTranslate]);

  const isJpToMk = direction === 'jp2mk';

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#050807] selection:bg-emerald-900/50">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-emerald-900/5 blur-[100px] rounded-full animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] bg-emerald-900/5 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <Header />

      <main className="w-full max-w-2xl px-3 md:px-6 flex flex-col gap-4">
        
        {/* Status Bar */}
        <div className="flex justify-between items-center px-4 py-2 glass-morphism rounded-full h-10">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-tighter font-mono text-emerald-800">
              {conversionStatus.isLoading ? '同期中...' : '冥刻同期完了'}
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-900/20">
               <div className={`w-1 h-1 rounded-full ${conversionStatus.engine === 'celestial' ? 'bg-emerald-400 animate-pulse' : conversionStatus.engine === 'terrestrial' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-900'}`} />
               <span className="text-[7px] font-mono text-emerald-700 uppercase tracking-widest">
                 {conversionStatus.engine === 'celestial' ? 'Celestial' : conversionStatus.engine === 'terrestrial' ? 'Terrestrial' : 'Idle'}
               </span>
            </div>
            <div className="group relative">
              <Keyboard className="w-3 h-3 text-emerald-900 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 text-[9px] text-emerald-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                {conversionStatus.engine === 'terrestrial' 
                  ? '地上書庫（Sudachi-WASM）が漢字を解析し、ひらがなに開いてから冥刻へ変換します。' 
                  : conversionStatus.engine === 'celestial'
                  ? '高位知能機構（Gemini）が漢字の読みを自動推測し、ひらがなに開いてから冥刻へ変換します。'
                  : '【警告】現在、漢字の読み解析が利用できません。漢字は変換されずにそのまま出力されます。解析にはGemini APIキーまたは互換性のあるSudachi辞書（.xdic）が必要です。'}
              </div>
            </div>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] uppercase tracking-tighter font-mono text-emerald-800 hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <History className="w-3 h-3" />
            過去の記録
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1 p-1 glass-morphism rounded-2xl">
          {[
            { id: 'deep', label: '深淵 (DEEP)', desc: 'C+V Shift' },
            { id: 'echo', label: '残響 (ECHO)', desc: 'C Only' },
            { id: 'chaos', label: '渾沌 (CHAOS)', desc: 'Dynamic C+V' },
            { id: 'silent', label: '沈黙 (SILENT)', desc: 'Fixed Proxies' },
            { id: 'whisper', label: '幽玄 (WHISPER)', desc: 'C Only' },
            { id: 'eclipse', label: '蝕 (ECLIPSE)', desc: 'Dynamic Proxies' }
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as TranslationMode)}
              className={`py-2.5 px-1 rounded-xl transition-all relative overflow-hidden group ${
                mode === m.id 
                  ? 'bg-emerald-900/40 text-emerald-100 border border-emerald-500/30' 
                  : 'text-emerald-900 hover:bg-emerald-900/10 border border-transparent'
              }`}
            >
              <div className="relative z-10">
                <div className="text-[9px] font-bold tracking-wider mb-0.5">{m.label}</div>
                <div className="text-[7px] opacity-60 font-mono italic whitespace-nowrap">{m.desc}</div>
              </div>
              {mode === m.id && (
                <motion.div 
                  layoutId="activeMode"
                  className="absolute inset-0 bg-emerald-500/10 -z-0"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Translator Unit */}
        <div className="flex flex-col glass-morphism rounded-3xl overflow-hidden relative">
          
          {/* Header Action Bar */}
          <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
            <div className={`flex-1 text-center text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${isJpToMk ? 'text-emerald-300' : 'text-emerald-900'}`}>
              {isJpToMk ? '現世' : '冥刻'}
            </div>
            <button 
              onClick={handleSwap}
              className="p-3 rounded-full bg-emerald-900/20 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
            >
              <ArrowLeftRight className={`w-4 h-4 transition-transform duration-500 ${isJpToMk ? '' : 'rotate-180'}`} />
            </button>
            <div className={`flex-1 text-center text-[10px] font-bold tracking-[0.3em] uppercase transition-all ${!isJpToMk ? 'text-emerald-300' : 'text-emerald-900'}`}>
              {!isJpToMk ? '現世' : '冥刻'}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6">
             <div className="flex justify-between items-center mb-3">
               <div className="flex items-center gap-2">
                 <div className="text-[9px] text-emerald-800 uppercase tracking-widest font-mono">Input Module</div>
                 <div className="text-[8px] text-emerald-900/60 font-mono">({input.length} chars)</div>
               </div>
               <div className="flex items-center gap-3">
                 <div className="relative flex items-center">
                   <button 
                     onClick={handlePaste} 
                     title="Paste from clipboard"
                     className={`transition-colors ${pasteError ? 'text-red-500' : 'text-emerald-800 hover:text-emerald-500'}`}
                   >
                     <Clipboard className="w-3.5 h-3.5" />
                   </button>
                   {pasteError && (
                     <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-black/95 border border-red-900/30 text-[9px] text-red-400 rounded-lg whitespace-normal text-left z-50 shadow-xl">
                       自動ペーストが拒否されました。<br/>キーボード(Ctrl+V / Cmd+V)で貼り付けてください。
                     </div>
                   )}
                 </div>
                 {input && (
                   <button 
                     onClick={() => { setInput(''); setOutput(''); }} 
                     title="Clear all"
                     className="text-emerald-800 hover:text-red-900 transition-colors"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 )}
               </div>
             </div>
             <textarea
               className="w-full h-32 md:h-40 bg-transparent text-xl md:text-2xl text-emerald-50 font-serif placeholder-emerald-900/30 focus:outline-none resize-none leading-relaxed"
               placeholder={isJpToMk ? "言葉を捧ぐ..." : "深鳴を解く..."}
               value={input}
               onChange={(e) => setInput(e.target.value)}
             />
          </div>

          {/* Ritual Button */}
          <div className="px-6 pb-6">
            <button 
              onClick={handleTranslate}
              disabled={!input.trim() || isTranslating}
              className={`w-full py-5 rounded-2xl font-bold tracking-[0.5em] text-xs md:text-sm transition-all relative overflow-hidden flex items-center justify-center gap-3
                ${(!input.trim() || isTranslating) 
                  ? 'bg-emerald-950/20 text-emerald-900 border border-emerald-900/30 cursor-not-allowed opacity-40' 
                  : 'bg-emerald-800/40 hover:bg-emerald-700/60 text-emerald-100 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] active:scale-[0.98]'}`}
            >
              <AnimatePresence mode="wait">
                {isTranslating ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>奏上中...</span>
                  </motion.div>
                ) : (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {isJpToMk ? '深淵へ抽出' : '光彩へ還元'}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Output Area */}
          <div className="p-6 bg-black/30 border-t border-white/5 min-h-[10rem]">
            <div className="flex justify-between items-center mb-4">
               <div className="text-[9px] text-emerald-900 uppercase tracking-widest font-mono">Result Module</div>
               <div className="flex items-center gap-1">
                 <button 
                   onClick={handleShareLink}
                   title="Copy permanent link to this translation"
                   className="p-2 rounded-lg text-emerald-700 hover:text-emerald-100 transition-all"
                 >
                   <Link2 className="w-3.5 h-3.5" />
                 </button>
                 <button 
                   onClick={handleShare}
                   disabled={!output}
                   className={`p-2 rounded-lg transition-all ${output ? 'text-emerald-600 hover:text-emerald-100' : 'text-emerald-900/40 cursor-not-allowed'}`}
                 >
                   <Share2 className="w-3.5 h-3.5" />
                 </button>
                 <button 
                   onClick={handleCopy} 
                   disabled={!output}
                   className={`p-2 rounded-lg transition-all ${output ? 'text-emerald-500 hover:text-emerald-100' : 'text-emerald-900/40 cursor-not-allowed'}`}
                 >
                   {copyFeedback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                 </button>
               </div>
            </div>
            <div className={`text-xl md:text-2xl font-serif leading-relaxed ${output ? 'text-emerald-200' : 'text-emerald-900/20 italic'}`}>
              {output || "結果の断片がここに現れる..."}
            </div>
          </div>
        </div>

        {/* Quick Audit / Info */}
        <CharacterAudit direction={direction} mode={mode} />

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="glass-morphism rounded-2xl p-4 mt-2"
            >
              <div className="text-[10px] text-emerald-700 font-bold tracking-widest mb-3 uppercase flex items-center gap-2">
                <History className="w-3 h-3" />
                過去の儀式履歴 (LATEST 10)
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="text-[10px] text-emerald-900 italic p-4 text-center">記録されていません</div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-black/40 rounded-xl border border-white/5 cursor-pointer hover:border-emerald-500/30 transition-all group"
                      onClick={() => { setInput(item.input); setOutput(item.output); setDirection(item.direction); }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] text-emerald-900 font-mono italic">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                        <div className={`text-[8px] px-1.5 py-0.5 rounded flex gap-1 ${item.direction === 'jp2mk' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          <span>{item.direction === 'jp2mk' ? 'JP->MK' : 'MK->JP'}</span>
                          <span className="opacity-40">|</span>
                          <span className="uppercase">{item.mode || 'DEEP'}</span>
                        </div>
                      </div>
                      <div className="text-xs text-emerald-300 truncate font-serif">{item.output}</div>
                    </div>
                  ))
                )}
              </div>
              {history.length > 0 && (
                <button 
                  onClick={() => { setHistory([]); localStorage.removeItem('meikoku_history'); }}
                  className="w-full mt-4 py-2 text-[9px] text-red-900 hover:text-red-500 transition-colors uppercase tracking-[0.2em]"
                >
                  全ての記録を刻印から消去
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-12 pb-8 text-center px-4">
        <p className="text-[9px] text-emerald-900 font-mono tracking-wider uppercase max-w-sm mx-auto leading-relaxed">
          The transformation preserves topological invariants through mathematical matrix rotation.<br />
          Optimized for one-hand precision rituals.
        </p>
      </footer>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
