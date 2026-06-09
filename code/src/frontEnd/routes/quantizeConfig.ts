/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * Quantize page — single source of truth for layout, key mappings, and
 * static field definitions.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  HOW TO CHANGE THE QUANTIZE PAGE                                         │
 * │                                                                          │
 * │  • Rename a backend key         → QUANT_KEYS.*                          │
 * │  • Change a field default/opts  → QUANT_FIELD_SPECS.*                   │
 * │  • Change column headers        → CALIB/VALID/QAT_*_HEADERS             │
 * │  • Change button/section text   → QUANT_TEXT.*                          │
 * │  • Add/remove a fixed field     → QUANT_KEYS + QUANT_FIELD_SPECS +      │
 * │    FIXED_KEYS + render function in Quantize.tsx                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import type { CSSProperties } from 'react';

// ─── Key mappings ──────────────────────────────────────────────────────────

export const QUANT_KEYS = {
  npu: {
    ptq: {
      batchNum:         'batch_num',
      validation:       'validation_npu',
      bitNum:           'bit_num_npu',
      validationLabels: 'validation_labels_npu',
      validationFile:   'vi2_file',
    },
    qat: {
      trainCode:     'retrain_code',
      networkStruct: 'network_structure',
      retrainInputs: 'retrain_inputs',
      validInputs:   'validation_inputs',
      configFile:    'config_file',
      retrainOutput: 'retrain_output',
      validOutput:   'valid_output',
      modelPath:     'Model Path',
      epochNum:      'epoch_num',
      batchSize:     'batch_size',
      learningRate:  'learning_rate',
    },
  },
  cpu: {
    batchNum:         'batch_num',
    validation:       'validation_cpu',
    bitNum:           'bit_num_cpu',
    quantType:        'quant_type',
    validationLabels: 'validation_labels_cpu',
    validationFile:   'val_out_cpu',
  },
  switchGroup:    'switch_config',
  switchStatus:   'switch_status',
  switchInput:    'switch_input_value',
  selectedOutput: 'selectedOutputNode',
} as const;

// ─── Static field definitions (replaces QuantizeConfig.txt) ───────────────
// These define the complete spec of every FIXED field.
// The frontend uses these to initialise state without needing the backend to
// send them from a config file.

export interface FieldSpec {
  kind:         'input' | 'select' | 'file';
  group:        string;
  title:        string;
  defaultValue: string;
  options?:     string[];       // only for 'select'
  folder?:      boolean;        // only for 'file'
  disabled?:    boolean;
}

export const QUANT_FIELD_SPECS: Record<string, FieldSpec> = {
  // ── NPU PTQ ──────────────────────────────────────────────────────────
  [QUANT_KEYS.npu.ptq.batchNum]:         { kind: 'input',  group: 'Quantization', title: 'batch_num',         defaultValue: '1' },
  [QUANT_KEYS.npu.ptq.validation]:       { kind: 'select', group: 'Quantization', title: 'Validation',        defaultValue: 'NONE',  options: ['NONE', 'FILE'] },
  [QUANT_KEYS.npu.ptq.bitNum]:           { kind: 'select', group: 'Quantization', title: 'Quantized Data Type', defaultValue: 'int8', options: ['int8', 'int16'] },
  [QUANT_KEYS.npu.ptq.validationLabels]: { kind: 'select', group: 'Quantization', title: 'Validation Labels', defaultValue: 'None', options: ['None', 'Choose from File System'] },
  [QUANT_KEYS.npu.ptq.validationFile]:   { kind: 'file',   group: 'Quantization', title: '',                  defaultValue: ' ', folder: false },

  // ── NPU QAT ──────────────────────────────────────────────────────────
  [QUANT_KEYS.npu.qat.trainCode]:        { kind: 'input',  group: 'Quantization', title: 'Train Code',         defaultValue: 'import this', disabled: true },
  [QUANT_KEYS.npu.qat.networkStruct]:    { kind: 'file',   group: 'Quantization', title: 'Network Structure',  defaultValue: ' ', folder: false },
  [QUANT_KEYS.npu.qat.retrainInputs]:    { kind: 'file',   group: 'Quantization', title: 'Input_0',            defaultValue: ' ', folder: true  },
  [QUANT_KEYS.npu.qat.validInputs]:      { kind: 'file',   group: 'Quantization', title: 'Validation Inputs',  defaultValue: ' ', folder: true  },
  [QUANT_KEYS.npu.qat.configFile]:       { kind: 'select', group: 'Quantization', title: 'Config File',        defaultValue: 'Default', options: ['Default', 'Custom'] },
  [QUANT_KEYS.npu.qat.retrainOutput]:    { kind: 'file',   group: 'Quantization', title: 'Output_0',           defaultValue: ' ', folder: false },
  [QUANT_KEYS.npu.qat.validOutput]:      { kind: 'file',   group: 'Quantization', title: 'Validation Outputs', defaultValue: ' ', folder: false },
  [QUANT_KEYS.npu.qat.modelPath]:        { kind: 'file',   group: 'Quantization', title: 'Model Path',         defaultValue: ' ', folder: false },
  [QUANT_KEYS.npu.qat.epochNum]:         { kind: 'input',  group: 'Quantization', title: 'Epoch Num',          defaultValue: '1' },
  [QUANT_KEYS.npu.qat.batchSize]:        { kind: 'input',  group: 'Quantization', title: 'Batch Size',         defaultValue: '4' },
  [QUANT_KEYS.npu.qat.learningRate]:     { kind: 'input',  group: 'Quantization', title: 'Learning Rate',      defaultValue: '0.00001' },

  // ── CPU ──────────────────────────────────────────────────────────────
  [QUANT_KEYS.cpu.batchNum]:             { kind: 'input',  group: 'Quantization', title: 'batch_num',          defaultValue: '1' },
  [QUANT_KEYS.cpu.validation]:           { kind: 'select', group: 'Quantization', title: 'Validation',         defaultValue: 'NONE', options: ['NONE', 'FILE'] },
  [QUANT_KEYS.cpu.bitNum]:               { kind: 'select', group: 'Quantization', title: 'Quantized Data Type', defaultValue: 'int8', options: ['int8'] },
  [QUANT_KEYS.cpu.quantType]:            { kind: 'select', group: 'Quantization', title: 'Quant Type',          defaultValue: 'FULL_QUANT', options: ['FULL_QUANT'] },
  [QUANT_KEYS.cpu.validationLabels]:     { kind: 'select', group: 'Quantization', title: 'Validation Labels',  defaultValue: 'None', options: ['None', 'Choose from File System'] },
  [QUANT_KEYS.cpu.validationFile]:       { kind: 'file',   group: 'Quantization', title: '',                   defaultValue: ' ', folder: false },
};

