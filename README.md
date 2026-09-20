# X12 Test Data

Deterministic, synthetic ANSI X12 test data for parser and pipeline testing:

- **Valid corpora at scale** (837P, 835, 271) for end-to-end runs. Configure
  transactions, claims per transaction, seed, and delimiters.
- **Adversarial corpus**: one small file per hostile case (injection, malformed
  envelopes, encoding attacks, resource exhaustion) with machine-readable
  expectations in `adversarial/manifest.json`.
- **Mixed corpus**: valid transactions interleaved with hostile ones, for
  testing recovery behavior mid-stream.

Everything is generated locally. No real patient, provider, or payer data is
used or required: the suite is HIPAA-safe by construction and can be used in CI
without data agreements.

## Usage

Requires Node >= 20. No dependencies.

```bash
node bin/generate.mjs --profile valid --transactions 100000 --claims 5 --out out
node bin/generate.mjs --profile adversarial --out out
node bin/generate.mjs --profile mixed --transactions 500 --out out
node bin/generate.mjs --profile all --out out
```

Output layout:

```
out/
  valid/corpus-837.x12          # streamable ISA..IEA envelopes
  valid/manifest.json           # seed, counts, byte size
  adversarial/<case-id>.x12     # one hostile input per file
  adversarial/manifest.json     # id, category, expect, description, bytes
  mixed/corpus-mixed.x12
  mixed/manifest.json
```

## Expectation semantics

`adversarial/manifest.json` records what a consumer should be able to rely on:

| expect | meaning |
| :-- | :-- |
| `parse` | Must be accepted as valid X12 (delimiter variants, CRLF, BOM, concatenated envelopes). |
| `reject` | Must be rejected with an error, without crashing (truncated or impossible input). |
| `no-crash` | Behavior is implementation-defined; the parser must not hang, crash, or consume unbounded memory. |

`no-crash` is the important bucket. Those inputs are where parsers most often
break in production, and where tests tend to be missing.

## Case categories

- `injection`: delimiter, JSON, SQL, and script payloads inside data elements.
- `structure`: envelope and transaction structural corruption.
- `encoding`: BOM, NUL bytes, control characters, RTL overrides, CRLF.
- `resource`: oversized elements, huge segment counts, deep composites.
- `numeric`: overflow, negative, and scientific-notation amounts.
- `invalid`: malformed identifiers and dates.
- `delimiter`: alternate and mixed delimiters.
- `zero`: empty and whitespace-only files.

The full list with descriptions lives in the generated manifest. `docs/CASES.md`
explains the categories in more detail.

## Design notes

- Deterministic: every corpus reproduces exactly from `(seed, transactions, claims)`.
- The valid generator emits syntactically plausible 837P/835/271 content, not
  semantically correct claim adjudication data.
- Adversarial cases are standalone files, so a failing case points at exactly
  one malformed input instead of a 500 MB haystack.
- The mixed profile is for streaming parsers: invalid records appear between
  valid ones, and a robust parser should report them and continue.

## License

MIT
