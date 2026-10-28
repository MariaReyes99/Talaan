"""
RAGAS evaluation of Ask Tala's retriever and answers.

Input: eval/ragas_input.jsonl, written by `npm run eval:rag` (talaan-app). Each row has the question, the retrieved
contexts and ids, Tala's answer, and the reference answer/contexts from the corpus.

Two levels:
  * Offline (default, no API key, runs in CI): RAGAS non-LLM metrics
      - NonLLMContextPrecisionWithReference: are the retrieved contexts the right ones, ranked first?
      - NonLLMContextRecall: did retrieval find every reference context?
      - NonLLMStringSimilarity: how close is the answer to the reference answer?
  * --llm (needs Talaan's own key in TALAAN_OPENAI_API_KEY): RAGAS LLM-judged metrics
      - Faithfulness (is every claim in the answer supported by the retrieved context?)
      - ResponseRelevancy, LLMContextPrecisionWithReference, LLMContextRecall
    Talaan's key only: never the Investment Research Library's or any other project's.

Writes metrics/ragas.json and appends to metrics/history.jsonl; exits 1 if a metric is below metrics/targets.json.
Run:  python -I talaan-ai/eval/ragas_eval.py [--llm] [--limit N]
"""
import asyncio, json, os, sys, pathlib, datetime, statistics
ROOT = pathlib.Path(__file__).resolve().parent.parent
from ragas import SingleTurnSample  # pip install -r talaan-ai/requirements.txt
from ragas.metrics import NonLLMContextPrecisionWithReference, NonLLMContextRecall, NonLLMStringSimilarity

rows = [json.loads(l) for l in (ROOT / 'eval/ragas_input.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
rows = [r for r in rows if r['reference_ids']]  # in-scope questions (off-topic ones have no reference)
if '--limit' in sys.argv: rows = rows[: int(sys.argv[sys.argv.index('--limit') + 1])]

def sample(r):
    return SingleTurnSample(user_input=r['user_input'], response=r['response'] or '', retrieved_contexts=r['retrieved_contexts'] or [''],
                            reference=r['reference'], reference_contexts=r['reference_contexts'])

async def offline():
    m = {'context_precision': NonLLMContextPrecisionWithReference(), 'context_recall': NonLLMContextRecall(), 'answer_similarity': NonLLMStringSimilarity()}
    out = {k: [] for k in m}; per_lang = {}
    for r in rows:
        s = sample(r)
        for k, metric in m.items():
            v = float(await metric.single_turn_ascore(s)); out[k].append(v)
            per_lang.setdefault(r['lang'], {}).setdefault(k, []).append(v)
    return {k: round(statistics.mean(v), 3) for k, v in out.items()}, {l: {k: round(statistics.mean(v), 3) for k, v in d.items()} for l, d in per_lang.items()}

async def with_llm():
    key = os.environ.get('TALAAN_OPENAI_API_KEY')
    if not key: sys.exit('Set TALAAN_OPENAI_API_KEY (Talaan’s own key).')
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithReference, LLMContextRecall
    llm = LangchainLLMWrapper(ChatOpenAI(model=os.environ.get('TALAAN_EVAL_MODEL', 'gpt-4o-mini'), api_key=key, temperature=0))
    emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model='text-embedding-3-small', api_key=key))
    m = {'faithfulness': Faithfulness(llm=llm), 'response_relevancy': ResponseRelevancy(llm=llm, embeddings=emb),
         'llm_context_precision': LLMContextPrecisionWithReference(llm=llm), 'llm_context_recall': LLMContextRecall(llm=llm)}
    out = {k: [] for k in m}
    for r in rows:
        s = sample(r)
        for k, metric in m.items(): out[k].append(float(await metric.single_turn_ascore(s)))
    return {k: round(statistics.mean(v), 3) for k, v in out.items()}

async def main():
    res, by_lang = await offline(); llm = {}
    if '--llm' in sys.argv: llm = await with_llm()
    targets = json.loads((ROOT / 'metrics/targets.json').read_text())
    allm = {**{f'ragas_{k}': v for k, v in res.items()}, **{f'ragas_{k}': v for k, v in llm.items()}}
    misses = [k for k, v in allm.items() if k in targets and (('min' in targets[k] and v < targets[k]['min']) or ('max' in targets[k] and v > targets[k]['max']))]
    at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (ROOT / 'metrics/ragas.json').write_text(json.dumps({'at': at, 'questions': len(rows), 'offline': res, 'by_language': by_lang, 'llm_judged': llm or 'not run (use --llm with TALAAN_OPENAI_API_KEY)', 'misses': misses}, indent=1, ensure_ascii=False))
    with open(ROOT / 'metrics/history.jsonl', 'a') as f: f.write(json.dumps({'at': at, 'label': 'RAGAS' + (' + LLM judge' if llm else ' (offline)'), **allm}) + '\n')
    print(f'RAGAS on {len(rows)} questions:', json.dumps(allm), '\nby language:', json.dumps(by_lang))
    print('Below target: ' + ', '.join(misses) if misses else 'All RAGAS targets met.')
    return 1 if misses else 0

sys.exit(asyncio.run(main()))
