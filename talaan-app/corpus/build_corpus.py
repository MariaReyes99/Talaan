import json
V = '2026-10-04'      # last full review of every entry
V2 = '2026-10-19'     # re-checked against current sources in this update
V3 = '2026-10-28'     # wage orders, remittance schedules and billing added
RECHECKED = {'sss-rate', 'philhealth-rate', 'min-wage-ncr', 'paternity', 'wht-table', 'thirteenth-tax'}
RECHECKED3 = {'remit-deadlines', 'overtime', 'deadline-1604c'}
C = []
def add(id, cat, aud, kw, source, effective, en, tl, zh, url='', verified=None):
    C.append({'product': 'talaan', 'namespace': 'talaan-ph-payroll', 'id': id, 'category': cat, 'audience': aud, 'kw': kw, 'source': source, 'sourceUrl': url, 'effective': effective, 'verified': verified or (V3 if id in RECHECKED3 else V2 if id in RECHECKED else V),
              'status': 'Needs CPA review before production use',
              'q': {'en': en[0], 'tl': tl[0], 'zh': zh[0]}, 'a': {'en': en[1], 'tl': tl[1], 'zh': zh[1]}})
A, E, O = 'accountant', 'employee', 'owner'
SSSU, PHU, PIU, BIRU, DOLEU, NWPC = 'https://www.sss.gov.ph', 'https://www.philhealth.gov.ph', 'https://www.pagibigfund.gov.ph', 'https://www.bir.gov.ph', 'https://www.dole.gov.ph', 'https://nwpc.dole.gov.ph'

# ---------- Contributions ----------
add('sss-rate', 'contributions', [A, O, E], [['sss', 3], ['social security', 3], ['msc', 2], ['salary credit', 3]],
  'RA 11199 (Social Security Act of 2018), contribution schedule from January 2025', '2025-01', 
  ['How much is the SSS contribution?', 'SSS contributions are 15% of the monthly salary credit: 10% paid by the employer and 5% by the employee. The salary credit runs from ₱5,000 to ₱35,000, in ₱500 steps.'],
  ['Magkano ang SSS contribution?', 'Ang SSS contribution ay 15% ng monthly salary credit: 10% ang employer at 5% ang empleyado. Ang salary credit ay mula ₱5,000 hanggang ₱35,000, kada ₱500.'],
  ['SSS 缴款是多少？', 'SSS 缴款为月薪基数的 15%：雇主 10%，员工 5%。月薪基数从 ₱5,000 到 ₱35,000，每档 ₱500。'], SSSU)
add('sss-ec', 'contributions', [A, O], [['ec', 2], ['employees compensation', 3], ['employees’ compensation', 3]],
  'PD 626 (Employees’ Compensation Program) and SSS contribution schedule', '2025-01',
  ['What is the EC contribution and who pays it?', 'The Employees’ Compensation (EC) contribution is paid by the employer only: ₱10 a month when the salary credit is below ₱15,000, and ₱30 a month from ₱15,000 up. It is not deducted from the employee.'],
  ['Ano ang EC contribution at sino ang nagbabayad?', 'Ang Employees’ Compensation (EC) ay employer lang ang nagbabayad: ₱10 kada buwan kung mababa sa ₱15,000 ang salary credit, at ₱30 kung ₱15,000 pataas. Hindi ito kinakaltas sa empleyado.'],
  ['EC 缴款是什么？由谁缴纳？', '雇员补偿（EC）缴款只由雇主缴纳：月薪基数低于 ₱15,000 时每月 ₱10，₱15,000 及以上每月 ₱30。不从员工工资中扣除。'], SSSU)
add('philhealth-rate', 'contributions', [A, O, E], [['philhealth', 3], ['phic', 3], ['premium', 1]],
  'RA 11223 (Universal Health Care Act) premium schedule', '2025-01',
  ['How much is the PhilHealth premium?', 'PhilHealth premiums are 5% of basic monthly salary, shared equally by employer and employee. Salaries below ₱10,000 are charged as ₱10,000, and salaries above ₱100,000 as ₱100,000.'],
  ['Magkano ang PhilHealth premium?', 'Ang PhilHealth premium ay 5% ng basic monthly salary, hati ang employer at empleyado. Kung mababa sa ₱10,000 ang sahod, ₱10,000 ang batayan; kung lampas ₱100,000, ₱100,000 ang batayan.'],
  ['PhilHealth 保费是多少？', 'PhilHealth 保费为月基本工资的 5%，雇主和员工各付一半。月薪低于 ₱10,000 按 ₱10,000 计，高于 ₱100,000 按 ₱100,000 计。'], PHU)
add('pagibig-rate', 'contributions', [A, O, E], [['pag-ibig', 3], ['pagibig', 3], ['hdmf', 3]],
  'HDMF Circular No. 460 (2024)', '2024-02',
  ['How much is the Pag-IBIG contribution?', 'The employee pays 2% (1% if earning ₱1,500 or less) and the employer pays 2%, on pay up to ₱10,000. That is at most ₱200 each a month.'],
  ['Magkano ang Pag-IBIG contribution?', 'Ang empleyado ay 2% (1% kung kumikita ng ₱1,500 o mas mababa) at ang employer ay 2%, sa sahod hanggang ₱10,000. Hanggang ₱200 bawat isa kada buwan.'],
  ['Pag-IBIG 缴款是多少？', '员工缴 2%（月收入 ₱1,500 或以下为 1%），雇主缴 2%，计费工资上限 ₱10,000，即每人每月最多 ₱200。'], PIU)
add('contrib-split', 'contributions', [A], [['cutoff', 2], ['semi-monthly', 3], ['split', 2], ['twice a month', 3], ['dalawang beses', 3], ['hatiin', 2], ['半月', 2], ['两次', 3], ['月度缴款', 3]],
  'Talaan practice note: agencies compute contributions monthly', '2026-01',
  ['How are monthly contributions handled when we pay twice a month?', 'Agencies compute SSS, PhilHealth and Pag-IBIG per month. Talaan splits each monthly amount evenly across the two cutoffs; some employers deduct it all in one cutoff instead. Either is fine as long as the monthly total is right.'],
  ['Paano ang buwanang kontribusyon kung dalawang beses magpasahod?', 'Buwanan kinukuwenta ng mga ahensya ang SSS, PhilHealth at Pag-IBIG. Hinahati ito ng Talaan nang pantay sa dalawang cutoff; ang ibang employer ay kinakaltas lahat sa isang cutoff. Ayos lang alinman basta tama ang total kada buwan.'],
  ['每月发薪两次时，月度缴款怎么处理？', '各机构按月计算 SSS、PhilHealth 和 Pag-IBIG。Talaan 把月度金额平均分到两个周期；也有雇主在其中一期一次扣完。只要每月合计正确，两种做法都可以。'])
add('remit-deadlines', 'contributions', [A, O], [['remit', 2], ['remittance', 2], ['deadline', 2], ['due', 2], ['due date', 2], ['when to pay', 2], ['kailan ang deadline', 3], ['何时缴款', 4], ['缴款期限', 3], ['sss', 1], ['philhealth', 1], ['pag-ibig', 1]],
  'SSS (RA 11199) monthly payment deadline; PhilHealth EPRS schedule by PEN; Pag-IBIG schedule by employer name (RA 9679). Checked 28 Oct 2026 via employer guides; confirm in each portal', '2026-01',
  ['When are SSS, PhilHealth and Pag-IBIG payments due?', 'For the following month: SSS by the last day of the month; PhilHealth on the 11th–15th if the PhilHealth employer number ends in 0–4, or the 16th–20th if it ends in 5–9; Pag-IBIG by the first letter of the employer’s name: A–D 10th–14th, E–L 15th–19th, M–Q 20th–24th, R–Z and numbers 25th to month end. Press Use the agencies’ schedules in the client’s settings, and confirm in each portal.'],
  ['Kailan ang deadline ng SSS, PhilHealth at Pag-IBIG?', 'Para sa susunod na buwan: SSS hanggang sa huling araw ng buwan; PhilHealth sa ika-11 hanggang ika-15 kung nagtatapos sa 0–4 ang PhilHealth employer number, o ika-16 hanggang ika-20 kung 5–9; Pag-IBIG ayon sa unang letra ng pangalan ng employer: A–D ika-10 hanggang ika-14, E–L ika-15 hanggang ika-19, M–Q ika-20 hanggang ika-24, R–Z at numero ika-25 hanggang katapusan. Pindutin ang Gamitin ang iskedyul ng mga ahensya sa settings ng client, at kumpirmahin sa bawat portal.'],
  ['SSS、PhilHealth 和 Pag-IBIG 何时缴款？', '均在次月缴纳：SSS 截至月末最后一天；PhilHealth 雇主编号尾数为 0–4 的在 11 日至 15 日，尾数为 5–9 的在 16 日至 20 日；Pag-IBIG 按雇主名称首字母：A–D 为 10 日至 14 日，E–L 为 15 日至 19 日，M–Q 为 20 日至 24 日，R–Z 及数字为 25 日至月末。可在客户设置中点击“使用各机构的缴款时间表”，并在各机构网站确认。'])
add('sss-late', 'contributions', [A, O], [['late', 2], ['penalty', 2], ['multa', 2], ['罚', 2], ['sss', 1]],
  'RA 11199, Sec. 22 (penalty on late remittance)', '2019-02',
  ['What is the penalty for paying SSS late?', 'Late SSS contributions carry a penalty of 2% a month on the unpaid amount until paid. Unremitted employee deductions can also lead to criminal liability.'],
  ['Ano ang multa kapag late ang bayad sa SSS?', 'May penalty na 2% kada buwan sa hindi nabayarang SSS contribution hanggang mabayaran. Puwede ring magkaroon ng kasong kriminal kapag hindi na-remit ang kinaltas sa empleyado.'],
  ['SSS 逾期缴款有什么处罚？', '逾期的 SSS 缴款按未缴金额每月加收 2% 罚款，直至缴清。已扣员工款项而未上缴的，还可能承担刑事责任。'], SSSU)

