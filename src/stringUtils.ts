// String helpers: hamming distance, LCP, and the pivot-alter operation.

import {AlteredString, Alteration} from "./types";

/** Apply all stacked alterations and return the final string. */
export function materialize(s: AlteredString): string {
    const chars = s.base.split("");
    for (const alt of s.alterations) {
        if (alt.index < chars.length) {
            chars[alt.index] = alt.char;
        }
    }
    return chars.join("");
}

/**
 * Hamming distance between two altered strings.
 * Only compares up to the shorter length — extra chars are ignored
 * (the paper calls this "generalized Hamming distance", Def. 2).
 */
export function hammingDistance(s1: AlteredString, s2: AlteredString): number {
    const m1 = materialize(s1);
    const m2 = materialize(s2);
    const len = Math.min(m1.length, m2.length);
    let dist = 0;
    for (let i = 0; i < len; i++) {
        if (m1[i] !== m2[i]) dist++;
    }
    return dist;
}

/** Longest common prefix length. */
export function lcp(s1: AlteredString, s2: AlteredString): number {
    const m1 = materialize(s1);
    const m2 = materialize(s2);
    let i = 0;
    while (i < m1.length && i < m2.length && m1[i] === m2[i]) i++;
    return i;
}

/** Lexicographic comparison for sorting. */
export function lexCompare(s1: AlteredString, s2: AlteredString): number {
    const m1 = materialize(s1);
    const m2 = materialize(s2);
    if (m1 < m2) return -1;
    if (m1 > m2) return 1;
    return 0;
}

/**
 * Pivot-alter: make `s` match `pivot` at one more position.
 *
 * Finds i = LCP(s, pivot) and forces s[i] = pivot[i]. This is the key trick
 * from Obs. 7 — by matching one more char with the pivot, we guarantee that
 * the Hamming distance to the query drops by 1 in at least one branch.
 */
export function pivotAlter(s: AlteredString, pivot: AlteredString): AlteredString {
    const i = lcp(s, pivot);
    const mp = materialize(pivot);
    if (i >= mp.length) return s;
    const newAlt: Alteration = {index: i, char: mp[i]};
    return {
        base: s.base,
        alterations: [...s.alterations, newAlt],
        startIndex: s.startIndex,
    };
}

/** Wrap a raw string as an AlteredString (no alterations). */
export function plain(s: string, startIndex?: number): AlteredString {
    return {base: s, alterations: [], startIndex};
}
