/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * Benchmark page layout configuration.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  HOW TO CHANGE THE BENCHMARK PAGE LAYOUT                                 │
 * │                                                                          │
 * │  • Rename a backend data key      → update BENCHMARK_KEYS.*             │
 * │  • Change table column headers    → update INPUT_TABLE_HEADERS           │
 * │  • Change button/section labels   → update BENCHMARK_TEXT.*             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import type { CSSProperties } from 'react';

// ─── Key mappings ──────────────────────────────────────────────────────────
export const BENCHMARK_KEYS = {
  /** Input file keys contain this substring (e.g. "input/profiling/1"). */
  inputFilePattern: '/profiling/',

  /** The validation label file key. */
  provalidation: 'provali',

  /** Key of the item that stores the selected output node name. */
  validationLabel: 'validation_labels',
} as const;

// ─── Table column headers ──────────────────────────────────────────────────
export const INPUT_TABLE_HEADERS: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node', style: { marginLeft: '8px' } },
  { label: 'Path', style: { marginLeft: '-54px' } },
];

// ─── Performance metrics display ───────────────────────────────────────────
// Text label for each metric tile, per platform target.
export const PERFORMANCE_METRICS = {
  NPU: [
    { label: 'INFERENCE TIME', valueKey: 'inferenceTime' },
    { label: 'MODEL SIZE', valueKey: 'modelSize' },
    { label: 'DBG SIZE', valueKey: 'dbgSize' },
  ],
  CPU: [
    { label: 'INFERENCE TIME', valueKey: 'timeValue' },
    { label: 'RAM', valueKey: 'ramValue' },
    { label: 'FLASH', valueKey: 'flashValue' },
  ],
} as const;

// ─── UI text ───────────────────────────────────────────────────────────────
export const BENCHMARK_TEXT = {
  sections: {
    serialConfig: 'Serial Config',
    accuracyConfig: 'Accuracy Evaluation Config',
  },
  labels: {
    validationLabels: 'Validation Labels',
    outputNodePlaceholder: '请选择输出节点',
    inputFilePlaceholder: '上传包含.npy文件的文件夹',
    labelFilePlaceholder: '上传label.csv文件',
  },
  buttons: {
    performance: 'Performance Evaluation',
    accuracy: 'Accuracy Evaluation',
    abort: 'Abort',
    summaryOfResults: 'Summary of Results',
  },
  modal: {
    title: 'Benchmark History',
    delete: 'Delete',
    csvExport: 'CSV Export',
  },
  errors: {
    noConvertRecord: 'No convert record is configured. Aborting...',
    noSerialConfig: 'No serial parameter is configured. Aborting...',
    noSelectedRecord: 'No selected record.',
    scriptRunning: 'Script is running..',
    uploadInputFiles: 'Upload required files: Validation input files',
    uploadLabelFiles: 'Upload required files: Label files',
  },
} as const;