# ---------- Withholding tax ----------
add('wht-table', 'tax', [A, O], [['withholding', 3], ['tax table', 3], ['wht', 3], ['bracket', 2], ['预扣', 3]],
  'BIR Revenue Regulations No. 11-2018, Annex E (withholding tax table, 2023 onwards)', '2023-01',
  ['Which withholding tax table do we use?', 'Use the TRAIN law table in effect from 2023. Semi-monthly: zero up to ₱10,417; 15% of the excess over ₱10,417 up to ₱16,667; ₱937.50 plus 20% over ₱16,667 up to ₱33,333; and higher brackets above that. Taxable pay is gross pay minus non-taxable items and the employee’s SSS, PhilHealth and Pag-IBIG.'],
  ['Anong withholding tax table ang gagamitin?', 'Gamitin ang TRAIN law table mula 2023. Semi-monthly: walang tax hanggang ₱10,417; 15% ng sobra sa ₱10,417 hanggang ₱16,667; ₱937.50 at 20% ng sobra sa ₱16,667 hanggang ₱33,333; at mas mataas pa lampas doon. Ang taxable ay gross pay bawas ang non-taxable at ang SSS, PhilHealth at Pag-IBIG ng empleyado.'],
  ['预扣税用哪张税表？', '使用 2023 年起生效的 TRAIN 法税表。半月薪：₱10,417 以下免税；₱10,417 至 ₱16,667 之间按超出部分的 15%；₱16,667 至 ₱33,333 之间为 ₱937.50 加超出部分的 20%；更高档次依此类推。应税工资为应发工资减去免税项目及员工承担的 SSS、PhilHealth 和 Pag-IBIG。'], BIRU)
add('mwe', 'tax', [A, O, E], [['minimum wage earner', 4], ['mwe', 3], ['exempt', 1], ['income tax', 3], ['tax', 1], ['最低工资收入', 3], ['所得税', 3]],
  'NIRC Sec. 24(A)(2), as amended by RA 9504', '2008-07',
  ['Do minimum wage earners pay income tax?', 'No. Minimum wage earners pay no income tax on their statutory minimum wage, holiday pay, overtime, night differential and hazard pay. Other taxable income they receive is still taxed.'],
  ['May income tax ba ang minimum wage earner?', 'Wala. Walang income tax ang minimum wage earner sa minimum wage, holiday pay, overtime, night differential at hazard pay. May tax pa rin ang ibang taxable na kita nila.'],
  ['最低工资收入者要缴个人所得税吗？', '不用。最低工资收入者的法定最低工资、节假日工资、加班费、夜班津贴和危险津贴免缴个人所得税，但其他应税收入仍需缴税。'], BIRU)
add('thirteenth-tax', 'tax', [A, O, E], [['13th', 2], ['thirteenth', 2], ['十三', 2], ['tax', 1], ['taxable', 1], ['buwis', 1], ['税', 1], ['90,000', 3], ['bonus', 1]],
  'NIRC Sec. 32(B)(7)(e), as amended by RA 10963 (TRAIN Law)', '2018-01',
  ['Is 13th month pay taxable?', '13th month pay and other benefits are tax-free up to ₱90,000 a year in total. Only the amount above ₱90,000 is taxable.'],
  ['May tax ba ang 13th month pay?', 'Walang tax ang 13th month pay at iba pang benefits hanggang ₱90,000 kada taon. Ang sobra lang sa ₱90,000 ang may tax.'],
  ['第十三个月工资要缴税吗？', '第十三个月工资及其他福利每年合计 ₱90,000 以内免税，只有超过 ₱90,000 的部分需要缴税。'], BIRU)
add('de-minimis', 'tax', [A, O], [['de minimis', 4], ['rice', 2], ['uniform', 2], ['laundry', 2], ['allowance', 1], ['bigas', 2], ['小额', 3], ['大米', 2]],
  'BIR Revenue Regulations No. 29-2025 (effective 6 January 2026), amending RR 2-98', '2026-01-06',
  ['What are the 2026 de minimis limits?', 'From 6 January 2026: rice subsidy ₱2,500 a month; uniform and clothing ₱8,000 a year; medical cash allowance to dependents ₱2,000 a semester; laundry ₱400 a month; Christmas and anniversary gifts ₱6,000 a year; achievement awards and CBA or productivity incentives ₱12,000 a year; overtime meal allowance 30% of the regional minimum wage. Amounts above a limit move into the ₱90,000 other-benefits ceiling.'],
  ['Ano ang mga limit ng de minimis sa 2026?', 'Mula 6 Enero 2026: rice subsidy ₱2,500 kada buwan; uniform at damit ₱8,000 kada taon; medical cash allowance sa dependents ₱2,000 kada semester; laundry ₱400 kada buwan; regalo sa Pasko at anibersaryo ₱6,000 kada taon; achievement awards at CBA o productivity incentive ₱12,000 kada taon; meal allowance sa overtime 30% ng regional minimum wage. Ang sobra ay papasok sa ₱90,000 na ceiling ng iba pang benefits.'],
  ['2026 年小额免税福利的上限是多少？', '自 2026 年 1 月 6 日起：大米补贴每月 ₱2,500；制服和服装每年 ₱8,000；家属医疗现金津贴每半年 ₱2,000；洗衣津贴每月 ₱400；圣诞及周年礼品每年 ₱6,000；成就奖及集体协议或生产力奖励每年 ₱12,000；加班餐补为地区最低工资的 30%。超出上限的部分计入 ₱90,000 其他福利额度。'], BIRU)
add('annualization', 'tax', [A], [['annualization', 4], ['annualize', 4], ['year-end', 3], ['refund', 2], ['december', 1], ['年终', 3]],
  'BIR Revenue Regulations No. 2-98, as amended by RR 11-2018 (year-end adjustment)', '2018-01',
  ['What is year-end annualization?', 'In the last payroll of the year, the employer recomputes each employee’s tax on the whole year’s pay. If too much was withheld, the excess is refunded; if too little, the shortfall is deducted, by January 25 of the next year at the latest.'],
  ['Ano ang year-end annualization?', 'Sa huling payroll ng taon, kinukuwenta ulit ng employer ang tax ng bawat empleyado batay sa buong taon. Kung sobra ang nakaltas, ibinabalik ito; kung kulang, kinakaltas ang kulang, hindi lalampas sa January 25 ng susunod na taon.'],
  ['什么是年终税款汇算？', '在年度最后一次发薪时，雇主按全年工资重新计算每位员工的税款。多扣的退还，少扣的补扣，最迟在次年 1 月 25 日前完成。'], BIRU)
add('substituted-filing', 'tax', [A, E], [['substituted filing', 4], ['itr', 2], ['sariling itr', 4], ['own income tax return', 4], ['1700', 2], ['income tax return', 3], ['报税', 2], ['自己报', 4], ['个人所得税', 2]],
  'BIR Revenue Regulations No. 11-2018 (substituted filing)', '2018-01',
  ['Do employees need to file their own income tax return?', 'Not if they qualify for substituted filing: one employer for the whole year, compensation income only, and tax withheld correctly. The employer’s Form 2316 filed with the BIR takes the place of their return.'],
  ['Kailangan bang mag-file ng sariling ITR ang empleyado?', 'Hindi, kung qualified sa substituted filing: iisang employer sa buong taon, sahod lang ang kita, at tama ang nakaltas na tax. Ang Form 2316 na isinumite ng employer sa BIR ang papalit sa kanilang ITR.'],
  ['员工需要自己报个人所得税吗？', '符合“替代申报”条件的不需要：全年只有一个雇主、只有工资收入、且税款已正确预扣。雇主向 BIR 提交的 2316 表格即视为其纳税申报。'], BIRU)

# ---------- Pay rules ----------
add('overtime', 'pay', [A, O, E], [['overtime', 3], ['ot', 1], ['obertaym', 3], ['加班', 3]],
  'Labor Code of the Philippines, Arts. 87, 93 and 94 (overtime, rest day and holiday premiums)', '1974-05',
  ['How is overtime paid?', 'Work beyond 8 hours on an ordinary working day is paid at least 25% more than the hourly rate. Overtime on a rest day or holiday is paid at least 30% more than the hourly rate for that day: 169% of the hourly rate on a rest day or special day, and 260% on a regular holiday. Talaan has separate columns for each.'],
  ['Paano binabayaran ang overtime?', 'Ang trabaho na lampas 8 oras sa ordinaryong araw ay may dagdag na hindi bababa sa 25% ng hourly rate. Ang overtime sa rest day o holiday ay may dagdag na hindi bababa sa 30% ng hourly rate sa araw na iyon: 169% ng hourly rate sa rest day o special day, at 260% sa regular holiday. May hiwalay na column ang Talaan para sa bawat isa.'],
  ['加班费怎么算？', '普通工作日超过 8 小时的部分，至少按时薪加 25% 支付。休息日或节假日的加班，至少按当天时薪加 30% 支付：休息日或特别假日为时薪的 169%，法定节假日为 260%。Talaan 为每种情况分别设栏。'], DOLEU)
add('night-diff', 'pay', [A, O, E], [['night', 2], ['differential', 3], ['gabi', 2], ['夜班', 3], ['nd', 1]],
  'Labor Code of the Philippines, Art. 86', '1974-05',
  ['How is night differential paid?', 'Each hour worked between 10pm and 6am earns at least 10% more than the regular hourly rate.'],
  ['Paano binabayaran ang night differential?', 'Bawat oras ng trabaho mula 10pm hanggang 6am ay may dagdag na hindi bababa sa 10% ng regular na hourly rate.'],
  ['夜班津贴怎么算？', '晚上 10 点至早上 6 点之间每工作 1 小时，至少按正常时薪加 10% 支付。'], DOLEU)
add('regular-holiday', 'pay', [A, O, E], [['regular holiday', 4], ['holiday', 2], ['piyesta', 2], ['法定节假日', 4], ['节假日', 2]],
  'Labor Code of the Philippines, Art. 94; DOLE holiday pay rules', '1974-05',
  ['How is a regular holiday paid?', 'If not worked, the employee still gets 100% of the daily rate. If worked, at least 200% of the daily rate for the first 8 hours, plus 30% more per hour of overtime.'],
  ['Paano binabayaran ang regular holiday?', 'Kung hindi pumasok, 100% pa rin ng daily rate ang matatanggap. Kung pumasok, hindi bababa sa 200% ng daily rate sa unang 8 oras, at dagdag na 30% kada oras ng overtime.'],
  ['法定节假日工资怎么算？', '不上班也照付 100% 日薪。上班的话，前 8 小时至少按日薪的 200% 支付，加班每小时再加 30%。'], DOLEU)
