const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: './src/index.js',
    output: {
      path: __dirname + '/dist',
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use:  [  'style-loader', MiniCssExtractPlugin.loader, 'css-loader']
        }
      ]
    },
    plugins: [
      new CopyWebpackPlugin([
        {from: "src/index.html"},
        {from: "data", to: "data"},
      ]),
      new MiniCssExtractPlugin({
        filename: 'style.css',
      })
    ],
};
