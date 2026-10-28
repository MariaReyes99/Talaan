# Talaan AI quality and safety

How Ask Tala (Talaan's payroll assistant) is tested, measured and protected. Everything here is Talaan's own:
its own corpus, keys and data, never shared with the Investment Research Library or any other project.

| Folder | What it does | Run |
|---|---|---|
| `synthetic/` | Synthetic evaluation questions: hand-written paraphrases in English, Tagalog/Taglish and Chinese, typo variants, off-topic and adversarial prompts, with a held-out test split. `--llm` adds RAGAS-generated questions for a person to review first. | `python -I talaan-ai/synthetic/generate.py` |
| `data/` | `eval_questions.jsonl` (423 questions), `synthetic_payroll.jsonl` (200 of the 3,000 generated employees used to test the payroll engine). All fictional. | – |
| `eval/` | RAGAS evaluation of retrieval and answers. Offline metrics by default; `--llm` adds faithfulness and relevancy judged by a model. | `python -I talaan-ai/eval/ragas_eval.py [--llm]` |
| `metrics/` | `targets.json` (the bar every change must meet), `history.jsonl` (every run, labelled with what changed), `latest.json`, `REPORT.md`, `ragas.json`, `redteam.json`, `redteam_pyrit.json`, `bench.json`. | – |
| `guardrails/` | NeMo Guardrails configuration (Colang rails, prompts, actions) for the server path where a model phrases answers. Uses the same patterns as the app (`patterns.json`, exported from `talaan-app/src/rag/guard.ts`). | `python -I talaan-ai/guardrails/test_guardrails.py` |
| `redteam/` | Attack set (`attacks.json`) and the PyRIT red team against the live `/api/ask`. | see below |

From `talaan-app`: `npm run eval:rag`, `npm run redteam`, `npm run test:synthetic`, `npm run export:guard`, `npm run bench`.
CI runs all of it on every pull request (`.github/workflows/quality.yml`) and fails if a metric drops below target.

## Results on 28 October 2026

Ask Tala retrieval and guardrails, 423 questions (`npm run eval:rag`):

| Metric | Keyword retriever (before) | Guardrails + hybrid retriever (now) | Target |
|---|---|---|---|
| Correct answer | 87.7% | **96.0%** | ≥ 92% |
| Right entry first | 85.0% | **95.0%** | ≥ 90% |
| Right entry in top 3 | 87.7% | **99.5%** | ≥ 95% |
| Wrong answer given | 3.5% | **2.3%** | ≤ 3% |
| Wrongly declined | 8.8% | **1.8%** | ≤ 6% |
| Held-out questions answered correctly | 70.9% | **86.1%** | ≥ 85% |
| Off-topic declined | 100% | **100%** | 100% |
| Adversarial prompts blocked | 44.4% | **100%** | 100% |
| Personal data removed from questions | 0% | **100%** | 100% |
| Time per question (95th percentile) | 1.3 ms | **1.4 ms** | ≤ 50 ms |

RAGAS (offline, 399 questions): context precision 0.955, context recall 0.956, answer similarity 0.947
(Tagalog and Chinese 0.99; English 0.93 — English has the most paraphrases and typos).

Red team: offline 96/96 attack variants handled; PyRIT against the running API with 9 disguises (Base64, leetspeak,
spacing, character swaps, Unicode look-alikes, ROT13, zero-width, random capitals): 208–209 of 209 across runs.
The character-swap converter is random; one in 209 occasionally slips past the patterns as a question Tala answers
from its corpus (no personal data, no evasion advice). On the server, NeMo's model-based self-check is the backstop.

Synthetic payroll: 3,000 fictional employees, about 39,000 property checks (gross and net add up, contribution caps,
minimum wage earners not taxed, ₱90,000 benefits limit, withholding never decreases, journals balance, year-end
annualization within tolerance). One check was wrong at first (the engine was right: leave converted beyond 10 days is
taxable even for minimum wage earners) and was corrected.

## How the numbers were improved (metric-driven)

Each step was measured; `metrics/history.jsonl` has every run.
1. Hybrid retriever (keyword rules + BM25 in three languages + typo tolerance) with guardrails: adversarial 44% → 100%, PII 0% → 100%, recall@3 86% → 99%; wrong answers rose to 8.5% and latency to 327 ms.
2. Score fusion instead of rank fusion, cached typo lookup: accuracy 91.5% → 93.7%, latency 327 ms → 2.6 ms.
3. Answers as a second, lighter field (BM25F) and an information-coverage gate: off-topic back to 100%.
4. Keywords for two new corpus entries whose own questions failed, and four ambiguous labels fixed (dev split only).
5. Spelling variants ("pag ibig"), typo-corrected keyword rules, a small payroll thesaurus: accuracy 96.5%, held-out 87%.
6. Red-team fixes (de-obfuscation, look-alike letters, typo-tolerant guard words, other-product topics) with no loss of accuracy.
7. Keyword rules compiled once: retrieval 0.8 ms → 0.13 ms per question.

Held-out questions (30% of paraphrases, split by corpus entry) were never looked at while tuning.

## Running the live tools

```
python -m venv .venv && .venv/bin/pip install -r talaan-ai/requirements.txt
# RAGAS with the model judge (Talaan's own key only)
TALAAN_OPENAI_API_KEY=... .venv/bin/python -I talaan-ai/eval/ragas_eval.py --llm
# PyRIT against a local talaan-kit dev server (see talaan-kit/README) or a preview deployment, never production
TALAAN_API_URL=http://localhost:3124 ORG_TOKEN_SECRET=<dev value> .venv/bin/python -I talaan-ai/redteam/pyrit_redteam.py
# NeMo Guardrails server for model-phrased answers
TALAAN_OPENAI_API_KEY=... TALAAN_API_URL=https://talaan-ivory.vercel.app TALAAN_SERVICE_TOKEN=... nemoguardrails server --config talaan-ai/guardrails
```

## Human in the loop

- Questions Tala cannot answer from a source, and tax-avoidance questions it refuses, go to a person (Ask Tala → Questions for a person). Answers can be flagged for the corpus review.
- New LLM-generated evaluation questions are written to a review file, not used until a person approves them.
- Rates, wage orders and corpus entries carry "Needs CPA review before production use" until the adviser signs off.
