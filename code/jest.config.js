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
/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

/** @type {import('jest').Config} */
module.exports = {
  // 指定项目根目录
  rootDir: path.resolve(__dirname),
  // 在每次测试之前自动清除模拟调用，实例，上下文和结果
  clearMocks: true,
  // 覆盖率提供者
  coverageProvider: 'v8',
  // 支持ts测试
  preset: 'ts-jest',
  // 设置路径映射,需要与tsconfig.json配置同步
  moduleNameMapper: {
    '@src/(.*)': '<rootDir>/src/$1',
  },
  // 指定要运行测试的文件
  testMatch: ['<rootDir>/src/test/**/*.spec.(ts|tsx|js)'],
  testPathIgnorePatterns: ['/node_modules/'],
  // 是否收集覆盖率
  collectCoverage: true,
  // Jest应该输出其覆盖率文件的目录
  coverageDirectory: '<rootDir>/test_report/coverage',
  // 指定要测试覆盖率的文件
  collectCoverageFrom: [
    '**/src/**/*.{js,ts,vue}',
  ],
  // 要忽略覆盖率的文件
  coveragePathIgnorePatterns: [
    'node_modules',
    'test',
  ],
  // 将自定义报告器添加到Jest
  reporters: [
    'default',
    [
      // 通过jest-junit生成成功率报告，给CodeCov解析
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test_report/success',
        outputName: 'report.xml',
      },
    ],
    [
      // HTML格式的报告用于人工查看
      'jest-html-reporter',
      {
        pageTitle: 'Test Report',
        outputPath: '<rootDir>/test_report/success/report.html',
      },
    ],
  ],
  // 覆盖率门限 启用后不达标会报错error Command failed with exit code 1.
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};