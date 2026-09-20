#!/usr/bin/env node
// CLI for the X12 test-data suite.
//
//   node bin/generate.mjs --profile valid --transactions 100000 --claims 5 --out out
//   node bin/generate.mjs --profile adversarial --out out
//   node bin/generate.mjs --profile mixed --transactions 500 --out out
//   node bin/generate.mjs --profile all --out out

import fs from 'node:fs';
import path from 'node:path';

import { adversarialCases, mixedCorpus } from '../src/adversarial.mjs';
import { DEFAULT_DELIMITERS, freshRng, ge, gs, iea, isa, transactionBlock } from '../src/x12.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) => {
    if (!a.startsWith('--')) return [];
    const next = all[i + 1];
    return [[a.slice(2), next && !next.startsWith('--') ? next : 'true']];
  })
);

const profile = args.profile ?? 'all';
const outDir = path.resolve(args.out ?? 'out');
const transactions = Number(args.transactions ?? 10_000);
const claims = Number(args.claims ?? 5);
const seed = Number(args.seed ?? 42);
const type = args.type ?? '837';
const interval = Number(args.interval ?? 10);

function writeChunks(file, chunks) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'w');
  try {
    for (const chunk of chunks) fs.writeSync(fd, chunk);
  } finally {
    fs.closeSync(fd);
  }
}

function* validChunks() {
  const rng = freshRng(seed);
  for (let i = 0; i < transactions; i++) {
    const control = i + 1;
    yield isa({ control });
    yield gs({ type: type === '835' ? 'HP' : type === '271' ? 'HB' : 'HC', control });
    yield transactionBlock(type, rng, { claims, control });
    yield ge(control);
    yield iea(control);
  }
}

async function generateValid() {
  const file = path.join(outDir, 'valid', `corpus-${type}.x12`);
  await writeChunks(file, validChunks());
  const bytes = fs.statSync(file).size;
  const manifest = {
    profile: 'valid',
    type,
    transactions,
    claims_per_transaction: claims,
    seed,
    bytes,
    mb: Number((bytes / 1024 / 1024).toFixed(1)),
    file: path.relative(outDir, file),
  };
  fs.writeFileSync(path.join(outDir, 'valid', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`valid: ${transactions} transactions, ${manifest.mb} MB -> ${manifest.file}`);
}

async function generateAdversarial() {
  const dir = path.join(outDir, 'adversarial');
  fs.mkdirSync(dir, { recursive: true });
  const manifest = [];
  for (const testCase of adversarialCases()) {
    const content = testCase.build();
    const file = path.join(dir, `${testCase.id}.x12`);
    fs.writeFileSync(file, content);
    manifest.push({
      id: testCase.id,
      category: testCase.category,
      expect: testCase.expect,
      description: testCase.description,
      bytes: Buffer.byteLength(content),
      file: path.relative(outDir, file),
    });
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const byCategory = {};
  for (const c of manifest) byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  console.log(`adversarial: ${manifest.length} cases ${JSON.stringify(byCategory)} -> adversarial/manifest.json`);
}

async function generateMixed() {
  const content = mixedCorpus({ transactions, claims, seed, interval });
  const dir = path.join(outDir, 'mixed');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'corpus-mixed.x12');
  fs.writeFileSync(file, content);
  const manifest = {
    profile: 'mixed',
    transactions,
    claims_per_transaction: claims,
    seed,
    interval,
    injected: Math.floor((transactions - 1) / interval),
    bytes: Buffer.byteLength(content),
    file: path.relative(outDir, file),
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`mixed: ${transactions} transactions, ${manifest.injected} hostile injections -> mixed/corpus-mixed.x12`);
}

fs.mkdirSync(outDir, { recursive: true });
if (profile === 'valid' || profile === 'all') await generateValid();
if (profile === 'adversarial' || profile === 'all') await generateAdversarial();
if (profile === 'mixed' || profile === 'all') await generateMixed();
