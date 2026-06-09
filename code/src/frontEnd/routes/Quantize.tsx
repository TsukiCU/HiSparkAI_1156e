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
import React, { CSSProperties, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Select, Button, Modal, Empty, message, Divider } from 'antd';
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
  QUANT_KEYS,
  FIXED_KEYS,
  QUANT_TEXT,
  CALIB_TABLE_HEADERS_NPU,
  CALIB_TABLE_HEADERS_CPU,
  VALID_TABLE_HEADERS,
  QAT_INPUT_HEADERS,
  QAT_LABEL_HEADERS,
} from './quantizeConfig';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux' | 'windows';

interface CompressionItem {
  target: string;
  page: string;
  type?: string;
  kind: 'input' | 'select' | 'file';
  group: string;
  key: string;
  title: string;
  content: any;
  defaultValue?: any;
  disabled?: boolean;
  folder?: boolean;
}

interface RootState {
  entities: { compressionHisgraphData: HistogramGraphData[] | null };
}

// ─── Data splitting helpers ────────────────────────────────────────────────

/**
 * Extracts typed, named field groups from the flat compressionData array.
 *
 * Fixed items are identified by their exact keys (defined in quantizeConfig.ts).
 * Everything else is "dynamic" — per-node calibration paths, shapes, type selects.
 * Dynamic items preserve the relative order sent by the backend.
 *
 * To add a new fixed field: add its key to QUANT_KEYS and FIXED_KEYS, then
 * extract it here by key. No positional magic required.
 */
function splitQuantizeData(data: CompressionItem[], target: Target) {
  const byKey = (key: string): CompressionItem | undefined =>
    data.find(d => d.page === 'quant' && d.key === key);

  const toInput = (d: CompressionItem | undefined): InputBoxProps | undefined =>
    d ? { group: d.group, key: d.key, title: d.title, content: d.content, disabled: Boolean(d.disabled) } : undefined;

  const toSelect = (d: CompressionItem | undefined): SelectBoxProps | undefined =>
    d ? { group: d.group, key: d.key, title: d.title, content: d.content, defaultValue: String(d.defaultValue ?? ''), disabled: Boolean(d.disabled) } : undefined;

  const toFile = (d: CompressionItem | undefined): FileInputBoxProps | undefined =>
    d ? { group: d.group, key: d.key, title: d.title, content: String(d.content ?? ''), folder: Boolean((d as any).folder), disabled: Boolean(d.disabled) } : undefined;

  const isQuantPage = (d: CompressionItem): boolean => d.page === 'quant';
  const notSwitch   = (d: CompressionItem): boolean => d.type !== 'switch' && d.group !== QUANT_KEYS.switchGroup;
  const notSpecial  = (d: CompressionItem): boolean => d.key !== QUANT_KEYS.selectedOutput;

  if (target === 'NPU') {
    const fix = FIXED_KEYS.npu;
    // Dynamic = quant-page items whose key is not in any fixed set
    const dynamicInputs  = data.filter(d => isQuantPage(d) && d.kind === 'input' && notSwitch(d) && notSpecial(d) && !fix.inputs.has(d.key))
                               .map(d => toInput(d)!);
    const dynamicSelects = data.filter(d => isQuantPage(d) && d.kind === 'select' && !fix.selects.has(d.key))
                               .map(d => toSelect(d)!);
    const dynamicFiles   = data.filter(d => isQuantPage(d) && d.kind === 'file' && !fix.files.has(d.key))
                               .map(d => toFile(d)!);

    // Switch state
    const switchStatusItem = data.find(d => d.key === QUANT_KEYS.switchStatus);
    const switchInputItem  = data.find(d => d.key === QUANT_KEYS.switchInput);

    return {
      // PTQ fixed
      ptq: {
        batchNum:         toInput(byKey(QUANT_KEYS.npu.ptq.batchNum)),
        validation:       toSelect(byKey(QUANT_KEYS.npu.ptq.validation)),
        bitNum:           toSelect(byKey(QUANT_KEYS.npu.ptq.bitNum)),
        validationLabels: toSelect(byKey(QUANT_KEYS.npu.ptq.validationLabels)),
        validationFile:   toFile(byKey(QUANT_KEYS.npu.ptq.validationFile)),
      },
      // QAT fixed
      qat: {
        trainCode:        toInput(byKey(QUANT_KEYS.npu.qat.trainCode)),
        networkStruct:    toFile(byKey(QUANT_KEYS.npu.qat.networkStruct)),
        retrainInputs:    toFile(byKey(QUANT_KEYS.npu.qat.retrainInputs)),
        validInputs:      toFile(byKey(QUANT_KEYS.npu.qat.validInputs)),
        configFile:       toSelect(byKey(QUANT_KEYS.npu.qat.configFile)),
        retrainOutput:    toFile(byKey(QUANT_KEYS.npu.qat.retrainOutput)),
        validOutput:      toFile(byKey(QUANT_KEYS.npu.qat.validOutput)),
        modelPath:        toFile(byKey(QUANT_KEYS.npu.qat.modelPath)),
        epochNum:         toInput(byKey(QUANT_KEYS.npu.qat.epochNum)),
        batchSize:        toInput(byKey(QUANT_KEYS.npu.qat.batchSize)),
        learningRate:     toInput(byKey(QUANT_KEYS.npu.qat.learningRate)),
      },
      // Dynamic per-node data (order preserved from backend)
      dynamic: { inputs: dynamicInputs, selects: dynamicSelects, files: dynamicFiles },
      // Switch
      switchStatus:     Boolean(switchStatusItem?.defaultValue ?? false),
      switchInputValue: String(switchInputItem?.content ?? ''),
    };
  } else {
    const fix = FIXED_KEYS.cpu;
    const dynamicInputs  = data.filter(d => isQuantPage(d) && d.kind === 'input' && notSwitch(d) && notSpecial(d) && !fix.inputs.has(d.key))
                               .map(d => toInput(d)!);
    const dynamicFiles   = data.filter(d => isQuantPage(d) && d.kind === 'file' && !fix.files.has(d.key))
                               .map(d => toFile(d)!);

    return {
      cpu: {
        batchNum:         toInput(byKey(QUANT_KEYS.cpu.batchNum)),
        validation:       toSelect(byKey(QUANT_KEYS.cpu.validation)),
        bitNum:           toSelect(byKey(QUANT_KEYS.cpu.bitNum)),
        quantType:        toSelect(byKey(QUANT_KEYS.cpu.quantType)),
        validationLabels: toSelect(byKey(QUANT_KEYS.cpu.validationLabels)),
        validationFile:   toFile(byKey(QUANT_KEYS.cpu.validationFile)),
      },
      dynamic: { inputs: dynamicInputs, files: dynamicFiles },
    };
  }
}

