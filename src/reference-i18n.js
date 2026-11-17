import { referenceSeeds } from './references.js';
import { translate, uiMessage, getLocale } from './i18n.js';
// Only editorial/catalog metadata is localized. Names and notes supplied by the
// user are returned verbatim, including when they match a translation key.
export function referenceText(reference, field, language = getLocale()) {
  const seed = referenceSeeds.find(item => item.id === reference.id);
  const value = reference[field];
  if (reference.catalogSource || seed && seed[field] === value || ['kind','stage','year','industry'].includes(field)) {
    return uiMessage(value, language);
  }
  return value;
}
export function referencesForRequest(references, language) {
  return references.map(reference => ({ ...reference,
    note: referenceText(reference, 'note', language),
    takeaway: referenceText(reference, 'takeaway', language)
  }));
}
