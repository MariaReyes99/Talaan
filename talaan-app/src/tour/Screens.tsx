'use client';
/**
 * The mock app screens shown in each scene of the guided tour.
 * Sample data only. Every word comes from the message files via `t`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { type TT } from './messages';
import TalaAvatar from './TalaAvatar';
import MARK from '../../assets/talaan-mark-256.png';

export const SCENES = ['intro', 'home', 'payrun', 'checks', 'approve', 'files', 'extra', 'people', 'byo', 'books', 'analytics', 'ask', 'ready'] as const;
export type SceneId = (typeof SCENES)[number];
export const NAV_KEYS = ['home', 'payroll', 'hr', 'compliance', 'books', 'analytics'] as const;
export const NAV_FOR: Record<SceneId, (typeof NAV_KEYS)[number]> = {
  intro: 'home', home: 'home', payrun: 'payroll', checks: 'payroll', approve: 'payroll', files: 'compliance', extra: 'payroll',
  people: 'hr', byo: 'compliance', books: 'books', analytics: 'analytics', ask: 'home', ready: 'home',
};
export const TOUR_MARK = MARK;

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


export function Screen({ id, onReplay, onFinish, t, name = 'Tala', gender = 'female' }: { id: SceneId; onReplay: () => void; onFinish: () => void; t: TT; name?: string; gender?: 'female' | 'male' }) {
  const screens: Record<SceneId, () => ReactNode> = {
    intro: () => (
      <div className="sc intro"><div className="hero">
        <div className="in" style={d(100, { width: 220, height: 220, flex: 'none' })}><TalaAvatar gender={gender} label={name} /></div>
        <div>
          <div className="brandline in" style={d(250)}><img src={MARK} alt="" width={64} height={64} /><h3>TALAAN</h3></div>
          <p className="in slogan" style={d(400)}>{t('ui.welcome')}</p>
          <div className="tiles six">
            {(['modPayroll', 'modCompliance', 'modBooks', 'modHR', 'modAI', 'modAnalytics'] as const).map((k, i) => <div key={k} className="tile in" style={d(650 + i * 180)}>{t(`ui.${k}`)}</div>)}
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
            <div className="search in" style={d(250)}>🔍 {t('ui.searchHint')}</div>
          </div>
          <table className="tbl in" style={d(350)}>
            <thead><tr><th>{t('ui.colClient')}</th><th className="num">{t('ui.colStaff')}</th><th>{t('ui.colNext')}</th><th>{t('ui.colStatus')}</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r[0]} className="in" style={d(600 + i * 350)}>
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
        <div className="panel" style={{ padding: 20 }}>
          <div className="muted in" style={d(200, { fontSize: 13, fontWeight: 600, marginBottom: 10 })}>Lim Trading Corp. · {t('ui.stepOf', { n: 2 })}</div>
          <div className="drop in" style={d(350)}><span className="muted" style={{ flex: 1 }}>{t('ui.dropHint')}</span><span className="file pop" style={d(1200)}><Doc /> timesheet_oct_1-15.xlsx</span></div>
          <div className="good in" style={d(1900, { margin: '12px 0' })}><Check /> {t('ui.rowsFound')}</div>
          <div className="prefillbox in" style={d(2600)}><b>{t('ui.prefillTitle')}</b>
            {(['prefill1', 'prefill2', 'prefill3'] as const).map((k, i) => <div key={k} className="pf in" style={d(3000 + i * 500)}><Check /> {t(`ui.${k}`)}</div>)}</div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn in" style={d(4700)} tabIndex={-1}>{t('ui.continue')}</button></div>
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
        [t('ui.fileSSS'), '#1F5FAE', 'My.SSS', 3], [t('ui.filePH'), '#2E9E5B', 'PhilHealth EPRS', 3], [t('ui.filePI'), '#D9434E', 'Virtual Pag-IBIG', 5],
        [t('ui.fileBIR'), '#0B2350', 'BIR eFPS', 8], [t('ui.fileBank'), '#6E56CF', 'BDO online banking', 1],
      ] as const;
      const ev: Record<number, [string, string][]> = { 10: [['BIR', 'late']], 15: [[t('ui.calPay'), 'done'], ['PH', 'soon'], ['PI', 'soon']], 20: [['SSS', 'done']], 28: [['SSS', 'planned']], 31: [[t('ui.calPay'), 'planned']] };
      return (
        <div className="sc filesplit">
          <div className="minical in" style={d(50)}><div className="row" style={{ justifyContent: 'space-between' }}><b>{t('ui.calTitle')}</b></div>
            <div className="mcgrid">{Array.from({ length: 35 }, (_, i) => { const day = i - 3; return <div key={i} className={`mc ${day < 1 || day > 31 ? 'x' : ''}`}>{day >= 1 && day <= 31 && <><span>{day}</span>{(ev[day] ?? []).map((e, k) => <i key={k} className={`ev ${e[1]} pop`} style={d(600 + day * 40)}>{e[0]}</i>)}</>}</div>; })}</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}><span className="chip late">{t('ui.calLate')}</span><span className="chip soon">{t('ui.calSoon')}</span><span className="chip ok">{t('ui.calDone')}</span></div></div>
          <div><h3 className="in" style={d(300, { marginBottom: 10 })}>{t('ui.filesTitle')}</h3>
            <table className="tbl in" style={d(400)}>
              <tbody>{rows.map((r, i) => (
                <tr key={r[2]} className="in" style={d(600 + i * 250)}>
                  <td><span className="agency" style={{ background: r[1] }} /><b>{r[0]}</b><div className="muted" style={{ fontSize: 12 }}>{r[2]} · {t('ui.dueIn', { days: r[3] })}</div></td>
                  <td style={{ textAlign: 'center' }}><span className="box" style={d(2400 + i * 600)}><svg className="ic" viewBox="0 0 20 20" style={d(2400 + i * 600, { color: '#fff' })}><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg></span></td>
                </tr>))}
              </tbody>
            </table>
            <div className="toast pop" style={d(5600)}><Check /> {t('ui.receiptSaved')}</div></div>
        </div>
      );
    },
    extra: () => (
      <div className="sc twocards">
        <div className="panel in" style={d(100)}><div className="row" style={{ justifyContent: 'space-between' }}><b>{t('ui.bonusTitle')}</b><span className="chip ok pop" style={d(2400)}>{t('ui.taxFree')}</span></div>
          {[['Ana Cruz', 24000], ['Ben Reyes', 21000], ['Rico Santos', 23500], ['Cheryl Tan', 38000]].map(([n, v], i) => <div key={n as string} className="kv in" style={d(500 + i * 300)}><span>{n}</span><b>{peso(v as number)}</b></div>)}</div>
        <div className="panel in" style={d(1800)}><b>{t('ui.finalTitle')}</b>
          <div className="kv in" style={d(2300)}><span>{t('ui.fpSalary')}</span><b>{peso(5516.86)}</b></div>
          <div className="kv in" style={d(2600)}><span>{t('ui.fp13th')}</span><b>{peso(19840.21)}</b></div>
          <div className="kv in" style={d(2900)}><span>{t('ui.fpLeave')}</span><b>{peso(11034.48)}</b></div>
          <div className="kv in" style={d(3200)}><span>{t('ui.fpTax')}</span><b style={{ color: 'var(--green)' }}>{peso(87.45)}</b></div>
          <div className="kv in" style={d(3600, { borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 17 })}><span><b>{t('ui.netPay')}</b></span><b>{peso(36479.0)}</b></div>
          <button className="btn ghost in" style={d(4200, { marginTop: 8 })} tabIndex={-1}><Doc /> {t('ui.fpCoe')}</button></div>
      </div>
    ),
    people: () => (
      <div className="sc ap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="panel in" style={d(1600)}><b>{t('ui.approvalsTitle')}</b><div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}><span>{t('ui.leaveReq')}</span><button className="btn green press" style={d(3000)} tabIndex={-1}>{t('ui.approve')}</button></div></div>
          <div className="panel in" style={d(3600)}><b>{t('ui.historyTitle')}</b><div style={{ marginTop: 6 }}>{t('ui.historyRow')}</div><div className="muted" style={{ fontSize: 13 }}>{t('ui.historyWhy')}</div></div>
        </div>
        <div className="phone in" style={d(100)}><div className="scr">
          <div className="bar">{t('ui.leaveTitle')}<div style={{ fontWeight: 500, fontSize: 13, opacity: 0.85 }}>Rico Santos</div></div>
          <div className="bd" style={{ gap: 8 }}>
            <div className="kv in" style={d(500)}><span>{t('ui.leaveVL')}</span><b>{t('ui.daysLeft', { n: 8 })}</b></div>
            <div className="kv in" style={d(700)}><span>{t('ui.leaveSL')}</span><b>{t('ui.daysLeft', { n: 5 })}</b></div>
            <button className="btn in" style={d(1000)} tabIndex={-1}>{t('ui.requestLeave')}</button>
            <div className="muted in" style={d(1300, { fontSize: 12, fontWeight: 700, marginTop: 6 })}>{t('ui.payslipTitle')} · {t('ui.cutoffLabel')}</div>
            <div className="kv in" style={d(1500, { color: 'var(--green)' })}><span><b>{t('ui.netPay')}</b></span><b>{peso(10394.84)}</b></div>
            <button className="btn ghost in" style={d(1800, { marginTop: 'auto' })} tabIndex={-1}><Doc /> {t('ui.download2316')}</button>
          </div>
        </div></div>
      </div>
    ),
    byo: () => {
      const rows: [string, number, boolean][] = [['Ramil Dizon', 42000, true], ['Nestor Abad', 16500, false], ['Marites Lagman', 19000, true], ['Jomar Villareal', 14000, true]];
      return (
        <div className="sc">
          <div className="row in" style={d(50, { justifyContent: 'space-between', marginBottom: 6 })}><h3>{t('ui.byoTitle')}</h3></div>
          <div className="drop in" style={d(250)}><span className="muted" style={{ flex: 1 }}>{t('ui.byoFrom')}</span><span className="file pop" style={d(900)}><Doc /> sprout_register_sep.csv</span></div>
          <table className="tbl in" style={d(1500, { marginTop: 12 })}><tbody>{rows.map(([n, g, ok], i) => (
            <tr key={n} className="in" style={d(1700 + i * 350)}><td><b>{n}</b></td><td className="num">{peso(g)}</td>
              <td>{ok ? <span className="chip ok pop" style={d(3200 + i * 250)}>{t('ui.matches')}</span> : <span className="chip late pop" style={d(3200 + i * 250)}>{t('ui.phDiff')}</span>}</td></tr>))}</tbody></table>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn in" style={d(4600)} tabIndex={-1}>{t('ui.byoSave')}</button></div>
        </div>
      );
    },
    books: () => {
      const lines: [string, string, number, number][] = [['ui.accSalaries', t('ui.deptOps'), 298750, 0], ['ui.accSalaries', t('ui.deptAdmin'), 112500, 0], ['ui.accSalaries', t('ui.deptSales'), 75000, 0], ['ui.accEmployer', '', 51250, 0],
        ['ui.accSSS', '', 0, 47250], ['ui.accPH', '', 0, 24300], ['ui.accPI', '', 0, 15200], ['ui.accWHT', '', 0, 28640], ['ui.accNet', '', 0, 422110]];
      const cell = { padding: '5px 14px', fontSize: 14 };
      return (
        <div className="sc">
          <div className="row in" style={d(50, { justifyContent: 'space-between', marginBottom: 12 })}>
            <div><h3>{t('ui.journalTitle')}</h3><div className="muted">Lim Trading Corp., {t('ui.cutoffLabel')}</div></div>
            <span className="xbadge pop" style={d(3300)}><Check /> {t('ui.sentXero')}</span>
          </div>
          <table className="tbl in" style={d(250)}>
            <thead><tr><th>{t('ui.colAccount')}</th><th>{t('ui.colDept')}</th><th className="num">{t('ui.debit')}</th><th className="num">{t('ui.credit')}</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (<tr key={i} className="in" style={d(400 + i * 170)}><td style={cell}>{t(l[0])}</td><td style={cell}>{l[1]}</td><td className="num" style={cell}>{l[2] ? peso(l[2]) : ''}</td><td className="num" style={cell}>{l[3] ? peso(l[3]) : ''}</td></tr>))}
              <tr className="in" style={d(2000)}><td style={cell} colSpan={2}><b>{t('ui.total')}</b></td><td className="num" style={cell}><b>{peso(537500)}</b></td><td className="num" style={cell}><b>{peso(537500)}</b></td></tr>
            </tbody>
          </table>
        </div>
      );
    },
    analytics: () => {
      const bars = [310, 342, 335, 381, 402, 475];
      return (
        <div className="sc">
          <div className="kpis">{([['kpiEmployees', '1,284'], ['kpiCost', '₱8.42M'], ['kpiGovt', '₱1.86M'], ['kpiOnTime', '96%']] as const).map(([k, v], i) => <div key={k} className="kpi in" style={d(100 + i * 200)}><span>{t(`ui.${k}`)}</span><b>{v}</b></div>)}</div>
          <div className="panel in" style={d(900, { marginTop: 14 })}><b>{t('ui.chartTitle')}</b>
            <div className="bars">{bars.map((v, i) => <div key={i} className="barcol"><span className="bv ttgrow" style={d(1200 + i * 200, { height: `${(v / 475) * 150}px` })} /><i>{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]}</i></div>)}</div></div>
        </div>
      );
    },
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
    ready: () => (
      <div className="sc ready">
        <div className="in wave" style={d(100, { width: 230, height: 230, flex: 'none' })}><TalaAvatar gender={gender} label={name} /></div>
        <div>
          <div className="brandline in" style={d(200)}><img src={MARK} alt="" width={48} height={48} /><span className="slogan">{t('ui.welcome')}</span></div>
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