add('special-day', 'pay', [A, O, E], [['special', 3], ['non-working', 3], ['special day', 4], ['特别假日', 4]],
  'DOLE Labor Advisory on holiday pay rules (issued yearly)', '2026-01',
  ['How is a special non-working day paid?', 'No work, no pay, unless company policy or a contract says otherwise. If worked, the employee gets at least 130% of the daily rate for the first 8 hours, or 150% if it is also their rest day.'],
  ['Paano binabayaran ang special non-working day?', 'No work, no pay, maliban kung iba ang patakaran ng kumpanya o kontrata. Kung pumasok, hindi bababa sa 130% ng daily rate sa unang 8 oras, o 150% kung rest day din niya.'],
  ['特别非工作日工资怎么算？', '不上班不付薪，除非公司政策或合同另有规定。上班的话，前 8 小时至少按日薪的 130% 支付；如果当天也是其休息日，则为 150%。'], DOLEU)
add('rest-day', 'pay', [A, O, E], [['rest day', 4], ['day off', 3], ['休息日', 4]],
  'Labor Code of the Philippines, Art. 93', '1974-05',
  ['How is work on a rest day paid?', 'Work on the employee’s scheduled rest day is paid at least 130% of the daily rate for the first 8 hours.'],
  ['Paano binabayaran ang trabaho sa rest day?', 'Ang trabaho sa nakatakdang rest day ng empleyado ay binabayaran ng hindi bababa sa 130% ng daily rate sa unang 8 oras.'],
  ['休息日上班怎么付薪？', '在员工排定的休息日上班，前 8 小时至少按日薪的 130% 支付。'], DOLEU)
add('min-wage-ncr', 'pay', [A, O, E], [['minimum wage', 4], ['minimum', 1], ['wage order', 4], ['ncr', 2], ['metro manila', 3], ['最低工资', 4]],
  'Wage Order No. NCR-28 (effective 26 September 2026), NWPC', '2026-09-26',
  ['What is the minimum wage in Metro Manila?', 'From 26 September 2026, Wage Order NCR-28 sets ₱755 a day for non-agriculture and ₱718 for agriculture, retail and service with 15 or fewer workers, and manufacturing with fewer than 10. Rates differ by region; check the regional wage board and update each client’s minimum wage in Talaan. The ₱25 January 2027 increase under the earlier Wage Order NCR-27 is not in force while court proceedings continue.'],
  ['Magkano ang minimum wage sa Metro Manila?', 'Mula 26 Setyembre 2026, sa Wage Order NCR-28: ₱755 kada araw sa non-agriculture at ₱718 sa agriculture, retail at service na may 15 o mas kaunting manggagawa, at manufacturing na may mas kaunti sa 10. Iba-iba ito bawat rehiyon; tingnan ang regional wage board at i-update ang minimum wage ng bawat client sa Talaan. Hindi pa umiiral ang ₱25 na dagdag sa Enero 2027 sa ilalim ng naunang Wage Order NCR-27 habang may kaso pa sa korte.'],
  ['马尼拉大都会的最低工资是多少？', '自 2026 年 9 月 26 日起，NCR-28 号工资令规定：非农业每日 ₱755；农业、15 人及以下的零售和服务业、不足 10 人的制造业每日 ₱718。各地区标准不同，请核对地区工资委员会公告，并在 Talaan 中更新每个客户的最低工资。此前 NCR-27 号工资令规定的 2027 年 1 月 ₱25 加薪，在法院程序结束前不生效。'], NWPC)
add('daily-rate', 'pay', [A], [['daily rate', 4], ['factor', 3], ['261', 3], ['313', 3], ['日薪', 4]],
  'DOLE Handbook on Workers’ Statutory Monetary Benefits (equivalent monthly rate factors)', '2024-01',
  ['How do we turn a monthly salary into a daily rate?', 'Daily rate = monthly salary × 12 ÷ the number of paid days a year. Use 261 for a 5-day week and 313 for a 6-day week. The hourly rate is the daily rate ÷ 8.'],
  ['Paano kunin ang daily rate mula sa buwanang sahod?', 'Daily rate = buwanang sahod × 12 ÷ bilang ng bayad na araw kada taon. Gamitin ang 261 kung 5 araw kada linggo at 313 kung 6 na araw. Ang hourly rate ay daily rate ÷ 8.'],
  ['月薪怎么换算成日薪？', '日薪 = 月薪 × 12 ÷ 全年计薪天数。每周 5 天用 261，每周 6 天用 313。时薪 = 日薪 ÷ 8。'], DOLEU)

# ---------- Leave and benefits ----------
add('thirteenth-when', 'benefits', [A, O, E], [['13th', 2], ['thirteenth', 2], ['十三', 2], ['when', 1], ['december', 2], ['kailan', 1], ['什么时候', 1], ['compute', 1], ['how much', 1], ['magkano', 1], ['多少', 1], ['prorate', 2]],
  'PD 851 and the Revised Guidelines on 13th month pay', '1975-12',
  ['How is 13th month pay computed and when is it due?', 'Rank-and-file employees get at least one twelfth of the basic salary they earned during the year, paid by December 24. Employees who leave during the year get a prorated amount with their final pay.'],
  ['Paano kinukuwenta ang 13th month pay at kailan ito ibinibigay?', 'Ang rank-and-file ay makakatanggap ng hindi bababa sa one twelfth ng basic salary na kinita sa taon, ibibigay hanggang December 24. Ang umalis sa kalagitnaan ng taon ay may prorated na halaga kasama ng final pay.'],
  ['第十三个月工资怎么算？何时发放？', '普通员工至少获得当年所得基本工资的十二分之一，最迟 12 月 24 日发放。年中离职的员工按比例计算，随最终工资一并发放。'], DOLEU)
add('sil', 'benefits', [A, O, E], [['service incentive', 4], ['sil', 3], ['vacation leave', 3], ['leave', 1], ['bakasyon', 2], ['年假', 3]],
  'Labor Code of the Philippines, Art. 95', '1974-05',
  ['What is service incentive leave?', 'Employees with at least one year of service get 5 days of paid leave a year. Unused days are converted to cash at the end of the year or when the employee leaves. Some employers, such as those with fewer than 10 workers, are exempt.'],
  ['Ano ang service incentive leave?', 'Ang empleyadong may hindi bababa sa isang taon ng serbisyo ay may 5 araw na bayad na leave kada taon. Ang hindi nagamit ay ginagawang cash sa katapusan ng taon o pag-alis ng empleyado. May ilang exempted, gaya ng employer na may mas kaunti sa 10 manggagawa.'],
  ['什么是服务奖励假？', '工作满一年的员工每年享有 5 天带薪假。未用完的天数在年底或离职时折算成现金。部分雇主可豁免，例如员工不足 10 人的雇主。'], DOLEU)
add('maternity', 'benefits', [A, O, E], [['maternity', 4], ['manganganak', 3], ['产假', 4], ['105', 3]],
  'RA 11210 (105-Day Expanded Maternity Leave Law)', '2019-03',
  ['How long is maternity leave?', '105 days with full pay for live childbirth, plus 15 days more for solo mothers, and 60 days for miscarriage or emergency termination of pregnancy. The mother may extend by 30 days without pay and may give up to 7 of her days to the child’s father.'],
  ['Gaano katagal ang maternity leave?', '105 araw na may buong sahod sa panganganak, dagdag na 15 araw sa solo mother, at 60 araw kung nakunan. Puwedeng i-extend ng 30 araw nang walang bayad, at puwedeng ibigay ang hanggang 7 araw sa ama ng bata.'],
  ['产假有多长？', '正常分娩享有 105 天全薪产假，单亲母亲再加 15 天，流产或紧急终止妊娠为 60 天。可再延长 30 天无薪假，并可把最多 7 天转给孩子的父亲。'], SSSU)
add('paternity', 'benefits', [A, O, E], [['paternity', 4], ['father', 2], ['tatay', 2], ['陪产', 4]],
  'RA 8187 (Paternity Leave Act of 1996); RA 11210 (transferred days)', '1996-06',
  ['How long is paternity leave?', '7 days with full pay for a married father, for the first four deliveries of his lawful wife. He can get up to 7 more days if the mother transfers part of her maternity leave. A bill to extend paternity leave was filed in 2026 but is not law.'],
  ['Gaano katagal ang paternity leave?', '7 araw na may buong sahod para sa amang may asawa, para sa unang apat na panganganak ng kanyang asawa. Puwedeng madagdagan ng hanggang 7 araw kung ilipat ng ina ang bahagi ng kanyang maternity leave. May panukalang batas noong 2026 para pahabain ito pero hindi pa batas.'],
  ['陪产假有多长？', '已婚父亲在合法配偶前四次分娩时享有 7 天全薪陪产假。如母亲转让部分产假，可再增加最多 7 天。2026 年已有延长陪产假的议案，但尚未成为法律。'], DOLEU)
add('solo-parent', 'benefits', [A, O, E], [['solo parent', 4], ['single parent', 3], ['单亲', 4]],
  'RA 11861 (Expanded Solo Parents Welfare Act)', '2022-06',
  ['What leave do solo parents get?', 'Solo parents with at least 6 months of service get up to 7 working days of paid parental leave a year, on top of other leave.'],
  ['Anong leave ang para sa solo parent?', 'Ang solo parent na may hindi bababa sa 6 na buwan ng serbisyo ay may hanggang 7 araw ng trabaho na bayad na parental leave kada taon, dagdag sa ibang leave.'],
  ['单亲父母有什么假？', '工作满 6 个月的单亲父母每年享有最多 7 个工作日的带薪育儿假，另计于其他假期。'], DOLEU)
add('vawc-leave', 'benefits', [A, O, E], [['vawc', 4], ['violence', 3], ['karahasan', 3], ['暴力', 3]],
  'RA 9262 (Anti-Violence Against Women and Their Children Act), Sec. 43', '2004-03',
  ['What is VAWC leave?', 'A woman employee who is a victim of violence under RA 9262 can take up to 10 days of paid leave, extendable when needed, to attend to medical and legal concerns.'],
  ['Ano ang VAWC leave?', 'Ang babaeng empleyado na biktima ng karahasan sa ilalim ng RA 9262 ay may hanggang 10 araw na bayad na leave, na puwedeng pahabain kung kailangan, para sa medikal at legal na usapin.'],
  ['什么是 VAWC 假？', '根据 RA 9262 遭受暴力的女性员工，可享有最多 10 天带薪假（必要时可延长），用于处理医疗和法律事务。'], DOLEU)
