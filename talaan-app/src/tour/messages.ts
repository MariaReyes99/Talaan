import type { Lang } from '../i18n';
import en from './messages/en.json';
import tl from './messages/tl.json';
import zh from './messages/zh.json';
/** The tour uses the same message files as the published tour and the Next.js kit. */
const M: Record<Lang, unknown> = { en, tl, zh };
export type TT = (key: string, vars?: Record<string, string | number>) => string;
const get = (o: unknown, k: string): unknown => k.split('.').reduce<unknown>((a, p) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[p] : undefined), o);
export function tourT(lang: Lang): TT {
  return (key, vars) => {
    let s = (get(M[lang], key) ?? get(M.en, key) ?? key) as string;
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}
