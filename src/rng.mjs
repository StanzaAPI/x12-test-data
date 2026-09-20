// Deterministic xorshift32 PRNG so every generated corpus is reproducible
// from (seed, transactions, claims) alone.

export function rng(seed) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    digits: (n) => {
      let out = '';
      for (let i = 0; i < n; i++) out += Math.floor(next() * 10);
      return out;
    },
  };
}