add('special-leave-women', 'benefits', [A, O, E], [['magna carta', 4], ['gynecological', 4], ['special leave', 3], ['妇科', 4]],
  'RA 9710 (Magna Carta of Women), Sec. 18', '2009-08',
  ['What is the special leave for women?', 'A woman employee with at least 6 months of service in the last 12 months can take up to 2 months of leave with full pay after surgery for a gynecological disorder.'],
  ['Ano ang special leave para sa kababaihan?', 'Ang babaeng empleyado na may hindi bababa sa 6 na buwang serbisyo sa nakaraang 12 buwan ay puwedeng mag-leave nang hanggang 2 buwan na may buong sahod pagkatapos ng operasyon sa gynecological na kondisyon.'],
  ['女性特别假是什么？', '过去 12 个月内工作满 6 个月的女性员工，因妇科疾病手术后可享有最多 2 个月全薪假。'], DOLEU)

# ---------- Separation ----------
add('final-pay', 'separation', [A, O, E], [['final pay', 4], ['last pay', 3], ['resign', 2], ['huling sahod', 4], ['离职', 3], ['最终工资', 4]],
  'DOLE Labor Advisory No. 06, Series of 2020', '2020-04',
  ['When must final pay be released?', 'Within 30 days from the date the employee leaves, unless a company policy or agreement is more favourable. Final pay includes unpaid salary, prorated 13th month pay, cash value of unused service incentive leave and any other amounts due.'],
  ['Kailan dapat ibigay ang final pay?', 'Sa loob ng 30 araw mula sa pag-alis ng empleyado, maliban kung mas mabuti ang patakaran o kasunduan ng kumpanya. Kasama sa final pay ang hindi pa nabayarang sahod, prorated na 13th month pay, cash ng hindi nagamit na service incentive leave, at iba pang dapat bayaran.'],
  ['最终工资必须什么时候发放？', '自员工离职之日起 30 天内发放，公司政策或协议更优的除外。最终工资包括未付工资、按比例的第十三个月工资、未用服务奖励假折现及其他应付款项。'], DOLEU)
add('coe', 'separation', [A, O, E], [['certificate of employment', 4], ['coe', 4], ['在职证明', 4], ['离职证明', 4]],
  'DOLE Labor Advisory No. 06, Series of 2020', '2020-04',
  ['How fast must a certificate of employment be issued?', 'Within 3 days from the employee’s request.'],
  ['Gaano kabilis dapat ibigay ang certificate of employment?', 'Sa loob ng 3 araw mula nang hilingin ng empleyado.'],
  ['在职或离职证明要多快开出？', '员工提出申请后 3 天内。'], DOLEU)
add('separation-pay', 'separation', [A, O], [['separation pay', 4], ['redundancy', 3], ['retrenchment', 3], ['closure', 2], ['遣散', 4]],
  'Labor Code of the Philippines, Arts. 298 and 299', '1974-05',
  ['How much is separation pay?', 'For redundancy or labour-saving devices: one month’s pay per year of service. For retrenchment, closure not due to serious losses, or disease: half a month’s pay per year of service. Either way, at least one month’s pay; six months or more counts as a full year.'],
  ['Magkano ang separation pay?', 'Sa redundancy o labor-saving device: isang buwang sahod kada taon ng serbisyo. Sa retrenchment, pagsasara na hindi dahil sa malaking lugi, o sakit: kalahating buwan kada taon. Alinman, hindi bababa sa isang buwang sahod; ang 6 na buwan pataas ay bilang isang buong taon.'],
  ['遣散费是多少？', '因岗位冗余或引进节省人力设备：每服务一年发一个月工资。因裁员、非严重亏损的停业或疾病：每服务一年发半个月工资。无论哪种至少一个月工资；满 6 个月按一年计。'], DOLEU)
add('retirement-pay', 'separation', [A, O, E], [['retirement', 4], ['retire', 3], ['pagreretiro', 3], ['退休', 4]],
  'RA 7641 (Retirement Pay Law)', '1993-01',
  ['How much is retirement pay without a company plan?', 'An employee aged 60 to 65 with at least 5 years of service gets at least 22.5 days’ pay per year of service: 15 days’ salary, plus one twelfth of 13th month pay, plus 5 days of service incentive leave.'],
  ['Magkano ang retirement pay kung walang company plan?', 'Ang empleyadong 60 hanggang 65 taong gulang na may hindi bababa sa 5 taon ng serbisyo ay makakatanggap ng hindi bababa sa 22.5 araw na sahod kada taon ng serbisyo: 15 araw na sahod, one twelfth ng 13th month pay, at 5 araw ng service incentive leave.'],
  ['没有公司退休计划时，退休金是多少？', '60 至 65 岁、服务满 5 年的员工，每服务一年至少获得 22.5 天工资：15 天工资，加第十三个月工资的十二分之一，再加 5 天服务奖励假。'], DOLEU)

# ---------- Deadlines and forms ----------
add('deadline-1601c', 'deadlines', [A, O], [['1601-c', 4], ['1601c', 4], ['monthly withholding', 3], ['remittance return', 3]],
  'BIR filing calendar; RR 11-2018', '2026-01',
  ['When is BIR Form 1601-C due?', 'Monthly, by the 10th of the following month for non-eFPS filers. eFPS filers file between the 11th and 15th depending on their group. The December return is due January 15. When a deadline falls on a weekend or holiday, it moves to the next working day.'],
  ['Kailan ang deadline ng BIR Form 1601-C?', 'Buwanan, hanggang ika-10 ng susunod na buwan para sa hindi naka-eFPS. Ang naka-eFPS ay mula ika-11 hanggang ika-15 depende sa grupo. Ang para sa Disyembre ay hanggang January 15. Kung tumapat sa weekend o holiday, lilipat sa susunod na araw ng trabaho.'],
  ['BIR 1601-C 表格何时截止？', '按月申报，非 eFPS 申报人为次月 10 日前；eFPS 申报人按组别在 11 日至 15 日之间。12 月的申报于次年 1 月 15 日截止。遇周末或节假日顺延至下一个工作日。'], BIRU)
add('deadline-1604c', 'deadlines', [A, O], [['1604-c', 4], ['1604c', 4], ['alphalist', 4], ['annual information', 3]],
  'BIR filing calendar; RR 11-2018', '2026-01',
  ['When are Form 1604-C and the alphalist due?', 'By January 31 of the following year, covering all compensation and tax withheld in the year. The totals must match the monthly 1601-C returns and each employee’s Form 2316.'],
  ['Kailan ang deadline ng Form 1604-C at alphalist?', 'Hanggang January 31 ng susunod na taon, para sa lahat ng sahod at tax na nakaltas sa taon. Dapat tugma ang mga total sa buwanang 1601-C at sa Form 2316 ng bawat empleyado.'],
  ['1604-C 表格和员工名册何时截止？', '次年 1 月 31 日前，涵盖全年所有工资和预扣税。合计数必须与每月 1601-C 申报及每位员工的 2316 表格一致。'], BIRU)
add('deadline-2316', 'deadlines', [A, O, E], [['2316', 4], ['certificate of compensation', 4]],
  'BIR filing calendar; RR 11-2018', '2026-01',
  ['When is BIR Form 2316 due?', 'Employers give each employee a signed Form 2316 by January 31, including employees who left during the year. Copies for substituted filing are submitted to the BIR by February 28.'],
  ['Kailan ang deadline ng BIR Form 2316?', 'Ibibigay ng employer ang pirmadong Form 2316 sa bawat empleyado hanggang January 31, kasama ang mga umalis sa taon. Ang kopya para sa substituted filing ay isusumite sa BIR hanggang February 28.'],
  ['BIR 2316 表格何时截止？', '雇主须在 1 月 31 日前向每位员工（包括年内离职员工）发放已签署的 2316 表格；替代申报的副本须在 2 月 28 日前提交 BIR。'], BIRU)
add('bir-penalties', 'deadlines', [A, O], [['surcharge', 4], ['interest', 2], ['late filing', 3], ['penalty', 1], ['bir', 1], ['罚款', 2]],
  'NIRC Secs. 248 and 249, as amended by RA 11976 (Ease of Paying Taxes Act)', '2024-01',
  ['What happens if a BIR return is filed late?', 'Late filing or payment generally costs a 25% surcharge plus 12% interest a year. Under the Ease of Paying Taxes Act, micro and small taxpayers pay a reduced 10% surcharge and half the interest. A compromise penalty may also apply.'],
  ['Ano ang mangyayari kung late ang pag-file sa BIR?', 'Karaniwan, 25% surcharge at 12% interest kada taon. Sa ilalim ng Ease of Paying Taxes Act, ang micro at small taxpayer ay 10% surcharge lang at kalahati ng interest. Puwede ring may compromise penalty.'],
  ['BIR 逾期申报会怎样？', '逾期申报或缴税一般加收 25% 附加费，另按年利率 12% 计息。根据《便利纳税法》，微型和小型纳税人的附加费降为 10%，利息减半。还可能有和解罚款。'], BIRU)
add('privacy', 'deadlines', [A, O], [['privacy', 4], ['data privacy', 4], ['breach', 3], ['npc', 3], ['隐私', 4]],
  'RA 10173 (Data Privacy Act of 2012); NPC Circular 16-03', '2012-08',
  ['What privacy rules apply to payroll data?', 'Government ID numbers, health and salary details are personal information, and ID numbers and health data are sensitive. Limit access to people who need it, keep records secure, and report a serious breach to the National Privacy Commission within 72 hours.'],
  ['Anong patakaran sa privacy ang para sa payroll data?', 'Ang government ID number, health at sahod ay personal information, at sensitive ang ID number at health data. Limitahan ang access sa mga kailangan lang, panatilihing ligtas, at i-report ang seryosong breach sa National Privacy Commission sa loob ng 72 oras.'],
  ['工资数据适用哪些隐私规定？', '政府证件号码、健康和薪资信息都属于个人信息，其中证件号码和健康数据属于敏感信息。仅限有需要的人访问，妥善保管，发生严重泄露须在 72 小时内向国家隐私委员会报告。'])

