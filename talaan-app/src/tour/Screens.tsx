'use client';
/**
 * The mock app screens shown in each scene of the guided tour.
 * Sample data only. Every word comes from the message files via `t`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { tourT, type TT } from './messages';
import TalaAvatar from './TalaAvatar';

export const SCENES = ['intro', 'home', 'payrun', 'checks', 'approve', 'files', 'xero', 'phone', 'ask', 'language', 'ready'] as const;
export type SceneId = (typeof SCENES)[number];
export const NAV_FOR: Record<SceneId, 'home' | 'clients' | 'payRuns' | 'files' | 'employees'> = {
  intro: 'home', home: 'clients', payrun: 'payRuns', checks: 'payRuns', approve: 'payRuns',
  files: 'files', xero: 'payRuns', phone: 'employees', ask: 'home', language: 'home', ready: 'home',
};

/** Animation delay for the orchestrated reveal inside each scene. */
const d = (ms: number, extra?: CSSProperties) => ({ ['--d' as string]: `${ms}ms`, ...extra }) as CSSProperties;
export const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Check = () => (
  <svg className="ic" viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Doc = () => (
  <svg className="ic" viewBox="0 0 20 20"><path d="M5 2.5h7l3.5 3.5v11.5H5z" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" /><path d="M12 2.5V6h3.5" fill="none" stroke="currentColor" strokeWidth={1.6} /></svg>
);
const Lock = () => (
  <svg className="ic" viewBox="0 0 20 20"><rect x={4} y={9} width={12} height={8} rx={2} fill="currentColor" /><path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" fill="none" stroke="currentColor" strokeWidth={1.8} /></svg>
);

const OTHER = { en: tourT('en'), tl: tourT('tl'), zh: tourT('zh') };

export function Screen({ id, onReplay, onFinish, t, name = 'Tala', gender = 'female' }: { id: SceneId; onReplay: () => void; onFinish: () => void; t: TT; name?: string; gender?: 'female' | 'male' }) {
  const screens: Record<SceneId, () => ReactNode> = {
    intro: () => (
      <div className="sc intro"><div className="hero">
        <div className="in" style={d(100, { width: 220, height: 220, flex: 'none' })}><TalaAvatar gender={gender} label={name} /></div>
        <div>
          <h3 className="in" style={d(250)}>Talaan</h3>
          <p className="in" style={d(400)}>{t('ui.welcome')}</p>
          <div className="tiles">
            <div className="tile in" style={d(650)}>{t('ui.tilePayroll')}</div>
            <div className="tile in" style={d(850)}>{t('ui.tileFiles')}</div>
            <div className="tile in" style={d(1050)}>{t('ui.tileXero')}</div>
          </div>
        </div>
      </div></div>
    ),
    home: () => {
      const rows = [
        ['Mabuhay Bakery', 12, t('ui.next1'), t('ui.dueIn', { days: 5 }), 'ok', t('ui.statusOk')],
        ['Santos Hardware', 27, t('ui.next2'), t('ui.dueIn', { days: 2 }), 'soon', t('ui.statusSoon')],
        ['Lim Trading Corp.', 38, t('ui.next3'), t('ui.overdue'), 'late', t('ui.statusLate')],
        ['Cebu Family Clinic', 54, t('ui.next4'), t('ui.dueIn', { days: 9 }), 'ok', t('ui.statusOk')],
      ] as const;
      return (
        <div className="sc home">
          <div className="head in" style={d(50)}>
            <div><h3>{t('ui.greeting')}</h3><div className="muted">{t('ui.clientsCount')}</div></div>
            <div className="row"><span className="chip ok">{t('ui.statusOk')}</span><span className="chip soon">{t('ui.statusSoon')}</span><span className="chip late">{t('ui.statusLate')}</span></div>
          </div>
          <table className="tbl in" style={d(250)}>
            <thead><tr><th>{t('ui.colClient')}</th><th className="num">{t('ui.colStaff')}</th><th>{t('ui.colNext')}</th><th>{t('ui.colStatus')}</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r[0]} className="in" style={d(500 + i * 350)}>
                <td><b>{r[0]}</b></td><td className="num">{r[1]}</td>
                <td>{r[2]}<div className="muted" style={{ fontSize: 13 }}>{r[3]}</div></td>
                <td><span className={`chip ${r[4]}`}>{r[5]}</span></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      );
    },
    payrun: () => (
      <div className="sc">
        <div className="steps in" style={d(50)}>{[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`step ${n === 1 ? 'done' : n === 2 ? 'cur' : ''}`}><b>{n === 1 ? '✓' : n}</b>{t(`ui.step${n}`)}</div>))}
        </div>
        <div className="panel" style={{ padding: 22 }}>
          <div className="muted in" style={d(200, { fontSize: 13, fontWeight: 600, marginBottom: 10 })}>Lim Trading Corp.<br />{t('ui.stepOf', { n: 2 })}</div>
          <div className="drop in" style={d(350)}><span className="muted" style={{ flex: 1 }}>{t('ui.dropHint')}</span><span className="file pop" style={d(1300)}><Doc /> timesheet_oct_1-15.xlsx</span></div>
          <div className="good in" style={d(2200, { margin: '16px 0 12px' })}><Check /> {t('ui.rowsFound')}</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="memo in" style={d(2900)}>{t('ui.mapMemory')}</div>
            <button className="btn in" style={d(3400)} tabIndex={-1}>{t('ui.continue')}</button>
          </div>
        </div>
      </div>
    ),
    checks: () => (
      <div className="sc">
        <div className="row in" style={d(50, { justifyContent: 'space-between', marginBottom: 16 })}><h3>{t('ui.checksTitle')}</h3><span className="chip soon">{t('ui.checksSummary')}</span></div>
        <div className="check r in" style={d(400)}><span className="dot" style={{ background: 'var(--red)' }}>!</span><span className="t">{t('ui.checkRed')}</span><button className="btn red" tabIndex={-1}>{t('ui.fixNow')}</button></div>
        <div className="check a in" style={d(1300)}><span className="dot" style={{ background: 'var(--amber)' }}>?</span><span className="t">{t('ui.checkAmber')}</span><button className="btn amber" tabIndex={-1}>{t('ui.addReason')}</button></div>
        <div className="check g in" style={d(2200)}><span className="dot" style={{ background: 'var(--green)' }}><Check /></span><span className="t">{t('ui.checkOk1')}</span></div>
        <div className="check g in" style={d(2700)}><span className="dot" style={{ background: 'var(--green)' }}><Check /></span><span className="t">{t('ui.checkOk2')}</span></div>
      </div>
    ),
    approve: () => (
      <div className="sc ap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="person in" style={d(100)}><span className="av" style={{ background: 'var(--blue)' }}>J</span><b>{t('ui.preparedBy')}</b></div>
          <div className="chip late in" style={d(700, { alignSelf: 'flex-start' })}>{t('ui.roleOnlyNote')}</div>
          <div className="person in" style={d(1300)}><span className="av" style={{ background: 'var(--ube)' }}>A</span><b>{t('ui.approvedBy')}</b><span className="pop" style={d(3600, { marginLeft: 'auto', color: 'var(--green)' })}><Check /></span></div>
          <div className="lock pop" style={d(4100, { alignSelf: 'flex-start' })}><Lock /> {t('ui.lockedNote')}</div>
        </div>
        <div className="phone in" style={d(500)}><div className="scr">
          <div className="bar">{t('ui.summaryTitle')}<div style={{ fontWeight: 500, fontSize: 13, opacity: 0.8 }}>Lim Trading Corp.</div></div>
          <div className="bd">
            <div className="kv"><span>{t('ui.employees')}</span><b>38</b></div>
            <div className="kv"><span>{t('ui.gross')}</span><b>{peso(486250)}</b></div>
            <div className="kv"><span>{t('ui.govt')}</span><b>{peso(86750)}</b></div>
            <div className="kv" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 16 }}><span>{t('ui.netPay')}</span><b>{peso(422110)}</b></div>
            <button className="btn press" style={d(3200, { marginTop: 'auto', padding: 13, fontSize: 16 })} tabIndex={-1}>{t('ui.approve')}</button>
          </div>
        </div></div>
      </div>
    ),
    files: () => {
      const rows = [
        [t('ui.fileSSS'), '#1E88C7', 'My.SSS', 3], [t('ui.filePH'), '#2E9E5B', 'PhilHealth EPRS', 3], [t('ui.filePI'), '#D9434E', 'Virtual Pag-IBIG', 5],
        [t('ui.fileBIR'), '#12355B', 'BIR eFPS', 8], [t('ui.fileBank'), '#6E56CF', 'BDO online banking', 1],
      ] as const;
      return (
        <div className="sc">
          <h3 className="in" style={d(50, { marginBottom: 14 })}>{t('ui.filesTitle')}</h3>
          <table className="tbl in" style={d(200)}>
            <thead><tr><th>{t('ui.colFile')}</th><th>{t('ui.colUpload')}</th><th>{t('ui.colDue')}</th><th style={{ textAlign: 'center' }}>{t('ui.colDone')}</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r[2]} className="in" style={d(400 + i * 250)}>
                <td><span className="agency" style={{ background: r[1] }} /><b>{r[0]}</b></td><td>{r[2]}</td><td>{t('ui.dueIn', { days: r[3] })}</td>
                <td style={{ textAlign: 'center' }}><span className="box" style={d(2200 + i * 700)}><svg className="ic" viewBox="0 0 20 20" style={d(2200 + i * 700, { color: '#fff' })}><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg></span></td>
              </tr>))}
            </tbody>
          </table>
          <div className="toast pop" style={d(5800)}><Check /> {t('ui.receiptSaved')}</div>
        </div>
      );
    },
    xero: () => {
      const lines = [['ui.accSalaries', 486250, 0], ['ui.accEmployer', 51250, 0], ['ui.accSSS', 0, 47250], ['ui.accPH', 0, 24300], ['ui.accPI', 0, 15200], ['ui.accWHT', 0, 28640], ['ui.accNet', 0, 422110]] as const;
      const cell = { padding: '9px 16px' };
      return (
        <div className="sc">
          <div className="row in" style={d(50, { justifyContent: 'space-between', marginBottom: 14 })}>
            <div><h3>{t('ui.journalTitle')}</h3><div className="muted">Lim Trading Corp., {t('ui.cutoffLabel')}</div></div>
            <span className="xbadge pop" style={d(3300)}><Check /> {t('ui.sentXero')}</span>
          </div>
          <table className="tbl in" style={d(250)}>
            <thead><tr><th>{t('ui.colAccount')}</th><th className="num">{t('ui.debit')}</th><th className="num">{t('ui.credit')}</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (<tr key={l[0]} className="in" style={d(400 + i * 200)}><td style={cell}>{t(l[0])}</td><td className="num" style={cell}>{l[1] ? peso(l[1]) : ''}</td><td className="num" style={cell}>{l[2] ? peso(l[2]) : ''}</td></tr>))}
              <tr className="in" style={d(1900)}><td style={cell}><b>{t('ui.total')}</b></td><td className="num" style={cell}><b>{peso(537500)}</b></td><td className="num" style={cell}><b>{peso(537500)}</b></td></tr>
            </tbody>
          </table>
        </div>
      );
    },
    phone: () => (
      <div className="sc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="phone in" style={d(100)}><div className="scr">
          <div className="bar">{t('ui.payslipTitle')}<div style={{ fontWeight: 500, fontSize: 13, opacity: 0.85 }}>Rico Santos, {t('ui.cutoffLabel')}</div></div>
          <div className="bd" style={{ gap: 6 }}>
            <div className="kv in" style={d(500)}><span>{t('ui.basicPay')}</span><b>{peso(9750)}</b></div>
            <div className="kv in" style={d(650)}><span>{t('ui.overtime')}</span><b>{peso(1218.75)}</b></div>
            <div className="kv in" style={d(800)}><span>{t('ui.nightDiff')}</span><b>{peso(487.5)}</b></div>
            <div className="kv in" style={d(950, { fontWeight: 700 })}><span>{t('ui.grossPay')}</span><b>{peso(11456.25)}</b></div>
            <div className="muted in" style={d(1100, { fontSize: 12, fontWeight: 700, marginTop: 4 })}>{t('ui.deductions')}</div>
            <div className="kv in" style={d(1250)}><span>SSS</span><b>−{peso(575)}</b></div>
            <div className="kv in" style={d(1400)}><span>PhilHealth</span><b>−{peso(286.41)}</b></div>
            <div className="kv in" style={d(1550)}><span>Pag-IBIG</span><b>−{peso(200)}</b></div>
            <div className="kv in" style={d(1900, { borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 17, color: 'var(--green)' })}><span><b>{t('ui.netPay')}</b></span><b>{peso(10394.84)}</b></div>
            <button className="btn ghost in" style={d(2500, { marginTop: 'auto' })} tabIndex={-1}><Doc /> {t('ui.download2316')}</button>
          </div>
        </div></div>
      </div>
    ),
    ask: () => (
      <div className="sc chat">
        <div className="bub me in" style={d(200)}>{t('ui.askQ')}</div>
        <div className="row in" style={d(1300, { alignItems: 'flex-start', gap: 10 })}>
          <div style={{ width: 44, height: 44, flex: 'none' }}><TalaAvatar gender={gender} label={name} /></div>
          <div className="bub tala" style={{ flex: 1, maxWidth: 600 }}>{t('ui.askA')}
            <span className="src"><Doc /> {t('ui.askSource')}: RA 10963 (TRAIN Law), NIRC Sec. 32(B)(7)(e)</span>
          </div>
        </div>
        <div className="askbar in" style={d(600)}>{t('ui.askPlaceholder')}</div>
      </div>
    ),
    language: () => (
      <div className="sc"><div className="langcards">
        {(['en', 'tl', 'zh'] as const).map((l, i) => {
          const o = OTHER[l];
          const [before, after] = o('ui.next2').split('SSS');
          return (
            <div key={l} className="lc in" style={d(200 + i * 500)}>
              <h4>{o('meta.langName')}</h4>
              <div className="bd">
                <div className="good"><Check /> {o('ui.approvedShort')}</div>
                <div className="kv"><span>{o('ui.netPay')}</span><b>{peso(10394.84)}</b></div>
                <div>{before}<mark>SSS</mark>{after}</div>
                <span className="chip soon" style={{ alignSelf: 'flex-start' }}>{o('ui.dueIn', { days: 2 })}</span>
              </div>
            </div>
          );
        })}
      </div></div>
    ),
    ready: () => (
      <div className="sc ready">
        <div className="in wave" style={d(100, { width: 230, height: 230, flex: 'none' })}><TalaAvatar gender={gender} label={name} /></div>
        <div>
          <h3 className="in" style={d(300, { fontSize: 34 })}>{t('scenes.ready.title', { name })}</h3>
          <div className="pts">{(['ui.readyPoint1', 'ui.readyPoint2', 'ui.readyPoint3'] as const).map((k, i) => (
            <div key={k} className="pt in" style={d(600 + i * 400)}><span className="dot" style={{ background: 'var(--green)' }}><Check /></span>{t(k)}</div>))}
          </div>
          <div className="row in" style={d(2000)}><button className="btn" style={{ fontSize: 16, padding: '12px 22px' }} onClick={onFinish}>{t('controls.startUsing')}</button><button className="btn ghost" style={{ fontSize: 16, padding: '12px 22px' }} onClick={onReplay}>{t('controls.replay')}</button></div>
        </div>
      </div>
    ),
  };
  return <>{screens[id]()}</>;
}
