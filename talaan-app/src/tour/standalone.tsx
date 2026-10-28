/**
 * The published, single-file guided tour (talaan-guided-tour.html). Same scenes, words and voice as
 * the tour inside the app. Build: npm run build:tour. Language from ?lang=en|tl|zh, then the browser.
 */
import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Lang } from '../i18n';
import TourHost from './TourHost';

const pick = (): Lang => { const q = new URLSearchParams(location.search).get('lang'); if (q === 'en' || q === 'tl' || q === 'zh') return q;
  const n = (navigator.language || 'en').toLowerCase(); return n.startsWith('zh') ? 'zh' : n.startsWith('fil') || n.startsWith('tl') ? 'tl' : 'en'; };
function Standalone() {
  const [lang, setLang] = useState<Lang>(pick); const [open, setOpen] = useState(true);
  const onLang = useCallback((l: Lang) => { setLang(l); document.documentElement.lang = l === 'zh' ? 'zh-Hans' : l; }, []);
  const onClose = useCallback(() => setOpen(false), []);
  return (<>
    {!open && <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0B2350', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 16 }}>
      <div><p style={{ fontSize: 22, letterSpacing: '.14em', color: '#E2B13C', fontWeight: 700 }}>TALAAN</p><p>Every payslip. Every deadline.</p>
        <button onClick={() => setOpen(true)} style={{ marginTop: 12, padding: '12px 22px', borderRadius: 10, border: 0, background: '#D4A12A', color: '#1b1300', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>▶ Replay the tour</button></div></main>}
    <TourHost open={open} lang={lang} onLang={onLang} onClose={onClose} />
  </>);
}
createRoot(document.getElementById('root')!).render(<Standalone />);
