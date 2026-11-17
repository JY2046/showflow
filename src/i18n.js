import { useSyncExternalStore } from 'react';
import messages from './messages.en.json' with { type: 'json' };
export const LOCALE_KEY = 'showflow-ui-language-v1';
let locale = 'en';
try { locale = localStorage.getItem(LOCALE_KEY) === 'zh' ? 'zh' : 'en'; } catch {}
const listeners = new Set();
export const getLocale = () => locale;
export function setLocale(next) {
  if (!['en', 'zh'].includes(next)) return;
  locale = next;
  try { localStorage.setItem(LOCALE_KEY, locale); } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    document.title = locale === 'en' ? 'ShowFlow · Pitch workspace' : 'ShowFlow · 路演导演台';
  }
  listeners.forEach(fn => fn());
}
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function useLocale() { return useSyncExternalStore(subscribe, getLocale, () => 'en'); }
// Translate interface copy only. Project titles, bodies, speaker notes and user notes
// must never be passed through the catalog or rewritten when switching languages.
export function translate(source, values = [], language = locale) {
  if (typeof source !== 'string') return source;
  const key = source.trim();
  const copy = language === 'en' ? messages[key] ?? key : key;
  const leading = source.match(/^\s*/)[0], trailing = source.match(/\s*$/)[0];
  return leading + copy.replace(/\{(\d+)\}/g, (_, i) => String(values[i] ?? `{${i}}`)) + trailing;
}
export const t = translate;
export function formatDate(value) { return new Date(value).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN'); }
setLocale(locale);

const templateMessages = Object.keys(messages).filter(key => /\{\d+\}/.test(key)).map(key => {
  const parts = key.split(/(\{\d+\})/g);
  const indices = [];
  const pattern = parts.map(part => {
    const token = part.match(/^\{(\d+)\}$/);
    if (token) { indices.push(Number(token[1])); return '([\\s\\S]*?)'; }
    return part.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
  }).join('');
  return { key, indices, regex: new RegExp('^' + pattern + '$') };
});
export function uiMessage(value, language = locale) {
  if (typeof value !== 'string' || language !== 'en') return value;
  if (Object.hasOwn(messages, value.trim())) return translate(value, [], language);
  for (const entry of templateMessages) {
    const match = value.match(entry.regex);
    if (!match) continue;
    const values = [];
    entry.indices.forEach((index, i) => { values[index] = uiMessage(match[i + 1], language); });
    return translate(entry.key, values, language);
  }
  return value;
}