# ---------- Using Talaan ----------
T = 'Talaan help'
add('how-payrun', 'talaan', [A], [['how to run', 4], ['run payroll', 4], ['pay run', 3], ['start', 1], ['paano mag-payroll', 4], ['怎么发薪', 4], ['发薪', 2]], T, '2026-10',
  ['How do I run payroll in Talaan?', 'Go to Payroll → Pay runs, choose the client and cutoff, and press Start. Talaan fills in pay template items, loan deductions and approved leave without pay. Enter only what changed (absences, overtime, night hours, holidays), review the checks, send for approval, then download the files.'],
  ['Paano mag-payroll sa Talaan?', 'Pumunta sa Payroll → Mga pay run, piliin ang client at cutoff, at pindutin ang Simulan. Pupunan ng Talaan ang pay template, kaltas sa loan at aprubadong leave na walang bayad. Ilagay lang ang nagbago (absent, overtime, oras sa gabi, holiday), tingnan ang mga check, ipadala para sa approval, saka i-download ang mga file.'],
  ['在 Talaan 怎么发薪？', '进入“工资 → 发薪批次”，选择客户和工资周期，点击“开始”。Talaan 会自动填入工资模板项目、借款扣款和已批准的无薪假。只填写有变化的内容（缺勤、加班、夜班、节假日），查看检查结果，提交审批，然后下载文件。'])
add('how-red', 'talaan', [A], [['red', 3], ['cannot continue', 4], ['continue', 1], ['locked', 1], ['pula', 3], ['红色', 4], ['blocked', 3]], T, '2026-10',
  ['Why can’t I continue past the checks?', 'A red check means something would make the pay run wrong or illegal, like a missing ID number or pay below minimum wage. Press Fix now to open the exact record. Yellow checks only need a short reason.'],
  ['Bakit hindi ako makatuloy sa mga check?', 'Ang pulang check ay may maling magpapamali o magpapailegal sa pay run, gaya ng kulang na ID number o sahod na mas mababa sa minimum wage. Pindutin ang Ayusin ngayon para buksan ang mismong record. Ang dilaw ay maikling dahilan lang ang kailangan.'],
  ['为什么检查后不能继续？', '红色检查表示存在会导致发薪错误或违法的问题，例如缺少证件号码或工资低于最低工资。点击“立即修正”即可打开对应记录。黄色检查只需填写简短原因。'])
add('how-approve', 'talaan', [A, O], [['approve', 3], ['cannot approve', 4], ['two-person', 4], ['aprubahan', 3], ['批准', 4]], T, '2026-10',
  ['Why can’t I approve the pay run?', 'The person who prepared a pay run cannot approve it. The client owner or the firm owner must approve. After approval the pay run is locked, so changes go into the next pay run as adjustments.'],
  ['Bakit hindi ko ma-approve ang pay run?', 'Hindi puwedeng mag-approve ang naghanda ng pay run. Ang may-ari ng client o ng firm ang dapat mag-approve. Pagkatapos ma-approve, naka-lock na ito, kaya ang mga pagbabago ay ilalagay sa susunod na pay run bilang adjustment.'],
  ['为什么我不能批准发薪？', '准备发薪的人不能自己批准，须由客户老板或事务所负责人批准。批准后发薪即被锁定，如需修改，请在下一次发薪中作为调整处理。'])
add('how-file', 'talaan', [A], [['mark as filed', 4], ['filed', 2], ['reference number', 4], ['upload', 2], ['file with', 3], ['can talaan', 3], ['for me', 2], ['mag-file', 4], ['para sa akin', 2], ['替我', 4], ['申报', 2], ['i-file', 3]], T, '2026-10',
  ['Can Talaan file with BIR, SSS, PhilHealth or Pag-IBIG for me?', 'Not yet. Talaan prepares each file and shows where to upload it. After you upload and pay on the agency portal, record the reference number, amount and receipt under Compliance → Remit and pay to mark it as filed. Direct filing through an accredited partner is planned for Phase 2.'],
  ['Kaya bang mag-file ng Talaan sa BIR, SSS, PhilHealth o Pag-IBIG para sa akin?', 'Hindi pa. Inihahanda ng Talaan ang bawat file at ipinapakita kung saan ia-upload. Pagkatapos mag-upload at magbayad sa portal, itala ang reference number, halaga at resibo sa Compliance → Remit at bayad para markahang na-file. Ang direktang pag-file sa pamamagitan ng accredited partner ay nakaplano sa Phase 2.'],
  ['Talaan 能替我向 BIR、SSS、PhilHealth 或 Pag-IBIG 申报吗？', '暂时不能。Talaan 会准备好每个文件并告诉你上传到哪里。在机构网站上传并缴款后，在“合规 → 缴款与支付”中记录参考号、金额和收据，即可标记为已申报。通过认证合作伙伴直接申报计划在第二阶段推出。'])
add('how-import', 'talaan', [A], [['import', 3], ['excel', 3], ['spreadsheet', 3], ['paste', 2], ['timesheet', 3], ['表格', 3], ['导入', 4]], T, '2026-10',
  ['How do I bring in hours from Excel?', 'In step 2 of a pay run, choose Paste from a spreadsheet and paste rows with a header such as Name, Absent, OT, ND. Talaan matches employees by name and remembers the column setup for that client.'],
  ['Paano ilagay ang oras mula sa Excel?', 'Sa hakbang 2 ng pay run, piliin ang I-paste mula sa spreadsheet at i-paste ang mga row na may header gaya ng Name, Absent, OT, ND. Itutugma ng Talaan ayon sa pangalan at tatandaan ang ayos ng columns para sa client na iyon.'],
  ['怎么从 Excel 导入工时？', '在发薪第 2 步选择“从表格粘贴”，粘贴带标题行（如 Name、Absent、OT、ND）的数据。Talaan 按姓名匹配员工，并记住该客户的列设置。'])
add('how-language', 'talaan', [A, O, E], [['language', 4], ['tagalog', 3], ['chinese', 3], ['wika', 4], ['语言', 4], ['中文', 3]], T, '2026-10',
  ['How do I change the language?', 'Use the English, Tagalog or 中文 buttons at the top of any page. Government terms such as SSS, BIR and form numbers stay the same in every language.'],
  ['Paano palitan ang wika?', 'Gamitin ang English, Tagalog o 中文 na button sa itaas ng kahit anong page. Hindi nagbabago ang mga terminong gaya ng SSS, BIR at numero ng form sa alinmang wika.'],
  ['怎么切换语言？', '在任何页面顶部点击 English、Tagalog 或“中文”按钮。SSS、BIR 等政府术语和表格编号在各语言中保持不变。'])
add('how-xero', 'talaan', [A, O], [['xero', 4], ['journal', 3], ['books', 2], ['accounting', 2], ['凭证', 3]], T, '2026-10',
  ['How does Talaan send payroll to Xero?', 'After approval, step 5 shows the payroll journal. Press Send to Xero to post it to the client’s Xero as a manual journal; the Books page also downloads it for QuickBooks or other apps, split by department if the client tracks departments. Connect Xero first in the client’s settings. In the prototype this connection is a demo.'],
  ['Paano ipinapadala ng Talaan ang payroll sa Xero?', 'Pagkatapos ma-approve, makikita ang payroll journal sa hakbang 5. Pindutin ang Ipadala sa Xero para i-post ito sa Xero ng client bilang manual journal; sa page na Books, puwede rin itong i-download para sa QuickBooks o ibang app, hati ayon sa department kung tina-track ito ng client. I-connect muna ang Xero sa settings ng client. Sa prototype, demo lang ang koneksyon.'],
  ['Talaan 怎么把工资发送到 Xero？', '批准后，第 5 步会显示工资凭证。点击“发送到 Xero”即可作为手工凭证过账到客户的 Xero；在“账务”页面也可下载给 QuickBooks 或其他软件使用，并可按部门拆分。请先在客户设置中连接 Xero。原型中的连接仅为演示。'])

# ---------- Employees ----------
add('emp-deductions', 'employees', [E], [['deduction', 3], ['kaltas', 4], ['why deducted', 4], ['扣款', 4], ['payslip', 1]], T, '2026-10',
  ['What are the deductions on my payslip?', 'SSS, PhilHealth and Pag-IBIG are your share of government contributions; your employer pays its own share on top. Withholding tax is income tax taken in advance. Loans appear only if you have an SSS or Pag-IBIG loan.'],
  ['Ano ang mga kaltas sa payslip ko?', 'Ang SSS, PhilHealth at Pag-IBIG ay bahagi mo sa kontribusyon sa gobyerno; may sariling bahagi rin ang employer mo. Ang withholding tax ay income tax na kinakaltas nang maaga. Lalabas lang ang loan kung may SSS o Pag-IBIG loan ka.'],
  ['工资单上的扣款是什么？', 'SSS、PhilHealth 和 Pag-IBIG 是你应缴的政府缴款部分，雇主另外缴纳其部分。预扣税是提前扣缴的个人所得税。只有在你有 SSS 或 Pag-IBIG 贷款时才会显示贷款扣款。'])
add('emp-netchange', 'employees', [E], [['different', 2], ['changed', 2], ['lower', 2], ['higher', 2], ['bakit iba', 4], ['为什么不同', 4], ['net pay', 2]], T, '2026-10',
  ['Why is my net pay different this cutoff?', 'Net pay changes with absences, overtime, night hours, holidays worked, allowances and loan deductions. Open the payslip to see each line. If something looks wrong, ask your HR or payroll contact.'],
  ['Bakit iba ang net pay ko ngayong cutoff?', 'Nagbabago ang net pay dahil sa absent, overtime, oras sa gabi, holiday na pumasok, allowance at kaltas sa loan. Buksan ang payslip para makita ang bawat linya. Kung may mukhang mali, magtanong sa HR o payroll.'],
  ['为什么这一期的实发工资不一样？', '实发工资会随缺勤、加班、夜班、节假日上班、津贴和贷款扣款而变化。打开工资单可查看每一项。如有疑问，请联系人事或工资负责人。'])


