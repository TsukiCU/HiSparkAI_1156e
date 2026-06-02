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
const rootDir = path.resolve(__dirname, '..');

module.exports = {
  target: 'node',
  mode: 'development',

  entry: path.resolve(__dirname, '../src/extension.ts'),
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: 'extension.js',
    library: {
      type: 'commonjs2',
    },
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode',
    bufferutil: 'bufferutil',
    'utf-8-validate': 'utf-8-validate',
    serialport: 'commonjs2 serialport',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@src': path.resolve(rootDir, 'src'),
      '@backEnd': path.join(rootDir, 'src', 'backend'),
      '@frontEnd': path.join(rootDir, 'src', 'frontEnd'),
    },
  },
  devServer: {
    port: 9030,
    host: 'localhost',
    historyApiFallback: true,
    hot: true,
    static: path.resolve(__dirname, '../dist'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
};
