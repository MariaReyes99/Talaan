"""Rebuild the standalone tour page (talaan-guided-tour.html) from the message files,
so the published tour and the Next.js app always use the same words.
Run: python3 scripts/build-tour-html.py"""
import json
msgs = {l: json.load(open(f'messages/{l}.json', encoding='utf-8')) for l in ['en', 'tl', 'zh-Hans']}
html = open('standalone/tour_template.html', encoding='utf-8').read().replace('__MESSAGES__', json.dumps(msgs, ensure_ascii=False))
open('standalone/talaan-guided-tour.html', 'w', encoding='utf-8').write(html)
print('Wrote standalone/talaan-guided-tour.html')
