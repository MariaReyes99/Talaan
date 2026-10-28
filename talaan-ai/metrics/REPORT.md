# Ask Tala evaluation

Run 2026-10-28 05:06 UTC · look-alike letters mapped before guard checks (PyRIT finding) · 423 questions · 65 corpus entries

| Metric | Baseline (keyword) | Current (guardrails + hybrid) | Target |
|---|---|---|---|
| questions | 423 | **423** |  |
| answer_accuracy | 87.7% | **96.0%** | ≥ 92.0% |
| hit_at_1 | 85.0% | **95.0%** | ≥ 90.0% |
| recall_at_3 | 87.7% | **99.5%** | ≥ 95.0% |
| mrr | 86.3% | **97.6%** | ≥ 92.0% |
| wrong_answer_rate | 3.5% | **2.3%** | ≤ 3.0% |
| false_decline_rate | 8.8% | **1.8%** | ≤ 6.0% |
| off_topic_declined | 100.0% | **100.0%** | ≥ 100.0% |
| adversarial_blocked | 44.4% | **100.0%** | ≥ 100.0% |
| pii_redacted | 0.0% | **100.0%** | ≥ 100.0% |
| heldout_accuracy | 70.9% | **86.1%** | ≥ 85.0% |
| p95_ms | 1.31 ms | **1.39 ms** | ≤ 50 ms |

## Answer accuracy by question type

| Type | Baseline | Current |
|---|---|---|
| original | 100.0% | 100.0% |
| paraphrase | 82.4% | 92.6% |
| typo | 56.6% | 90.6% |
| pii | 100.0% | 100.0% |

## By language

| Language | Baseline | Current |
|---|---|---|
| en | 80.7% | 93.7% |
| tl | 98.9% | 100.0% |
| zh | 97.2% | 98.6% |

## Misses on the tuning (dev) split

Held-out (test) misses count in heldout_accuracy but are not listed, so the retriever is never tuned to them.

- [paraphrase/en] “ot rate on a normal workday” → declined; expected overtime
- [typo/en] “ot rate on a normal wordkay” → declined; expected overtime
- [typo/en] “steps to process paryoll in talaan” → answered (how-finalpay); expected how-payrun
- [typo/en] “does talaan submit to bir dircetly” → declined; expected how-file
- [paraphrase/en] “request a vacation leave” → answered (sil); expected emp-leave, how-leave

## Trend (last 10 runs)

| When | Label | Accuracy | Wrong answers | Off-topic declined | Adversarial blocked |
|---|---|---|---|---|---|
| 2026-10-28 04:26 | typo words count at their own idf in the coverage gate | 96.5% | 2.3% | 93.3% | 100.0% |
| 2026-10-28 04:26 | weak keyword hits also need coverage | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 04:29 | guardrails hardened after red team (deobfuscation, other-product topics) | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 04:31 | RAGAS (offline) | NaN% | NaN% | NaN% | NaN% |
| 2026-10-28 04:31 | RAGAS (offline) | NaN% | NaN% | NaN% | NaN% |
| 2026-10-28 04:42 | guard reads words one typo from a guard word (PyRIT finding) | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 04:49 | guard typo fix also inside punctuation | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 04:51 | 4-letter guard words: swapped letters only | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 04:57 | keyword rules compiled once (speed) | 96.0% | 2.3% | 100.0% | 100.0% |
| 2026-10-28 05:06 | look-alike letters mapped before guard checks (PyRIT finding) | 96.0% | 2.3% | 100.0% | 100.0% |

**All targets met.**
