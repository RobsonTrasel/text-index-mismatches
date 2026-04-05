/**
 * Recursive CGL Tree — the core data structure from Section 3.
 *
 * The idea: pick a pivot, compute LCP of every string with the pivot,
 * then split into subsets by comparing LCP values against the median.
 * For each subset we also build an "altered" copy where strings are
 * nudged one char closer to the pivot — this lets the search radius
 * shrink by 1 on each altered branch (Obs. 7).
 *
 * arXiv:2604.01307 — Bibbens, Borevitz, McCauley
 */

import {AlteredString, CGLNode, Match} from "./types";
import {
    hammingDistance,
    lcp,
    lexCompare,
    materialize,
    pivotAlter,
    plain,
} from "./stringUtils";

/**
 * Build a CGL node for a set of suffixes.
 * @param leafSize — when the set is this small or smaller, stop splitting (σ param)
 */
export function buildCGL(
    suffixes: AlteredString[],
    k: number,
    leafSize = 1
): CGLNode {
    if (suffixes.length <= leafSize) {
        return {
            pivot: suffixes[0] ?? plain(""),
            lessThanMedian: null,
            greaterThanMedian: null,
            lessLex: null,
            greaterLex: null,
            altLessThanMedian: null,
            altGreaterThanMedian: null,
            altLessLex: null,
            altGreaterLex: null,
            suffixes,
            isLeaf: true,
        };
    }

    // pivot = lexicographic median
    const sorted = [...suffixes].sort(lexCompare);
    const pivotIdx = Math.floor(sorted.length / 2);
    const pivot = sorted[pivotIdx];

    // LCP of every other string with the pivot
    const withLCP = sorted
        .filter((_, i) => i !== pivotIdx)
        .map((s) => ({s, l: lcp(s, pivot)}));

    // median LCP value (Def. 9)
    const lcpValues = withLCP.map((x) => x.l).sort((a, b) => a - b);
    const m = lcpValues[Math.floor(lcpValues.length / 2)] ?? 0;

    // partition into 4 subsets based on LCP vs median
    const S_lessM: AlteredString[] = [];
    const S_greaterM: AlteredString[] = [];
    const S_lessLex: AlteredString[] = [];
    const S_greaterLex: AlteredString[] = [];

    for (const {s, l} of withLCP) {
        if (l < m) {
            S_lessM.push(s);
        } else if (l > m) {
            S_greaterM.push(s);
        } else {
            const cmp = lexCompare(s, pivot);
            if (cmp < 0) S_lessLex.push(s);
            else S_greaterLex.push(s);
        }
    }

    // pivot-alter every string in each subset
    const hat = (arr: AlteredString[]) => arr.map((s) => pivotAlter(s, pivot));

    return {
        pivot,
        isLeaf: false,
        suffixes: [],
        lessThanMedian: S_lessM.length > 0 ? buildCGL(S_lessM, k, leafSize) : null,
        greaterThanMedian: S_greaterM.length > 0 ? buildCGL(S_greaterM, k, leafSize) : null,
        lessLex: S_lessLex.length > 0 ? buildCGL(S_lessLex, k, leafSize) : null,
        greaterLex: S_greaterLex.length > 0 ? buildCGL(S_greaterLex, k, leafSize) : null,
        // altered branches only make sense when we still have mismatches to spend
        altLessThanMedian: (k > 0 && S_lessM.length > 0) ? buildCGL(hat(S_lessM), k - 1, leafSize) : null,
        altGreaterThanMedian: (k > 0 && S_greaterM.length > 0) ? buildCGL(hat(S_greaterM), k - 1, leafSize) : null,
        altLessLex: (k > 0 && S_lessLex.length > 0) ? buildCGL(hat(S_lessLex), k - 1, leafSize) : null,
        altGreaterLex: (k > 0 && S_greaterLex.length > 0) ? buildCGL(hat(S_greaterLex), k - 1, leafSize) : null,
    };
}

/**
 * Query the tree: find all suffixes within Hamming distance `r` of `query`.
 *
 * At each node we check the pivot, then route into children based on
 * LCP(query, pivot). On altered branches we send the pivot-altered query
 * with radius r-1 — that's where Obs. 7 kicks in.
 */
