# Adversarial cases

The full case list is generated, not hand-maintained: run
`node bin/generate.mjs --profile adversarial --out out` and read
`out/adversarial/manifest.json`. Each entry has:

```json
{
  "id": "injection.segment-delimiter",
  "category": "injection",
  "expect": "no-crash",
  "description": "Segment terminator (~) embedded inside a data element.",
  "bytes": 2729,
  "file": "adversarial/injection.segment-delimiter.x12"
}
```

## Expectation semantics

| expect | meaning |
| :-- | :-- |
| `parse` | Valid X12 per the standard; a conforming parser should accept it. |
| `reject` | Not valid X12; a conforming parser should return an error and keep running. |
| `no-crash` | Undefined behavior territory. The only requirement is a bound: no hang, no crash, no unbounded allocation. |

`no-crash` cases are intentionally not labeled "reject" because different
parsers have different contracts for bad data: some reject the record, some
null it out and continue, some skip it. All of those are fine. A stack
overflow, an event-loop hang, or 8 GB of resident memory are not.

## Categories

| Category | What it probes |
| :-- | :-- |
| `injection` | Delimiter, JSON, SQL, and script payloads inside data elements. The dangerous ones are delimiter injections: a `~` inside a field can fabricate segments. |
| `structure` | Truncated headers, missing or orphan control segments, count mismatches, envelope mismatches, trailing bytes, concatenated envelopes. |
| `encoding` | BOM, NUL, control characters, Unicode RTL override, CRLF line endings. |
| `resource` | 1 MiB data elements, 50k-segment transactions, 10k-component elements. These catch parsers that materialize everything before checking limits. |
| `numeric` | Overflow, negative, and scientific-notation amounts. |
| `invalid` | Malformed identifiers (non-numeric NPI) and impossible dates. |
| `delimiter` | Pipe-delimited valid files and mixed-delimiter corruption. |
| `zero` | Empty and whitespace-only input. |

## The mixed corpus

`--profile mixed` interleaves hostile inputs between valid transactions in one
stream. This exercises recovery: the parser should surface the bad records and
keep producing correct output for the rest. A parser that aborts on the first
malformed record passes all standalone tests and still fails in production.

## Adding a case

Add an entry to `src/adversarial.mjs` with a stable `id`, a category, an
`expect`, a one-line description, and a `build()` returning the file content.
Keep cases small: a failing case should point at one malformed input, not a
haystack.