# ---------- Using Talaan: features added in version 0.9 ----------
add('how-modules', 'talaan', [A, O], [['module', 4], ['modules', 4], ['subscription', 3], ['turn on', 2], ['mga module', 4], ['模块', 4]], T, '2026-10',
  ['What are the Talaan modules and how do I turn them on?', 'Talaan has six modules: Payroll, Compliance, Books, HR, AI (Ask Tala) and Analytics. The firm owner turns them on for each client under Clients → the client → Talaan modules. Menus show only the modules that are on, and the price is per active employee for each module.'],
  ['Ano ang mga module ng Talaan at paano ito bubuksan?', 'Anim ang module ng Talaan: Payroll, Compliance, Books, HR, AI (Ask Tala) at Analytics. Binubuksan ito ng may-ari ng firm para sa bawat client sa Clients → ang client → Mga module ng Talaan. Ang nakabukas lang ang lumalabas sa menu, at ang presyo ay bawat aktibong empleyado sa bawat module.'],
  ['Talaan 有哪些模块？怎么开启？', 'Talaan 有六个模块：工资、合规、账务、人事、AI（问 Tala）和分析。事务所负责人在“客户 → 该客户 → Talaan 模块”中为每个客户开启。菜单只显示已开启的模块，价格按每个模块的在职员工人数计算。'])
add('how-templates', 'talaan', [A], [['pay template', 5], ['pay item', 4], ['allowance every', 3], ['recurring', 3], ['umuulit', 3], ['工资模板', 5], ['固定项目', 3], ['每期固定', 6]], T, '2026-10',
  ['How do I set up recurring allowances and deductions?', 'Add the item once under Payroll → Pay items (taxable allowance, de minimis, deduction or reimbursement). Then open Payroll → Pay templates, choose the client and add the item and amount per cutoff for each employee. New regular pay runs fill them in automatically; open a draft and press Refresh to update it.'],
  ['Paano mag-set up ng umuulit na allowance at kaltas?', 'Idagdag ang item nang isang beses sa Payroll → Mga pay item (allowance na may buwis, de minimis, kaltas o reimbursement). Saka buksan ang Payroll → Mga pay template, piliin ang client at idagdag ang item at halaga bawat cutoff para sa bawat empleyado. Kusang pupunan ito ng mga bagong regular na pay run; buksan ang draft at pindutin ang Refresh para i-update.'],
  ['怎么设置每期固定的津贴和扣款？', '先在“工资 → 工资项目”中添加一次（应税津贴、小额免税福利、扣款或报销）。然后打开“工资 → 工资模板”，选择客户，为每名员工添加项目和每期金额。新的常规发薪会自动填入；打开草稿并点击“刷新”即可更新。'])
add('how-loans', 'talaan', [A], [['loan', 3], ['cash advance', 4], ['salary loan', 3], ['loan balance', 4], ['utang', 2], ['借款', 4], ['预支', 4]], T, '2026-10',
  ['How do I deduct an SSS loan or a cash advance?', 'Go to Payroll → Loans and deductions and press Add loan. Enter the amount borrowed, the deduction per cutoff and the first cutoff. Talaan deducts it in every regular pay run, shows the balance and stops at zero. SSS and Pag-IBIG loan amounts must match the agency’s billing.'],
  ['Paano kaltasan ang SSS loan o cash advance?', 'Pumunta sa Payroll → Loan at kaltas at pindutin ang Magdagdag ng loan. Ilagay ang halagang hiniram, kaltas bawat cutoff at unang cutoff. Kakaltasin ito ng Talaan sa bawat regular na pay run, ipapakita ang balanse at hihinto kapag zero na. Dapat tugma ang halaga ng SSS at Pag-IBIG loan sa billing ng ahensya.'],
  ['怎么扣 SSS 贷款或预支款？', '进入“工资 → 借款与扣款”，点击“添加借款”，填写借款金额、每期扣款和首次扣款期。Talaan 会在每次常规发薪时扣除，显示余额，余额为零时停止。SSS 和 Pag-IBIG 贷款金额必须与机构账单一致。'])
add('how-bonus-run', 'talaan', [A], [['13th month pay run', 5], ['bonus run', 5], ['off-cycle', 4], ['separate pay run', 4], ['reimbursement run', 4], ['hiwalay na pay run', 4], ['额外发薪', 4], ['奖金发薪', 4], ['separately', 6], ['hiwalay', 6], ['单独发放', 6]], T, '2026-10',
  ['How do I pay the 13th month or a bonus separately?', 'In Payroll → Pay runs, press Bonus or reimbursement run. Choose the client, the cutoff to pay with and the employees. For the 13th month, Talaan fills in basic pay earned this year divided by 12, less what was already paid, and taxes only the part above the ₱90,000 limit. No SSS, PhilHealth or Pag-IBIG is deducted. It goes through the same checks and approval.'],
  ['Paano ibigay nang hiwalay ang 13th month o bonus?', 'Sa Payroll → Mga pay run, pindutin ang Pay run para sa bonus o reimbursement. Piliin ang client, cutoff na kasabay ng bayad at mga empleyado. Para sa 13th month, pupunan ng Talaan ang basic pay ngayong taon na hinati sa 12, bawas ang naibigay na, at ang lampas lang sa ₱90,000 na limit ang bubuwisan. Walang kaltas na SSS, PhilHealth o Pag-IBIG. Dadaan ito sa parehong check at approval.'],
  ['怎么单独发放第13个月工资或奖金？', '在“工资 → 发薪批次”中点击“奖金或报销发薪”，选择客户、随哪一期发放以及员工。第13个月工资由 Talaan 按本年基本工资除以 12、减去已发金额自动填写，只对超过 ₱90,000 限额的部分计税，不扣 SSS、PhilHealth 或 Pag-IBIG。同样需要检查和审批。'])
add('how-finalpay', 'talaan', [A], [['final pay run', 5], ['employee leaving', 4], ['resigned employee', 4], ['last salary', 3], ['aalis na empleyado', 4], ['离职结算', 5], ['final pay in talaan', 7], ['final pay sa talaan', 7], ['办理离职结算', 6]], T, '2026-10',
  ['How do I process final pay in Talaan?', 'In Payroll → Pay runs, press Final pay, choose the employee, the last day of work and the reason. Talaan works out the last salary, the pro-rated 13th month, unused convertible leave and the tax adjustment for the year, and prepares a certificate of employment. Release it within 30 days unless a better company policy applies.'],
  ['Paano mag-process ng final pay sa Talaan?', 'Sa Payroll → Mga pay run, pindutin ang Final pay, piliin ang empleyado, huling araw ng trabaho at dahilan. Kukuwentahin ng Talaan ang huling sahod, pro-rated na 13th month, hindi nagamit na leave na puwedeng gawing pera at adjustment sa buwis ngayong taon, at ihahanda ang certificate of employment. Ibigay ito sa loob ng 30 araw maliban kung may mas magandang patakaran ang kumpanya.'],
  ['在 Talaan 中怎么办理离职结算？', '在“工资 → 发薪批次”中点击“离职结算”，选择员工、最后工作日和原因。Talaan 计算最后工资、按比例的第13个月工资、可折现的未休假期和本年度税款调整，并准备在职证明。除非公司政策更优惠，应在 30 天内发放。'])
add('how-leave', 'talaan', [A, O], [['approve leave', 5], ['leave request', 5], ['file leave', 4], ['leave balance', 4], ['leave without pay', 3], ['hiling na leave', 4], ['请假申请', 5], ['假期余额', 4]], T, '2026-10',
  ['How do leave requests work in Talaan?', 'Employees request leave from My leave, or staff file it under HR → File leave. The client owner or firm owner approves it under HR → Leave requests. Approved leave without pay is deducted as absent days in the pay run for those dates; paid leave does not change pay. HR → Leave balances shows the days left.'],
  ['Paano gumagana ang hiling na leave sa Talaan?', 'Humihiling ang empleyado sa Aking leave, o nagfa-file ang staff sa HR → Mag-file ng leave. Inaaprubahan ito ng may-ari ng client o firm sa HR → Mga hiling na leave. Ibinabawas bilang absent ang aprubadong leave na walang bayad sa pay run ng mga petsang iyon; hindi nagbabago ang sahod sa leave na may bayad. Makikita sa HR → Balanse ng leave ang natitirang araw.'],
  ['Talaan 的请假申请怎么运作？', '员工在“我的假期”中申请，或由工作人员在“人事 → 登记请假”中登记。客户老板或事务所负责人在“人事 → 请假申请”中审批。已批准的无薪假会在对应日期所在的发薪中按缺勤扣除；带薪假不影响工资。“人事 → 假期余额”显示剩余天数。'])
add('how-byo', 'talaan', [A], [['another payroll system', 5], ['sprout', 4], ['salarium', 4], ['payroll register', 4], ['import payroll', 5], ['ibang payroll system', 5], ['其他工资系统', 5], ['工资明细表', 4]], T, '2026-10',
  ['Can a client that uses another payroll system still use Talaan?', 'Yes. Set the client’s payroll to Another payroll system, then each month upload its payroll register under Compliance → Import payroll. Talaan checks the SSS, PhilHealth, Pag-IBIG and tax figures against its own tables, flags differences, and prepares the government files from the register.'],
  ['Puwede pa bang gumamit ng Talaan ang client na may ibang payroll system?', 'Oo. Itakda ang payroll ng client sa Ibang payroll system, saka buwan-buwan i-upload ang payroll register nito sa Compliance → Import payroll. Susuriin ng Talaan ang SSS, PhilHealth, Pag-IBIG at buwis gamit ang sarili nitong table, ituturo ang pagkakaiba, at ihahanda ang mga file para sa gobyerno mula sa register.'],
  ['使用其他工资系统的客户还能用 Talaan 吗？', '可以。将该客户的工资来源设为“其他工资系统”，每月在“合规 → 导入工资”中上传工资明细表。Talaan 用自己的费率表核对 SSS、PhilHealth、Pag-IBIG 和税款，标出差异，并根据明细表准备政府申报文件。'])
