// Adversarial X12 cases. Each case is a tiny, self-contained input designed to
// probe a specific class of parser weakness. `expect` is guidance for the
// consumer, not an assertion about any particular parser:
//
//   parse     must be accepted as valid X12
//   reject    must be rejected with an error (no crash)
//   no-crash  behavior is implementation-defined; must not hang, crash, or
//             consume unbounded memory

import { DEFAULT_DELIMITERS, ge, gs, iea, isa, st, se, transactionBlock, validCorpus } from './x12.mjs';
import { rng } from './rng.mjs';

const valid = (options = {}) => validCorpus({ transactions: 2, claims: 3, seed: 1, ...options });

// A guaranteed-present literal in every 837P so injection targets are stable.
const TARGET = 'SYNTHETIC PAYER';

function withTarget(content, replacement) {
  return valid().replace(TARGET, replacement);
}

function singleEnvelope(body) {
  return isa({ control: 1 }) + gs({ type: 'HC', control: 1 }) + body + ge(1) + iea(1);
}

export function adversarialCases() {
  const d = DEFAULT_DELIMITERS;

  const cases = [
    {
      id: 'injection.segment-delimiter',
      category: 'injection',
      expect: 'no-crash',
      description: 'Segment terminator (~) embedded inside a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC~PAYER'),
    },
    {
      id: 'injection.element-delimiter',
      category: 'injection',
      expect: 'no-crash',
      description: 'Element separator (*) embedded inside a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC*PAYER'),
    },
    {
      id: 'injection.component-delimiter',
      category: 'injection',
      expect: 'no-crash',
      description: 'Component separator (:) embedded inside a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC:PAYER'),
    },
    {
      id: 'injection.json',
      category: 'injection',
      expect: 'no-crash',
      description: 'JSON-breaking payload in a free-text field.',
      build: () => withTarget(valid(), 'SYN"}; process.exit(1); {"x":"'),
    },
    {
      id: 'injection.sql',
      category: 'injection',
      expect: 'no-crash',
      description: 'SQL injection payload in a free-text field.',
      build: () => withTarget(valid(), "SYN'); DROP TABLE claims;--"),
    },
    {
      id: 'injection.script',
      category: 'injection',
      expect: 'no-crash',
      description: 'HTML script payload in a free-text field.',
      build: () => withTarget(valid(), 'SYN<script>alert(1)</script>'),
    },
    {
      id: 'encoding.bom',
      category: 'encoding',
      expect: 'parse',
      description: 'UTF-8 BOM before the ISA segment (common in exported files).',
      build: () => '\uFEFF' + valid(),
    },
    {
      id: 'encoding.null-byte',
      category: 'encoding',
      expect: 'no-crash',
      description: 'NUL byte inside a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC\u0000PAYER'),
    },
    {
      id: 'encoding.control-chars',
      category: 'encoding',
      expect: 'no-crash',
      description: 'ASCII control characters inside a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC\u0001\u0002\u0003PAYER'),
    },
    {
      id: 'encoding.rtl-override',
      category: 'encoding',
      expect: 'no-crash',
      description: 'Unicode right-to-left override in a data element.',
      build: () => withTarget(valid(), 'SYNTHETIC\u202EPAYER'),
    },
    {
      id: 'encoding.crlf',
      category: 'encoding',
      expect: 'parse',
      description: 'CRLF after every segment terminator.',
      build: () => valid().replaceAll('~', '~\r\n'),
    },
    {
      id: 'structure.short-isa',
      category: 'structure',
      expect: 'reject',
      description: 'Truncated ISA header (fewer than 106 characters).',
      build: () => valid().slice(0, 80),
    },
    {
      id: 'structure.missing-isa',
      category: 'structure',
      expect: 'reject',
      description: 'Stream starts with GS instead of ISA.',
      build: () => valid().slice(106),
    },
    {
      id: 'structure.bad-isa-delimiters',
      category: 'structure',
      expect: 'reject',
      description: 'ISA element separator inconsistent with the rest of the file.',
      build: () => valid().replace('ISA*', 'ISA9'),
    },
    {
      id: 'structure.no-se',
      category: 'structure',
      expect: 'reject',
      description: 'Transaction truncated before its SE segment at EOF.',
      build: () => {
        const file = validCorpus({ transactions: 1, claims: 3, seed: 3 });
        const parts = file.split('~');
        return parts.slice(0, -4).join('~') + '~';
      },
    },
    {
      id: 'structure.se-count-mismatch',
      category: 'structure',
      expect: 'no-crash',
      description: 'SE segment count does not match the segment count in the transaction.',
      build: () => valid().replace(/SE\*\d+\*(\d+)~/, 'SE*2*$1~'),
    },
    {
      id: 'structure.se-without-st',
      category: 'structure',
      expect: 'no-crash',
      description: 'Orphan SE without a preceding ST.',
      build: () => singleEnvelope(se(2, 1, d)),
    },
    {
      id: 'structure.nested-st',
      category: 'structure',
      expect: 'no-crash',
      description: 'Second ST opens before the first transaction is closed.',
      build: () => valid().replace(/(SE\*\d+\*\d+~)/, (m) => st('837', 9999, d) + m),
    },
    {
      id: 'structure.unknown-transaction-type',
      category: 'structure',
      expect: 'no-crash',
      description: 'ST with a transaction type the parser does not know.',
      build: () => singleEnvelope(st('999', 1, d) + ['BHT', '0019', '00', '000001', '20260101', '1200', 'CH'].join('*') + '~' + se(2, 1, d)),
    },
    {
      id: 'structure.empty-elements',
      category: 'structure',
      expect: 'no-crash',
      description: 'Transaction where every data element is empty.',
      build: () =>
        singleEnvelope(
          ['ST', '837', '0001', ''].join('*') + '~' + ['NM1', '', '', '', '', '', '', '', '', ''].join('*') + '~' + se(2, 1, d)
        ),
    },
    {
      id: 'structure.envelope-control-mismatch',
      category: 'structure',
      expect: 'no-crash',
      description: 'ISA, GS, GE, and IEA control numbers disagree.',
      build: () => valid().replace(/IEA\*1\*\d{9}/, 'IEA*1*999999999'),
    },
    {
      id: 'structure.trailing-garbage',
      category: 'structure',
      expect: 'no-crash',
      description: 'Non-X12 bytes after the final IEA.',
      build: () => valid() + 'GARBAGE_BYTES_AFTER_IEA',
    },
    {
      id: 'structure.two-envelopes',
      category: 'structure',
      expect: 'parse',
      description: 'Two complete ISA..IEA envelopes concatenated in one stream.',
      build: () => validCorpus({ transactions: 1, claims: 2, seed: 1 }) + validCorpus({ transactions: 1, claims: 2, seed: 2 }),
    },
    {
      id: 'resource.oversized-element',
      category: 'resource',
      expect: 'no-crash',
      description: 'One data element of 1 MiB.',
      build: () => withTarget(valid(), 'X'.repeat(1024 * 1024)),
    },
    {
      id: 'resource.many-segments',
      category: 'resource',
      expect: 'no-crash',
      description: 'A single transaction with 50,000 segments.',
      build: () => {
        const body = [['BHT', '0019', '00', '000001', '20260101', '1200', 'CH'].join('*') + '~'];
        for (let i = 0; i < 50_000; i++) body.push(['LX', String(i + 1)].join('*') + '~');
        return singleEnvelope(st('837', 1, d) + body.join('') + se(body.length + 1, 1, d));
      },
    },
    {
      id: 'resource.deep-components',
      category: 'resource',
      expect: 'no-crash',
      description: 'A single element with 10,000 component separators.',
      build: () => withTarget(valid(), Array(10_000).fill('X').join(':')),
    },
    {
      id: 'numeric.overflow',
      category: 'numeric',
      expect: 'no-crash',
      description: 'Claim charge far beyond 64-bit integer range.',
      build: () => valid().replace(/(CLM\*SYN\d+\*)[\d.]+/, (_m, prefix) => `${prefix}9999999999999999999999999999`),
    },
    {
      id: 'numeric.negative',
      category: 'numeric',
      expect: 'no-crash',
      description: 'Negative claim charge.',
      build: () => valid().replace(/(CLM\*SYN\d+\*)([\d.]+)/, '$1-150.00'),
    },
    {
      id: 'numeric.scientific',
      category: 'numeric',
      expect: 'no-crash',
      description: 'Scientific notation where a decimal amount is expected.',
      build: () => valid().replace(/(CLM\*SYN\d+\*)[\d.]+/, (_m, prefix) => `${prefix}1e309`),
    },
    {
      id: 'invalid.identifier',
      category: 'invalid',
      expect: 'reject',
      description: 'Non-numeric characters in an NPI element.',
      build: () => valid().replace(/XX\*\d{10}/, 'XX*ABCDEFGHIJ'),
    },
    {
      id: 'invalid.date',
      category: 'invalid',
      expect: 'no-crash',
      description: 'Impossible date values (99999999).',
      build: () => valid().replaceAll('20260101', '99999999'),
    },
    {
      id: 'delimiter.pipe',
      category: 'delimiter',
      expect: 'parse',
      description: 'Valid pipe-delimited corpus instead of the default asterisk.',
      build: () => validCorpus({ transactions: 2, claims: 3, seed: 4, delimiters: { element: '|', segment: '~', component: ':', repetition: '^' } }),
    },
    {
      id: 'delimiter.mixed',
      category: 'delimiter',
      expect: 'no-crash',
      description: 'ISA declares * but body elements use |.',
      build: () => valid().replace('CLM*', 'CLM|'),
    },
    {
      id: 'zero.empty',
      category: 'zero',
      expect: 'reject',
      description: 'Empty file.',
      build: () => '',
    },
    {
      id: 'zero.whitespace',
      category: 'zero',
      expect: 'reject',
      description: 'Whitespace and newlines only.',
      build: () => '   \n\n\t  \r\n',
    },
  ];

  return cases;
}

/**
 * A stream that alternates valid transactions with hostile ones, to exercise
 * recovery behavior: a parser should report the bad records and keep
 * processing the stream instead of aborting or corrupting later output.
 */
export function mixedCorpus({ transactions = 500, claims = 4, seed = 42, interval = 10 } = {}) {
  const cases = adversarialCases().filter((c) => c.category !== 'resource' && c.category !== 'zero');
  const r = rng(seed);
  const chunks = [];
  for (let i = 0; i < transactions; i++) {
    const control = i + 1;
    if (i > 0 && i % interval === 0) {
      const injected = cases[r.int(cases.length)];
      chunks.push(injected.build());
    } else {
      chunks.push(isa({ control }), gs({ type: 'HC', control }), transactionBlock('837', r, { claims, control }), iea(control));
    }
  }
  return chunks.join('');
}
