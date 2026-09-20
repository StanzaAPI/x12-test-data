// Envelope and transaction structural corruption.

import { ge, gs, iea, isa, se, st, validCorpus } from '../x12.mjs';
import { caseOf, d, singleEnvelope, valid } from './shared.mjs';

export function structureCases() {
  return [
    caseOf('structure.short-isa', 'structure', 'reject', 'Truncated ISA header (fewer than 106 characters).', () => valid().slice(0, 80)),
    caseOf('structure.missing-isa', 'structure', 'reject', 'Stream starts with GS instead of ISA.', () => valid().slice(106)),
    caseOf('structure.isa-only', 'structure', 'reject', 'ISA segment with no GS, transaction, or trailer.', () => isa({ control: 1 })),
    caseOf('structure.isa-gs-only', 'structure', 'reject', 'ISA and GS with no transaction and no trailer.', () => isa({ control: 1 }) + gs({ control: 1 })),
    caseOf('structure.gs-without-trailer', 'structure', 'reject', 'GS and transaction with no GE or IEA.', () =>
      isa({ control: 1 }) + gs({ control: 1 }) + st('837', 1, d) + se(1, 1, d)
    ),
    caseOf('structure.bad-isa-delimiters', 'structure', 'reject', 'ISA element separator inconsistent with the rest of the file.', () =>
      valid().replace('ISA*', 'ISA9')
    ),
    caseOf('structure.non-digit-control', 'structure', 'no-crash', 'Non-numeric characters in the ISA control number.', () =>
      valid().replace(/(00501\*)\d{9}/, '$100000000A')
    ),
    caseOf('structure.st-se-control-mismatch', 'structure', 'no-crash', 'SE02 transaction control does not match ST02.', () =>
      valid().replace(/SE\*\d+\*\d+~/, 'SE*99*9999~')
    ),
    caseOf('structure.no-se', 'structure', 'reject', 'Transaction truncated before its SE segment at EOF.', () => {
      const parts = validCorpus({ transactions: 1, claims: 3, seed: 3 }).split('~');
      return parts.slice(0, -4).join('~') + '~';
    }),
    caseOf('structure.se-count-mismatch', 'structure', 'no-crash', 'SE segment count does not match the transaction length.', () =>
      valid().replace(/SE\*\d+\*(\d+)~/, 'SE*2*$1~')
    ),
    caseOf('structure.se-without-st', 'structure', 'no-crash', 'Orphan SE without a preceding ST.', () => singleEnvelope(se(2, 1, d))),
    caseOf('structure.se-twice', 'structure', 'no-crash', 'Two SE segments closing one transaction.', () =>
      valid().replace(/(SE\*\d+\*\d+~)/, '$1$1')
    ),
    caseOf('structure.empty-transaction', 'structure', 'no-crash', 'ST immediately followed by SE.', () =>
      singleEnvelope(st('837', 1, d) + se(1, 1, d))
    ),
    caseOf('structure.nested-st', 'structure', 'no-crash', 'Second ST opens before the first transaction closes.', () =>
      valid().replace(/(SE\*\d+\*\d+~)/, (match) => st('837', 9999, d) + match)
    ),
    caseOf('structure.interleaved-transactions', 'structure', 'no-crash', 'One transaction opens in an envelope that already closed.', () => {
      const a = validCorpus({ transactions: 1, claims: 2, seed: 5 }).split('~');
      const b = validCorpus({ transactions: 1, claims: 2, seed: 6 }).split('~');
      return a.slice(0, -4).join('~') + '~' + b.slice(2).join('~');
    }),
    caseOf('structure.duplicate-control-numbers', 'structure', 'no-crash', 'Two envelopes reuse the same control numbers (replay).', () =>
      validCorpus({ transactions: 1, claims: 2, seed: 9 }) + validCorpus({ transactions: 1, claims: 2, seed: 9 })
    ),
    caseOf('structure.unknown-transaction-type', 'structure', 'no-crash', 'ST with a transaction type the parser does not know.', () =>
      singleEnvelope(
        st('999', 1, d) + ['BHT', '0019', '00', '000001', '20260101', '1200', 'CH'].join('*') + '~' + se(2, 1, d)
      )
    ),
    caseOf('structure.empty-elements', 'structure', 'no-crash', 'Transaction where every data element is empty.', () =>
      singleEnvelope(
        ['ST', '837', '0001', ''].join('*') + '~' + ['NM1', '', '', '', '', '', '', '', '', ''].join('*') + '~' + se(2, 1, d)
      )
    ),
    caseOf('structure.lowercase-tags', 'structure', 'no-crash', 'Lowercase segment tags.', () => valid().replaceAll('NM1', 'nm1')),
    caseOf('structure.tag-only-segment', 'structure', 'no-crash', 'Segment consisting of a tag and nothing else.', () =>
      valid().replace('NM1*41', 'NM1~NM1*41')
    ),
    caseOf('structure.double-terminator', 'structure', 'no-crash', 'Empty segment between two terminators.', () => valid().replace('NM1*40', '~~NM1*40')),
    caseOf('structure.missing-bht', 'structure', 'no-crash', '837 transaction with its BHT segment removed.', () => valid().replace(/BHT\*[^~]*~/, '')),
    caseOf('structure.envelope-control-mismatch', 'structure', 'no-crash', 'ISA, GS, GE, and IEA control numbers disagree.', () =>
      valid().replace(/IEA\*1\*\d{9}/, 'IEA*1*999999999')
    ),
    caseOf('structure.envelope-count-mismatch', 'structure', 'no-crash', 'IEA claims a different number of included groups.', () =>
      valid().replace(/IEA\*1\*/, 'IEA*9*')
    ),
    caseOf('structure.two-envelopes', 'structure', 'parse', 'Two complete ISA..IEA envelopes concatenated in one stream.', () =>
      validCorpus({ transactions: 1, claims: 2, seed: 1 }) + validCorpus({ transactions: 1, claims: 2, seed: 2 })
    ),
    caseOf('structure.trailing-garbage', 'structure', 'no-crash', 'Non-X12 bytes after the final IEA.', () => valid() + 'GARBAGE_BYTES_AFTER_IEA'),
    caseOf('structure.segment-after-iea', 'structure', 'no-crash', 'A well-formed segment after the final IEA.', () => valid() + 'NM1*XX*1~'),
  ];
}
