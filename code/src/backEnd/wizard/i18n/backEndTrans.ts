/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as vscode from 'vscode';

export function res(key: string, args?: string[]): string {
  const zh = require('./lang/zh.json');
  const en = require('./lang/en.json');
  let value: string = vscode.env.language.includes('zh')
    ? (zh[key] ?? en[key] ?? key)
    : (en[key] ?? zh[key] ?? key);
  if (args?.length) {
    args.forEach((arg, i) => { value = value.replace(`{${i}}`, arg); });
  }
  return value;
}
