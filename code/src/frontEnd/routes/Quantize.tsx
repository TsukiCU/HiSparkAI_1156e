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
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Select, Button, Modal, Empty, Divider } from 'antd';
import { notify } from '../common';
import { vscode } from '..';
import InputBoxComponent from './utils/InputBox';
import type { InputBoxProps } from './utils/InputBox';
import type { SelectBoxProps } from './utils/SelectBox';
import SelectBoxComponent from './utils/SelectBox';
import FileInputBoxComponent from './utils/ProPathComponents';
import type { FileInputBoxProps } from './utils/ProPathComponents';
import LayerBoxComponent from './utils/LayerConfigBox';
import type { LayerBoxProps } from './utils/LayerConfigBox';
import type { Message } from '@src/backEnd/interface/api';
import { BackEndStorage } from '../core/store/tools';
import { PanelType } from '@src/backEnd/interface/model';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import History from './utils/History';
import { IStore } from '../core/store/store';
import { updateEntity } from '../core/store/actions';
import '../a-styles/app.css';
import HistogramGraph from './utils/Graph';
import type { HistogramGraphData } from './utils/Graph';
import SwitchBoxComponent from './utils/Switch';
import SwitchInput from './utils/SwitchInput';
import { ImageInfo } from '@src/frontEnd/component/ImageInfo';
import CommonCard from '@src/frontEnd/component/commonTemplate/common';
import {
  QUANT_KEYS, QUANT_FIELD_SPECS, FIXED_KEYS, QUANT_TEXT,
  CALIB_TABLE_HEADERS_NPU, CALIB_TABLE_HEADERS_CPU, VALID_TABLE_HEADERS,
  QAT_INPUT_HEADERS, QAT_LABEL_HEADERS,
} from './quantizeConfig';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux' | 'windows';

interface CompressionItem {
  target: string; page: string; type?: string;
  kind: 'input' | 'select' | 'file';
  group: string; key: string; title: string;
  content: any; defaultValue?: any; disabled?: boolean; folder?: boolean;
}

interface RootState { entities: { compressionHisgraphData: HistogramGraphData[] | null } }

// ─── State initialisation helpers ─────────────────────────────────────────

/**
 * Build initial fixed-field state from QUANT_FIELD_SPECS defaults, then merge
 * any saved values from compressionData on top.
 *
 * Fixed fields (keys in FIXED_KEYS) are initialised from the schema.
 * Dynamic fields (per-node calibration paths / shapes / type-selects) come
 * from compressionData only.
 */
function buildState(
  compressionData: CompressionItem[],
  target: Target,
  switchStatusParam: boolean,
): { inputs: InputBoxProps[]; selects: SelectBoxProps[]; files: FileInputBoxProps[] } {
  const fix = target === 'NPU' ? FIXED_KEYS.npu : FIXED_KEYS.cpu;

  // ── 1. Schema defaults for fixed fields ────────────────────────────────
  const fixedInputs:  InputBoxProps[]  = [];
  const fixedSelects: SelectBoxProps[] = [];
  const fixedFiles:   FileInputBoxProps[] = [];

  for (const [key, spec] of Object.entries(QUANT_FIELD_SPECS)) {
    if (!fix.inputs.has(key) && !fix.selects.has(key) && !fix.files.has(key)) { continue; }
    if (spec.kind === 'input') {
      fixedInputs.push({ group: spec.group, key, title: spec.title, content: spec.defaultValue, disabled: Boolean(spec.disabled) });
    } else if (spec.kind === 'select') {
      fixedSelects.push({ group: spec.group, key, title: spec.title, content: spec.options ?? [], defaultValue: spec.defaultValue, disabled: Boolean(spec.disabled) });
    } else if (spec.kind === 'file') {
      fixedFiles.push({ group: spec.group, key, title: spec.title, content: spec.defaultValue ?? ' ', folder: Boolean(spec.folder), disabled: Boolean(spec.disabled) });
    }
  }

  // ── 2. Merge saved values from compressionData ─────────────────────────
  const dataMap = new Map((compressionData ?? []).map((d: CompressionItem) => [d.key, d]));

  const mergedInputs = fixedInputs.map(inp => {
    const saved = dataMap.get(inp.key);
    return saved ? { ...inp, content: saved.content, disabled: Boolean(saved.disabled) } : inp;
  });
  const mergedSelects = fixedSelects.map(sel => {
    const saved = dataMap.get(sel.key);
    const merged = saved ? { ...sel, defaultValue: String(saved.defaultValue ?? sel.defaultValue), disabled: Boolean(saved.disabled) } : sel;
    // Switch status controls bit_num disabled state.
    if (sel.key === QUANT_KEYS.npu.ptq.bitNum) { return { ...merged, disabled: switchStatusParam }; }
    return merged;
  });
  const mergedFiles = fixedFiles.map(fil => {
    const saved = dataMap.get(fil.key);
    return saved ? { ...fil, content: String(saved.content ?? fil.content), disabled: Boolean(saved.disabled) } : fil;
  });

  // ── 3. Dynamic items (per-node data, not in any fixed set) ─────────────
  const allFixed = new Set([...fix.inputs, ...fix.selects, ...fix.files,
    QUANT_KEYS.switchStatus, QUANT_KEYS.switchInput, QUANT_KEYS.selectedOutput]);

  const dynamic = (compressionData ?? []).filter(
    d => d.page === 'quant' && d.type !== 'switch' && d.group !== QUANT_KEYS.switchGroup && !allFixed.has(d.key)
  );
  const dynInputs  = dynamic.filter(d => d.kind === 'input')
    .map(d => ({ group: d.group, key: d.key, title: d.title, content: d.content, disabled: Boolean(d.disabled) }));
  const dynSelects = dynamic.filter(d => d.kind === 'select')
    .map(d => ({ group: d.group, key: d.key, title: d.title, content: d.content, defaultValue: String(d.defaultValue ?? ''), disabled: Boolean(d.disabled) }));
  const dynFiles   = dynamic.filter(d => d.kind === 'file')
    .map(d => ({ group: d.group, key: d.key, title: d.title, content: String(d.content ?? ''), folder: Boolean(d.folder), disabled: Boolean(d.disabled) }));

  return {
    inputs:  [...mergedInputs,  ...dynInputs]  as InputBoxProps[],
    selects: [...mergedSelects, ...dynSelects] as SelectBoxProps[],
    files:   [...mergedFiles,   ...dynFiles]   as FileInputBoxProps[],
  };
}

