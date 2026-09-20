// Byte-level and text-encoding attacks.

import { caseOf, buf, valid } from './shared.mjs';

export function encodingCases() {
  return [
    caseOf('encoding.bom', 'encoding', 'parse', 'UTF-8 BOM before the ISA segment (common in exported files).', () => '\uFEFF' + valid()),
    caseOf('encoding.null-byte', 'encoding', 'no-crash', 'NUL byte inside a data element.', () => valid().replace('SYNTHETIC PAYER', 'SYNTHETIC\u0000PAYER')),
    caseOf('encoding.control-chars', 'encoding', 'no-crash', 'ASCII control characters inside a data element.', () =>
      valid().replace('SYNTHETIC PAYER', 'SYNTHETIC\u0001\u0002\u0003PAYER')
    ),
    caseOf('encoding.rtl-override', 'encoding', 'no-crash', 'Unicode right-to-left override in a data element.', () =>
      valid().replace('SYNTHETIC PAYER', 'SYNTHETIC\u202EPAYER')
    ),
    caseOf('encoding.crlf', 'encoding', 'parse', 'CRLF after every segment terminator.', () => valid().replaceAll('~', '~\r\n')),
    caseOf('encoding.cr-only', 'encoding', 'no-crash', 'Carriage-return-only line endings.', () => valid().replaceAll('~', '~\r')),
    caseOf('encoding.utf16', 'encoding', 'reject', 'UTF-16 encoded file with a UTF-16 BOM.', () => buf('\uFEFF' + valid(), 'utf16le'), {
      mixed: false,
    }),
    caseOf('encoding.latin1-invalid-utf8', 'encoding', 'no-crash', 'Latin-1 bytes that are not valid UTF-8.', () => buf(valid(), 'latin1'), {
      mixed: false,
    }),
    caseOf('encoding.overlong-utf8', 'encoding', 'no-crash', 'Overlong UTF-8 encoding of a separator byte.', () => {
      const base = Buffer.from(valid(), 'utf8');
      const at = base.indexOf(Buffer.from('~'));
      return Buffer.concat([base.subarray(0, at), Buffer.from([0xc0, 0xbe]), base.subarray(at + 1)]);
    }, { mixed: false }),
    caseOf('encoding.trailing-nul-padding', 'encoding', 'no-crash', 'NUL padding after the final segment.', () => valid() + '\u0000'.repeat(64)),
    caseOf('encoding.bom-mid-stream', 'encoding', 'no-crash', 'BOM in the middle of a record.', () => valid().replace('SYNTHETIC PAYER', '\uFEFFSYNTHETIC PAYER')),
    caseOf('encoding.emoji', 'encoding', 'no-crash', 'Astral-plane emoji inside a data element.', () =>
      valid().replace('SYNTHETIC PAYER', 'SYNTHETIC \u{1F4A5} PAYER')
    ),
    caseOf('encoding.zalgo', 'encoding', 'no-crash', 'Long combining-character sequence (Zalgo) in a field.', () =>
      valid().replace('SYNTHETIC PAYER', 'SYNTHETIC ' + '\u0301\u0302\u0303'.repeat(2000) + ' PAYER')
    ),
  ];
}
