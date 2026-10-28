/**
 * Device voices for the guided tour (Web Speech API). Nothing is downloaded or sent anywhere.
 * Browsers load voices after the page opens, so we wait for them; browsers do not say whether a voice is
 * female or male, so we infer it from the voice name and let the user correct it.
 */
export type Gender = 'female' | 'male';
export type TourLang = 'en' | 'tl' | 'zh';

const FEMALE = ['female', 'woman', 'zira', 'hazel', 'susan', 'heera', 'catherine', 'linda', 'eva', 'aria', 'jenny', 'michelle', 'emma', 'sonia', 'libby', 'natasha', 'clara',
  'rosa', 'blessica', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'allison', 'ava', 'kate', 'serena', 'nicky', 'salli', 'kimberly', 'ivy', 'kendra', 'joanna',
  'xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'hanhan', 'tingting', 'ting-ting', 'meijia', 'mei-jia', 'sinji', 'sin-ji', 'hiumaan', 'hiugaai', 'xiaochen', 'xiaohan', 'xiaomo', 'xiaorui', 'xiaoxuan', 'xiaoyan', 'yating', 'hanhan', 'amber', 'ashley', 'cora', 'elizabeth', 'jane', 'nancy', 'sara', 'luna', 'neerja', 'leah', 'yan'];
const MALE = ['male', 'david', 'mark', 'george', 'ravi', 'guy', 'ryan', 'christopher', 'eric', 'roger', 'steffan', 'brian', 'thomas', 'james', 'angelo', 'alex', 'daniel', 'fred',
  'rishi', 'aaron', 'arthur', 'gordon', 'oliver', 'reed', 'rocko', 'grandpa', 'eddy', 'yunxi', 'yunyang', 'yunjian', 'yunye', 'yunfeng', 'yunhao', 'yunze', 'kangkang', 'zhiwei', 'wanlung', 'joey', 'justin', 'matthew', 'russell', 'kevin', 'andrew', 'brandon', 'davis', 'jason', 'tony', 'william', 'prabhat', 'liam', 'hunyi'];

/** Infers gender from the voice name. sure=false means it is a guess the user may correct. */
export function guessGender(v: Pick<SpeechSynthesisVoice, 'name'>): { gender: Gender; sure: boolean } {
  const words = v.name.toLowerCase().replace(/[()\-,]/g, ' ').split(/\s+/);
  if (words.includes('female') || words.includes('woman')) return { gender: 'female', sure: true };
  if (words.includes('male') || words.includes('man')) return { gender: 'male', sure: true };
  const has = (list: string[]) => list.some(n => words.includes(n) || words.some(w => w === n.replace('-', '')));
  if (has(FEMALE)) return { gender: 'female', sure: true };
  if (has(MALE)) return { gender: 'male', sure: true };
  return { gender: 'female', sure: false };
}

/** Filipino names for the guide: a female voice gets a female name, a male voice a male name. */
export const GUIDE_NAMES: Record<Gender, string[]> = {
  female: ['Tala', 'Mayumi', 'Ligaya', 'Amihan', 'Hiraya', 'Liwayway', 'Dalisay', 'Marisol', 'Luningning', 'Isabel'],
  male: ['Bayani', 'Lakan', 'Dakila', 'Makisig', 'Andres', 'Gabriel', 'Rafael', 'Miguel', 'Josue', 'Paolo'],
};
export function pickName(g: Gender, avoid?: string) {
  const list = GUIDE_NAMES[g].filter(n => n !== avoid);
  return list[Math.floor(Math.random() * list.length)];
}

/** Waits for the browser's voice list (it is empty at first in Chrome and Edge). */
export function loadVoices(timeoutMs = 4000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  return new Promise(resolve => {
    const now = synth.getVoices(); if (now.length) return resolve(now);
    let done = false;
    const finish = () => { if (done) return; done = true; clearInterval(poll); resolve(synth.getVoices()); };
    synth.addEventListener?.('voiceschanged', finish, { once: true } as AddEventListenerOptions);
    const poll = setInterval(() => { if (synth.getVoices().length) finish(); }, 200);
    setTimeout(finish, timeoutMs);
  });
}

const PREFIXES: Record<TourLang, string[][]> = {
  en: [['en-ph'], ['en-us', 'en-gb', 'en-au'], ['en']],
  tl: [['fil', 'tl'], ['en-ph'], ['en']],
  zh: [['zh-cn'], ['zh-tw', 'zh-hk', 'cmn', 'yue'], ['zh']],
};
/** Voices ordered best first for the tour language: 0 = right language, 1 = close, 2 = other. */
export function rankVoices(voices: SpeechSynthesisVoice[], lang: TourLang) {
  const rank = (v: SpeechSynthesisVoice) => { const l = v.lang.toLowerCase().replace('_', '-'); const i = PREFIXES[lang].findIndex(ps => ps.some(p => l.startsWith(p))); return i < 0 ? 3 : i; };
  return voices.map(v => ({ v, rank: rank(v) })).sort((a, b) => a.rank - b.rank || Number(b.v.localService) - Number(a.v.localService) || a.v.name.localeCompare(b.v.name));
}

/** Splits text into short sentences: long single utterances stop after ~15 s in some browsers. */
export function chunks(text: string, max = 180): string[] {
  const parts = text.match(/[^.!?。！？；;]+[.!?。！？；;]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) { const s = p.trim(); if (!s) continue;
    if (s.length <= max) out.push(s); else for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max)); }
  return out;
}

/** Speaks text sentence by sentence. Returns a function that stops speaking. */
export function speak(text: string, voice: SpeechSynthesisVoice | null, ev: { onstart?: () => void; onend?: () => void; rate?: number } = {}) {
  const synth = window.speechSynthesis; synth.cancel();
  let stopped = false; const list = chunks(text); let i = 0;
  const keepAlive = setInterval(() => { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } }, 10000);
  const next = () => {
    if (stopped) return;
    if (i >= list.length) { clearInterval(keepAlive); ev.onend?.(); return; }
    const u = new SpeechSynthesisUtterance(list[i++]);
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = ev.rate ?? 0.98; u.pitch = 1;
    if (i === 1) u.onstart = () => ev.onstart?.();
    u.onend = next; u.onerror = next;
    synth.speak(u);
  };
  if (synth.paused) synth.resume();
  next();
  return () => { stopped = true; clearInterval(keepAlive); synth.cancel(); };
}
