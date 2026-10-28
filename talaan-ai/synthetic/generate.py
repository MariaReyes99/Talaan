"""
Builds the Ask Tala evaluation set (data/eval_questions.jsonl) from the corpus and the hand-written paraphrases.
Deterministic (seeded) so metrics are comparable run to run. Run: python3 -I talaan-ai/synthetic/generate.py
Optional: --llm uses RAGAS's TestsetGenerator with Talaan's own OpenAI key (TALAAN_OPENAI_API_KEY) to add more questions;
those are written to data/eval_questions_llm.jsonl for a person to review before they join the main set (human in the loop).
"""
import json, random, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent; ROOT = HERE.parent
sys.path.insert(0, str(HERE)); from paraphrases import P, OFF_TOPIC, ADVERSARIAL, PII_FAIR  # noqa: E402
corpus = json.loads((ROOT.parent / 'talaan-app/corpus/corpus.json').read_text(encoding='utf-8'))
ids = {e['id'] for e in corpus}
missing = ids - set(P); extra = set(P) - ids
assert not extra, f'paraphrases for unknown entries: {extra}'
rng = random.Random(20261028)
def lang_of(q): return 'zh' if any('一' <= ch <= '鿿' for ch in q) else 'tl' if any(w in q.lower().split() for w in ['ang', 'ng', 'sa', 'ba', 'magkano', 'paano', 'kailan', 'ilang', 'bakit', 'ko', 'mag-payroll', 'kailangan', 'may']) else 'en'
def typo(q):
    w = q.split(); cand = [i for i, x in enumerate(w) if len(x) > 4 and x.isalpha()]
    if not cand: return None
    i = rng.choice(cand); x = w[i]; j = rng.randrange(1, len(x) - 2); w[i] = x[:j] + x[j + 1] + x[j] + x[j + 2:]; return ' '.join(w)
rows = []
import hashlib
def split_of(eid):
    # Held-out test split by corpus entry (about 30%): never look at these misses when tuning the retriever.
    return 'test' if int(hashlib.sha1(eid.encode()).hexdigest(), 16) % 10 < 3 else 'dev'
def add(q, expected, typ, lang=None, split='dev'): rows.append({'id': f'q{len(rows) + 1:04d}', 'question': q, 'lang': lang or lang_of(q), 'expected': expected, 'type': typ, 'split': split})
for e in corpus:
    for l in ['en', 'tl', 'zh']: add(e['q'][l], [e['id']], 'original', l)
for eid, qs in P.items():
    for item in qs:
        q, also = (item, []) if isinstance(item, str) else item
        add(q, [eid, *also], 'paraphrase', split=split_of(eid))
        if lang_of(q) == 'en' and rng.random() < 0.5:
            t = typo(q)
            if t: add(t, [eid, *also], 'typo', split=split_of(eid))
for q in OFF_TOPIC: add(q, [], 'off_topic')
for q in ADVERSARIAL: add(q, [], 'adversarial')
for q, exp in PII_FAIR: add(q, exp, 'pii')
out = ROOT / 'data/eval_questions.jsonl'
out.write_text('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n', encoding='utf-8')
by = {}; [by.__setitem__(r['type'] + '/' + r['split'], by.get(r['type'] + '/' + r['split'], 0) + 1) for r in rows]
print(f'{len(rows)} questions → {out.relative_to(ROOT.parent)}', by, f'(entries without paraphrases: {sorted(missing) or "none"})')

if '--llm' in sys.argv:
    import os
    key = os.environ.get('TALAAN_OPENAI_API_KEY')
    if not key: sys.exit('Set TALAAN_OPENAI_API_KEY (Talaan’s own key, never another project’s).')
    from ragas.testset import TestsetGenerator  # pip install -r talaan-ai/requirements.txt
    from langchain_core.documents import Document
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    docs = [Document(page_content=f"{e['q']['en']}\n{e['a']['en']}", metadata={'id': e['id'], 'source': e['source']}) for e in corpus]
    gen = TestsetGenerator.from_langchain(ChatOpenAI(model='gpt-4o-mini', api_key=key), OpenAIEmbeddings(api_key=key))
    ts = gen.generate_with_langchain_docs(docs, testset_size=60).to_pandas()
    p = ROOT / 'data/eval_questions_llm.jsonl'
    p.write_text('\n'.join(json.dumps({'question': r.user_input, 'reference': r.reference, 'review': 'pending'}, ensure_ascii=False) for r in ts.itertuples()) + '\n', encoding='utf-8')
    print(f'{len(ts)} LLM-generated questions → {p}. Review each, add the expected entry id, then move approved ones into paraphrases.py.')
