const fs = require('fs')
const path = require('path')

const nodeExternals = require('webpack-node-externals')

const { scripts, devDependencies, ...pkg } = require('./package.json')
fs.writeFileSync('../../heroku/package.json', JSON.stringify(pkg))

module.exports = {
  mode: 'production',
  devtool: false,
  optimization: {
    minimize: false,
  },
  entry: './src/index.ts',
  output: {
    filename: 'server.js',
    path: path.resolve('../../heroku'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  target: 'node',
  externals: [
    nodeExternals(),
  ],
}
