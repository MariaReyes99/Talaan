"""
NeMo Guardrails actions for Ask Tala.

The deterministic checks use the patterns exported from talaan-app/src/rag/guard.ts (patterns.json), so the browser,
the Next.js API and this Python server apply exactly the same rules; test_guardrails.py proves parity.
Retrieval and the human handoff call the Talaan API (TALAAN_API_URL), which runs the same hybrid retriever as the app.
"""
from __future__ import annotations
import json, os, pathlib, re, unicodedata
from urllib import request

HERE = pathlib.Path(__file__).resolve().parent
P = json.loads((HERE / 'patterns.json').read_text(encoding='utf-8'))

def _js(p):
    """JavaScript regex → Python. The exported patterns use only syntax both engines share."""
    flags = re.IGNORECASE if 'i' in p['flags'] else 0
    return re.compile(p['source'].replace('(?<=', '(?<='), flags)

PII = [(x['kind'], _js(x), x['luhn']) for x in P['pii']]
GROUPS = {k: [_js(x) for x in P[k]] for k in ['injection', 'exfiltration', 'evasion', 'out_of_scope']}
CONFUSABLES = P['confusables']
LEET = {'0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's'}

try:  # the module also loads without NeMo installed, for the offline parity test
    from nemoguardrails.actions import action
except ImportError:  # pragma: no cover
    def action(**_):
        return lambda f: f

def _luhn(d: str) -> bool:
    s = 0
    for i, ch in enumerate(reversed(d)):
        n = int(ch)
        if i % 2:
            n *= 2
            if n > 9: n -= 9
        s += n
    return s % 10 == 0

def redact(text: str):
    out, red = text, []
    for kind, rx, luhn in PII:
        n = 0
        def sub(m):
            nonlocal n
            if luhn and not _luhn(re.sub(r'\D', '', m.group(0))): return m.group(0)
            n += 1
            return f'[{kind.upper()}]'
        out = rx.sub(sub, out)
        if n: red.append({'kind': kind, 'count': n})
    return out, red

def deobfuscate(s: str) -> str:
    s = ''.join(CONFUSABLES.get(ch, ch) for ch in unicodedata.normalize('NFKC', s).lower())
    s = re.sub('[​-‍﻿]', '', s)
    s = re.sub(r'(?<=[a-z])[013457@$](?=[a-z])|(?<=[a-z])[013457@$]\b|\b[013457@$](?=[a-z])', lambda m: LEET.get(m.group(0), m.group(0)), s)
    s = re.sub(r'\s+', ' ', s)
    return ' '.join(_fix(w) for w in s.split(' '))

GUARD_WORDS = P['guard_words']

def one_edit_apart(a: str, b: str) -> bool:
    """Same rule as oneEditApart in talaan-app/src/rag/text.ts: one insert, delete, substitution or adjacent swap."""
    if a == b: return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1 or min(la, lb) < 4: return False
    i = 0
    while i < la and i < lb and a[i] == b[i]: i += 1
    if la == lb: return a[i + 1:] == b[i + 1:] or (i + 1 < la and a[i] == b[i + 1] and a[i + 1] == b[i] and a[i + 2:] == b[i + 2:])
    return a[i + 1:] == b[i:] if la > lb else a[i:] == b[i + 1:]

def _swapped(a: str, b: str) -> bool:
    return len(a) == len(b) and a != b and sorted(a) == sorted(b) and sum(x != y for x, y in zip(a, b)) == 2

def _fix_core(w: str) -> str:
    if len(w) < 4 or w in GUARD_WORDS: return w
    if len(w) == 4: return next((g for g in GUARD_WORDS if len(g) == 4 and _swapped(w, g)), w)
    return next((g for g in GUARD_WORDS if one_edit_apart(w, g)), w)

def _fix(w: str) -> str:
    """A word one typo away from a guard word is read as that word (PyRIT character-swap finding)."""
    return re.sub(r'[a-z]+', lambda m: _fix_core(m.group(0)), w)

def check_input(raw: str) -> dict:
    text, red = redact(raw[:1000])
    rails = ['pii_redacted'] if red else []
    forms = [re.sub(r'\s+', ' ', raw), deobfuscate(raw)]
    for verdict, rail in [('injection', 'jailbreak'), ('exfiltration', 'sensitive_data_request'), ('evasion', 'tax_evasion'), ('out_of_scope', 'off_topic')]:
        if any(rx.search(f) for f in forms for rx in GROUPS[verdict]):
            return {'verdict': verdict, 'text': text, 'redactions': red, 'rails': rails + [rail]}
    return {'verdict': 'ok', 'text': text, 'redactions': red, 'rails': rails}

def check_output(answer: str, sources: list[str]) -> dict:
    if not sources: return {'ok': False, 'rails': ['no_citation'], 'ungrounded': [], 'text': answer}
    src = ' '.join(sources).replace(',', '')
    facts = [m.replace(' ', '') for m in re.findall(r'₱\s?\d+(?:\.\d+)?|\b\d+(?:\.\d+)?%', answer.replace(',', ''))]
    ungrounded = [f for f in facts if f not in src]
    text, red = redact(answer)
    rails = (['ungrounded_numbers'] if ungrounded else []) + (['pii_in_output'] if red else [])
    return {'ok': not ungrounded, 'rails': rails, 'ungrounded': ungrounded, 'text': text}

def _api(path: str, body: dict) -> dict:
    base = os.environ.get('TALAAN_API_URL', '').rstrip('/')
    if not base: raise RuntimeError('Set TALAAN_API_URL to the Talaan deployment (for example https://talaan-ivory.vercel.app).')
    req = request.Request(base + path, data=json.dumps(body).encode(), headers={'content-type': 'application/json', 'x-talaan-service': os.environ.get('TALAAN_SERVICE_TOKEN', '')})
    with request.urlopen(req, timeout=15) as r: return json.loads(r.read())

@action(name='talaan_check_input')
async def talaan_check_input(text: str):
    return check_input(text)

@action(name='talaan_retrieve')
async def talaan_retrieve(question: str):
    r = _api('/api/ask', {'question': question, 'mode': 'retrieve'})
    srcs = r.get('sources', [])
    return {'confident': bool(srcs), 'ids': [s['id'] for s in srcs], 'context': '\n\n'.join(f"[{i + 1}] {s['answer']} ({s['source']})" for i, s in enumerate(srcs)),
            'extractive': '\n\n'.join(s['answer'] for s in srcs), 'answers': [s['answer'] for s in srcs]}

@action(name='talaan_check_output')
async def talaan_check_output(answer: str, source_ids: list[str], context: dict | None = None):
    sources = (context or {}).get('sources', {}).get('answers', []) if context else []
    return check_output(answer, sources)

@action(name='talaan_handoff')
async def talaan_handoff(question: str, reason: str):
    try: _api('/api/ask/handoff', {'question': question, 'reason': reason})
    except Exception: pass  # the app also records handoffs; a failed call must not break the conversation
    return True

def init(app):  # called by NeMo when the config is loaded
    for f in [talaan_check_input, talaan_retrieve, talaan_check_output, talaan_handoff]:
        app.register_action(f, name=f.__name__)