// ─── Component ────────────────────────────────────────────────────────────

function Quantize(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const pickType = source === 'linux' ? 'linux' : 'local';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [activeTab,          setActiveTab]          = useState<'PTQ' | 'QAT'>('PTQ');
  const [model,              setModel]              = useState('');
  const [inputBoxes,         setInputBoxes]         = useState<InputBoxProps[]>([]);
  const [selectBoxes,        setSelectBoxes]        = useState<SelectBoxProps[]>([]);
  const [fileBoxes,          setFileBoxes]          = useState<FileInputBoxProps[]>([]);
  const [layerCfgData,       setLayerCfgData]       = useState<LayerBoxProps[]>([]);
  const [isModalOpen,        setModalOpen]          = useState(false);
  const [disableBtn,         setDisableBtn]         = useState(true);   // show/hide Validation Inputs
  const [disable,            setDisable]            = useState(true);   // QAT config file: Default = disabled
  const [switchStatus,       setSwitchStatus]       = useState(false);  // Advanced Options switch
  const [switchInputValue,   setSwitchInputValue]   = useState('');
  const [netStrucQatStatus,  setNetStrucQatStatus]  = useState(true);   // QAT network struct empty
  const [outputNames,        setOutputNames]        = useState<string[]>([]);
  const [selectedOutput,     setSelectedOutput]     = useState('');

  const compressionData = useSelector((state: any) => state.entities.compressionData);
  const layerData       = useSelector((state: any) => state.entities.layerwiseData);
  const hisGraphData    = useSelector((state: RootState) => state.entities.compressionHisgraphData);
  const ptqEnabled      = useSelector((state: any) => state.entities.ptq);
  const qatEnabled      = useSelector((state: any) => state.entities.qat);
  const convertEnabled  = useSelector((state: any) => state.entities.convert);
  const quantPending    = useSelector((state: any) => state.entities.quantPending);
  const [histogramData, setHistogramData] = useState<HistogramGraphData[]>([]);
  interface ChartConfig { width?: string; height?: string; overflowX?: CSSProperties['overflowX'] }
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});

  // ─── Key-based state lookups (used in render) ──────────────────────────
  // These always reflect the CURRENT user-modified state, never stale Redux data.
  const selByKey = (key: string): SelectBoxProps | undefined => selectBoxes.find(s => s.key === key);
  const inpByKey = (key: string): InputBoxProps  | undefined => inputBoxes.find(i => i.key === key);
  const filByKey = (key: string): FileInputBoxProps | undefined => fileBoxes.find(f => f.key === key);

  // Dynamic items = state entries NOT in fixed key sets.
  const { dynInputs, dynSelects, dynFiles } = useMemo(() => {
    const fix = target === 'NPU' ? FIXED_KEYS.npu : FIXED_KEYS.cpu;
    return {
      dynInputs:  inputBoxes.filter(i => !fix.inputs.has(i.key)),
      dynSelects: selectBoxes.filter(s => !fix.selects.has(s.key)),
      dynFiles:   fileBoxes.filter(f => !fix.files.has(f.key)),
    };
  }, [inputBoxes, selectBoxes, fileBoxes, target]);

  // ─── Initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    const store = IStore.getStore();
    const names = store.getState().entities.modelOutputNames || [];
    const withNone = ['None', ...names];
    setOutputNames(withNone);
    if (names.length > 0) { setSelectedOutput(withNone[0]); }
  }, []);

  useEffect(() => {
    if (ptqEnabled) { setActiveTab('PTQ'); } else if (qatEnabled) { setActiveTab('QAT'); }
  }, [ptqEnabled, qatEnabled]);

  useEffect(() => {
    const store = IStore.getStore();
    setModel(store.getState().entities.selectedFileName ?? '');
    const unsub = store.subscribe(() => {
      const n = store.getState().entities.selectedFileName;
      if (n) { setModel(n); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!hisGraphData || hisGraphData.length === 0) { setHistogramData([]); return; }
    setHistogramData(hisGraphData.filter((d: any) => Object.keys(d).includes('x')));
  }, [hisGraphData]);

  // ─── Messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const msg = event.data;
      switch (msg.type) {
        case 'modelChosen':
          setModel(msg.params.fileName);
          IStore.getStore().dispatch(updateEntity('selectedFileName', msg.params.fileName));
          break;
        case 'QuantSuccess': dispatch(updateEntity('quantPending', false)); break;
        case 'QuantFailed':
          dispatch(updateEntity('quantPending', false));
          { const desc = msg.params?.description || '';
            notify(desc.includes('aborted by user') ? 'Quantization aborted.' : `Failed to quantize. ${desc}`,
              { type: desc.includes('aborted by user') ? 'warning' : 'error', stack: false, duration: 2 }); }
          break;
        case 'LostConnection':
          if (quantPending) { dispatch(updateEntity('quantPending', false)); notify('Lost connection to remote server', { type: 'error', stack: false, duration: 2 }); }
          break;
        default: break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ─── Populate state from compressionData ──────────────────────────────
  // This is the ONLY place that reads compressionData.  All rendering reads
  // from inputBoxes / selectBoxes / fileBoxes state, never from compressionData.
  useEffect(() => {
    const { inputs, selects, files } = buildState(compressionData ?? [], target, switchStatus);
    setInputBoxes(inputs);
    setSelectBoxes(selects);
    setFileBoxes(files);

    // Derive auxiliary UI state from the data.
    const byKey = (key: string): any => (compressionData ?? []).find((d: any) => d.key === key) ?? {};
    const selByKeyData = (key: string): string => String(byKey(key)?.defaultValue ?? '');

    if (target === 'CPU') {
      setDisableBtn(selByKeyData(QUANT_KEYS.cpu.validation) === 'NONE');
      setSelectedOutput(selByKeyData(QUANT_KEYS.selectedOutput) || 'None');
    } else {
      setDisableBtn(selByKeyData(QUANT_KEYS.npu.ptq.validation) === 'NONE');
      setSelectedOutput(selByKeyData(QUANT_KEYS.selectedOutput) || 'None');
      setDisable(selByKeyData(QUANT_KEYS.npu.qat.configFile) === 'Default' || selByKeyData(QUANT_KEYS.npu.qat.configFile) === '');
      const sw = byKey(QUANT_KEYS.switchStatus);
      const si = byKey(QUANT_KEYS.switchInput);
      const newSwitch = Boolean(sw?.defaultValue ?? false);
      setSwitchStatus(newSwitch);
      setSwitchInputValue(newSwitch ? String(si?.content ?? '') : '');
      const ns = byKey(QUANT_KEYS.npu.qat.networkStruct);
      if (ns?.content != null) { setNetStrucQatStatus(String(ns.content).trim() === ''); }
    }
  }, [compressionData]);

  useEffect(() => {
    if (compressionData?.length > 0) {
      const byKey = (key: string): any => compressionData.find((d: any) => d.key === key) ?? {};
      if (target === 'CPU') { setDisableBtn(String(byKey(QUANT_KEYS.cpu.validation)?.defaultValue ?? '') === 'NONE'); }
      else { setDisableBtn(String(byKey(QUANT_KEYS.npu.ptq.validation)?.defaultValue ?? '') === 'NONE'); }
    }
  }, [navigate]);

  // ─── Sync to backend storage ───────────────────────────────────────────
  useEffect(() => {
    const inputMap  = new Map(inputBoxes.map(b => [b.key, b]));
    const selectMap = new Map(selectBoxes.map(b => [b.key, b]));
    const fileMap   = new Map(fileBoxes.map(b => [b.key, b]));
    const updated   = (compressionData ?? []).map((d: CompressionItem) => {
      const inp = inputMap.get(d.key);  if (inp)  { return { ...d, content: inp.content  }; }
      const sel = selectMap.get(d.key); if (sel)  { return { ...d, defaultValue: sel.defaultValue, content: sel.content, disabled: sel.disabled }; }
      const fil = fileMap.get(d.key);   if (fil)  { return { ...d, content: fil.content  }; }
      return d;
    });
    BackEndStorage.set('compressionData', updated, PanelType.CHIPCONFIG);
  }, [inputBoxes, selectBoxes, fileBoxes]);

  useEffect(() => { if (Array.isArray(layerData)) { setLayerCfgData(layerData); } }, [layerData]);

  // ─── Validation helpers ─────────────────────────────────────────────────
  const validateShape    = (v: string): { valid: boolean; errorMsg?: string } => {
    const ok = /^[0-9,]+$/.test(v) && v[0] !== ',' && v[v.length - 1] !== ',';
    return { valid: ok, errorMsg: ok ? undefined : QUANT_TEXT.validation.shapeErrorMsg };
  };
  const validateBatchNum = (v: string): { valid: boolean; errorMsg?: string } => {
    const ok = /^[0-9]+$/.test(v) && Number(v) >= 1;
    return { valid: ok, errorMsg: ok ? undefined : QUANT_TEXT.validation.batchNumError };
  };

  // ─── Field update handlers ──────────────────────────────────────────────
  const updateInput  = (value: string | string[], key: string): void =>
    setInputBoxes(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));

  const updateSelect = (value: string, key: string, isCtrlOthers?: boolean): void => {
    if (key === QUANT_KEYS.selectedOutput) { setSelectedOutput(value); return; }
    if (isCtrlOthers) {
      if (value === 'Default') { setDisable(true);  }
      if (value === 'Custom')  { setDisable(false); }
    }
    if (key === QUANT_KEYS.npu.ptq.validation || key === QUANT_KEYS.cpu.validation) {
      setDisableBtn(value === 'NONE');
    }
    setSelectBoxes(prev => prev.map(b => b.key === key ? { ...b, defaultValue: value } : b));
  };

  const updateFile = (value: string, key: string): void =>
    setFileBoxes(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));

  // Advanced Options switch — also disables bit_num select.
  const handleSwitchChange = (checked: boolean): void => {
    setSwitchStatus(checked);
    setSelectBoxes(prev => prev.map(b =>
      b.key === QUANT_KEYS.npu.ptq.bitNum ? { ...b, disabled: checked } : b
    ));
  };

  const handleBlur = (e: any): void => {
    const v = typeof e === 'string' ? e.trim() : e?.target?.value?.trim();
    if (!v || !v.endsWith('.py')) { setNetStrucQatStatus(true); return; }
    vscode.postMessage({ method: ApiMethod.SHOW_NET_STRUCT, params: { input: v } });
    setNetStrucQatStatus(false);
  };

  // ─── Layer config modal ─────────────────────────────────────────────────
  const updateLayerField = (index: number, field: keyof LayerBoxProps, value: string): void =>
    setLayerCfgData(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));

  const handleModalOpen = (): void => {
    if (layerCfgData.length === 0) { vscode.postMessage({ method: ApiMethod.IMPORT_LAYER }); }
    setModalOpen(m => !m);
  };
  const handleModalOk = (): void => {
    IStore.getStore().dispatch(updateEntity('layerwiseData', layerCfgData));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: layerCfgData, key: 'layerwiseData' } });
    setModalOpen(false);
  };

  const layerConfigModal = (): React.JSX.Element => (
    <Modal title="Layerwise Config" open={isModalOpen} onCancel={(): void => setModalOpen(false)} width={599}
      footer={[<div key="f" className="footer-ok-cancel-class"><Button key="ok" type="primary" onClick={handleModalOk}>确认</Button></div>]}
      maskClosable={false} style={{ top: '39%' }} bodyStyle={{ overflow: 'auto' }}>
      <div className="option-description">
        <span className="description" style={{ marginLeft: '35px' }}>layer_name</span>
        <span className="description" style={{ marginLeft: '96px' }}>layer_type</span>
        <span className="description" style={{ marginLeft: '101px' }}>quantized_data_type</span>
      </div>
      <div>
        {layerCfgData.map((row, i) => (
          <LayerBoxComponent key={i} layerBox={row} onChange={(f, v): void => updateLayerField(i, f, v)} />
        ))}
      </div>
    </Modal>
  );

  // ─── Payload helpers ────────────────────────────────────────────────────
  const buildPayload = (): CompressionItem[] => {
    const inputMap  = new Map(inputBoxes.map(b => [b.key, b]));
    const selectMap = new Map(selectBoxes.map(b => [b.key, b]));
    const fileMap   = new Map(fileBoxes.map(b => [b.key, b]));

    const baseData: CompressionItem[] = compressionData ?? [];
    const merged = baseData
      .filter(d => d.key !== QUANT_KEYS.switchStatus && d.key !== QUANT_KEYS.switchInput && d.key !== QUANT_KEYS.selectedOutput)
      .map(d => {
        const inp = inputMap.get(d.key);  if (inp)  { return { ...d, content: inp.content,  disabled: inp.disabled  }; }
        const sel = selectMap.get(d.key); if (sel)  { return { ...d, defaultValue: sel.defaultValue, content: sel.content, disabled: sel.disabled }; }
        const fil = fileMap.get(d.key);   if (fil)  { return { ...d, content: fil.content,  disabled: fil.disabled  }; }
        return d;
      });

    // Ensure fixed fields are present even if compressionData was empty.
    const existingKeys = new Set(merged.map(d => d.key));
    const fix = target === 'NPU' ? FIXED_KEYS.npu : FIXED_KEYS.cpu;
    for (const [key, spec] of Object.entries(QUANT_FIELD_SPECS)) {
      if (!fix.inputs.has(key) && !fix.selects.has(key) && !fix.files.has(key)) { continue; }
      if (existingKeys.has(key)) { continue; }
      const state = inputMap.get(key) ?? selectMap.get(key) ?? fileMap.get(key);
      if (state) {
        merged.push({ target: target.toLowerCase(), page: 'quant', type: spec.kind === 'input' ? 'ptq' : undefined,
          kind: spec.kind, group: spec.group, key, title: spec.title,
          content: (state as any).content ?? (state as any).defaultValue ?? spec.defaultValue,
          defaultValue: (state as any).defaultValue ?? spec.defaultValue, disabled: Boolean((state as any).disabled) });
      }
    }

    if (target === 'NPU') {
      merged.push(
        { target, type: 'switch', page: 'quant', kind: 'input', group: QUANT_KEYS.switchGroup, key: QUANT_KEYS.switchStatus, title: 'Switch Status', content: switchStatus, defaultValue: switchStatus, disabled: false },
        { target, type: 'switch', page: 'quant', kind: 'input', group: QUANT_KEYS.switchGroup, key: QUANT_KEYS.switchInput,  title: 'Switch Input Value', content: switchInputValue, defaultValue: switchInputValue, disabled: false },
      );
    }
    merged.push({ target, type: 'output', page: 'quant', kind: 'input', group: 'output_config', key: QUANT_KEYS.selectedOutput, title: 'Selected Output Node', content: selectedOutput, defaultValue: selectedOutput, disabled: false });
    return merged;
  };

  const handleErrorBoxContent = (payload: CompressionItem[]): CompressionItem[] => {
    const find = (key: string): any => payload.find(d => d.key === key) ?? {};
    if (activeTab === 'PTQ' && target === 'NPU') {
      const val = find(QUANT_KEYS.npu.ptq.validation);
      const lbl = find(QUANT_KEYS.selectedOutput);
      if (!Object.keys(val).length) { return payload; }
      return payload.map(d => {
        if (val.defaultValue === 'NONE') {
          if (d.key === QUANT_KEYS.selectedOutput) { return { ...d, defaultValue: 'None' }; }
          if (d.key !== QUANT_KEYS.npu.qat.validInputs && d.key.includes('validation_input')) { return { ...d, content: ' ' }; }
          if (d.key === QUANT_KEYS.npu.ptq.validationFile) { return { ...d, content: ' ' }; }
        }
        if (val.defaultValue === 'FILE' && (lbl.defaultValue === 'NONE' || lbl.defaultValue === 'None')) {
          if (d.key === QUANT_KEYS.selectedOutput) { return { ...d, defaultValue: 'None' }; }
          if (d.key === QUANT_KEYS.npu.ptq.validationFile) { return { ...d, content: ' ' }; }
        }
        return d;
      });
    }
    if (target === 'CPU') {
      const val = find(QUANT_KEYS.cpu.validation);
      const lbl = find(QUANT_KEYS.selectedOutput);
      if (!Object.keys(val).length) { return payload; }
      return payload.map(d => {
        if (val.defaultValue === 'NONE') {
          if (d.key !== QUANT_KEYS.npu.qat.validInputs && d.key.includes('validation_input')) { return { ...d, content: ' ' }; }
          if (d.key === QUANT_KEYS.cpu.validationFile) { return { ...d, content: ' ' }; }
        }
        if (val.defaultValue === 'FILE' && (lbl.defaultValue === 'NONE' || lbl.defaultValue === 'None')) {
          if (d.key === QUANT_KEYS.cpu.validationFile) { return { ...d, content: ' ' }; }
        }
        return d;
      });
    }
    return payload;
  };

  // ─── Quantize action ────────────────────────────────────────────────────
  const handleNext = (): void => {
    if (convertEnabled) { notify(QUANT_TEXT.validation.notSupported, { type: 'info', stack: false, duration: 2 }); return; }
    navigate('/convert');
  };

  const handleQuantizeClick = (type?: string): void => {
    if (switchStatus && !switchInputValue) { notify(QUANT_TEXT.validation.advancedEmpty, { type: 'error', stack: false, duration: 2 }); return; }
    IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'process', 'wait', 'wait', 'wait']));
    IStore.getStore().dispatch(updateEntity('lastQuantTS', 0));
    if (quantPending) { notify(QUANT_TEXT.validation.inProgress, { type: 'info', stack: false, duration: 2 }); return; }
    dispatch(updateEntity('quantPending', true));
    const payload = handleErrorBoxContent(buildPayload());
    IStore.getStore().dispatch(updateEntity('compressionData', payload));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: payload, key: 'compressionData' } });
    try {
      vscode.postMessage({ method: ApiMethod.START_DATA_QUANTIZE, params: { coreParams: { target, source }, paramType: type, paramData: payload, layerData } } as Message);
    } catch {
      notify('Error: handleQuantizeClick', { type: 'error', stack: false, duration: 2 });
      dispatch(updateEntity('quantPending', false));
    }
  };

  // ─── Validation Labels shared row ──────────────────────────────────────
  const renderValidationLabelsRow = (extraStyle?: React.CSSProperties): React.JSX.Element => (
    <div className="row-ptq" style={extraStyle}>
      <div style={{ marginLeft: target === 'NPU' ? '0' : '-135px', display: 'flex', gap: '50px', alignItems: 'center' }}>
        <label>{QUANT_TEXT.validationLabels.label}</label>
        <Select style={{ width: 170 }} placeholder={QUANT_TEXT.validationLabels.placeholder}
          value={selectedOutput} onChange={setSelectedOutput} disabled={outputNames.length === 0}>
          {outputNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
        </Select>
      </div>
    </div>
  );

  // ─── NPU PTQ rendering ─────────────────────────────────────────────────
  //
  // All fields read from state (selByKey / inpByKey / filByKey / dynInputs…).
  // No positional slicing.  No calls to splitQuantizeData.
  //
  const renderNpuPtq = (): React.JSX.Element => {
    const numNodes = dynInputs.length; // shape inputs = one per calibration node

    return (
      <div className="form-grid npu">

        {/* ① Bit-num select + Layerwise Config button */}
        <div className="row-ptq firstNpu">
          {selByKey(QUANT_KEYS.npu.ptq.bitNum) && (
            <SelectBoxComponent selectBox={selByKey(QUANT_KEYS.npu.ptq.bitNum)!}
              labelOrP={true} transmitStyle={true} getSelected={updateSelect} />
          )}
          <Button className="left-bt" type="primary"
            style={{ marginLeft: '30px', background: switchStatus ? '#cccccc' : '' }}
            onClick={handleModalOpen} disabled={switchStatus}>
            {QUANT_TEXT.buttons.layerwiseConfig}
          </Button>
          {layerConfigModal()}
        </div>

        {/* ② Calibration Inputs table (validation switch appears AFTER the table) */}
        <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.calibrationInputs}</h2></div>
        <div className="inputs-class-table">
          <div className="row-ptq th-ptq">
            {CALIB_TABLE_HEADERS_NPU.map(h => (
              <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
            ))}
          </div>
          {Array.from({ length: numNodes }, (_, i) => (
            <div key={i} className="row-ptq sedNpu" style={{ marginTop: '5px' }}>
              {dynFiles[2 * i] && (
                <FileInputBoxComponent fileInputBox={dynFiles[2 * i]} isShowInput={false}
                  onInputChange={updateFile} filePickerType={pickType}
                  inputPlaceholder="上传包含.npy文件的文件夹" />
              )}
              {dynInputs[i] && (
                <InputBoxComponent inputBox={dynInputs[i]} labelOrP={true} transmitStyle={true}
                  getInputed={updateInput} validate={validateShape} editable={false} />
              )}
              {dynSelects[i] && (
                <SelectBoxComponent selectBox={dynSelects[i]} labelOrP={true} transmitStyle={true}
                  getSelected={updateSelect} />
              )}
              {/* dynFiles[2*i+1] (calib output) goes to Validation Inputs table, NOT here */}
            </div>
          ))}
        </div>

        {/* ③ Validation switch — shown AFTER calibration table (matches original layout) */}
        {selByKey(QUANT_KEYS.npu.ptq.validation) && (
          <SwitchBoxComponent
            selectBox={selByKey(QUANT_KEYS.npu.ptq.validation)!}
            labelOrP={true} transmitStyle={true} labelWidth={65}
            customEditableStyle={{ marginRight: '15px' }}
            onChange={(checked, key): void => {
              updateSelect(checked ? 'FILE' : 'NONE', key);
              setDisableBtn(!checked);
            }}
          />
        )}

        {/* ④ Validation Inputs table (when validation = FILE) */}
        {!disableBtn && (
          <>
            <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.validationInputs}</h2></div>
            <div className="inputs-class-table">
              <div className="row-ptq th-ptq">
                {VALID_TABLE_HEADERS.map(h => (
                  <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
                ))}
              </div>
              {Array.from({ length: numNodes }, (_, i) => (
                <div key={i} className="row-ptq sedNpu" style={{ marginTop: '13px', marginLeft: '100px' }}>
                  {dynFiles[2 * i + 1] && (
                    <FileInputBoxComponent fileInputBox={dynFiles[2 * i + 1]} isShowInput={false}
                      onInputChange={updateFile} filePickerType={pickType}
                      inputPlaceholder="上传包含.npy文件的文件夹" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ⑤ Validation Labels + vi2_file inline in same row (when validation = FILE) */}
        <div className="row-ptq">
          {!disableBtn && (
            <div style={{ marginLeft: '0', display: 'flex', gap: '50px', alignItems: 'center' }}>
              <label>{QUANT_TEXT.validationLabels.label}</label>
              <Select style={{ width: 170 }} placeholder={QUANT_TEXT.validationLabels.placeholder}
                value={selectedOutput} onChange={setSelectedOutput} disabled={outputNames.length === 0}>
                {outputNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
              </Select>
              {filByKey(QUANT_KEYS.npu.ptq.validationFile) && (
                <FileInputBoxComponent
                  fileInputBox={filByKey(QUANT_KEYS.npu.ptq.validationFile)!}
                  labelWidth={135} isShowInput={false} fileExt="csv"
                  onInputChange={updateFile} filePickerType={pickType}
                  disableByOthers={selectedOutput === 'None'}
                  customEditableStyle={{ marginLeft: '-120px' }}
                  inputPlaceholder="需传入输入文件与label的对应关系" />
              )}
            </div>
          )}
        </div>

        {/* ⑤ Advanced Options + Quantize button */}
        <div>
          <SwitchInput
            checked={switchStatus} inputValue={switchInputValue}
            onSwitchChange={handleSwitchChange} onInputChange={setSwitchInputValue}
            switchText={QUANT_TEXT.advancedOptions.ptq.label}
            inputPlaceholder={QUANT_TEXT.advancedOptions.ptq.placeholder}
            showButton={true} fileExt="cfg" quantType="ptq"
            filePickerType={pickType} targetKey="selectedPath" folder={false}
          />
          <Button className="left-bt" type="primary"
            onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('PTQ'); }}
            style={{ marginTop: '10px' }}>
            {quantPending ? QUANT_TEXT.buttons.quantizing : QUANT_TEXT.buttons.quantize}
          </Button>
        </div>
      </div>
    );
  };

  // ─── NPU QAT rendering ─────────────────────────────────────────────────
  const renderNpuQat = (): React.JSX.Element => {
    const qatStatus = switchStatus || netStrucQatStatus;
    return (
      <div className="form-grid npu">
        <div className="row-qat">
          <div className="row1-first">
            {filByKey(QUANT_KEYS.npu.qat.networkStruct) && (
              <FileInputBoxComponent fileInputBox={filByKey(QUANT_KEYS.npu.qat.networkStruct)!}
                isShowInput={false} onBlur={handleBlur} onInputChange={updateFile}
                fileExt="py" filePickerType={pickType} inputPlaceholder="上传.py文件" />
            )}
          </div>
        </div>

        <div className="inputs-class-table" style={{ width: '560px' }}>
          <div className="row-ptq th-ptq">
            {QAT_INPUT_HEADERS.map(h => <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>)}
          </div>
          <div className="row-qat sedQat">
            {filByKey(QUANT_KEYS.npu.qat.retrainInputs) && (
              <FileInputBoxComponent fileInputBox={filByKey(QUANT_KEYS.npu.qat.retrainInputs)!}
                labelWidth={99} isShowInput={false} onInputChange={updateFile}
                filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
            )}
            {filByKey(QUANT_KEYS.npu.qat.validInputs) && (
              <FileInputBoxComponent fileInputBox={filByKey(QUANT_KEYS.npu.qat.validInputs)!}
                labelWidth={0} isShowInput={false} onInputChange={updateFile}
                filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
            )}
          </div>
        </div>

        <div className="inputs-class-table" style={{ width: '560px' }}>
          <div className="row-ptq th-ptq">
            {QAT_LABEL_HEADERS.map(h => <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>)}
          </div>
          <div className="row-qat threeQat">
            {filByKey(QUANT_KEYS.npu.qat.retrainOutput) && (
              <FileInputBoxComponent fileInputBox={filByKey(QUANT_KEYS.npu.qat.retrainOutput)!}
                labelWidth={99} isShowInput={false} onInputChange={updateFile}
                fileExt="csv" filePickerType={pickType} inputPlaceholder="上传对应的labels.csv" />
            )}
            {filByKey(QUANT_KEYS.npu.qat.validOutput) && (
              <FileInputBoxComponent fileInputBox={filByKey(QUANT_KEYS.npu.qat.validOutput)!}
                labelWidth={0} isShowInput={false} onInputChange={updateFile}
                fileExt="csv" filePickerType={pickType} inputPlaceholder="上传对应的labels.csv" />
            )}
          </div>
        </div>

        {/* configFile, modelPath, trainCode are in the payload but not shown in the original UI */}

        <div className="row-qat threeQat">
          {inpByKey(QUANT_KEYS.npu.qat.epochNum)     && <InputBoxComponent inputBox={inpByKey(QUANT_KEYS.npu.qat.epochNum)!}     labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={updateInput} editable={true} />}
          {inpByKey(QUANT_KEYS.npu.qat.batchSize)    && <InputBoxComponent inputBox={inpByKey(QUANT_KEYS.npu.qat.batchSize)!}    labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={updateInput} editable={true} />}
          {inpByKey(QUANT_KEYS.npu.qat.learningRate) && <InputBoxComponent inputBox={inpByKey(QUANT_KEYS.npu.qat.learningRate)!} labelOrP={true} transmitStyle={true} getInputed={updateInput} editable={true} />}
        </div>

        <div className="row-ptq firstNpu">
          <Button className="left-bt" type="primary"
            style={{ marginLeft: '100px', background: qatStatus ? '#cccccc' : '' }}
            onClick={handleModalOpen} disabled={qatStatus}>
            {QUANT_TEXT.buttons.layerwiseConfig}
          </Button>
          {layerConfigModal()}
        </div>

        <div className="row-qat threeQat">
          <SwitchInput
            checked={switchStatus} inputValue={switchInputValue}
            onSwitchChange={handleSwitchChange} onInputChange={setSwitchInputValue}
            switchText={QUANT_TEXT.advancedOptions.qat.label}
            inputPlaceholder={QUANT_TEXT.advancedOptions.qat.placeholder}
            showButton={true} fileExt="cfg" quantType="qat"
            filePickerType={pickType} targetKey="selectedPath" folder={false}
          />
        </div>

        <div className="row-qat last" style={{ gap: '5px' }}>
          <Button className="left-bt" type="primary"
            onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('QAT'); }}>
            {quantPending ? QUANT_TEXT.buttons.quantizing : QUANT_TEXT.buttons.quantize}
          </Button>
          {quantPending && (
            <Button className="left-bt" danger style={{ marginLeft: '10px' }}
              onClick={(e): void => { e.stopPropagation(); vscode.postMessage({ method: ApiMethod.STOP_DATA_QUANTIZE }); }}>
              {QUANT_TEXT.buttons.abort}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ─── CPU rendering ─────────────────────────────────────────────────────
  const renderCpu = (): React.JSX.Element => {
    const numNodes = dynInputs.length;
    return (
      <div className="ant-model-body">
        <div className="square-container-1">
          <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.quantizationConfig}</h2></div>
          <div className="form-grid cpu">

            {/* First row: bitNum + quantType */}
            <div className="row-ptq">
              {selByKey(QUANT_KEYS.cpu.bitNum)    && <div className="gutter-row"><SelectBoxComponent selectBox={selByKey(QUANT_KEYS.cpu.bitNum)!}    labelOrP={true} labelWidth={140} transmitStyle={true} getSelected={updateSelect} /></div>}
              {selByKey(QUANT_KEYS.cpu.quantType) && <div className="gutter-row"><SelectBoxComponent selectBox={selByKey(QUANT_KEYS.cpu.quantType)!} labelOrP={true} labelWidth={97}  transmitStyle={true} getSelected={updateSelect} /></div>}
            </div>

            {/* Calibration Inputs table.
                batchNum is in the payload but NOT shown (matches original behaviour).
                Validation switch appears AFTER the table, not inside it. */}
            <div className="inputs-class-cpu">
              <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.calibrationInputs}</h2></div>
              <div className="row-ptq th-cpu">
                <div className="th-cpu first-cpu">
                  {CALIB_TABLE_HEADERS_CPU.map(h => <span key={h.label} style={h.style}>{h.label}</span>)}
                </div>
                <span className="th-ptq" style={{ marginLeft: '11px' }}>Shape</span>
              </div>
              {Array.from({ length: numNodes }, (_, i) => (
                <div key={i} className="row-ptq cpuSed cpu-tab-margin cpu-shape-gap">
                  {dynFiles[2 * i] && (
                    <FileInputBoxComponent fileInputBox={dynFiles[2 * i]} isShowInput={false}
                      labelWidth={105} onInputChange={updateFile} filePickerType={pickType}
                      inputPlaceholder="上传包含.npy文件的文件夹" />
                  )}
                  {dynInputs[i] && (
                    <InputBoxComponent inputBox={dynInputs[i]} labelOrP={true} labelWidth={120}
                      transmitStyle={true} getInputed={updateInput} validate={validateShape} />
                  )}
                </div>
              ))}
            </div>

            {/* Validation switch — AFTER calibration table (matches original) */}
            {selByKey(QUANT_KEYS.cpu.validation) && (
              <SwitchBoxComponent
                selectBox={selByKey(QUANT_KEYS.cpu.validation)!}
                labelOrP={true} transmitStyle={true} labelWidth={65}
                customEditableStyle={{ marginRight: '15px' }}
                onChange={(checked, key): void => {
                  updateSelect(checked ? 'FILE' : 'NONE', key);
                  setDisableBtn(!checked);
                }}
              />
            )}

            {/* Validation Inputs (when validation = FILE) */}
            {!disableBtn && (
              <div className="inputs-class-cpu">
                <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.validationInputs}</h2></div>
                <div className="row-ptq th-cpu">
                  <div className="th-cpu first-cpu">
                    {VALID_TABLE_HEADERS.map(h => <span key={h.label} style={h.style}>{h.label}</span>)}
                  </div>
                </div>
                {Array.from({ length: numNodes }, (_, i) => (
                  <div key={i} className="row-ptq cpuSed cpu-tab-margin">
                    {dynFiles[2 * i + 1] && (
                      <FileInputBoxComponent fileInputBox={dynFiles[2 * i + 1]} isShowInput={false}
                        labelWidth={105} onInputChange={updateFile} filePickerType={pickType}
                        inputPlaceholder="上传包含.npy文件的文件夹" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Validation Labels + val_out_cpu inline in same row (when validation = FILE).
                validation_labels_cpu switch is NOT shown (matches original). */}
            {!disableBtn && (
              <div className="row-ptq">
                <label>{QUANT_TEXT.validationLabels.label}</label>
                <Select style={{ width: 170 }} placeholder={QUANT_TEXT.validationLabels.placeholder}
                  value={selectedOutput} onChange={setSelectedOutput} disabled={outputNames.length === 0}>
                  {outputNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
                </Select>
                {filByKey(QUANT_KEYS.cpu.validationFile) && (
                  <div style={{ marginLeft: '-135px' }}>
                    <FileInputBoxComponent
                      fileInputBox={filByKey(QUANT_KEYS.cpu.validationFile)!}
                      validationStatus={disableBtn} labelWidth={131} isShowInput={false}
                      {...(pickType === 'local' ? { fileExt: 'csv' } : {})}
                      onInputChange={updateFile} filePickerType={pickType}
                      disableByOthers={selectedOutput === 'None'}
                      customEditableStyle={{ marginBottom: '8px' }}
                      inputPlaceholder="上传.csv文件" />
                  </div>
                )}
              </div>
            )}

            {/* Quantize button */}
            <div>
              <Button className="left-bt" type="primary"
                onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('PTQ'); }}>
                {quantPending ? QUANT_TEXT.buttons.quantizing : QUANT_TEXT.buttons.quantize}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderByConfig = (): React.JSX.Element => {
    if (target === 'NPU') {
      return (
        <div className="tab-container">
          <div className="tab-header">
            {(['PTQ', 'QAT'] as const).map(tab => {
              const enabled = tab === 'PTQ' ? ptqEnabled : qatEnabled;
              return (
                <button key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''} ${!enabled ? 'disabled' : ''}`}
                  disabled={!enabled}
                  onClick={(): void => { if (enabled) { setActiveTab(tab); } }}
                  style={activeTab === tab ? { borderBottom: '2px solid #5391FF' } : {}}>
                  {tab}
                </button>
              );
            })}
          </div>
          <Divider />
          <div className="tab-content">
            {activeTab === 'PTQ' && ptqEnabled && (
              <div className="ant-model-body">
                <div className="square-container-1-1">
                  <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.quantizationConfig}</h2></div>
                  {renderNpuPtq()}
                </div>
              </div>
            )}
            {activeTab === 'QAT' && qatEnabled && (
              <div className="ant-model-body">
                <div className="square-container-1-1">
                  <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.quantizationConfig}</h2></div>
                  {renderNpuQat()}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (target === 'CPU') { return renderCpu(); }
    notify(QUANT_TEXT.validation.unexpectedTarget, { type: 'error', stack: false, duration: 2 });
    return <></>;
  };

  return (
    <div className="navigation">
      <div className="aa-container">
        <div className="app-common-font"><h2 className="section-title">Model currently selected</h2></div>
        <div className="model-selected">
          <ImageInfo modelName={model} />
          <span style={{ marginLeft: '8px', fontSize: '18px' }}>{model}</span>
        </div>
        {target === 'CPU' && (
          <Button className="left-bt next-without-quantization" type="primary"
            onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('skip'); }}>
            {QUANT_TEXT.buttons.nextWithout}
          </Button>
        )}
      </div>
      <div>{renderByConfig()}</div>
      <div className="results-style">
        <CommonCard title="Quantization Result History" width="56.5vw"
          children={<History nextPage="../convert" target={target} activeTab={activeTab} />} />
        <CommonCard title="Probability Density Histogram" chartChange={setChartConfig} width="33vw"
          children={histogramData.length > 0
            ? <HistogramGraph width={chartConfig.width} height={chartConfig.height} overflowX={chartConfig.overflowX} histogramGraphData={histogramData} />
            : <Empty style={{ height: '300px' }} />} />
      </div>
    </div>
  );
}

export default Quantize;
