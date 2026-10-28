/**
 * Mounts the tour in its own Shadow DOM layer so its styles and the app's styles
 * never clash. A separate React root inside the shadow root keeps clicks working.
 */
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Lang } from '../i18n';
import TalaTour from './TalaTour';
import tourCss from './tour.css';

const EXTRA = `
.tt-overlay{position:fixed;inset:0;z-index:1000;background:rgba(10,25,45,.62);overflow:auto;padding:calc(16px + env(safe-area-inset-top,0px)) 12px calc(16px + env(safe-area-inset-bottom,0px));font-family:"Plus Jakarta Sans","Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.tt-overlay .talaan-tour{max-width:1110px;margin:0 auto;border-radius:22px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6)}
.tt-overlay .talaan-tour .top .row{display:flex;align-items:center;gap:10px}
.tt-close{width:40px;height:40px;border-radius:50%;border:1px solid var(--card-line);background:var(--card);color:var(--page-ink);font-size:24px;line-height:1;cursor:pointer}
.tt-close:focus-visible{outline:3px solid var(--mango);outline-offset:2px}
.talaan-tour .btn.ghost{background:#fff;border:1px solid var(--line);color:var(--ink)}
`;

export default function TourHost({ open, lang, onLang, onClose }: { open: boolean; lang: Lang; onLang: (l: Lang) => void; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  useEffect(() => {
    const host = document.createElement('div'); host.setAttribute('data-talaan-tour', '');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = tourCss + EXTRA; shadow.appendChild(style);
    const mount = document.createElement('div'); shadow.appendChild(mount);
    hostRef.current = host; rootRef.current = createRoot(mount);
    return () => { const r = rootRef.current; rootRef.current = null; setTimeout(() => { r?.unmount(); host.remove(); }); };
  }, []);
  useEffect(() => {
    rootRef.current?.render(open ? <TalaTour lang={lang} onLang={onLang} onClose={onClose} /> : <></>);
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open, lang, onLang, onClose]);
  return null;
}
