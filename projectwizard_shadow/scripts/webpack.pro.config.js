/**
 * Backend (Node/extension) bundle config
 */
const path = require('path');

module.exports = {
  target: 'node',
  mode:   'production',
  entry: {
    extension: path.resolve(__dirname, '../src/extension.ts'),
  },
  output: {
    path:     path.resolve(__dirname, '../dist'),
    filename: '[name].js',
    library:  { type: 'commonjs2' },
  },
  externals: {
    vscode:     'commonjs vscode',
    serialport: 'commonjs serialport',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test:    /\.ts$/,
        exclude: /node_modules/,
        use:     [{ loader: 'ts-loader' }],
      },
    ],
  },
};
