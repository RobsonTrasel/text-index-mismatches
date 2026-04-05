/**
 * Quick demo — typo-tolerant search, DNA alignment, and the σ tradeoff.
 * Run: npx tsx examples/demo.ts
 */

import { TextIndexWithMismatches } from "../src/index";
import { inverterSpaceSummary } from "../src/functionInversion";

// --- 1. Typo-tolerant search ---

console.log("\n=== Typo-tolerant search ===\n");

const article = "the quick brown fox jumps over the lazy dog. a fast auburn fox leaps across the sleepy hound. the rapid brawn foxe jumps near the layz dog.";

const searchIndex = new TextIndexWithMismatches(article, 2);

for (const q of ["fox", "jumps", "lazy"]) {
    const matches = searchIndex.query(q, 2);
    console.log(`"${q}" (k=2): ${matches.length} matches`);
    for (const m of matches.sort((a, b) => a.startIndex - b.startIndex)) {
        console.log(`  pos=${m.startIndex}  dist=${m.hammingDistance}  "${m.substring}"`);
    }
}

// --- 2. DNA k-mismatch ---

console.log("\n=== DNA sequence alignment ===\n");

const genome =
    "ATCGATCGTAGCTAGCTAGCTAGCTTGATCGATCGATCGAATCGATCGTAGCTAGCTTT" +
    "GCTAGCTAGCTAGCTAGCTAGCATCGATCGATCGATCGATCGATCGTAGCTAGCTAGCT";

const probe = "ATCGATCG";
const dnaIndex = new TextIndexWithMismatches(genome, 3);

console.log(`Genome: ${genome.length} bp, Probe: "${probe}"\n`);

for (let k = 0; k <= 3; k++) {
    const hits = dnaIndex.query(probe, k);
    console.log(`  k=${k}: ${hits.length} alignments`);
}

// sanity check against brute force
const naive = dnaIndex.naiveQuery(probe, 2);
const fast = dnaIndex.query(probe, 2);
console.log(`\n  CGL vs naive (k=2): ${fast.length} vs ${naive.length} — ${fast.length === naive.length ? "OK" : "MISMATCH!"}`);

// --- 3. Space/time tradeoff with σ ---

console.log("\n=== Space vs time tradeoff (sigma) ===\n");

const text = "abcdefghijklmnopqrstuvwxyz".repeat(4);
const n = text.length;

console.log(`Text length: ${n}\n`);
console.log(`${"sigma".padEnd(8)} ${"nodes".padEnd(12)} ${"inv. entries".padEnd(16)} ratio`);
console.log("-".repeat(52));

for (const sigma of [1, 2, 3, 4, 6, 8]) {
    const idx = new TextIndexWithMismatches(text, 2, sigma);
    const stats = idx.stats();
    const inv = inverterSpaceSummary(n, sigma);
    console.log(
        `${String(sigma).padEnd(8)} ${String(stats.treeNodeCount).padEnd(12)} ${String(inv.totalChainEntries).padEnd(16)} ${inv.ratio}`
    );
}

// --- 4. Quick correctness sweep ---

console.log("\n=== Correctness check ===\n");

const corpus = "the quick brown fox jumps over the lazy dog and the five boxing wizards";
const verifyIndex = new TextIndexWithMismatches(corpus, 2);

let allGood = true;
for (const q of ["fox", "the", "jump", "quikc", "browx", "xyz"]) {
    for (let r = 0; r <= 2; r++) {
        const fSet = new Set(verifyIndex.query(q, r).map((m) => m.startIndex));
        const nSet = new Set(verifyIndex.naiveQuery(q, r).map((m) => m.startIndex));
        const ok = [...nSet].every((i) => fSet.has(i));
        if (!ok) {
            allGood = false;
            console.log(`FAIL: "${q}" r=${r}  tree=${[...fSet]}  naive=${[...nSet]}`);
        }
    }
}

if (allGood) {
    console.log("All queries match naive scan.");
}
