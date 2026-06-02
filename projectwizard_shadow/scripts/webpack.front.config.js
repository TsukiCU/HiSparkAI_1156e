/**
 * Frontend (webview) bundle config
 */
const path               = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin  = require('html-webpack-plugin');
const fs                 = require('fs');

const rootDir = path.resolve(__dirname, '..');
const theme   = process.env.theme || 'dark';

// Parse Less theme variables for antd
const str    = fs.readFileSync(path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'themes', `${theme}.less`), 'utf8');
const themeVars = {};
str.split(/\r?\n/).forEach((line) => {
  if (!line.startsWith('//') && line.includes('@')) {
    const [k, v] = line.replace(';', '').split(':');
    if (k && v) { themeVars[k.trim()] = v.trim(); }
  }
});

const entry = theme === 'dark'
  ? [
      path.join(rootDir, 'src', 'frontEnd', 'index.tsx'),
      path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'index.less'),
    ]
  : path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'index.less');

module.exports = {
  mode:    'development',
  entry,
  output: {
    filename: 'bundle.js',
    path:     path.join(rootDir, 'dist'),
  },
  // VSCode webview bundles are not served over the network, so size hints
  // are not meaningful here.
  performance: { hints: false },
  devtool: 'nosources-source-map',
  resolve: {
    extensions: ['.wasm', '.mjs', '.js', '.json', '.tsx', '.ts'],
    alias: {
      '@src':      path.resolve(rootDir, 'src'),
      '@frontEnd': path.join(rootDir, 'src', 'frontEnd'),
    },
    fallback: { Buffer: false },
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/i,
        use:  [{ loader: 'file-loader' }],
      },
      {
        test:   /\.svg$/,
        loader: 'svg-inline-loader',
      },
      {
        test:    /\.tsx?$/,
        use: [
          { loader: 'babel-loader', options: { plugins: ['@babel/plugin-transform-runtime'] } },
          'ts-loader',
        ],
        exclude: /node_modules/,
      },
      {
        test:    /\.jsx?$/,
        exclude: /node_modules/,
        loader:  'babel-loader',
        options: { plugins: ['@babel/plugin-transform-runtime'] },
      },
      {
        test: /\.css$/i,
        use:  ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/i,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader' },
          {
            loader:  'less-loader',
            options: {
              lessOptions: { modifyVars: themeVars, javascriptEnabled: true },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename:      `themes/${theme}.css`,
      chunkFilename: `themes/${theme}.css`,
      ignoreOrder:   false,
    }),
    new HtmlWebpackPlugin({
      template: path.join(rootDir, 'src', 'frontEnd', 'index.html'),
      filename: 'index.html',
      inject:   true,
      theme,
    }),
  ],
};
