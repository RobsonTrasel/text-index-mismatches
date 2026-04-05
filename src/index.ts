/**
 * TextIndexWithMismatches
 *
 * Combines the CGL tree (Section 3) with Fiat-Naor function inversion (Section 4)
 * to support k-mismatch substring search in sublinear query time.
 *
 * The gist: build a truncated CGL tree where leaves hold at most σ suffixes,
 * then use function inversion to map suffix indices back to leaf labels without
 * storing them all explicitly. Setting σ = log(n)/k gives O(n) space (Corollary 2).
 *
 * Based on arXiv:2604.01307 — Bibbens, Borevitz, McCauley
 */

import {AlteredString, Match} from "./types";
import {buildCGL, queryCGL, countNodes} from "./cglTree";
import {FunctionInverter, BOTTOM, inverterSpaceSummary} from "./functionInversion";
import {plain, hammingDistance} from "./stringUtils";

export interface IndexStats {
    textLength: number;
    numSuffixes: number;
    maxMismatches: number;
    sigma: number;
    treeNodeCount: number;
    spaceSummary: ReturnType<typeof inverterSpaceSummary>;
}

export class TextIndexWithMismatches {
    private readonly text: string;
    private readonly k: number;
    private readonly sigma: number;
    private readonly suffixes: string[];
    private readonly cglRoot: ReturnType<typeof buildCGL>;
    private readonly inverter: FunctionInverter;

    /**
     * @param text  — the text to index
     * @param k     — max number of mismatches
     * @param sigma — truncation parameter. Larger = less space, slower queries.
     *                Defaults to ceil(log2(n)/k) for O(n) space.
     */
    constructor(text: string, k: number, sigma?: number) {
        this.text = text;
        this.k = k;
        const n = text.length;

        this.sigma = sigma ?? Math.max(2, Math.ceil(Math.log2(n + 1) / Math.max(1, k)));

        // build all suffixes with a sentinel so short suffixes don't cause issues
        this.suffixes = [];
        for (let i = 0; i <= n - 1; i++) {
            this.suffixes.push(text.slice(i) + "$".repeat(2 * k + 1));
        }

        const altSuffixes: AlteredString[] = this.suffixes.map((s, i) => plain(s, i));
        this.cglRoot = buildCGL(altSuffixes, k, this.sigma);

        // function inversion: f(i) = leaf label that suffix i falls into
        const leafMap = this.buildLeafMap();
        const f = (i: number) => {
            const leafIdx = leafMap.get(i);
            return leafIdx !== undefined ? leafIdx : BOTTOM;
        };

        this.inverter = new FunctionInverter(this.suffixes.length, this.sigma, f);
    }

    /** Walk the tree and assign each leaf a sequential label. */
    private buildLeafMap(): Map<number, number> {
        const leafMap = new Map<number, number>();
        let leafCounter = 0;

        const traverse = (node: ReturnType<typeof buildCGL> | null) => {
            if (!node) return;
            if (node.isLeaf) {
                const label = leafCounter++;
                for (const s of node.suffixes) {
                    const idx = this.suffixes.indexOf(s.base);
                    if (idx >= 0) leafMap.set(idx, label);
                }
                return;
            }
            traverse(node.lessThanMedian);
            traverse(node.greaterThanMedian);
            traverse(node.lessLex);
            traverse(node.greaterLex);
            traverse(node.altLessThanMedian);
            traverse(node.altGreaterThanMedian);
            traverse(node.altLessLex);
            traverse(node.altGreaterLex);
        };

        traverse(this.cglRoot);
        return leafMap;
    }

    /**
     * Find all substrings of the text within Hamming distance `r` of `query`.
     * @param r — search radius, must be ≤ k
     */
    public query(query: string, r: number): Match[] {
        if (r > this.k) {
            throw new Error(`r=${r} exceeds the index's maximum k=${this.k}`);
        }

        const altQuery = plain(query);
        const rawMatches = queryCGL(this.cglRoot, altQuery, r);

        const seen = new Set<number>();
        const qLen = query.length;

        // trim matches to query length and recompute distance on the raw text
        // (the tree works on altered strings, so we double-check here)
        const trimmed = rawMatches.map((m) => ({
            startIndex: m.startIndex,
            substring: this.text.slice(m.startIndex, m.startIndex + qLen),
            hammingDistance: (() => {
                const sub = this.text.slice(m.startIndex, m.startIndex + qLen);
                let d = 0;
                for (let j = 0; j < qLen; j++) if (sub[j] !== query[j]) d++;
                return d;
            })()
        })).filter((m) => m.hammingDistance <= r);

        return trimmed.filter((m) => {
            if (seen.has(m.startIndex)) return false;
            seen.add(m.startIndex);
            return true;
        });
    }

    /** Brute-force O(n·|q|) scan, used to verify correctness of the tree. */
    public naiveQuery(query: string, r: number): Match[] {
        const results: Match[] = [];
        const n = this.text.length;
        const qLen = query.length;
        for (let i = 0; i <= n - qLen; i++) {
            const sub = this.text.slice(i, i + qLen);
            let dist = 0;
            for (let j = 0; j < qLen; j++) {
                if (sub[j] !== query[j]) dist++;
            }
            if (dist <= r) {
                results.push({startIndex: i, substring: sub, hammingDistance: dist});
            }
        }
        return results;
    }

    public stats(): IndexStats {
        return {
            textLength: this.text.length,
            numSuffixes: this.suffixes.length,
            maxMismatches: this.k,
            sigma: this.sigma,
            treeNodeCount: countNodes(this.cglRoot),
            spaceSummary: inverterSpaceSummary(this.suffixes.length, this.sigma),
        };
    }
}