add('how-calendar', 'talaan', [A, O], [['deadline calendar', 5], ['calendar', 3], ['all deadlines', 4], ['kalendaryo', 4], ['日历', 4], ['all the deadlines', 7], ['lahat ng deadline', 7], ['所有客户的截止日', 6]], T, '2026-10',
  ['Where can I see all the deadlines for my clients?', 'Compliance → Deadline calendar shows every client’s paydays and SSS, PhilHealth, Pag-IBIG and BIR due dates in one month. Green is done, amber is due within 3 days and red is late. Export it to Google Calendar or Outlook as a CSV.'],
  ['Saan makikita ang lahat ng deadline ng mga client ko?', 'Ipinapakita ng Compliance → Kalendaryo ng deadline ang sahuran at due date ng SSS, PhilHealth, Pag-IBIG at BIR ng bawat client sa isang buwan. Berde ang tapos, dilaw kung due sa loob ng 3 araw at pula kung huli. I-export ito sa Google Calendar o Outlook bilang CSV.'],
  ['在哪里查看所有客户的截止日？', '“合规 → 截止日日历”在一个月视图中显示所有客户的发薪日以及 SSS、PhilHealth、Pag-IBIG 和 BIR 到期日。绿色为已完成，黄色为 3 天内到期，红色为逾期。可导出为 CSV，导入 Google 日历或 Outlook。'])
add('how-reports', 'talaan', [A, O], [['dashboard', 4], ['report', 3], ['reports', 3], ['analytics', 4], ['payroll cost', 3], ['ulat', 2], ['看板', 4], ['报表', 4]], T, '2026-10',
  ['Where are the dashboards and reports?', 'Analytics → Dashboard shows employees, payroll cost, government payments, on-time filing and cost by department, for all clients or one. Analytics → Reports downloads the payroll summary, year to date by employee, remittances, cost by department, leave balances and loans as CSV for Excel.'],
  ['Nasaan ang dashboard at mga report?', 'Ipinapakita ng Analytics → Dashboard ang empleyado, gastos sa payroll, bayad sa gobyerno, filing sa oras at gastos ayon sa department, para sa lahat ng client o isa. Dina-download ng Analytics → Mga report ang buod ng payroll, year to date bawat empleyado, remittance, gastos ayon sa department, balanse ng leave at loan bilang CSV para sa Excel.'],
  ['看板和报表在哪里？', '“分析 → 看板”显示全部或单个客户的员工人数、工资成本、政府缴款、按时申报和各部门成本。“分析 → 报表”可将工资汇总、员工年初至今、缴款、各部门成本、假期余额和借款下载为 CSV，用 Excel 打开。'])
add('how-history', 'talaan', [A, O], [['salary change', 4], ['who changed', 5], ['history', 3], ['audit trail', 4], ['kasaysayan', 4], ['变更记录', 5], ['调薪', 3]], T, '2026-10',
  ['How do I see who changed an employee’s salary?', 'Open the client, then the 🕘 button next to the employee, or HR → People. Every change to salary, position, bank account or ID numbers is recorded with who made it, when and the reason given. Bank and ID numbers are masked in the history.'],
  ['Paano makita kung sino ang nagpalit ng sahod ng empleyado?', 'Buksan ang client, saka ang 🕘 na button sa tabi ng empleyado, o ang HR → Mga tao. Naitatala ang bawat pagbabago sa sahod, posisyon, bank account o ID number kasama kung sino, kailan at ang dahilan. Nakatago ang bank at ID number sa kasaysayan.'],
  ['怎么查看谁修改了员工工资？', '打开客户，点击员工旁的 🕘 按钮，或进入“人事 → 员工”。工资、职位、银行账号或证件号码的每次修改都会记录操作人、时间和原因。银行账号和证件号码在记录中会被遮盖。'])
add('how-support', 'talaan', [A, O], [['contact support', 5], ['report a problem', 5], ['ticket', 4], ['help desk', 4], ['support', 3], ['kontakin', 4], ['联系支持', 5], ['工单', 4]], T, '2026-10',
  ['How do I report a problem or ask Talaan support?', 'Press Contact support at the top right of any page. Talaan attaches the page, your name and the app version automatically. Do not include salaries, ID numbers or bank details. Replies appear under My tickets in the same window and by email.'],
  ['Paano mag-report ng problema o magtanong sa Talaan support?', 'Pindutin ang Kontakin ang support sa kanang itaas ng kahit anong page. Kusang ilalakip ng Talaan ang page, pangalan mo at bersyon ng app. Huwag isama ang sahod, ID number o detalye ng bangko. Lalabas ang sagot sa Aking mga ticket sa parehong window at sa email.'],
  ['怎么报告问题或联系 Talaan 支持？', '点击任何页面右上角的“联系支持”。Talaan 会自动附上页面、你的姓名和应用版本。请不要填写工资、证件号码或银行信息。回复会显示在同一窗口的“我的工单”中，并通过邮件发送。'])
add('emp-leave', 'employees', [E], [['request leave', 5], ['my leave', 4], ['leave left', 4], ['humiling ng leave', 5], ['申请请假', 5], ['剩余假期', 4]], T, '2026-10',
  ['How do I request leave and see how many days I have left?', 'Open My leave. Your balances for this year are at the top. Press Request leave, choose the type and dates, and send. Your employer approves it and you get a notice. Leave without pay is deducted from that cutoff’s pay.'],
  ['Paano humiling ng leave at makita ang natitirang araw?', 'Buksan ang Aking leave. Nasa itaas ang balanse mo ngayong taon. Pindutin ang Humiling ng leave, piliin ang uri at petsa, at ipadala. Aaprubahan ito ng employer mo at makakatanggap ka ng abiso. Ibinabawas sa sahod ng cutoff na iyon ang leave na walang bayad.'],
  ['怎么申请请假、查看剩余天数？', '打开“我的假期”，顶部显示本年余额。点击“申请请假”，选择类型和日期后提交。雇主审批后你会收到通知。无薪假会从当期工资中扣除。'])

# ---------- Rules behind the new features ----------
add('holidays-2026', 'pay', [A, O, E], [['holidays 2026', 5], ['holiday list', 5], ['2026 holidays', 5], ['proclamation 1006', 5], ['listahan ng holiday', 5], ['节假日', 4], ['假日表', 4], ['holiday sa 2026', 7], ['the 2026 holidays', 7], ['2026 年有哪些节假日', 7]],
  'Proclamation No. 1006 (s. 2025), 2026 regular holidays and special non-working days', '2026-01',
  ['What are the 2026 holidays?', 'Regular holidays: 1 January, 2 and 3 April (Maundy Thursday, Good Friday), 9 April, 1 May, 12 June, 31 August, 30 November, 25 and 30 December. Special non-working days: 21 August, 1 and 2 November, 8, 24 and 31 December, 4 April, and Chinese New Year (17 February). Eid holidays are set by separate proclamations.'],
  ['Ano ang mga holiday sa 2026?', 'Regular holiday: 1 Enero, 2 at 3 Abril (Huwebes at Biyernes Santo), 9 Abril, 1 Mayo, 12 Hunyo, 31 Agosto, 30 Nobyembre, 25 at 30 Disyembre. Special non-working day: 21 Agosto, 1 at 2 Nobyembre, 8, 24 at 31 Disyembre, 4 Abril, at Chinese New Year (17 Pebrero). Hiwalay na proklamasyon ang nagtatakda ng Eid.'],
  ['2026 年有哪些节假日？', '法定节假日：1 月 1 日，4 月 2 日和 3 日（濯足节、耶稣受难日），4 月 9 日，5 月 1 日，6 月 12 日，8 月 31 日，11 月 30 日，12 月 25 日和 30 日。特别非工作日：8 月 21 日，11 月 1 日和 2 日，12 月 8 日、24 日和 31 日，4 月 4 日，以及春节（2 月 17 日）。开斋节和宰牲节另行公布。'],
  'https://www.officialgazette.gov.ph', V2)
add('leave-monetize', 'tax', [A, O], [['unused leave', 4], ['leave conversion', 5], ['convert leave', 5], ['monetized', 4], ['commutation', 3], ['gawing pera', 4], ['假期折现', 5], ['未休假', 4]],
  'Labor Code Art. 95 (service incentive leave commutable to cash); RR 11-2018 (de minimis: monetized unused vacation leave up to 10 days)', '2018-01',
  ['Is converting unused leave to cash taxable?', 'Unused service incentive leave must be paid in cash at year end or on separation. For private employees, cash for up to 10 days of unused vacation leave a year is a tax-free de minimis benefit; anything above that is taxable pay. Talaan applies the 10-day limit in final pay.'],
  ['May buwis ba ang hindi nagamit na leave na ginawang pera?', 'Dapat bayaran ng pera ang hindi nagamit na service incentive leave sa katapusan ng taon o sa paghihiwalay. Sa pribadong empleyado, walang buwis ang pera para sa hanggang 10 araw na hindi nagamit na vacation leave kada taon (de minimis); may buwis ang lampas doon. Inilalapat ng Talaan ang 10-araw na limit sa final pay.'],
  ['未休假期折现要缴税吗？', '未休的服务奖励假须在年底或离职时折现支付。私营企业员工每年最多 10 天未休年假的折现属于小额免税福利，超出部分为应税工资。Talaan 在离职结算中套用 10 天限额。'], BIRU)
add('reimburse-tax', 'tax', [A, O], [['reimbursement', 4], ['reimburse', 4], ['liquidated', 3], ['receipts', 2], ['ibinalik na gastos', 4], ['报销', 5]],
  'NIRC Sec. 32(A) and RR 2-98, Sec. 2.78.1 (expenses incurred for the employer, liquidated with receipts, are not compensation)', '1998-04',
  ['Are reimbursements to employees taxable?', 'Expenses an employee pays for the business, such as fuel, meals or training, are not compensation when they are reimbursed against receipts in the employer’s name and liquidated. They are added to net pay and not taxed. Fixed allowances paid without receipts are taxable unless they are de minimis.'],
  ['May buwis ba ang reimbursement sa empleyado?', 'Hindi sahod ang gastos na binayaran ng empleyado para sa negosyo, gaya ng fuel, pagkain o training, kapag ibinalik ito batay sa resibo sa pangalan ng employer at na-liquidate. Idinadagdag ito sa net pay at walang buwis. May buwis ang nakapirming allowance na walang resibo maliban kung de minimis.'],
  ['给员工的报销要缴税吗？', '员工为公司垫付的费用（如燃油、餐费或培训），如果凭以雇主名义开具的收据报销并已核销，不属于工资，加到实发工资中，不计税。无收据的固定津贴需计税，属于小额免税福利的除外。'], BIRU)
