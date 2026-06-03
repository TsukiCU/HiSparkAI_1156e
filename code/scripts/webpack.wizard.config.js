/**
 * Webpack config for the Project Wizard webview bundle.
 *
 * Produces:
 *   dist/wizard.js               — React app (New Project + Import Project)
 *   dist/wizard-themes/dark.css  — dark theme CSS  (dark build only)
 *   dist/wizard-themes/light.css — light theme CSS (light build only)
 *   dist/wizard.html             — webview HTML     (dark build only)
 *
 * Light build emits only the CSS; the placeholder JS is discarded by
 * .vscodeignore so it doesn't inflate the .vsix.
 */
const path               = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebPackPlugin  = require('html-webpack-plugin');
const fs                 = require('fs');

const rootDir = path.resolve(__dirname, '..');
const theme   = process.env.theme || 'dark';

// Read antd theme variables from Less so antd can be compiled with them.
const str = fs.readFileSync(
  path.join(rootDir, 'src', 'frontEnd', 'wizard', 'a-styles', 'themes', `${theme}.less`),
  'utf8',
);
const themeVars = {};
str.split(/\r?\n/).forEach((line) => {
  if (!line.startsWith('//') && line.includes('@')) {
    const arr = line.replace(';', '').split(':');
    if (arr[0] && arr[1]) { themeVars[arr[0].trim()] = arr[1].replace(/\s+/g, ''); }
  }
});

const entry = theme === 'dark'
  ? [
      path.join(rootDir, 'src', 'frontEnd', 'wizard', 'index.tsx'),
      path.join(rootDir, 'src', 'frontEnd', 'wizard', 'a-styles', 'index.less'),
    ]
  : path.join(rootDir, 'src', 'frontEnd', 'wizard', 'a-styles', 'index.less');

module.exports = {
  mode:    'development',
  entry,
  output: {
    // Light build has a CSS-only entry; redirect its empty JS to a noop file
    // so it does not overwrite the dark build's wizard.js.
    filename: theme === 'dark' ? 'wizard.js' : '_wizard_noop.js',
    path:     path.join(rootDir, 'dist'),
  },
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
        test: /\.(?<image>png|jpe?g|gif)$/i,
        type: 'asset/resource',
        generator: { filename: 'images/[name][ext][query]' },
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: { filename: 'images/[name][ext][query]' },
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
      filename:      `wizard-themes/${theme}.css`,
      chunkFilename: `wizard-themes/${theme}.css`,
      ignoreOrder:   false,
    }),
    // Only emit wizard.html for the dark build (light is CSS-only; its HTML
    // would have no <script> tag and would overwrite the dark build's result).
    ...(theme === 'dark'
      ? [new HtmlWebPackPlugin({
          template: path.join(rootDir, 'src', 'frontEnd', 'wizard', 'index.html'),
          filename: 'wizard.html',
          inject:   true,
          theme,
        })]
      : []
    ),
  ],
};
