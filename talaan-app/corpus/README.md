# Talaan corpus

45 question-and-answer entries in English, Tagalog and Simplified Chinese, each with its official
source, effective date and the date it was last checked (4 October 2026). Topics: contributions,
withholding tax, pay rules, leave and benefits, leaving a job, deadlines and compliance, using
Talaan, and questions from employees.

- `corpus.json` — the single source. The app's FAQs page and Ask Tala read it directly.
- `build_corpus.py` — where the entries are written and edited. Run `python3 corpus/build_corpus.py`.
- `md/<category>/<id>.md` and `sources.json` — RAG-ready export with front matter for a vector index
  (run `npm run export:corpus`). Filter searches by `effective` date and `agency`.

## Keep this corpus separate

This corpus belongs to Talaan only. Every entry and exported file is tagged `product: talaan` and
`namespace: talaan-ph-payroll`.

- Load it only into Talaan's own vector index, created for Talaan, with its own API keys and
  environment variables (for example `TALAAN_VECTOR_URL`, `TALAAN_VECTOR_TOKEN`). Do not reuse the
  index, namespace or keys of any other project, including the Investment Research Library.
- Do not add documents from other projects to `corpus.json`. `npm run check:corpus` fails if an
  entry is not tagged for Talaan or contains investment-product terms that belong elsewhere.
- When searching, always filter on `product = talaan` as a second safeguard.
- `npm run check:corpus` — fails if any language is missing, an agency name or peso amount changed in
  translation, Chinese has Traditional characters, a question cannot find its own answer, or an
  off-topic question gets an answer instead of a polite decline.

Updated in this version: de minimis ceilings (RR 29-2025, from 6 January 2026) and NCR minimum wage
₱755 (Wage Order NCR-28, from 26 September 2026). Paternity leave is still 7 days; the 2026 bill to
extend it is not law.

Every legal and tax answer must be reviewed by a CPA and, for labour rules, a labour practitioner
before production use. Re-check sources at least monthly; wage orders and BIR rules change often.
