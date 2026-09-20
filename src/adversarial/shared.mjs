// Shared helpers for adversarial case modules.

import { DEFAULT_DELIMITERS, ge, gs, iea, isa, validCorpus } from '../x12.mjs';

export const d = DEFAULT_DELIMITERS;

export const valid = (options = {}) => validCorpus({ transactions: 2, claims: 3, seed: 1, ...options });

// A guaranteed-present literal in every 837P so injection targets are stable.
export const TARGET = 'SYNTHETIC PAYER';

export const withTarget = (replacement, base = valid()) => base.replace(TARGET, replacement);

export function singleEnvelope(body, { control = 1, type = 'HC' } = {}) {
  return isa({ control }) + gs({ type, control }) + body + ge(control) + iea(control);
}

export function caseOf(id, category, expect, description, build, extra = {}) {
  return { id, category, expect, description, build, ...extra };
}

export const buf = (value, encoding = 'utf8') => Buffer.from(value, encoding);
