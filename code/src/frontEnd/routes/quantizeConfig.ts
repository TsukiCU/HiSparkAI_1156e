/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * Quantize page layout configuration — single source of truth for all key
 * mappings and UI text.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  HOW TO CHANGE THE QUANTIZE PAGE LAYOUT                                  │
 * │                                                                          │
 * │  • Rename a backend data key          → update QUANT_KEYS.*             │
 * │  • Change table column headers        → update TABLE_HEADERS.*           │
 * │  • Rename a button / section title    → update QUANT_TEXT.*             │
 * │  • Add/remove an NPU / CPU field      → update renderNpuPtq / renderCpu │
 * │    in Quantize.tsx (one place only)                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import type { CSSProperties } from 'react';

// ─── Key mappings ──────────────────────────────────────────────────────────
// ALL backend data keys are defined here. If the backend renames a key,
// update it in ONE place and no other file needs to change.

export const QUANT_KEYS = {
  npu: {
    ptq: {
      batchNum:         'batch_num',
      validation:       'validation_npu',
      bitNum:           'bit_num_npu',
      validationLabels: 'validation_labels_npu',
      validationFile:   'vi2_file',       // CSV label file shown when validation = FILE
    },
    qat: {
      trainCode:        'retrain_code',
      networkStruct:    'network_structure',
      retrainInputs:    'retrain_inputs',
      validInputs:      'validation_inputs',
      configFile:       'config_file',
      retrainOutput:    'retrain_output',
      validOutput:      'valid_output',
      modelPath:        'Model Path',
      epochNum:         'epoch_num',
      batchSize:        'batch_size',
      learningRate:     'learning_rate',
    },
  },
  cpu: {
    batchNum:           'batch_num',
    validation:         'validation_cpu',
    bitNum:             'bit_num_cpu',
    quantType:          'quant_type',
    validationLabels:   'validation_labels_cpu',
    validationFile:     'val_out_cpu',
  },

  // Used to identify Advanced Options switch data (NPU only).
  switchGroup:          'switch_config',
  switchStatus:         'switch_status',
  switchInput:          'switch_input_value',

  // Output node selection key (appended in payload, not in config file).
  selectedOutput:       'selectedOutputNode',
} as const;

// ─── "Fixed" key sets used to derive dynamic items ─────────────────────────
// Dynamic items (node shapes, per-node selects, calibration paths) are
// anything in the data that is NOT one of these fixed keys.

const NPU_FIXED_INPUT_KEYS = new Set([
  QUANT_KEYS.npu.ptq.batchNum,
  QUANT_KEYS.npu.qat.trainCode,
  QUANT_KEYS.npu.qat.epochNum,
  QUANT_KEYS.npu.qat.batchSize,
  QUANT_KEYS.npu.qat.learningRate,
]);

const NPU_FIXED_SELECT_KEYS = new Set([
  QUANT_KEYS.npu.ptq.validation,
  QUANT_KEYS.npu.ptq.bitNum,
  QUANT_KEYS.npu.ptq.validationLabels,
  QUANT_KEYS.npu.qat.configFile,
]);

const NPU_FIXED_FILE_KEYS = new Set([
  QUANT_KEYS.npu.ptq.validationFile,
  QUANT_KEYS.npu.qat.networkStruct,
  QUANT_KEYS.npu.qat.retrainInputs,
  QUANT_KEYS.npu.qat.validInputs,
  QUANT_KEYS.npu.qat.retrainOutput,
  QUANT_KEYS.npu.qat.validOutput,
  QUANT_KEYS.npu.qat.modelPath,
]);

const CPU_FIXED_INPUT_KEYS = new Set([QUANT_KEYS.cpu.batchNum]);

const CPU_FIXED_SELECT_KEYS = new Set([
  QUANT_KEYS.cpu.validation,
  QUANT_KEYS.cpu.bitNum,
  QUANT_KEYS.cpu.quantType,
  QUANT_KEYS.cpu.validationLabels,
]);

const CPU_FIXED_FILE_KEYS = new Set([QUANT_KEYS.cpu.validationFile]);

// Typed as Set<string> so `.has(anyString)` works without type errors.
export const FIXED_KEYS: {
  npu: { inputs: Set<string>; selects: Set<string>; files: Set<string> };
  cpu: { inputs: Set<string>; selects: Set<string>; files: Set<string> };
} = {
  npu: { inputs: NPU_FIXED_INPUT_KEYS, selects: NPU_FIXED_SELECT_KEYS, files: NPU_FIXED_FILE_KEYS },
  cpu: { inputs: CPU_FIXED_INPUT_KEYS, selects: CPU_FIXED_SELECT_KEYS, files: CPU_FIXED_FILE_KEYS },
};

// ─── Table column headers ──────────────────────────────────────────────────

export const CALIB_TABLE_HEADERS_NPU: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Path',       style: { marginLeft: '-49px' } },
  { label: 'Shape',      style: { marginLeft: '110px' } },
  { label: 'Data Type',  style: { marginLeft:  '71px' } },
];

export const CALIB_TABLE_HEADERS_CPU: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Path',  style: { marginLeft: '-54px' } },
];

export const VALID_TABLE_HEADERS: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Path', style: { marginLeft: '-49px' } },
];

export const QAT_INPUT_HEADERS: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input' },
  { label: 'Training Dataset',   style: { marginLeft: '-28px' } },
  { label: 'Validation Dataset', style: { marginLeft:   '6px' } },
];

export const QAT_LABEL_HEADERS: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Label' },
  { label: 'Training Dataset',   style: { marginLeft: '-28px' } },
  { label: 'Validation Dataset', style: { marginLeft:   '6px' } },
];

// ─── UI text ───────────────────────────────────────────────────────────────

export const QUANT_TEXT = {
  sections: {
    quantizationConfig: 'Quantization Config',
    calibrationInputs:  'Calibration Inputs',
    validationInputs:   'Validation Inputs',
  },
  tabs: { ptq: 'PTQ', qat: 'QAT' },
  buttons: {
    quantize:          'Quantize',
    quantizing:        'Processing...',
    abort:             'Abort',
    layerwiseConfig:   'Layerwise Config',
    nextWithout:       'Next Without Quantization',
    editTrainScript:   'Edit Train Script',
    editTrainConfig:   'Edit Train Config',
  },
  advancedOptions: {
    ptq: { label: 'Advanced', placeholder: 'Ascend Config' },
    qat: { label: 'Advanced Settings', placeholder: 'Ascend Config' },
  },
  validationLabels: {
    label:       'Validation Labels',
    placeholder: '请选择输出节点',
  },
  validation: {
    shapeErrorMsg:  'Shapes should only contain numbers and commas.',
    batchNumError:  'Batch Number should only contain integer not smaller than 1.',
    advancedEmpty:  'Advanced options are enabled. Additional arguments are required.',
    notSupported:   'Not supported for the selected file.',
    inProgress:     'Quantization already in progress... Check the output panel for details.',
    unexpectedTarget: 'Unexpected Entrance : Quantize.',
  },
} as const;
