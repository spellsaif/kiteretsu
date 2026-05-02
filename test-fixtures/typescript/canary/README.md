# The Canary Test (TypeScript)

This is the single most important test for Kiteretsu. It verifies the core dependency resolution logic across multiple layers of depth and different import styles.

## The Setup
- **Trigger**: `core/utils.ts`
- **Direct (3)**: `d1.ts`, `d2.ts`, `d3.ts`
- **Barrel (1)**: `barrel/index.ts` (re-exports `utils.ts`)
- **Through Barrel (2)**: `b1.ts`, `b2.ts` (import from `barrel`)
- **Transitive (2)**: `t1.ts` (imports `b1`), `t2.ts` (imports `t1`)
- **Type-Only (1)**: `typeOnly.ts` (should NOT be in blast radius)
- **Dynamic (1)**: `dynamic.ts` (should be flagged UNRESOLVABLE)

## Expected Result
Blast radius should contain exactly 8 files. `typeOnly.ts` must be excluded. `dynamic.ts` must be flagged.
