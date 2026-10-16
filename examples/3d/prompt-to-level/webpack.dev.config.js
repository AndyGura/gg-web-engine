const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, './index.ts'),
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      // the prompt is shown on the page: PROMPT.md is imported as a raw string
      { test: /\.md$/, type: 'asset/source' },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
    }),
  ],
};
