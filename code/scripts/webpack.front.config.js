/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const fs = require('fs');
const rootDir = path.resolve(__dirname, '..');
const theme = process.env.theme || 'dark';

const str = fs.readFileSync(path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'themes', `${theme}.less`), 'utf8');

const lines = str.split(/\r?\n/);
const themeVars = {};

lines.forEach((line) => {
  if (!line.startsWith('//') && line.includes('@')) {
    const arr = line.replace(';', '').split(':');
    themeVars[arr[0]] = arr[1].replace(/\s+/g, '');
  }
});

const entry =
  theme === 'dark'
    ? [
      path.join(rootDir, 'src', 'frontEnd', 'index.tsx'),
      path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'index.less'),
    ]
    : path.join(rootDir, 'src', 'frontEnd', 'a-styles', 'index.less');

module.exports = {
  entry: entry,
  output: {
    filename: 'bundle.js',
    path: path.join(rootDir, 'dist'),
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['.wasm', '.mjs', '.js', '.json', '.tsx', '.ts'],
    alias: {
      '@src': path.resolve(rootDir, 'src'),
      '@backEnd': path.join(rootDir, 'src', 'backend'),
      '@frontEnd': path.join(rootDir, 'src', 'frontEnd'),
      '@': path.resolve(__dirname, 'src').replace(/\\/g, '/'),
    },
    fallback: {
      Buffer: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(?<image>png|jpe?g|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext][query]',
        },
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext][query]',
        },
      },
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              plugins: ['@babel/plugin-transform-runtime'],
            },
          },
          'ts-loader',
        ],
        exclude: /(?<exclude>node_modules|public)/,
      },
      {
        test: /\.jsx?$/,
        exclude: /(?<exclude>node_modules|bower_components|public\/)/,
        loader: 'babel-loader',
      },
      {
        test: /\.js$/,
        exclude: /(?<exclude>node_modules|bower_components|public\/)/,
        loader: 'babel-loader',
        options: {
          plugins: ['@babel/plugin-transform-runtime'],
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/i,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader' },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                modifyVars: themeVars,
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
      {
        test: /\.(mp4|mp3)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]',
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: `themes/${theme}.css`,
      chunkFilename: `themes/${theme}.css`,
      ignoreOrder: false,
    }),
    new HtmlWebPackPlugin({
      template: path.join(rootDir, 'src', 'frontEnd', 'index.html'),
      filename: 'index.html',
      inject: true,
      theme: theme,
    }),
  ],
};