export function queryCGL(
    node: CGLNode | null,
    query: AlteredString,
    r: number
): Match[] {
    if (!node) return [];

    const results: Match[] = [];

    // check pivot
    const distToPivot = hammingDistance(query, node.pivot);
    if (distToPivot <= r && node.pivot.startIndex !== undefined) {
        results.push({
            startIndex: node.pivot.startIndex,
            substring: materialize(node.pivot).replace(/\$+$/, ""),
            hammingDistance: distToPivot,
        });
    }

    // leaf — just brute-force the remaining suffixes
    if (node.isLeaf) {
        for (const s of node.suffixes) {
            if (s === node.pivot) continue;
            const d = hammingDistance(query, s);
            if (d <= r && s.startIndex !== undefined) {
                results.push({
                    startIndex: s.startIndex,
                    substring: materialize(s).replace(/\$+$/, ""),
                    hammingDistance: d,
                });
            }
        }
        return results;
    }

    const i = lcp(query, node.pivot);
    const qHat = pivotAlter(query, node.pivot);
    const qStr = materialize(query);
    const pStr = materialize(node.pivot);

    // edge case: query is a prefix of the pivot — need to check everything
    if (i >= qStr.length) {
        results.push(...queryCGL(node.lessThanMedian, query, r));
        results.push(...queryCGL(node.greaterThanMedian, query, r));
        results.push(...queryCGL(node.lessLex, query, r));
        results.push(...queryCGL(node.greaterLex, query, r));
        if (r > 0) {
            results.push(...queryCGL(node.altLessThanMedian, qHat, r - 1));
            results.push(...queryCGL(node.altGreaterThanMedian, qHat, r - 1));
            results.push(...queryCGL(node.altLessLex, qHat, r - 1));
            results.push(...queryCGL(node.altGreaterLex, qHat, r - 1));
        }
        return results;
    }

    // route based on lex comparison with pivot
    // TODO: track median m explicitly per node for a tighter traversal
    const qLessP = qStr < pStr;

    if (r > 0) {
        if (qLessP) {
            results.push(...queryCGL(node.lessThanMedian, query, r));
            results.push(...queryCGL(node.lessLex, query, r));
            results.push(...queryCGL(node.greaterLex, qHat, r - 1));
            results.push(...queryCGL(node.greaterThanMedian, qHat, r - 1));
            results.push(...queryCGL(node.altLessThanMedian, query, r - 1));
            results.push(...queryCGL(node.altLessLex, qHat, r - 1));
            results.push(...queryCGL(node.altGreaterLex, qHat, r - 1));
        } else {
            results.push(...queryCGL(node.greaterThanMedian, query, r));
            results.push(...queryCGL(node.greaterLex, query, r));
            results.push(...queryCGL(node.lessThanMedian, qHat, r - 1));
            results.push(...queryCGL(node.altGreaterThanMedian, query, r - 1));
            results.push(...queryCGL(node.altGreaterLex, query, r - 1));
            results.push(...queryCGL(node.altLessLex, qHat, r - 1));
        }
    } else {
        // r=0 → exact match, no altered branches
        if (qLessP) {
            results.push(...queryCGL(node.lessThanMedian, query, 0));
            results.push(...queryCGL(node.lessLex, query, 0));
        } else {
            results.push(...queryCGL(node.greaterThanMedian, query, 0));
            results.push(...queryCGL(node.greaterLex, query, 0));
        }
    }

    return results;
}

/** Count total nodes in the tree. */
export function countNodes(node: CGLNode | null): number {
    if (!node) return 0;
    return (
        1 +
        countNodes(node.lessThanMedian) +
        countNodes(node.greaterThanMedian) +
        countNodes(node.lessLex) +
        countNodes(node.greaterLex) +
        countNodes(node.altLessThanMedian) +
        countNodes(node.altGreaterThanMedian) +
        countNodes(node.altLessLex) +
        countNodes(node.altGreaterLex)
    );
}
