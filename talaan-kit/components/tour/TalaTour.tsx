'use client';
/**
 * "Meet Tala": Talaan's guided tour. Captions are always shown; the optional voice
 * uses the device's own speech, so nothing is downloaded or sent anywhere.
 * Language comes from the URL (/en, /tl, /zh) via next-intl.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/navigation';
import { routing } from '../../i18n/routing';
import TalaAvatar from './TalaAvatar';
import { NAV_FOR, NAV_KEYS, SCENES, Screen, TOUR_MARK } from './Screens';
import { guessGender, loadVoices, pickName, rankVoices, speak, type Gender, type TourLang } from './voice';

const LANG_NAMES: Record<string, string> = { en: 'English', tl: 'Tagalog', zh: '中文' };
type VoiceMeta = Record<string, { gender: Gender; name: string; sure: boolean }>;
const store = { get: <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } }, set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* empty */ } } };

export default function TalaTour() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [voice, setVoice] = useState(true);
  const [talking, setTalking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<VoiceMeta>({});
  const stopSpeech = useRef<null | (() => void)>(null);
  useEffect(() => { setChosen(store.get('talaan-tour-voice', {})); setMeta(store.get('talaan-tour-voice-meta', {})); let alive = true; loadVoices().then(v => { if (alive) setVoices(v); }); return () => { alive = false; }; }, []);
  const tl = locale as TourLang;
  const ranked = voices ? rankVoices(voices, tl) : [];
  const current = ranked.find(x => x.v.voiceURI === chosen[tl])?.v ?? ranked[0]?.v ?? null;
  const info = current ? (meta[current.voiceURI] ?? (() => { const g = guessGender(current); return { gender: g.gender, sure: g.sure, name: pickName(g.gender) }; })()) : { gender: 'female' as Gender, sure: false, name: 'Tala' };
  useEffect(() => { if (current && !meta[current.voiceURI]) { const m = { ...meta, [current.voiceURI]: info }; setMeta(m); store.set('talaan-tour-voice-meta', m); } }, [current?.voiceURI]);
  const name = info.name;
  const chooseVoice = (uri: string) => { const c = { ...chosen, [tl]: uri }; setChosen(c); store.set('talaan-tour-voice', c); };
  const setGender = (g: Gender) => { if (!current) return; const m = { ...meta, [current.voiceURI]: { gender: g, sure: true, name: g === info.gender ? info.name : pickName(g, info.name) } }; setMeta(m); store.set('talaan-tour-voice-meta', m); };
  const test = () => { stopSpeech.current?.(); stopSpeech.current = speak(t('controls.testLine', { name }), current, { onstart: () => setTalking(true), onend: () => setTalking(false) }); };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const id = SCENES[idx];
  const line = t(`scenes.${id}.line`, { name });
  const duration = Math.max(6500, line.length * (locale === 'zh' ? 210 : 62));

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stopSpeech.current?.(); stopSpeech.current = null;
    setTalking(false);
  }, []);

  const go = useCallback((i: number) => { setStarted(true); setIdx(Math.max(0, Math.min(SCENES.length - 1, i))); }, []);

  // Play the current scene: speak (if voice is on and available) or wait, then move on.
  useEffect(() => {
    stop();
    if (!playing) return;
    const advance = () => (idx < SCENES.length - 1 ? setIdx(idx + 1) : setPlaying(false));
    if (voice && current && voices?.length) {
      let finished = false;
      stopSpeech.current = speak(line, current, { onstart: () => setTalking(true), onend: () => { finished = true; setTalking(false); timer.current = setTimeout(advance, 900); } });
      const guard = setTimeout(() => { if (!finished) advance(); }, duration + 12000);
      return () => { clearTimeout(guard); stop(); };
    }
    setTalking(true);
    const quiet = setTimeout(() => setTalking(false), Math.min(duration - 800, 4500));
    timer.current = setTimeout(advance, duration);
    return () => { clearTimeout(quiet); stop(); };
  }, [idx, playing, voice, locale, line, duration, stop, current?.voiceURI]);

  // Scale the 960×540 stage to the available width.
  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 960));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // Keyboard: space plays or pauses, arrows move between scenes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('button') && e.key === ' ') return;
      if (e.key === ' ') { e.preventDefault(); setStarted(true); setPlaying((p) => !p); }
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [idx, go]);

  const navKeys = NAV_KEYS;

  return (
    <div className="talaan-tour"><div className="page">
      <header className="top">
        <div className="brand"><img src={TOUR_MARK} alt="" width={34} height={34} /><span className="word">TALAAN</span><span className="sub">{t('controls.tourTitle')}</span></div>
        <div className="langs" role="group" aria-label={t('controls.language')}>
          {routing.locales.map((l) => (
            <button key={l} type="button" aria-pressed={l === locale} lang={l === 'zh' ? 'zh-Hans' : l} onClick={() => router.replace(pathname, { locale: l })}>{LANG_NAMES[l]}</button>
          ))}
        </div>
      </header>

      <main className={`player ${playing ? '' : 'paused'}`}>
        <div className="stage-wrap" ref={wrapRef} style={{ height: 540 * scale }}>
          <div className="stage" aria-hidden="true" style={{ transform: `scale(${scale})` }}>
            <div className="appbar">
              <span className="mini"><img src={TOUR_MARK} alt="" width={22} height={22} />TALAAN</span>
              <nav>{navKeys.map((k) => <span key={k} className={NAV_FOR[id] === k ? 'on' : ''}>{t(`nav.${k}`)}</span>)}</nav>
              <span className="who">MS</span>
            </div>
            <div className="screen" key={`${id}-${locale}`}><Screen id={id} name={name} gender={info.gender} onReplay={() => { go(0); setPlaying(true); }} /></div>
          </div>
          {!started && (
            <div className="overlay"><button type="button" onClick={() => { setStarted(true); setPlaying(true); }}>{t('controls.play')}</button></div>
          )}
        </div>

        <div className={`caption ${talking ? 'talking' : ''} ${id === 'intro' || id === 'ready' ? 'wave' : ''}`}>
          <div className="tala"><TalaAvatar gender={info.gender} label={name} /><span className="nameplate">{name}</span></div>
          <div className="cap-text" aria-live="polite"><h2>{t(`scenes.${id}.title`, { name })}</h2><p>{line}</p></div>
        </div>

        <div className="progress">
          {SCENES.map((s, i) => (
            <button key={`${s}-${i === idx ? idx : ''}`} type="button" aria-label={t(`scenes.${s}.title`, { name })} className={i < idx ? 'done' : i === idx ? 'cur' : ''}
              style={{ ['--dur' as string]: `${duration}ms` }} onClick={() => go(i)}><span className="fill" /></button>
          ))}
        </div>

        <div className="controls">
          <button className="cbtn" type="button" onClick={() => go(idx - 1)}><span>{t('controls.prev')}</span></button>
          <button className="cbtn main" type="button" onClick={() => { setStarted(true); setPlaying(!playing); }}>{playing ? t('controls.pause') : t('controls.play')}</button>
          <button className="cbtn" type="button" onClick={() => go(idx + 1)}><span>{t('controls.next')}</span></button>
          <span className="count">{t('controls.sceneOf', { current: idx + 1, total: SCENES.length })}</span>
          <span className="spacer" />
          <button className="cbtn" type="button" aria-pressed={voice} disabled={!voices?.length} onClick={() => setVoice(!voice)}>{voice && voices?.length ? t('controls.voiceOn') : t('controls.voiceOff')}</button>
        </div>
        <div className="voicebar">
          {voices === null ? <span className="note">{t('controls.loadingVoices')}</span>
            : !voices.length ? <span className="note">{t('controls.noVoices')}</span>
            : <>
              <label>{t('controls.voiceLabel')}<select value={current?.voiceURI ?? ''} onChange={e => chooseVoice(e.target.value)}>
                {ranked.map(({ v, rank }) => { const g = meta[v.voiceURI]?.gender ?? guessGender(v).gender;
                  return <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang} · {t(`controls.${g}`)}{rank >= 2 ? ` (${t('controls.otherLang')})` : ''}</option>; })}
              </select></label>
              <label>{t('controls.sounds')}<select value={info.gender} onChange={e => setGender(e.target.value as Gender)}>
                <option value="female">{t('controls.female')}{!info.sure && info.gender === 'female' ? ` (${t('controls.guess')})` : ''}</option>
                <option value="male">{t('controls.male')}{!info.sure && info.gender === 'male' ? ` (${t('controls.guess')})` : ''}</option></select></label>
              <button className="cbtn" type="button" onClick={test}>🔊 {t('controls.testVoice')}</button>
              {locale === 'tl' && !ranked.some(x => x.rank === 0) && <span className="note">{t('controls.voiceTipTl')}</span>}
            </>}
        </div>
      </main>
      <p className="foot">{t('controls.mockNote')}</p>
    </div></div>
  );
}