// ─── Component ────────────────────────────────────────────────────────────

function Quantize(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const pickType = source === 'linux' ? 'linux' : 'local';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // ── Tab ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'PTQ' | 'QAT'>('PTQ');

  // ── Model name ────────────────────────────────────────────────────────
  const [model, setModel] = useState<string>('');

  // ── Field state (single source of truth per kind) ─────────────────────
  const [inputBoxes,  setInputBoxes]  = useState<InputBoxProps[]>([]);
  const [selectBoxes, setSelectBoxes] = useState<SelectBoxProps[]>([]);
  const [fileBoxes,   setFileBoxes]   = useState<FileInputBoxProps[]>([]);
  const [layerCfgData, setLayerCfgData] = useState<LayerBoxProps[]>([]);

  // ── Misc UI state ─────────────────────────────────────────────────────
  const [isModalOpen,       setModalOpen]       = useState(false);
  const [disableValLabel,   setDisableValLabel]  = useState(true);
  const [disableBtn,        setDisableBtn]       = useState(true);
  const [disable,           setDisable]          = useState(true);   // QAT config file
  const [switchMode,        setSwitchMode]       = useState(false);  // (legacy, keep for compat)
  const [switchStatus,      setSwitchStatus]     = useState(false);
  const [switchInputValue,  setSwitchInputValue] = useState('');
  const [netStrucQatStatus, setNetStrucQatStatus] = useState(true);
  const [outputNames,       setOutputNames]      = useState<string[]>([]);
  const [selectedOutput,    setSelectedOutput]   = useState<string>('');

  // ── Redux selectors ───────────────────────────────────────────────────
  const compressionData = useSelector((state: any) => state.entities.compressionData);
  const layerData       = useSelector((state: any) => state.entities.layerwiseData);
  const hisGraphData    = useSelector((state: RootState) => state.entities.compressionHisgraphData);
  const ptqEnabled      = useSelector((state: any) => state.entities.ptq);
  const qatEnabled      = useSelector((state: any) => state.entities.qat);
  const convertEnabled  = useSelector((state: any) => state.entities.convert);
  const quantPending    = useSelector((state: any) => state.entities.quantPending);
  const [histogramData, setHistogramData] = useState<HistogramGraphData[]>([]);

  // ── Chart config ──────────────────────────────────────────────────────
  interface ChartConfig { width?: string; height?: string; overflowX?: CSSProperties['overflowX'] }
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});

  // ─── Init output names ─────────────────────────────────────────────────
  useEffect(() => {
    const store = IStore.getStore();
    const names = store.getState().entities.modelOutputNames || [];
    const withNone = ['None', ...names];
    setOutputNames(withNone);
    if (names.length > 0) { setSelectedOutput(withNone[0]); }
  }, []);

  // ─── Sync active tab from Redux ────────────────────────────────────────
  useEffect(() => {
    if (ptqEnabled) { setActiveTab('PTQ'); }
    else if (qatEnabled) { setActiveTab('QAT'); }
  }, [ptqEnabled, qatEnabled]);

  // ─── Model name ────────────────────────────────────────────────────────
  useEffect(() => {
    const store = IStore.getStore();
    setModel(store.getState().entities.selectedFileName ?? '');
    const unsub = store.subscribe(() => {
      const n = store.getState().entities.selectedFileName;
      if (n) { setModel(n); }
    });
    return unsub;
  }, []);

  // ─── Histogram ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hisGraphData || hisGraphData.length === 0) { setHistogramData([]); return; }
    setHistogramData(hisGraphData.filter((item: any) => Object.keys(item).includes('x')));
  }, [hisGraphData]);

  // ─── Messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;
      switch (msg.type) {
        case 'modelChosen':
          setModel(msg.params.fileName);
          IStore.getStore().dispatch(updateEntity('selectedFileName', msg.params.fileName));
          break;
        case 'QuantSuccess':
          dispatch(updateEntity('quantPending', false));
          break;
        case 'QuantFailed':
          dispatch(updateEntity('quantPending', false));
          {
            const desc = msg.params?.description || '';
            notify(
              desc.includes('aborted by user') ? 'Quantization aborted.' : `Failed to quantize. ${desc}`,
              { type: desc.includes('aborted by user') ? 'warning' : 'error', stack: false, duration: 2 }
            );
          }
          break;
        case 'LostConnection':
          if (quantPending) {
            dispatch(updateEntity('quantPending', false));
            notify('Lost connection to remote server', { type: 'error', stack: false, duration: 2 });
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ─── Validation helpers ────────────────────────────────────────────────
  const validateShape = (value: string): { valid: boolean; errorMsg?: string } => {
    const ok = /^[0-9,]+$/.test(value) && value[0] !== ',' && value[value.length - 1] !== ',';
    return { valid: ok, errorMsg: ok ? undefined : QUANT_TEXT.validation.shapeErrorMsg };
  };
  const validateBatchNum = (value: string): { valid: boolean; errorMsg?: string } => {
    const ok = /^[0-9]+$/.test(value) && Number(value) >= 1;
    return { valid: ok, errorMsg: ok ? undefined : QUANT_TEXT.validation.batchNumError };
  };

  // ─── Field update handlers ─────────────────────────────────────────────
  const updateInput = (value: string | string[], key: string): void => {
    setInputBoxes(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));
  };

  const updateSelect = (value: string, key: string, isCtrlOthers?: boolean): void => {
    if (key === QUANT_KEYS.selectedOutput) { setSelectedOutput(value); }
    if (isCtrlOthers) {
      if (value === 'None')                   { setDisableValLabel(true);  }
      if (value === 'Choose from File System') { setDisableValLabel(false); }
      if (value === 'Default')                { setDisable(true);          }
      if (value === 'Custom')                 { setDisable(false);         }
    }
    if (key === QUANT_KEYS.npu.ptq.validation || key === QUANT_KEYS.cpu.validation) {
      setDisableBtn(value === 'NONE');
    }
    setSelectBoxes(prev => prev.map(b => b.key === key ? { ...b, defaultValue: value } : b));
  };

  const updateFile = (value: string, key: string): void => {
    setFileBoxes(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));
  };

  const handleSwitchChange = (checked: boolean): void => {
    setSwitchStatus(checked);
    // Disable the bit-num select when Advanced switch is on.
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

  // ─── Populate fields from Redux compressionData ────────────────────────
  useEffect(() => {
    if (!compressionData || compressionData.length === 0) { return; }

    // Extract selectedOutput item.
    const selectedOutputItem = compressionData.find((d: any) => d.key === QUANT_KEYS.selectedOutput);
    if (selectedOutputItem) {
      setSelectedOutput(selectedOutputItem.content || selectedOutputItem.defaultValue || '');
    }

    const allInputs = compressionData
      .filter((d: any) => d.page === 'quant' && d.kind === 'input' && d.type !== 'switch' && d.key !== QUANT_KEYS.selectedOutput)
      .map((d: any) => ({ group: d.group, key: d.key, title: d.title, content: d.content, disabled: Boolean(d.disabled) }));

    const allSelects = compressionData
      .filter((d: any) => d.page === 'quant' && d.kind === 'select' && d.type !== 'switch')
      .map((d: any) => ({
        group: d.group, key: d.key, title: d.title, content: d.content,
        defaultValue: String(d.defaultValue ?? ''),
        disabled: d.key === QUANT_KEYS.npu.ptq.bitNum ? switchStatus : Boolean(d.disabled),
      }));

    const allFiles = compressionData
      .filter((d: any) => d.page === 'quant' && d.kind === 'file' && d.type !== 'switch')
      .map((d: any) => ({
        group: d.group, key: d.key, title: d.title,
        content: String(d.content ?? ''), folder: Boolean(d.folder), disabled: Boolean(d.disabled),
      }));

    setInputBoxes(allInputs as InputBoxProps[]);
    setSelectBoxes(allSelects as SelectBoxProps[]);
    setFileBoxes(allFiles as FileInputBoxProps[]);
    updateBtnStatus(compressionData);
  }, [compressionData]);

  useEffect(() => {
    if (compressionData && compressionData.length > 0) { updateBtnStatus(compressionData); }
  }, [navigate]);

  const updateBtnStatus = (data: any): void => {
    const findByKey = (key: string): any => data.find((d: any) => d.key === key) ?? {};
    if (target === 'CPU') {
      setDisableBtn(findByKey(QUANT_KEYS.cpu.validation)?.defaultValue === 'NONE');
      setSelectedOutput(findByKey(QUANT_KEYS.selectedOutput)?.defaultValue ?? '');
    } else {
      setDisableBtn(findByKey(QUANT_KEYS.npu.ptq.validation)?.defaultValue === 'NONE');
      setSelectedOutput(findByKey(QUANT_KEYS.selectedOutput)?.defaultValue ?? '');
      setDisable(findByKey(QUANT_KEYS.npu.qat.configFile)?.defaultValue === 'Default');
      const sw = findByKey(QUANT_KEYS.switchStatus);
      const si = findByKey(QUANT_KEYS.switchInput);
      setSwitchStatus(Boolean(sw?.defaultValue ?? false));
      setSwitchInputValue(sw?.defaultValue ? String(si?.content ?? '') : '');
      const ns = findByKey(QUANT_KEYS.npu.qat.networkStruct);
      if (ns?.content) { setNetStrucQatStatus(ns.content.trim() === ''); }
    }
  };

  // ─── Sync to backend storage ───────────────────────────────────────────
  useEffect(() => {
    if (!compressionData || compressionData.length === 0) { return; }
    const inputMap  = new Map(inputBoxes.map(b => [b.key, b]));
    const selectMap = new Map(selectBoxes.map(b => [b.key, b]));
    const fileMap   = new Map(fileBoxes.map(b => [b.key, b]));
    const updated = compressionData.map((d: CompressionItem) => {
      const inp = inputMap.get(d.key);
      if (inp) { return { ...d, content: inp.content }; }
      const sel = selectMap.get(d.key);
      if (sel) { return { ...d, defaultValue: sel.defaultValue, content: sel.content, disabled: sel.disabled }; }
      const fil = fileMap.get(d.key);
      if (fil) { return { ...d, content: fil.content }; }
      return d;
    });
    BackEndStorage.set('compressionData', updated, PanelType.CHIPCONFIG);
  }, [inputBoxes, selectBoxes, fileBoxes]);

  // ─── Layer config ──────────────────────────────────────────────────────
  useEffect(() => {
    if (Array.isArray(layerData)) { setLayerCfgData(layerData); }
  }, [layerData]);

  const updateLayerField = (index: number, field: keyof LayerBoxProps, value: string): void => {
    setLayerCfgData(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleModalOpen = (): void => {
    if (layerCfgData.length === 0) {
      vscode.postMessage({ method: ApiMethod.IMPORT_LAYER });
    }
    setModalOpen(m => !m);
  };
  const handleModalOk = (): void => {
    IStore.getStore().dispatch(updateEntity('layerwiseData', layerCfgData));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: layerCfgData, key: 'layerwiseData' } });
    setModalOpen(false);
  };

  // ─── Payload assembly ──────────────────────────────────────────────────
  const buildQuantizePayload = (): CompressionItem[] => {
    const inputMap  = new Map(inputBoxes.map(b => [b.key, b]));
    const selectMap = new Map(selectBoxes.map(b => [b.key, b]));
    const fileMap   = new Map(fileBoxes.map(b => [b.key, b]));

    const merged = (compressionData as CompressionItem[])
      .filter(d => d.key !== QUANT_KEYS.switchStatus && d.key !== QUANT_KEYS.switchInput && d.key !== QUANT_KEYS.selectedOutput)
      .map(d => {
        const inp = inputMap.get(d.key);  if (inp)  { return { ...d, content: inp.content,  disabled: inp.disabled  }; }
        const sel = selectMap.get(d.key); if (sel)  { return { ...d, defaultValue: sel.defaultValue, content: sel.content, disabled: sel.disabled }; }
        const fil = fileMap.get(d.key);   if (fil)  { return { ...d, content: fil.content,  disabled: fil.disabled  }; }
        return d;
      });

    if (target === 'NPU') {
      merged.push(
        { target, type: 'switch', page: 'quant', kind: 'input', group: QUANT_KEYS.switchGroup, key: QUANT_KEYS.switchStatus,     title: 'Switch Status',      content: switchStatus,     disabled: false, defaultValue: switchStatus },
        { target, type: 'switch', page: 'quant', kind: 'input', group: QUANT_KEYS.switchGroup, key: QUANT_KEYS.switchInput,      title: 'Switch Input Value', content: switchInputValue, disabled: false, defaultValue: switchInputValue },
      );
    }
    merged.push({
      target, type: 'output', page: 'quant', kind: 'input',
      group: 'output_config', key: QUANT_KEYS.selectedOutput,
      title: 'Selected Output Node', content: selectedOutput, defaultValue: selectedOutput, disabled: false,
    });
    return merged;
  };

  const handleErrorBoxContent = (payload: CompressionItem[]): CompressionItem[] => {
    const findByKey = (key: string): any => payload.find(d => d.key === key) ?? {};
    if (activeTab === 'PTQ' && target === 'NPU') {
      const val = findByKey(QUANT_KEYS.npu.ptq.validation);
      const lbl = findByKey(QUANT_KEYS.selectedOutput);
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
      const val = findByKey(QUANT_KEYS.cpu.validation);
      const lbl = findByKey(QUANT_KEYS.selectedOutput);
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

  // ─── Quantize action ───────────────────────────────────────────────────
  const handleNext = (): void => {
    if (convertEnabled) {
      notify(QUANT_TEXT.validation.notSupported, { type: 'info', stack: false, duration: 2 });
      return;
    }
    navigate('/convert');
  };

  const handleQuantizeClick = (type?: string): void => {
    if (switchStatus && !switchInputValue) {
      notify(QUANT_TEXT.validation.advancedEmpty, { type: 'error', stack: false, duration: 2 });
      return;
    }
    IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'process', 'wait', 'wait', 'wait']));
    IStore.getStore().dispatch(updateEntity('lastQuantTS', 0));
    if (quantPending) {
      notify(QUANT_TEXT.validation.inProgress, { type: 'info', stack: false, duration: 2 });
      return;
    }
    dispatch(updateEntity('quantPending', true));
    const payload = handleErrorBoxContent(buildQuantizePayload());
    IStore.getStore().dispatch(updateEntity('compressionData', payload));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: payload, key: 'compressionData' } });
    try {
      vscode.postMessage({
        method: ApiMethod.START_DATA_QUANTIZE,
        params: { coreParams: { target, source }, paramType: type, paramData: payload, layerData },
      } as Message);
    } catch {
      notify('Error: handleQuantizeClick', { type: 'error', stack: false, duration: 2 });
      dispatch(updateEntity('quantPending', false));
    }
  };

  // ─── LayerConfig modal ─────────────────────────────────────────────────
  const layerConfigModal = (): React.JSX.Element => (
    <Modal
      title="Layerwise Config"
      open={isModalOpen}
      onCancel={(): void => setModalOpen(false)}
      width={599}
      footer={[
        <div key="footer" className="footer-ok-cancel-class">
          <Button key="ok" type="primary" onClick={handleModalOk}>确认</Button>
        </div>,
      ]}
      maskClosable={false}
      style={{ top: '39%' }}
      bodyStyle={{ overflow: 'auto' }}
    >
      <div className="option-description">
        <span className="description" style={{ marginLeft: '35px' }}>layer_name</span>
        <span className="description" style={{ marginLeft: '96px' }}>layer_type</span>
        <span className="description" style={{ marginLeft: '101px' }}>quantized_data_type</span>
      </div>
      <div>
        {layerCfgData.map((row, i) => (
          <LayerBoxComponent key={i} layerBox={row} onChange={(field, value): void => updateLayerField(i, field, value)} />
        ))}
      </div>
    </Modal>
  );

  // ─── Rendering ────────────────────────────────────────────────────────

  /**
   * Output-node selector (Validation Labels row) shared between NPU PTQ and CPU.
   * Only shown when validation = FILE (disableBtn = false).
   */
  const renderValidationLabelsRow = (): React.JSX.Element => (
    <div className="row-ptq">
      <div style={{ marginLeft: target === 'NPU' ? '0' : '-135px', display: 'flex', gap: '50px', alignItems: 'center' }}>
        <label>{QUANT_TEXT.validationLabels.label}</label>
        <Select
          style={{ width: 170 }}
          placeholder={QUANT_TEXT.validationLabels.placeholder}
          value={selectedOutput}
          onChange={setSelectedOutput}
          disabled={outputNames.length === 0}
        >
          {outputNames.map(name => <Select.Option key={name} value={name}>{name}</Select.Option>)}
        </Select>
      </div>
    </div>
  );

  /**
   * NPU — PTQ tab.
   *
   * Layout (key-based, no positional magic):
   *   ① First row : bitNum select + Layerwise Config button
   *   ② Calibration Inputs table : one row per node
   *      (Validation switch shown below the table)
   *   ③ Validation Inputs table  : shown only when validation = FILE
   *   ④ Validation Labels row    : shown only when validation = FILE
   *   ⑤ Advanced Options switch
   *   ⑥ Quantize button
   */
  const renderNpuPtq = (): React.JSX.Element => {
    const fields = splitQuantizeData(compressionData ?? [], 'NPU') as any;
    const { ptq, dynamic } = fields;

    // Dynamic per-node data.
    // Each node = [calibInput file, shapeInput, dataTypeSelect, calibOutput file]
    const numNodes    = dynamic.inputs.length;
    const calibInputs  = (i: number): FileInputBoxProps => dynamic.files[2 * i];
    const calibOutputs = (i: number): FileInputBoxProps => dynamic.files[2 * i + 1];
    const nodeShape    = (i: number): InputBoxProps    => dynamic.inputs[i];
    const nodeType     = (i: number): SelectBoxProps   => dynamic.selects[i];

    return (
      <div className="form-grid npu">

        {/* ① Bit-num select + Layerwise button */}
        <div className="row-ptq firstNpu">
          {ptq.bitNum && (
            <SelectBoxComponent
              selectBox={{ ...ptq.bitNum, disabled: switchStatus }}
              labelOrP={true} transmitStyle={true}
              getSelected={updateSelect}
            />
          )}
          <Button
            className="left-bt" type="primary"
            style={{ marginLeft: '30px', background: switchStatus ? '#cccccc' : '' }}
            onClick={handleModalOpen}
            disabled={switchStatus}
          >
            {QUANT_TEXT.buttons.layerwiseConfig}
          </Button>
          {layerConfigModal()}
        </div>

        {/* ② Calibration Inputs table */}
        <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.calibrationInputs}</h2></div>

        {ptq.validation && (
          <SwitchBoxComponent
            selectBox={ptq.validation}
            labelOrP={true} transmitStyle={true} labelWidth={65}
            customEditableStyle={{ marginRight: '15px' }}
            onChange={(checked, key): void => {
              if (ptq.validation) { ptq.validation.defaultValue = checked ? 'FILE' : 'NONE'; }
              setDisableBtn(!checked);
            }}
          />
        )}

        <div className="inputs-class-table">
          <div className="row-ptq th-ptq">
            {CALIB_TABLE_HEADERS_NPU.map(h => (
              <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
            ))}
          </div>
          {Array.from({ length: numNodes }, (_, i) => (
            <div key={i} className="row-ptq sedNpu" style={{ marginTop: '5px' }}>
              {calibInputs(i) && (
                <FileInputBoxComponent
                  fileInputBox={calibInputs(i)} isShowInput={false}
                  onInputChange={updateFile} filePickerType={pickType}
                  inputPlaceholder="上传包含.npy文件的文件夹"
                />
              )}
              {nodeShape(i) && (
                <InputBoxComponent
                  inputBox={nodeShape(i)} labelOrP={true} transmitStyle={true}
                  getInputed={updateInput} validate={validateShape} editable={false}
                />
              )}
              {nodeType(i) && (
                <SelectBoxComponent
                  selectBox={nodeType(i)} labelOrP={true} transmitStyle={true}
                  getSelected={updateSelect}
                />
              )}
              {calibOutputs(i) && (
                <FileInputBoxComponent
                  fileInputBox={calibOutputs(i)} isShowInput={false}
                  onInputChange={updateFile} filePickerType={pickType}
                  inputPlaceholder="上传包含.npy文件的文件夹"
                  customEditableStyle={{ display: 'flex', flexDirection: 'row', gap: '5px', marginLeft: '-100px' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ③ Validation Inputs table (shown when validation = FILE) */}
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
                  {calibOutputs(i) && (
                    <FileInputBoxComponent
                      fileInputBox={calibOutputs(i)} isShowInput={false}
                      onInputChange={updateFile} filePickerType={pickType}
                      inputPlaceholder="上传包含.npy文件的文件夹"
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ④ Validation Labels select (shown when validation = FILE) */}
        {!disableBtn && renderValidationLabelsRow()}
        {!disableBtn && ptq.validationFile && (
          <FileInputBoxComponent
            fileInputBox={ptq.validationFile} labelWidth={135} isShowInput={false}
            fileExt="csv" onInputChange={updateFile} filePickerType={pickType}
            disableByOthers={selectedOutput === 'None'}
            customEditableStyle={{ marginLeft: '-120px' }}
            inputPlaceholder="需传入输入文件与label的对应关系"
          />
        )}

        {/* ⑤ Advanced Options + ⑥ Quantize button */}
        <div>
          <SwitchInput
            checked={switchStatus} inputValue={switchInputValue}
            onSwitchChange={handleSwitchChange} onInputChange={setSwitchInputValue}
            switchText={QUANT_TEXT.advancedOptions.ptq.label}
            inputPlaceholder={QUANT_TEXT.advancedOptions.ptq.placeholder}
            showButton={true} fileExt="cfg" quantType="ptq"
            filePickerType={pickType} targetKey="selectedPath" folder={false}
          />
          <Button
            className="left-bt" type="primary"
            onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('PTQ'); }}
            style={{ marginTop: '10px' }}
          >
            {quantPending ? QUANT_TEXT.buttons.quantizing : QUANT_TEXT.buttons.quantize}
          </Button>
        </div>

      </div>
    );
  };

  /**
   * NPU — QAT tab.
   *
   * Layout: all fields referenced by explicit key, no positional slicing.
   */
  const renderNpuQat = (): React.JSX.Element => {
    const fields = splitQuantizeData(compressionData ?? [], 'NPU') as any;
    const { qat } = fields;
    const qatStatus = switchStatus || netStrucQatStatus;

    return (
      <div className="form-grid npu">

        {/* Network structure file */}
        <div className="row-qat">
          <div className="row1-first">
            {qat.networkStruct && (
              <FileInputBoxComponent
                fileInputBox={qat.networkStruct} isShowInput={false}
                onBlur={handleBlur} onInputChange={updateFile} fileExt="py"
                filePickerType={pickType} inputPlaceholder="上传.py文件"
              />
            )}
          </div>
        </div>

        {/* Input datasets table */}
        <div className="inputs-class-table" style={{ width: '560px' }}>
          <div className="row-ptq th-ptq">
            {QAT_INPUT_HEADERS.map(h => (
              <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
            ))}
          </div>
          <div className="row-qat sedQat">
            {qat.retrainInputs && (
              <FileInputBoxComponent fileInputBox={qat.retrainInputs} labelWidth={99} isShowInput={false} onInputChange={updateFile} filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
            )}
            {qat.validInputs && (
              <FileInputBoxComponent fileInputBox={qat.validInputs} labelWidth={0} isShowInput={false} onInputChange={updateFile} filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
            )}
          </div>
        </div>

        {/* Label datasets table */}
        <div className="inputs-class-table" style={{ width: '560px' }}>
          <div className="row-ptq th-ptq">
            {QAT_LABEL_HEADERS.map(h => (
              <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
            ))}
          </div>
          <div className="row-qat threeQat">
            {qat.retrainOutput && (
              <FileInputBoxComponent fileInputBox={qat.retrainOutput} labelWidth={99} isShowInput={false} onInputChange={updateFile} fileExt="csv" filePickerType={pickType} inputPlaceholder="上传对应的labels.csv" />
            )}
            {qat.validOutput && (
              <FileInputBoxComponent fileInputBox={qat.validOutput} labelWidth={0} isShowInput={false} onInputChange={updateFile} fileExt="csv" filePickerType={pickType} inputPlaceholder="上传对应的labels.csv" />
            )}
          </div>
        </div>

        {/* Config file + model path + hyperparams */}
        <div className="row-qat threeQat">
          {qat.configFile && (
            <SelectBoxComponent selectBox={qat.configFile} labelOrP={true} transmitStyle={true} getSelected={(v, k): void => updateSelect(v, k, true)} />
          )}
          {qat.modelPath && (
            <FileInputBoxComponent fileInputBox={qat.modelPath} isShowInput={false} onInputChange={updateFile} filePickerType={pickType} />
          )}
          {qat.trainCode && (
            <InputBoxComponent inputBox={qat.trainCode} labelOrP={true} transmitStyle={true} getInputed={updateInput} />
          )}
        </div>

        <div className="row-qat threeQat">
          {qat.epochNum     && <InputBoxComponent inputBox={qat.epochNum}     labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={updateInput} editable={true} />}
          {qat.batchSize    && <InputBoxComponent inputBox={qat.batchSize}    labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={updateInput} editable={true} />}
          {qat.learningRate && <InputBoxComponent inputBox={qat.learningRate} labelOrP={true}                transmitStyle={true} getInputed={updateInput} editable={true} />}
        </div>

        {/* Layerwise Config button */}
        <div className="row-ptq firstNpu">
          <Button
            className="left-bt" type="primary"
            style={{ marginLeft: '100px', background: qatStatus ? '#cccccc' : '' }}
            onClick={handleModalOpen} disabled={qatStatus}
          >
            {QUANT_TEXT.buttons.layerwiseConfig}
          </Button>
          {layerConfigModal()}
        </div>

        {/* Advanced Options switch */}
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

        {/* Quantize / Abort buttons */}
        <div className="row-qat last" style={{ gap: '5px' }}>
          <Button className="left-bt" type="primary" onClick={(e): void => { e.stopPropagation(); handleQuantizeClick('QAT'); }}>
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

  /**
   * CPU platform.
   *
   * Layout: all fields referenced by key, no positional slicing.
   * Dynamic per-node data: pairs of [calibInput file, shapeInput, calibOutput file].
   */
  const renderCpu = (): React.JSX.Element => {
    const fields = splitQuantizeData(compressionData ?? [], 'CPU') as any;
    const { cpu, dynamic } = fields;
    const numNodes = dynamic.inputs.length;

    return (
      <div className="ant-model-body">
        <div className="square-container-1">
          <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.quantizationConfig}</h2></div>

          <div className="form-grid cpu">

            {/* First row: bitNum + quantType selects */}
            <div className="row-ptq">
              {cpu.bitNum    && <div className="gutter-row"><SelectBoxComponent selectBox={cpu.bitNum}    labelOrP={true} labelWidth={140} transmitStyle={true} getSelected={updateSelect} /></div>}
              {cpu.quantType && <div className="gutter-row"><SelectBoxComponent selectBox={cpu.quantType} labelOrP={true} labelWidth={97}  transmitStyle={true} getSelected={updateSelect} /></div>}
            </div>

            {/* Calibration Inputs table */}
            <div className="inputs-class-cpu">
              <div className="app-common-font"><h2 className="section-title">{QUANT_TEXT.sections.calibrationInputs}</h2></div>
              {cpu.batchNum && (
                <InputBoxComponent inputBox={cpu.batchNum} labelOrP={true} labelWidth={120} transmitStyle={true} getInputed={updateInput} validate={validateBatchNum} />
              )}
              {cpu.validation && (
                <SwitchBoxComponent
                  selectBox={cpu.validation} labelOrP={true} transmitStyle={true} labelWidth={65}
                  customEditableStyle={{ marginRight: '15px' }}
                  onChange={(checked, key): void => {
                    if (cpu.validation) { cpu.validation.defaultValue = checked ? 'FILE' : 'NONE'; }
                    setDisableBtn(!checked);
                  }}
                />
              )}
              <div className="row-ptq th-cpu">
                <div className="th-cpu first-cpu">
                  {CALIB_TABLE_HEADERS_CPU.map(h => <span key={h.label} style={h.style}>{h.label}</span>)}
                </div>
                <span className="th-ptq" style={{ marginLeft: '11px' }}>Shape</span>
              </div>
              {Array.from({ length: numNodes }, (_, i) => (
                <div key={i} className="row-ptq cpuSed cpu-tab-margin cpu-shape-gap">
                  {dynamic.files[2 * i] && (
                    <FileInputBoxComponent fileInputBox={dynamic.files[2 * i]} isShowInput={false} labelWidth={105} onInputChange={updateFile} filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
                  )}
                  {dynamic.inputs[i] && (
                    <InputBoxComponent inputBox={dynamic.inputs[i]} labelOrP={true} labelWidth={120} transmitStyle={true} getInputed={updateInput} validate={validateShape} />
                  )}
                </div>
              ))}
            </div>

            {/* Validation Inputs table (shown when validation = FILE) */}
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
                    {dynamic.files[2 * i + 1] && (
                      <FileInputBoxComponent fileInputBox={dynamic.files[2 * i + 1]} isShowInput={false} labelWidth={105} onInputChange={updateFile} filePickerType={pickType} inputPlaceholder="上传包含.npy文件的文件夹" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Validation Labels */}
            {!disableBtn && renderValidationLabelsRow()}
            {!disableBtn && cpu.validationLabels && (
              <SwitchBoxComponent
                selectBox={cpu.validationLabels} labelOrP={true} transmitStyle={true} labelWidth={128}
                customEditableStyle={{ marginRight: '15px' }}
                onChange={(checked, key): void => {
                  const v = checked ? 'Choose from File System' : 'NONE';
                  if (cpu.validationLabels) { cpu.validationLabels.defaultValue = v; }
                  updateSelect(v, key);
                }}
              />
            )}
            {!disableBtn && cpu.validationFile && (
              <FileInputBoxComponent
                fileInputBox={cpu.validationFile}
                validationStatus={disableBtn} labelWidth={131} isShowInput={false}
                {...(pickType === 'local' ? { fileExt: 'csv' } : {})}
                onInputChange={updateFile} filePickerType={pickType}
                disableByOthers={selectedOutput === 'None'}
                customEditableStyle={{ marginBottom: '8px' }}
                inputPlaceholder="上传.csv文件"
              />
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
            {([['PTQ', ptqEnabled], ['QAT', qatEnabled]] as const).map(([tab, enabled]) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''} ${!enabled ? 'disabled' : ''}`}
                disabled={!enabled}
                onClick={(): void => { if (enabled) { setActiveTab(tab); } }}
                style={activeTab === tab ? { borderBottom: '2px solid #5391FF' } : {}}
              >
                {tab}
              </button>
            ))}
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
    if (target === 'CPU') {
      return renderCpu();
    }
    notify(QUANT_TEXT.validation.unexpectedTarget, { type: 'error', stack: false, duration: 2 });
    return <></>;
  };

  // ─── Page layout ──────────────────────────────────────────────────────
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
            : <Empty style={{ height: '300px' }} />
          } />
      </div>

    </div>
  );
}

export default Quantize;
