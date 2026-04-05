# text-index-mismatches

Implementação do paper ["Space-Efficient Text Indexing with Mismatches using Function Inversion"](https://arxiv.org/abs/2604.01307) (Bibbens, Borevitz, McCauley — 2026).

O problema: dado um texto T e uma query q, encontrar todas as substrings de T que estão a no máximo k mismatches (distância de Hamming) de q. A solução ingênua é O(n·|q|) por query. O paper propõe uma estrutura que constrói um índice em O(n) espaço e responde queries em tempo sublinear.

## Como funciona

A estrutura combina duas ideias:

1. **CGL Tree (Seção 3)** — Uma árvore recursiva que particiona os sufixos do texto usando pivôs. A sacada é o *pivot-alter*: ao forçar uma string a concordar com o pivô em mais uma posição, a distância de Hamming com a query cai em 1. Isso garante que a recursão tem profundidade limitada por k.

2. **Function Inversion (Seção 4)** — A árvore completa é grande demais (O(n · C(log n, k)) nós), então truncamos ela e usamos inversão de função (Fiat-Naor) pra recuperar quais sufixos caem em cada folha sem armazená-los explicitamente. Ajustando σ = log(n)/k, o espaço total fica O(n).

## Estrutura

```
src/
  types.ts             # tipos base (AlteredString, CGLNode, Match)
  stringUtils.ts       # hamming distance, LCP, pivot-alter
  cglTree.ts           # build e query da árvore CGL
  functionInversion.ts # inversão de função (Fiat-Naor)
  index.ts             # TextIndexWithMismatches — junta tudo
examples/
  demo.ts              # demo com busca tolerante a typo, DNA alignment e tradeoff de σ
```

## Rodando

```bash
pnpm install
npx tsx examples/demo.ts
```

## Exemplo rápido

```ts
import { TextIndexWithMismatches } from "./src/index";

const idx = new TextIndexWithMismatches("the quick brown fox jumps over the lazy dog", 2);

// busca "fox" permitindo até 2 mismatches
const matches = idx.query("fox", 2);

for (const m of matches) {
  console.log(`pos=${m.startIndex} dist=${m.hammingDistance} "${m.substring}"`);
}
```

## Referência

> Bibbens, Borevitz, McCauley. *Space-Efficient Text Indexing with Mismatches using Function Inversion*. arXiv:2604.01307, 2026.
