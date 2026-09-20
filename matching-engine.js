// ============================================================
// matching-engine.js — the actual gradient/harmony/accent logic.
// Depends on: color-math.js (deltaE2000).
// ============================================================
// Weight for the palette-spread penalty in color search (see palette_spread
// in extract_blocks.py). Higher = more strongly avoids picking a block whose
// average color hides a high-contrast split (ore flecks on stone, etc).
// Tune here if it feels too aggressive or too lax.
const SPREAD_PENALTY = 0.6;

function findNearest(targetLab, pool, excludeIds) {
  let best = null, bestScore = Infinity, bestD = Infinity;
  for (const block of pool) {
    if (excludeIds.has(block.id)) continue;
    const d = deltaE2000(targetLab, block.lab);
    const score = d + SPREAD_PENALTY * (block.spread || 0);
    if (score < bestScore) { bestScore = score; bestD = d; best = block; }
  }
  if (!best) {
    // Pool exhausted -- fewer distinct blocks than requested steps (small
    // dataset, a tightly filtered family, etc). Fall back to allowing a
    // repeat rather than returning null: a repeated block in the chain is
    // an honest sign the palette ran out, not something to crash over.
    for (const block of pool) {
      const d = deltaE2000(targetLab, block.lab);
      const score = d + SPREAD_PENALTY * (block.spread || 0);
      if (score < bestScore) { bestScore = score; bestD = d; best = block; }
    }
  }
  return { block: best, distance: bestD };
}

function buildGradient(blockA, blockB, steps, pool) {
  const chain = new Array(steps);
  chain[0] = { block: blockA, targetDistance: 0 };
  if (steps > 1) chain[steps - 1] = { block: blockB, targetDistance: 0 };
  const used = new Set([blockA.id, blockB.id]);
  for (let i = 1; i < steps - 1; i++) {
    const t = i / (steps - 1);
    const targetLab = [0, 1, 2].map(k => blockA.lab[k] + (blockB.lab[k] - blockA.lab[k]) * t);
    const { block, distance } = findNearest(targetLab, pool, used);
    used.add(block.id);
    chain[i] = { block, targetDistance: distance };
  }
  let maxJump = -1, maxJumpIndex = -1; const jumps = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const d = deltaE2000(chain[i].block.lab, chain[i + 1].block.lab);
    jumps.push(d);
    if (d > maxJump) { maxJump = d; maxJumpIndex = i; }
  }
  return { chain, jumps, maxJumpIndex };
}

function textureDistance(t1, t2) {
  const dr = t1.roughness - t2.roughness, dg = t1.grain - t2.grain;
  return Math.sqrt(dr * dr + dg * dg);
}

function findComplementaryByTexture(blockA, pool, mode, k) {
  const candidates = pool.filter(b => b.id !== blockA.id).map(b => ({
    block: b, colorD: deltaE2000(blockA.lab, b.lab), texD: textureDistance(blockA.tex, b.tex),
  }));
  if (mode === 'harmony') {
    candidates.sort((x, y) =>
      (x.texD + 0.4 * x.colorD + SPREAD_PENALTY * (x.block.spread || 0)) -
      (y.texD + 0.4 * y.colorD + SPREAD_PENALTY * (y.block.spread || 0)));
    return candidates.slice(0, k);
  }
  const gated = candidates.filter(c => c.colorD < 26);
  const pool2 = gated.length >= k ? gated : candidates;
  pool2.sort((x, y) => (y.texD - 0.015 * y.colorD) - (x.texD - 0.015 * x.colorD));
  return pool2.slice(0, k);
}

// How close (ΔE) a complementary block has to be to count as a real
// companion suggestion, rather than "closest of a bad bunch." Tune here.
const COMPANION_THRESHOLD = { gradient: 20, harmony: 25, accent: 30 };

// For each block actually shown in a (cube-only) gradient chain, find the
// nearest complementary block. Dedupes by id (kept at its best distance,
// remembering every step it matched), drops anything farther than the
// threshold, and returns the closest few -- "closest and most
// complementary" as a short, non-redundant list rather than one-per-step.
function findComplementaryCompanions(chainBlocks, compPool, threshold, k) {
  const best = new Map();
  chainBlocks.forEach((step, i) => {
    let nearest = null, nearestD = Infinity;
    for (const c of compPool) {
      const d = deltaE2000(step.block.lab, c.lab) + SPREAD_PENALTY * (c.spread || 0);
      if (d < nearestD) { nearestD = d; nearest = c; }
    }
    if (nearest && nearestD <= threshold) {
      const prior = best.get(nearest.id);
      if (prior) prior.steps.push(i + 1);
      else best.set(nearest.id, { block: nearest, distance: nearestD, steps: [i + 1] });
    }
  });
  return [...best.values()].sort((a, b) => a.distance - b.distance).slice(0, k);
}