// ─── Fixed key sets ────────────────────────────────────────────────────────
// Dynamic items (per-node shapes, paths, type-selects) are everything
// NOT in these sets.

const NPU_FIXED_INPUT_KEYS  = new Set([QUANT_KEYS.npu.ptq.batchNum, QUANT_KEYS.npu.qat.trainCode,  QUANT_KEYS.npu.qat.epochNum,  QUANT_KEYS.npu.qat.batchSize, QUANT_KEYS.npu.qat.learningRate]);
const NPU_FIXED_SELECT_KEYS = new Set([QUANT_KEYS.npu.ptq.validation, QUANT_KEYS.npu.ptq.bitNum, QUANT_KEYS.npu.ptq.validationLabels, QUANT_KEYS.npu.qat.configFile]);
const NPU_FIXED_FILE_KEYS   = new Set([QUANT_KEYS.npu.ptq.validationFile, QUANT_KEYS.npu.qat.networkStruct, QUANT_KEYS.npu.qat.retrainInputs, QUANT_KEYS.npu.qat.validInputs, QUANT_KEYS.npu.qat.retrainOutput, QUANT_KEYS.npu.qat.validOutput, QUANT_KEYS.npu.qat.modelPath]);
const CPU_FIXED_INPUT_KEYS  = new Set([QUANT_KEYS.cpu.batchNum]);
const CPU_FIXED_SELECT_KEYS = new Set([QUANT_KEYS.cpu.validation, QUANT_KEYS.cpu.bitNum, QUANT_KEYS.cpu.quantType, QUANT_KEYS.cpu.validationLabels]);
const CPU_FIXED_FILE_KEYS   = new Set([QUANT_KEYS.cpu.validationFile]);

export const FIXED_KEYS: {
  npu: { inputs: Set<string>; selects: Set<string>; files: Set<string> };
  cpu: { inputs: Set<string>; selects: Set<string>; files: Set<string> };
} = {
  npu: { inputs: NPU_FIXED_INPUT_KEYS, selects: NPU_FIXED_SELECT_KEYS, files: NPU_FIXED_FILE_KEYS },
  cpu: { inputs: CPU_FIXED_INPUT_KEYS, selects: CPU_FIXED_SELECT_KEYS, files: CPU_FIXED_FILE_KEYS },
};

// ─── Table headers ─────────────────────────────────────────────────────────

export const CALIB_TABLE_HEADERS_NPU: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Path',      style: { marginLeft: '-49px'  } },
  { label: 'Shape',     style: { marginLeft: '110px'  } },
  { label: 'Data Type', style: { marginLeft:  '71px'  } },
];

export const CALIB_TABLE_HEADERS_CPU: Array<{ label: string; style?: CSSProperties }> = [
  { label: 'Input Node' },
  { label: 'Path', style: { marginLeft: '-54px' } },
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
    quantize:        'Quantize',
    quantizing:      'Processing...',
    abort:           'Abort',
    layerwiseConfig: 'Layerwise Config',
    nextWithout:     'Next Without Quantization',
  },
  advancedOptions: {
    ptq: { label: 'Advanced',          placeholder: 'Ascend Config' },
    qat: { label: 'Advanced Settings', placeholder: 'Ascend Config' },
  },
  validationLabels: {
    label:       'Validation Labels',
    placeholder: '请选择输出节点',
  },
  validation: {
    shapeErrorMsg:    'Shapes should only contain numbers and commas.',
    batchNumError:    'Batch Number should only contain integer not smaller than 1.',
    advancedEmpty:    'Advanced options are enabled. Additional arguments are required.',
    notSupported:     'Not supported for the selected file.',
    inProgress:       'Quantization already in progress... Check the output panel for details.',
    unexpectedTarget: 'Unexpected Entrance : Quantize.',
  },
} as const;
