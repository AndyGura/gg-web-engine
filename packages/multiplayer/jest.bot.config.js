// Config for `npm run bot` (the zoning bot harness): real Firebase SDK (no stub mapping), node
// environment, only the *.bot.ts file. See test/bot/zoning-bot.bot.ts for the required env vars.
module.exports = {
  rootDir: '.',
  testRegex: 'zoning-bot\\.bot\\.ts$',
  testEnvironment: 'node',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { esModuleInterop: true }, diagnostics: false }] },
  moduleNameMapper: { '@gg-web-engine/core': '<rootDir>/../core/src/index.ts' },
  testTimeout: 10 * 60 * 1000,
};
