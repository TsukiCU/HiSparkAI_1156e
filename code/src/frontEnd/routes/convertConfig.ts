/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * Convert page layout configuration — single source of truth for all UI structure.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  HOW TO CHANGE THE CONVERT PAGE LAYOUT                                   │
 * │                                                                          │
 * │  • Rename a column header       → edit tableHeaders[].label              │
 * │  • Adjust column alignment      → edit tableHeaders[].style              │
 * │  • Add/remove an NPU feature    → add/remove from npuExtras              │
 * │  • Change button text           → edit buttons.*                         │
 * │  • Rename a backend data key    → update keyMap.*                        │
 * │  • Change Advanced Options text → edit advancedSwitch.*                  │
 * │                                                                          │
 * │  No changes to Convert.tsx or the backend are needed for the above.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import type { CSSProperties } from 'react';

// ─── Key mappings ─────────────────────────────────────────────────────────
export const CONVERT_KEYS = {
  /** The "Output Type" select shown below the node table (NPU only). */
  outputType: 'Output_Type',

  /** Redux group used to store Advanced Options switch data (NPU only). */
  switchGroup: 'switch_config',
  switchStatus: 'switch_status',
  switchInput: 'switch_input_value',
} as const;

// ─── Node table layout ─────────────────────────────────────────────────────
// Modify header text or column alignment here.
export const NODE_TABLE_HEADERS: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Shape', style: { marginLeft: '-85px' } },
  { label: 'Data Type', style: { marginLeft: '73px' } },
];

// ─── Static field definitions (replaces QuantizeConfig.txt for Convert) ───
// Frontend-owned defaults for the Output Type select (NPU only).
// If the backend renames the key or changes options, update CONVERT_KEYS and here.
export const CONVERT_FIELD_SPECS = {
  outputType: {
    kind: 'select' as const,
    group: 'Convert',
    title: 'Output Type',
    options: ['float16', 'uint8', 'int8'] as string[],
    defaultValue: 'float16',
  },
};

// ─── UI text ───────────────────────────────────────────────────────────────
export const CONVERT_TEXT = {
  sectionTitle: 'Convert Config',
  buttons: {
    convert: 'Convert',
    converting: 'Processing...',
    abort: 'Abort',
  },
  advancedSwitch: {
    label: 'Advanced Options',
    placeholder: 'Additional Arguments',
    tooltip: '可选参数，允许为空',
  },
  validation: {
    shapeRegex: /^[0-9,]+$/,
    shapeErrorMsg: 'Illegal input. Should only contain numbers and commas.',
  },
} as const;
