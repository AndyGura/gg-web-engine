// three.js ships ESM-only as of r186 (its CJS entry now just does a native
// `require()` of its ESM build). Jest's own require(esm) support doesn't reach
// requires issued from inside untransformed node_modules code, so this transform
// converts three's ESM build to CommonJS on the fly for the test run only —
// the package's own build/runtime output is untouched.
module.exports = {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
};
