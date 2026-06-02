module.exports = {
  // 指定代码在哪些环境下运行。这里指定了浏览器、ES2021 和 Node.js 环境。
  'env': {
    'browser': true,
    'es2021': true,
    'node': true,
  },
  // 继承的规则集，这里继承了 Google 的规则集和 prettier 的规则集
  'extends': [
    'eslint:recommended',
    'plugin:jest/recommended',
    'google',
    'prettier',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  "settings": {
    "react": {
      "version": "detect", // React version. "detect" automatically picks the version you have installed.
                           // You can also use `16.0`, `16.3`, etc, if you want to override the detected value.
                           // It will default to "latest" and warn if missing, and to "detect" in the future
    },
  },
  // 指定解析器，这里使用 @typescript-eslint/parser 解析 TypeScript 代码
  'parser': '@typescript-eslint/parser',
  // 指定解析器选项，这里指定了 ECMAScript 版本为 13，代码类型为模块
  'parserOptions': {
    'ecmaVersion': 13,
    'sourceType': 'module',
    "project": ["./tsconfig.json"],
  },
  // 指定使用的插件，这里使用了 @typescript-eslint 插件
  'plugins': [
    '@typescript-eslint',
    'header',
    'react-hooks',
  ],
  // 指定规则
  'rules': {
    // 规定头文件注释格式
    "header/header": [
      "",
      " * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.",
      "",
      " * Licensed under the Apache License, Version 2.0 (the \"License\");",
      " * you may not use this file except in compliance with the License.",
      " * You may obtain a copy of the License at",
      "",
      " * http://www.apache.org/licenses/LICENSE-2.0",
      "",
      " * Unless required by applicable law or agreed to in writing, software",
      " * distributed under the License is distributed on an \"AS IS\" BASIS,",
      " * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
      " * See the License for the specific language governing permissions and",
      " * limitations under the License.",
      ""
    ],

    // 在注释周围添加空行
    "lines-around-comment": [1, {
      "beforeBlockComment": true,
      "allowClassStart": true,
    }],
    // 优先使用模板字符串
    "prefer-template": 2,
    // 关闭no-unused-vars规则
    "no-unused-vars": "off",
    // 并使用 @typescript-eslint/no-unused-vars 规则检查 TypeScript 代码中未使用的变量
    "@typescript-eslint/no-unused-vars": "error",
    // 关闭require-jsdoc规则
    "require-jsdoc": "off",
    // 类方法定义之间有一个空行
    "lines-between-class-members": ["error", "always", { "exceptAfterSingleLine": true }],
    // 统一使用 import type 导入类型
    '@typescript-eslint/consistent-type-imports': 'error',
    // 判断相等时应使用 === 或 !== 
    "eqeqeq": "error",
    // 任何代码路径都显示的返回一个值
    "consistent-return": "warn",
    // 避免当前作用域中的变量覆盖更外层作用域的变量
    '@typescript-eslint/no-shadow': 'warn',
    // 避免使用console.log
    'no-console': 'warn',
    // TypeScript必须显式声明函数及类方法的返回值类型
    "@typescript-eslint/explicit-function-return-type": "warn",
    // 在混合使用不同的操作符时，采用括号明确运算的优先级
    "no-mixed-operators": "warn",
    // 使用参数的解构
    "prefer-destructuring": ["warn", {
      "array": true,
      "object": true,
    }],
    // 关闭原有eslint小驼峰检查
    "camelcase": "off",
    // TypeScript函数名使用小驼峰或者大驼峰，变量名使用小驼峰或者大写蛇形风格
    "@typescript-eslint/naming-convention": [
      "warn",
      { 
        "selector": "function", 
        "format": ["camelCase", "PascalCase"],
      },
      { 
        "selector": 'variableLike', 
        "format": ["camelCase", "UPPER_CASE", "PascalCase"],
      },
      { 
        "selector": 'property',
        "types": ["boolean", "function", "number"],
        "format": ["camelCase"],
      }
    ],
    // 不要使用非空断言
    "@typescript-eslint/no-non-null-assertion": "warn",
  },
};
