// Types for the CGL tree index (arXiv:2604.01307)

/** Character substitution at a given position. */
export interface Alteration {
    index: number;
    char: string;
}

/**
 * String with lazy alterations — instead of copying the whole string on each
 * pivot-alter step, we just stack substitutions on top of the original.
 * At most k alterations accumulate during recursion.
 */
export interface AlteredString {
    base: string;
    alterations: Alteration[];
    startIndex?: number; // only set for text suffixes, not for queries
}

/**
 * CGL tree node. Splits strings into 4 subsets based on LCP with the pivot,
 * plus 4 "altered" subsets where the search radius drops by 1.
 * See Section 3.1 for the full partitioning scheme.
 */
export interface CGLNode {
    pivot: AlteredString;

    // unaltered children
    lessThanMedian: CGLNode | null;
    greaterThanMedian: CGLNode | null;
    lessLex: CGLNode | null;
    greaterLex: CGLNode | null;

    // pivot-altered children (radius k-1)
    altLessThanMedian: CGLNode | null;
    altGreaterThanMedian: CGLNode | null;
    altLessLex: CGLNode | null;
    altGreaterLex: CGLNode | null;

    suffixes: AlteredString[];
    isLeaf: boolean;
}

/** Query result. */
export interface Match {
    startIndex: number;
    substring: string;
    hammingDistance: number;
}