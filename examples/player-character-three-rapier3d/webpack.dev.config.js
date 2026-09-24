const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, './index.ts'),
  devtool: 'inline-source-map',
  // devServer: {
  //   static: [{ directory: path.resolve(__dirname, '../assets'), publicPath: '/assets' }],
  // },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [new HtmlWebpackPlugin({
    template: 'index.html'
  })],
};
