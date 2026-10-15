// pixi.js and a few of its dependencies (earcut, ...) ship ESM-only, which Jest's CommonJS runtime
// can't require from inside node_modules. This transform converts them to CommonJS for the test
// run only (see the jest `transformIgnorePatterns` in package.json); the package's own build and
// runtime output are untouched.
module.exports = {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
};