add('loan-deduct', 'contributions', [A, O], [['loan amortization', 5], ['sss loan', 4], ['pag-ibig loan', 4], ['deduct loan', 4], ['kaltas sa loan', 5], ['贷款扣款', 5], ['代扣', 6], ['贷款还款', 6], ['loan payments', 6], ['bayad sa sss at pag-ibig loan', 7]],
  'SSS and Pag-IBIG employer obligations on member loans (salary deduction and monthly remittance)', '2026-01',
  ['Must the employer deduct SSS and Pag-IBIG loan payments?', 'Yes. When SSS or Pag-IBIG bills a member loan, the employer deducts the monthly amortization from pay and remits it with the contributions (SSS ML-2, Pag-IBIG STLRF). Late remittance carries penalties. Record each loan in Talaan so the deduction and balance are tracked.'],
  ['Kailangan bang kaltasan ng employer ang bayad sa SSS at Pag-IBIG loan?', 'Oo. Kapag nag-bill ang SSS o Pag-IBIG ng loan ng miyembro, kinakaltas ng employer ang buwanang hulog sa sahod at nire-remit kasama ng kontribusyon (SSS ML-2, Pag-IBIG STLRF). May multa ang late na remittance. Itala ang bawat loan sa Talaan para masubaybayan ang kaltas at balanse.'],
  ['雇主必须代扣 SSS 和 Pag-IBIG 贷款还款吗？', '是的。SSS 或 Pag-IBIG 对会员贷款出账后，雇主须从工资中扣除每月还款，并随缴款一起上缴（SSS ML-2、Pag-IBIG STLRF）。逾期上缴会被罚款。请在 Talaan 中登记每笔贷款，以便跟踪扣款和余额。'], SSSU)

# ---------- Added 28 October 2026: regional wage orders, overtime premiums, billing and payments ----------
add('min-wage-regions', 'pay', [A, O], [['outside metro manila', 8], ['labas ng metro manila', 8], ['以外', 5], ['大都会以外', 8], ['minimum wage', 2], ['region', 3], ['regional', 4], ['cebu', 4], ['davao', 4], ['calabarzon', 4], ['central luzon', 4], ['province', 3], ['probinsya', 4], ['rehiyon', 4], ['各地区', 5], ['省', 2], ['wage order', 1]],
  'Regional wage orders listed by NWPC (CAR-24, RB 1-24, RTWPB 2-24, RBIII-26, IVA-23, RB-MIMAROPA-13, RBV-23, RBVI-29, ROVII-27, RB VIII-25, RIX-24, RX-24, RB XI-24, RB XII-25, RXIII-20, BARMM-05)', '2026-10',
  ['What is the minimum wage outside Metro Manila?', 'Each region has its own wage order. Highest daily non-agriculture rates as of 28 October 2026: Region IV-A ₱645 (IVA-23, from 26 October 2026), Region III ₱600, Region VII ₱582 Class A (ROVII-27, from 14 October 2026), Region VI ₱550, Region XI ₱540 (from 1 September 2026), CAR and Region I ₱505, Regions II and X ₱500. Rates vary by area and sector, so pick the client’s region in Talaan and confirm with the regional wage board.'],
  ['Magkano ang minimum wage sa labas ng Metro Manila?', 'May sariling wage order ang bawat rehiyon. Pinakamataas na arawang non-agriculture rate hanggang 28 Oktubre 2026: Region IV-A ₱645 (IVA-23, mula 26 Oktubre 2026), Region III ₱600, Region VII ₱582 Class A (ROVII-27, mula 14 Oktubre 2026), Region VI ₱550, Region XI ₱540 (mula 1 Setyembre 2026), CAR at Region I ₱505, Region II at X ₱500. Iba-iba ang rate ayon sa lugar at sektor, kaya piliin ang rehiyon ng client sa Talaan at kumpirmahin sa regional wage board.'],
  ['马尼拉大都会以外的最低工资是多少？', '各地区有各自的工资令。截至 2026 年 10 月 28 日的非农业最高日薪：Region IV-A ₱645（IVA-23，自 2026 年 10 月 26 日起），Region III ₱600，Region VII A 类 ₱582（ROVII-27，自 2026 年 10 月 14 日起），Region VI ₱550，Region XI ₱540（自 2026 年 9 月 1 日起），CAR 和 Region I ₱505，Region II 和 X ₱500。工资因地区和行业而异，请在 Talaan 中选择客户所在地区，并向地区工资委员会确认。'], NWPC, V3)
add('how-pay-invoice', 'talaan', [O], [['pay invoice', 5], ['pay the invoice', 5], ['pay now', 5], ['proof of payment', 6], ['deposit slip', 5], ['paid another way', 6], ['bayaran ang invoice', 5], ['patunay ng bayad', 6], ['付款凭证', 6], ['支付发票', 5], ['gcash', 2], ['maya', 2]], 'Talaan help', '2026-10',
  ['How do I pay my accounting firm’s invoice in Talaan?', 'Open More → Invoices and press Pay now on the invoice. Paying online with GCash, Maya, card or online banking is quickest: the invoice updates straight away and a receipt is emailed. If you paid another way, such as a bank deposit or cheque, press Paid another way, attach the deposit slip or transfer confirmation and send it. Your firm checks it against its statement and confirms or tells you why not.'],
  ['Paano bayaran ang invoice ng accounting firm ko sa Talaan?', 'Buksan ang Higit pa → Mga invoice at pindutin ang Magbayad ngayon sa invoice. Pinakamabilis ang online na bayad gamit ang GCash, Maya, card o online banking: agad na-a-update ang invoice at may resibo sa email. Kung nagbayad ka sa ibang paraan, gaya ng deposito o tseke, pindutin ang Nagbayad sa ibang paraan, ilakip ang deposit slip o kumpirmasyon ng transfer at ipadala. Susuriin ito ng firm mo laban sa statement at kukumpirmahin o sasabihin kung bakit hindi.'],
  ['怎么在 Talaan 中支付会计事务所的发票？', '打开“更多 → 发票”，在发票上点击“立即付款”。使用 GCash、Maya、银行卡或网上银行在线支付最快：发票立即更新，并通过邮件发送收据。如果您已通过其他方式付款（如银行存款或支票），点击“已通过其他方式付款”，附上存款单或转账确认后提交。事务所会与流水核对后确认，或告知不接受的原因。'])
add('how-receivables', 'talaan', [A, O], [['record payment', 5], ['receivables', 5], ['aging', 4], ['ageing', 4], ['unpaid invoices', 5], ['collect', 3], ['statement of account', 5], ['confirm payment', 5], ['2307', 3], ['kolekta', 4], ['应收账款', 5], ['账龄', 5]], 'Talaan help', '2026-10',
  ['How do I track what clients owe and record their payments?', 'Billing → Invoices shows Receivables at the top: outstanding and past-due balances by age (not yet due, 1–30, 31–60, 61–90 and over 90 days) and days to collect. Payments made online are recorded automatically. Proofs that clients upload wait under Payments to confirm: open the file, check your bank or e-wallet statement, then confirm or reject with a reason. Someone else must confirm a payment you sent. Use Record payment for money received directly, including any amount withheld on BIR Form 2307, and Statement of account for each client’s running balance.'],
  ['Paano subaybayan ang utang ng mga client at itala ang bayad nila?', 'Ipinapakita ng Billing → Mga invoice ang Mga receivable sa itaas: hindi pa bayad at lampas na sa due date ayon sa tagal (hindi pa due, 1–30, 31–60, 61–90 at higit 90 araw) at ilang araw bago makolekta. Kusang naitatala ang bayad online. Naghihintay sa Mga bayad na kukumpirmahin ang patunay na in-upload ng client: buksan ang file, suriin ang bank o e-wallet statement, saka kumpirmahin o tanggihan nang may dahilan. Ibang tao ang dapat magkumpirma ng bayad na ikaw ang nagpadala. Gamitin ang Itala ang bayad para sa perang direktang natanggap, kasama ang kinaltas sa BIR Form 2307, at ang Statement of account para sa tumatakbong balanse ng bawat client.'],
  ['怎么跟踪客户欠款并记录收款？', '“账单 → 发票”顶部显示应收账款：按账龄（未到期、1–30、31–60、61–90 和 90 天以上）列出的未收和逾期余额，以及平均收款天数。在线付款会自动入账。客户上传的凭证会在“待确认付款”中等待：打开文件，核对银行或电子钱包流水后确认，或注明原因拒绝。您提交的付款须由他人确认。直接收到的款项（包括按 BIR 2307 表代扣的金额）请用“记录收款”，“对账单”显示每个客户的累计余额。'])
add('how-subscription', 'talaan', [O], [['subscription namin', 7], ['bayaran ang subscription', 7], ['talaan subscription', 6], ['pay talaan', 6], ['talaan invoice', 6], ['our subscription', 5], ['subscription invoice', 6], ['bayad sa talaan', 6], ['talaan 订阅', 6], ['订阅发票', 6]], 'Talaan help', '2026-10',
  ['How do we pay our Talaan subscription?', 'Talaan bills each firm or direct employer monthly for the modules it uses, per active employee. The firm owner opens Billing → Talaan subscription, presses Pay now to pay online, or Paid another way to upload proof of a bank payment for Talaan to confirm. The statement of account shows every invoice and payment. Accounts 30 days past due get a reminder, and at 60 days may move to read-only access until paid.'],
  ['Paano bayaran ang subscription namin sa Talaan?', 'Buwan-buwang sinisingil ng Talaan ang bawat firm o direktang employer para sa mga module na ginagamit, kada aktibong empleyado. Bubuksan ng may-ari ng firm ang Billing → Talaan subscription, pipindutin ang Magbayad ngayon para magbayad online, o Nagbayad sa ibang paraan para mag-upload ng patunay ng bayad sa bangko na kukumpirmahin ng Talaan. Ipinapakita ng statement of account ang bawat invoice at bayad. Pinapaalalahanan ang account na 30 araw nang huli, at sa 60 araw ay maaaring gawing read-only hanggang mabayaran.'],
  ['我们怎么支付 Talaan 订阅费？', 'Talaan 按每家事务所或直接雇主使用的模块和在职员工人数按月收费。事务所负责人打开“账单 → Talaan 订阅”，点击“立即付款”在线支付，或点击“已通过其他方式付款”上传银行付款凭证，由 Talaan 确认。对账单列出每张发票和每笔付款。逾期 30 天的账户会收到提醒，逾期 60 天可能改为只读权限，直至付清。'])

json.dump(C, open('corpus/corpus.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(C), 'entries')
