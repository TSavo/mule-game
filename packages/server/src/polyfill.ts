// Polyfill Symbol.metadata for @colyseus/schema v4 TC39 decorators
// Must be loaded before any schema imports
(Symbol as any).metadata ??= Symbol.for("Symbol.metadata");
