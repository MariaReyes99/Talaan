/**
 * "Meet Tala", the guided tour, inside the app. Same scenes and words as the
 * published tour. Captions are always shown; the optional voice uses the
 * device's own speech, so nothing is downloaded or sent anywhere.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { LANG_NAMES } from '../i18n';
import { tourT } from './messages';
import TalaAvatar, { TalaMark } from './TalaAvatar';
import { NAV_FOR, SCENES, Screen } from './Screens';
import { guessGender, loadVoices, pickName, rankVoices, speak, type Gender } from './voice';

type VoiceMeta = Record<string, { gender: Gender; name: string; sure: boolean }>;
const store = { get: <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d; } catch { return d; } }, set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* empty */ } } };

export default function TalaTour({ lang, onLang, onClose }: { lang: Lang; onLang: (l: Lang) => void; onClose: () => void }) {
  const t = tourT(lang);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [voice, setVoice] = useState(true);
  const [talking, setTalking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>(() => store.get('talaan-tour-voice', {}));
  const [meta, setMeta] = useState<VoiceMeta>(() => store.get('talaan-tour-voice-meta', {}));
  const stopSpeech = useRef<null | (() => void)>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => { let alive = true; loadVoices().then(v => { if (alive) setVoices(v); }); return () => { alive = false; }; }, []);
  const ranked = voices ? rankVoices(voices, lang) : [];
  const current = ranked.find(x => x.v.voiceURI === chosen[lang])?.v ?? ranked[0]?.v ?? null;
  const info = current ? (meta[current.voiceURI] ?? (() => { const g = guessGender(current); return { gender: g.gender, sure: g.sure, name: pickName(g.gender) }; })()) : { gender: 'female' as Gender, sure: false, name: 'Tala' };
  useEffect(() => { if (current && !meta[current.voiceURI]) { const m = { ...meta, [current.voiceURI]: info }; setMeta(m); store.set('talaan-tour-voice-meta', m); } }, [current?.voiceURI]);
  const name = info.name;
  const chooseVoice = (uri: string) => { const c = { ...chosen, [lang]: uri }; setChosen(c); store.set('talaan-tour-voice', c); };
  const setGender = (g: Gender) => { if (!current) return; const m = { ...meta, [current.voiceURI]: { gender: g, sure: true, name: g === info.gender ? info.name : pickName(g, info.name) } }; setMeta(m); store.set('talaan-tour-voice-meta', m); };
  const test = () => { stopSpeech.current?.(); stopSpeech.current = speak(t('controls.testLine', { name }), current, { onstart: () => setTalking(true), onend: () => setTalking(false) }); };
  const id = SCENES[idx];
  const line = t(`scenes.${id}.line`, { name });
  const duration = Math.max(6500, line.length * (lang === 'zh' ? 210 : 62));

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current); timer.current = null;
    stopSpeech.current?.(); stopSpeech.current = null; setTalking(false);
  }, []);
  const go = useCallback((i: number) => { setStarted(true); setIdx(Math.max(0, Math.min(SCENES.length - 1, i))); }, []);
  const close = useCallback(() => { stop(); onClose(); }, [stop, onClose]);

  useEffect(() => {
    stop(); if (!playing) return;
    const advance = () => (idx < SCENES.length - 1 ? setIdx(idx + 1) : setPlaying(false));
    if (voice && current && voices?.length) {
      let finished = false;
      stopSpeech.current = speak(line, current, { onstart: () => setTalking(true), onend: () => { finished = true; setTalking(false); timer.current = setTimeout(advance, 900); } });
      // Safety net: if the browser never reports the end of speech, move on anyway.
      const guard = setTimeout(() => { if (!finished) advance(); }, duration + 12000);
      return () => { clearTimeout(guard); stop(); };
    }
    setTalking(true);
    const quiet = setTimeout(() => setTalking(false), Math.min(duration - 800, 4500));
    timer.current = setTimeout(advance, duration);
    return () => { clearTimeout(quiet); stop(); };
  }, [idx, playing, voice, lang, line, duration, stop, current?.voiceURI]);

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 960)); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      const inButton = (e.composedPath()[0] as HTMLElement)?.closest?.('button');
      if (e.key === ' ' && !inButton) { e.preventDefault(); setStarted(true); setPlaying(p => !p); }
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [idx, go, close]);

  const navKeys = ['home', 'clients', 'payRuns', 'files', 'employees'] as const;
  return (
    <div className="tt-overlay" role="dialog" aria-modal="true" aria-label={t('controls.tourTitle')} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="talaan-tour"><div className="page">
        <header className="top">
          <div className="brand"><TalaMark size={30} /><span className="word">tala<i>a</i>n</span><span className="sub">{t('controls.tourTitle')}</span></div>
          <div className="row">
            <div className="langs" role="group" aria-label={t('controls.language')}>
              {(Object.keys(LANG_NAMES) as Lang[]).map(l => <button key={l} type="button" aria-pressed={l === lang} lang={l === 'zh' ? 'zh-Hans' : l} onClick={() => onLang(l)}>{LANG_NAMES[l]}</button>)}
            </div>
            <button ref={closeRef} className="tt-close" type="button" aria-label={t('controls.close')} onClick={close}>×</button>
          </div>
        </header>
        <main className={`player ${playing ? '' : 'paused'}`}>
          <div className="stage-wrap" ref={wrapRef} style={{ height: 540 * scale }}>
            <div className="stage" aria-hidden="true" style={{ transform: `scale(${scale})` }}>
              <div className="appbar"><span className="mini"><TalaMark size={22} />talaan</span>
                <nav>{navKeys.map(k => <span key={k} className={NAV_FOR[id] === k ? 'on' : ''}>{t(`nav.${k}`)}</span>)}</nav><span className="who">MS</span></div>
              <div className="screen" key={`${id}-${lang}`}><Screen id={id} t={t} name={name} gender={info.gender} onReplay={() => { go(0); setPlaying(true); }} onFinish={close} /></div>
            </div>
            {!started && <div className="overlay"><button type="button" onClick={() => { setStarted(true); setPlaying(true); }}>▶ {t('controls.play')}</button></div>}
          </div>
          <div className={`caption ${talking ? 'talking' : ''} ${id === 'intro' || id === 'ready' ? 'wave' : ''}`}>
            <div className="tala"><TalaAvatar gender={info.gender} label={name} /><span className="nameplate">{name}</span></div>
            <div className="cap-text" aria-live="polite"><h2>{t(`scenes.${id}.title`, { name })}</h2><p>{line}</p></div>
          </div>
          <div className="progress">{SCENES.map((s, i) => (
            <button key={`${s}-${i === idx ? idx : ''}`} type="button" aria-label={t(`scenes.${s}.title`, { name })} className={i < idx ? 'done' : i === idx ? 'cur' : ''}
              style={{ ['--dur' as string]: `${duration}ms` }} onClick={() => go(i)}><span className="fill" /></button>))}</div>
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
                {lang === 'tl' && !ranked.some(x => x.rank === 0) && <span className="note">{t('controls.voiceTipTl')}</span>}
              </>}
          </div>
        </main>
        <p className="foot">{t('controls.mockNote')}</p>
      </div></div>
    </div>
  );
}
