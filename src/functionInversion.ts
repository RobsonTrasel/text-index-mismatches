/**
 * Fiat-Naor function inversion, adapted for the CGL tree (Section 4.3).
 *
 * Given f: [N] → [N], we want to compute f⁻¹(j) — all i where f(i) = j.
 * A naive lookup table costs O(N) space. Fiat-Naor trades space for query
 * time: O(N/σ) space, O(σ³) per query. The paper exploits the fact that
 * each CGL leaf has at most σ suffixes (|f⁻¹(j)| ≤ σ) to skip the
 * high-indegree handling from the original 1990 paper.
 *
 * arXiv:2604.01307
 */

export const BOTTOM = Symbol("⊥");
export type FunctionValue = number | typeof BOTTOM;

export type InvertibleFunction = (i: number) => FunctionValue;

interface Cluster {
    hashSeed: number;
    chainEnds: Map<number, number>; // chain endpoint → chain start
}

/**
 * Inverts a function f using chained hashing.
 *
 * Space: O(n/σ) — we store n/σ³ chains across σ² clusters.
 * Query: O(σ³) — walk a chain of length σ in each of σ² clusters.
 */
export class FunctionInverter {
    private readonly n: number;
    private readonly sigma: number;
    private readonly f: InvertibleFunction;
    private readonly clusters: Cluster[];
    // elements that no chain covers — stored directly to guarantee correctness
    private readonly missingItems: Map<number, number[]>;

    constructor(n: number, sigma: number, f: InvertibleFunction) {
        this.n = n;
        this.sigma = sigma;
        this.f = f;
        this.clusters = [];
        this.missingItems = new Map();
        this.build();
    }

    private build(): void {
        const numClusters = Math.max(1, Math.ceil(this.sigma * this.sigma));
        const chainsPerCluster = Math.max(1, Math.ceil(this.n / (this.sigma ** 3)));

        const found = new Set<number>();

        for (let c = 0; c < numClusters; c++) {
            const seed = (c * 2654435761) >>> 0; // Knuth multiplicative hash
            const cluster: Cluster = {hashSeed: seed, chainEnds: new Map()};

            for (let t = 0; t < chainsPerCluster; t++) {
                const x = Math.floor(((seed * (t + 1) * 1000003) % this.n + this.n) % this.n);
                let cur = x;

                for (let step = 0; step < this.sigma; step++) {
                    const fVal = this.f(cur);
                    if (fVal === BOTTOM) break;
                    found.add(cur);
                    cur = this.hash(seed, fVal as number);
                }

                cluster.chainEnds.set(cur, x);
            }

            this.clusters.push(cluster);
        }

        // anything not covered by chains gets stored explicitly
        for (let i = 0; i < this.n; i++) {
            if (!found.has(i)) {
                const fVal = this.f(i);
                if (fVal !== BOTTOM) {
                    const j = fVal as number;
                    if (!this.missingItems.has(j)) this.missingItems.set(j, []);
                    this.missingItems.get(j)!.push(i);
                }
            }
        }
    }

    /**
     * Find all i such that f(i) = j.
     *
     * For each cluster: walk the chain from j for σ steps, check if we hit a
     * stored endpoint, and if so re-walk from the chain start to collect preimages.
     */
    public invert(j: number): number[] {
        const results = new Set<number>();

        const missing = this.missingItems.get(j);
        if (missing) missing.forEach((i) => results.add(i));

        for (const cluster of this.clusters) {
            let cur = j;
            const chainFromJ: number[] = [cur];
            for (let step = 0; step < this.sigma; step++) {
                cur = this.hash(cluster.hashSeed, cur);
                chainFromJ.push(cur);
            }

            for (const endpoint of chainFromJ) {
                const x = cluster.chainEnds.get(endpoint);
                if (x === undefined) continue;

                // re-walk from x, collecting any element that maps to j
                let curr = x;
                for (let step = 0; step < this.sigma; step++) {
                    const fCurr = this.f(curr);
                    if (fCurr === BOTTOM) break;
                    if ((fCurr as number) === j) {
                        results.add(curr);
                    }
                    curr = this.hash(cluster.hashSeed, fCurr as number);
                }
                break;
            }
        }

        return Array.from(results);
    }

    /** Simple multiply-shift hash. Good enough for a demo, not cryptographic. */
    private hash(seed: number, val: number): number {
        return Math.abs((seed * (val + 1) * 2246822519) % this.n);
    }
}

/** Quick summary of how much space the inverter uses. */
export function inverterSpaceSummary(
    n: number,
    sigma: number
): { clusters: number; chainsPerCluster: number; totalChainEntries: number; ratio: string } {
    const clusters = Math.ceil(sigma * sigma);
    const chainsPerCluster = Math.ceil(n / sigma ** 3);
    const totalChainEntries = clusters * chainsPerCluster;
    return {
        clusters,
        chainsPerCluster,
        totalChainEntries,
        ratio: `${totalChainEntries} entries for n=${n} (ratio: n/${(n / totalChainEntries).toFixed(1)})`,
    };
}
