// `poly-decomp` has no official type definitions (no `@types/poly-decomp` package exists), and it's
// only ever passed opaquely into matter-js's own `Common.setDecomp` (see `matter-factory.ts`), which
// itself only types that parameter as `any` - so a minimal ambient declaration is enough here.
declare module 'poly-decomp';
