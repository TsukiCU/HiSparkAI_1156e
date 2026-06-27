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
import React, { useEffect, useState, CSSProperties } from 'react';
import type { TableProps } from 'antd';
import { Button, Select, message, Empty } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { CommandMsg, Message } from '@src/backEnd/interface/api';
import ProfilingGraph from './utils/ProfilingGraph';
import ProValidation from './utils/proValidation';
import type { ProfilingGraphData } from './utils/ProfilingGraph';
import type { ProfilingValidationData } from './utils/proValidation';
import History, { Row } from './utils/History';
import { useDispatch, useSelector } from 'react-redux';
import { vscode } from '..';
import { exportDataMessage } from '../actions';
import FileInputBoxComponent from './utils/ProPathComponents';
import { useCustomModal, CustomModal } from '../hooks/useCustomModal';
import type { SelectBoxProps } from './utils/SelectBox';
import SelectBoxComponent from './utils/SelectBox';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import { IStore } from '../core/store/store';
import { updateEntity } from '../core/store/actions';
import type { FileInputBoxProps } from './utils/ProPathComponents';
import pathIcon from '../../../resources/benchmark/path.svg';
import deleteIcon from '../../../resources/benchmark/delete.svg';
import exportIcon from '../../../resources/button/down.svg';
import { BackEndStorage } from '../core/store/tools';
import { PanelType } from '@src/backEnd/interface/model';
import '../a-styles/app.css';
import '../a-styles/profiling.css';
import { notify } from '../common';
import { PortInfo } from '@src/backEnd/interface/api';
import { SelectSerial } from '../component/SelectSerial/SelectSerial';
import { ProfilingResultFC } from '../component/ResultTable/ResultTable';
import CommonCard from '@src/frontEnd/component/commonTemplate/common';
import { BENCHMARK_KEYS, INPUT_TABLE_HEADERS, BENCHMARK_TEXT, PERFORMANCE_METRICS } from './benchmarkConfig';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux';
type TableRowSelection<T extends object = object> = TableProps<T>['rowSelection'];

interface ProfilingItem {
  target: string;
  page: string;
  type?: string;
  kind: 'input' | 'select' | 'file';
  group: string;
  key: string;
  title: string;
  content: any;
  defaultValue: string;
  disabled?: boolean;
  folder?: boolean;
  selectedOutputNode?: string;
}

interface ProfilingParams {
  targetPlatform: { target: Target };
  paramType: string;
  selectedOutputNode?: string;
  source?: Source;
}

type ProfilingCommandMsg = Omit<CommandMsg, 'params'> & { params: ProfilingParams };

// ─── History modal sub-components ─────────────────────────────────────────
const BenchmarkModal = (
  { isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }
): React.JSX.Element | null => {
  if (!isOpen) { return null; }
  return (
    <div className="modal-overlay">
      <div className="ant-modal-content">
        <label className="label-style">
          <img src={pathIcon} alt="arrow" className="lt-icon-class" />
          &nbsp;&nbsp;{BENCHMARK_TEXT.modal.title}
        </label>
        <button className="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
};

function ModalHeader({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="modal-header">{children}</div>;
}
function ModalBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div style={{ overflowY: 'scroll', maxHeight: '800px' }}>{children}</div>;
}
function ModalFooter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="modal-footer">{children}</div>;
}
BenchmarkModal.Header = ModalHeader;
BenchmarkModal.Body = ModalBody;
BenchmarkModal.Footer = ModalFooter;

const csvRawData: any = {
  parsedSampleData: [
    { date: '07/17/2025 11:28:33 AM', trailID: '1', modelName: 'model1', avgSim: 0.987, ram: '18.72KB', flash: '141.32KB', time: '14.28ms' },
    { date: '07/17/2025 11:28:33 AM', trailID: '2', modelName: 'model2', avgSim: 0.999, ram: '22.83KB', flash: '141.32KB', time: '12.23ms' },
  ],
};

// ─── Data helpers ──────────────────────────────────────────────────────────

/**
 * Splits profilingData into typed field groups using KEY-based filtering.
 *
 * No positional indexing — each field is identified by its key.
 * To change the key patterns, edit benchmarkConfig.ts only.
 */
function splitBenchmarkData(data: FileInputBoxProps[]) {
  return {
    /** Per-node input files (identified by key containing BENCHMARK_KEYS.inputFilePattern). */
    inputFiles: data.filter(f => f.key.includes(BENCHMARK_KEYS.inputFilePattern)),
    /** Validation label file (identified by BENCHMARK_KEYS.provalidation key). */
    provalidation: data.find(f => f.key === BENCHMARK_KEYS.provalidation),
  };
}

// ─── Component ────────────────────────────────────────────────────────────
function Benchmark(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { Option } = Select;

  // ── Serial port state ─────────────────────────────────────────────────
  const [port1, setPort1] = useState<string>('');
  const [port2, setPort2] = useState<string>('');
  const [baudRate1, setBaudRate1] = useState<string>('');
  const [baudRate2, setBaudRate2] = useState<string>('');

  // ── Redux selectors ───────────────────────────────────────────────────
  // CPU performance
  const timeValue = useSelector((state: any) => state.entities.timeValue);
  const ramValue = useSelector((state: any) => state.entities.ramValue);
  const flashValue = useSelector((state: any) => state.entities.flashValue);
  const lastConvertTS = useSelector((state: any) => state.entities.lastConvertTS);
  // NPU performance
  const dbgSize = useSelector((state: any) => state.entities.dbgSize);
  const modelSize = useSelector((state: any) => state.entities.modelSize);
  const inferenceTime = useSelector((state: any) => state.entities.inferenceTime);
  // Accuracy
  const accuracyValue = useSelector((state: any) => state.entities.balancedAccuracy);
  const cosineSimilarity = useSelector((state: any) => state.entities.cosineSimilarity);

  const benchmarkSelectValue = useSelector((state: any) => state.entities.benchmarkSelectValue);
  const selectResultRecord = useSelector((state: any) => state.entities.selectResultRecord);
  const profHistoryData = useSelector((state: any) => state.entities.profHistoryData);
  const profilingData = useSelector((state: any) => state.entities.profilingData) as ProfilingItem[];
  // True when the selected model is onnx (or a precompiled model with companion onnx).
  // Default true so existing onnx-only workflows are unaffected.
  const onnxAvailable = useSelector((state: any) => Boolean(state.entities.onnxAvailable ?? true));
  const proGraphData = useSelector((state: any) => state.entities.importProGraphCallbackData);
  const proValidationData = useSelector((state: any) => state.entities.importProValidationCallbackData);
  const ports = useSelector((state: any) => state.entities.ports) as [];

  // ── File input state (single source — no new* duplicate) ──────────────
  const [fileBoxes, setFileBoxes] = useState<FileInputBoxProps[]>([]);
  const [profilingBoxes, setProfilingBoxes] = useState<ProfilingItem[]>([]);
  const [mappedData, setMappedData] = useState<ProfilingItem[]>([]);

  // ── Output node ───────────────────────────────────────────────────────
  const [outputNames, setOutputNames] = useState<string[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<string>('None');

  // ── Modal / pending ───────────────────────────────────────────────────
  const [isModalOpen, setModalOpen] = useState(false);
  const [exportMessageState, setExportMessageState] = useState(false);
  const [pending, setPending] = useState(false);
  const [performancePending, setPerformancePending] = useState(false);
  const [accuracyPending, setAccuracyPending] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [selectedRows, setSelectedRows] = useState([]);

  // ── Chart config ──────────────────────────────────────────────────────
  interface ChartConfig { width?: string; height?: string; overflowX?: CSSProperties['overflowX'] }
  const [chartConfig, setChartConfig] = useState<ChartConfig>({});
  const [tableConfig, setTableConfig] = useState<ChartConfig>({});

  // ── Graph data ────────────────────────────────────────────────────────
  const [profilingCfgData, setProfilingCfgData] = useState<ProfilingGraphData[]>([]);
  const [proValidationCfgData, setProValidationCfgData] = useState<ProfilingValidationData[]>([]);

  // ── Flashing ──────────────────────────────────────────────────────────
  let isFlashed = useSelector((state: any) => state.entities.isFlashed);
  let skipFlashing = useSelector((state: any) => state.entities.skipFlashing);

  const setIsFlashed = (v: boolean): void => {
    isFlashed = v;
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: v, key: 'isFlashed' } });
    IStore.getStore().dispatch(updateEntity('isFlashed', v));
  };
  const setSkipFlashing = (v: boolean): void => {
    skipFlashing = v;
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: v, key: 'skipFlashing' } });
    IStore.getStore().dispatch(updateEntity('isFlashed', v));
  };

  // ── Delete modal ──────────────────────────────────────────────────────
  const { openModal, closeModal, modalOpen, config } = useCustomModal();
  const handleDeleteSelected = (): void => {
    if (!selectedRowKeys.length) { message.error({ content: BENCHMARK_TEXT.errors.noSelectedRecord, duration: 1 }); return; }
    openModal({
      title: 'Info', content: 'Are you sure you want to delete the selected data?',
      okText: 'Delete', okBtnProps: { danger: true },
      onOK: (): void => {
        closeModal();
        vscode.postMessage({ method: ApiMethod.DELETE_PROFILING_HISTORY_INFO, params: { timeStamp: selectedRowKeys } } as Message);
        setTimeout(() => { setSelectedRowKeys([]); setSelectedRows([]); queryProfilingData(); }, 1000);
      },
      onCancel: closeModal,
    });
  };

  // ─── Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    const store = IStore.getStore();
    const names = store.getState().entities.modelOutputNames || [];
    const withNone = ['None', ...names];
    setOutputNames(withNone);
    setSelectedOutput(withNone[0]); // always default to first option ('None' or first output name)
    setFileBoxes([]);
    setProfilingBoxes([]);
    setMappedData([]);
  }, []);

  useEffect(() => {
    setProfilingCfgData(proGraphData?.length > 0 ? proGraphData : []);
  }, [proGraphData]);

  useEffect(() => {
    setProValidationCfgData(proValidationData ?? []);
  }, [proValidationData]);

  useEffect(() => {
    if (selectResultRecord?.length > 0) { setSelectedRowKeys(selectResultRecord); }
  }, [selectResultRecord]);

  useEffect(() => { updateSelectPortBaud(); }, [benchmarkSelectValue]);

  const updateSelectPortBaud = (): void => {
    if (!benchmarkSelectValue) { return; }
    setPort1(benchmarkSelectValue.port1 ?? '');
    setBaudRate1(benchmarkSelectValue.baudRate1 ?? '');
    if (target === 'NPU') {
      setPort2(benchmarkSelectValue.port2 ?? '');
      setBaudRate2(benchmarkSelectValue.baudRate2 ?? '');
    }
  };

  useEffect(() => {
    findHistory();
    const clearAccuracy = [
      { key: 'balancedAccuracy', value: undefined },
      { key: 'cosineSimilarity', value: undefined },
    ];
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG_CALLBACK, params: { config: clearAccuracy } });
    IStore.getStore().dispatch(updateEntity('balancedAccuracy', undefined));
    IStore.getStore().dispatch(updateEntity('cosineSimilarity', undefined));
    IStore.getStore().dispatch(updateEntity('importProGraphCallbackData', []));
    IStore.getStore().dispatch(updateEntity('importProValidationCallbackData', []));
    updateSelectPortBaud();
  }, [navigate]);

  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const msg = event.data;
      if (msg.type === 'SkipFlashing') {
        setSkipFlashing(true);
        if (msg.params?.stage === 'accuracy') { handleAccuracy(); } else { handleProfiling(); }
      }
      if (msg.type === 'Failed') {
        setPending(false); setPerformancePending(false); setAccuracyPending(false);
        if (msg.params?.stage === 'profiling') {
          setPort1(''); setBaudRate1('');
          if (target === 'CPU') {
            IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1: '', baudRate1: '' }));
          } else {
            setPort2(''); setBaudRate2('');
            IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1: '', baudRate1: '', port2: '', baudRate2: '' }));
          }
        }
        notify(`Failed. ${msg.params?.description || ''}`, { type: 'error', stack: false, duration: 2 });
      }
      if (msg.type === 'Success') {
        setPending(false); setPerformancePending(false); setAccuracyPending(false);
        IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'finish', 'finish']));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setIsFlashed, setSkipFlashing]);

  // ─── File input state from profilingData ──────────────────────────────
  useEffect(() => {
    if (!profilingData || profilingData.length === 0) { setFileBoxes([]); return; }
    setProfilingBoxes(profilingData);
    setMappedData([...profilingData]);

    // Resolve selected output from the validation_labels item.
    const lblItem = profilingData.find(d => d.key === BENCHMARK_KEYS.validationLabel);
    const resolvedOutput = lblItem?.selectedOutputNode ?? selectedOutput ?? 'None';
    setSelectedOutput(resolvedOutput);

    const boxes: FileInputBoxProps[] = profilingData.map(item => ({
      group: item.group, key: item.key, title: item.title, folder: Boolean(item.folder),
      content: item.key === BENCHMARK_KEYS.provalidation && resolvedOutput === 'None' ? '' : String(item.content ?? ''),
      disabled: item.key === BENCHMARK_KEYS.provalidation ? resolvedOutput === 'None' : Boolean(item.disabled),
    }));
    setFileBoxes(boxes);
  }, [profilingData]);

  // ─── Sync to backend storage ───────────────────────────────────────────
  useEffect(() => {
    const base = profilingBoxes.length > 0 ? profilingBoxes : mappedData;
    const fileMap = new Map(fileBoxes.map(f => [`${f.key}|${f.group}`, f]));
    const updated = base.map(item => {
      const f = fileMap.get(`${item.key}|${item.group}`);
      const content = f
        ? (item.key === BENCHMARK_KEYS.provalidation && selectedOutput === 'None' ? '' : f.content || '')
        : (item.key === BENCHMARK_KEYS.provalidation && selectedOutput === 'None' ? '' : item.content);
      return { ...item, content, selectedOutputNode: selectedOutput };
    });
    BackEndStorage.set('compressionData', JSON.stringify(updated), PanelType.CHIPCONFIG);
  }, [fileBoxes, mappedData, profilingBoxes, selectedOutput]);

  // ─── Export ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!exportMessageState) { return; }
    if (!selectedRowKeys.length) {
      message.error({ content: BENCHMARK_TEXT.errors.noSelectedRecord, duration: 1 });
      setExportMessageState(false);
      return;
    }
    let data = csvRawData;
    if (profHistoryData?.data?.length) {
      const selectData: any[] = [];
      profHistoryData.data.forEach((item: any, index: number) => {
        if (!selectedRowKeys.includes(item.updateTime)) { return; }
        const common = {
          Date: item.date, TrailID: index + 1, ModelName: item.modelName,
          Accuracy: item.accuracyB, CosineSimilarity: item.avgSimB,
          AccuracyQuantize: item.accuracy, CosineSimilarityQuantize: item.avgSim, MSE: item.mse,
        };
        selectData.push(target === 'NPU'
          ? { ...common, DbgSize: item.ram, ModelSize: item.flash, InferenceTime: item.time }
          : { ...common, RAM: item.ram, Flash: item.flash, InferenceTime: item.time }
        );
      });
      data = { parsedSampleData: selectData, target };
      if (selectData.length) { dispatch(exportDataMessage(JSON.stringify(data))); }
      else { message.error({ content: BENCHMARK_TEXT.errors.noSelectedRecord, duration: 1 }); }
    }
    setExportMessageState(false);
  }, [exportMessageState, dispatch]);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const findHistory = (): void => {
    vscode.postMessage({ method: ApiMethod.FIND_BENCHMARK_HISTORY_CONFIG, params: { data: lastConvertTS, target } });
  };

  const queryProfilingData = (): void => {
    vscode.postMessage({ method: ApiMethod.GET_PROFILING_HISTORY_INFO } as Message);
  };

  const handleInputChange = (value: string, key: string, group?: string): void => {
    const finalValue = key === BENCHMARK_KEYS.provalidation && selectedOutput === 'None' ? '' : value;
    const update = (boxes: FileInputBoxProps[]): FileInputBoxProps[] =>
      boxes.map(b => b.key === key && (!group || b.group === group) ? { ...b, content: finalValue } : handleConfigItem(b));
    setFileBoxes(prev => update(prev));

    const updatedProfilingData = profilingBoxes.map(item =>
      item.key === key && (!group || item.group === group)
        ? { ...item, content: finalValue }
        : handleConfigItem(item)
    );
    IStore.getStore().dispatch(updateEntity('profilingData', updatedProfilingData));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: updatedProfilingData, key: 'profilingData' } });
  };

  const handleConfigItem = (item: any): any =>
    item.key === BENCHMARK_KEYS.validationLabel ? { ...item, selectedOutputNode: selectedOutput } : item;

  const sendPortBaudrate = (): void => {
    vscode.postMessage({ method: 'saveProfSelectItems', port1, port2, baudRate1, baudRate2 });
  };

  const benchmarkSetup = (): void => {
    sendPortBaudrate();
    const updated = profilingBoxes.map(item => {
      if (item.kind === 'file') {
        const box = fileBoxes.find(f => f.key === item.key && f.group === item.group);
        const content = (item.key === BENCHMARK_KEYS.provalidation && selectedOutput === 'None')
          ? '' : box?.content || '';
        return { ...item, content, selectedOutputNode: selectedOutput };
      }
      const c = item.key === BENCHMARK_KEYS.provalidation && selectedOutput === 'None' ? '' : item.content;
      return { ...item, content: c, selectedOutputNode: selectedOutput };
    });
    IStore.getStore().dispatch(updateEntity('profilingData', updated));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: updated, key: 'profilingData', selectedOutputNode: selectedOutput } });
  };

  const checkAccuracyConfig = (): boolean => {
    const inputs = fileBoxes.filter(f => f.key.includes(BENCHMARK_KEYS.inputFilePattern));
    const isEmpty = (c: string | string[]): boolean => !c || String(c).trim() === '';
    if (inputs.some(f => isEmpty(f.content))) {
      message.error({ content: BENCHMARK_TEXT.errors.uploadInputFiles, duration: 1 });
      return false;
    }
    const lbl = fileBoxes.find(f => f.key === BENCHMARK_KEYS.provalidation);
    if (selectedOutput !== 'None' && (!lbl?.content || isEmpty(lbl.content))) {
      message.error({ content: BENCHMARK_TEXT.errors.uploadLabelFiles, duration: 1 });
      return false;
    }
    return true;
  };

  // ─── Action handlers ────────────────────────────────────────────────────
  const notifyNoOnnx = (): void => {
    vscode.postMessage({ method: 'showInfo', params: { text: 'ONNX model not available — accuracy evaluation is disabled.' } });
  };

  const handleAccuracy = (): void => {
    if (!onnxAvailable) {
      notifyNoOnnx();
      return;
    }
    if (!lastConvertTS) { message.error({ content: BENCHMARK_TEXT.errors.noConvertRecord, duration: 1 }); return; }
    if (target === 'CPU' && !checkAccuracyConfig()) { return; }
    if (target === 'CPU' && checkAccuracyConfig() && (!port1 || !baudRate1)) {
      message.error({ content: BENCHMARK_TEXT.errors.noSerialConfig, duration: 1 }); return;
    }
    if (pending) { notify(BENCHMARK_TEXT.errors.scriptRunning, { type: 'info', stack: false, duration: 1 }); return; }
    if (target === 'NPU' && !isFlashed && !skipFlashing) { vscode.postMessage({ method: 'confirmFlash', isFlashed, stage: 'accuracy' }); return; }

    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG_CALLBACK, params: { config: [{ key: 'balancedAccuracy', value: undefined }, { key: 'cosineSimilarity', value: undefined }] } });
    setPending(true); setAccuracyPending(true);
    benchmarkSetup();
    if (target === 'CPU') { IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1 })); }
    else { IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1, port2, baudRate2 })); }
    vscode.postMessage({ method: ApiMethod.START_PROFILING, params: { targetPlatform: { target }, paramType: 'accuracy', selectedOutputNode: selectedOutput, source } } as ProfilingCommandMsg);
  };

  const handleProfiling = (): void => {
    if (!lastConvertTS) { message.error({ content: BENCHMARK_TEXT.errors.noConvertRecord, duration: 1 }); return; }
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { config: [{ key: 'dbgSize', value: undefined }, { key: 'modelSize', value: undefined }, { key: 'inferenceTime', value: undefined }, { key: 'timeValue', value: undefined }, { key: 'ramValue', value: undefined }, { key: 'flashValue', value: undefined }] } });
    const missing: string[] = [];
    if (!port1) { missing.push('port'); }
    if (!baudRate1) { missing.push('baud rate'); }
    if (missing.length > 0) { notify(`Configure ${missing.join(missing.length === 2 ? ' and ' : ', and ')}.`, { type: 'info', stack: false, duration: 3 }); return; }
    if (pending) { notify(BENCHMARK_TEXT.errors.scriptRunning, { type: 'info', stack: false, duration: 1 }); return; }
    if (target === 'NPU' && !isFlashed && !skipFlashing) { vscode.postMessage({ method: 'confirmFlash', isFlashed, stage: 'profiling' }); return; }

    setPending(true); setPerformancePending(true);
    benchmarkSetup();
    if (target === 'CPU') { IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1 })); }
    else { IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1, port2, baudRate2 })); }
    vscode.postMessage({ method: ApiMethod.START_PROFILING, params: { targetPlatform: { target }, paramType: 'profiling', selectedOutputNode: selectedOutput, source } } as ProfilingCommandMsg);
  };

  // ─── Rendering ──────────────────────────────────────────────────────────

  /**
   * Accuracy Evaluation Config section.
   *
   * Layout (key-based, no positional magic):
   *   1. Input file table  — items whose key includes BENCHMARK_KEYS.inputFilePattern
   *   2. Validation Labels row + provali file — item with key = BENCHMARK_KEYS.provalidation
   *   3. Accuracy Evaluation button
   *
   * To change the layout, edit benchmarkConfig.ts only.
   */
  const renderAccuracyConfig = (): React.JSX.Element => {
    // Use key-based split — no more (setLen - 2) positional magic.
    const { inputFiles, provalidation } = splitBenchmarkData(fileBoxes);

    return (
      <div style={!onnxAvailable ? { opacity: 0.4 } : {}}>
        {/* Input file table */}
        <div className="inputs-class-table" style={{ width: 'auto' }}>
          {inputFiles.length > 0 && (
            <div className="row-ptq th-ptq">
              {INPUT_TABLE_HEADERS.map(h => (
                <span key={h.label} className="th-ptq" style={h.style}>{h.label}</span>
              ))}
            </div>
          )}
          {inputFiles.map((box) => (
            <div key={box.key} className="AVC-container-rows" style={{ position: 'relative' }}>
              <FileInputBoxComponent
                fileInputBox={{ ...box, disabled: !onnxAvailable || Boolean(box.disabled) }}
                isShowInput={false}
                onInputChange={(value, key): void => handleInputChange(value, key, box.group)}
                filePickerType="local"
                inputPlaceholder={BENCHMARK_TEXT.labels.inputFilePlaceholder}
              />
              {!onnxAvailable && (
                <div style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }} onClick={notifyNoOnnx} />
              )}
            </div>
          ))}
        </div>

        {/* Validation Labels + provali file + Accuracy button */}
        <div className="AVC-container-last-row" style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '5px' }}>
            <label>{BENCHMARK_TEXT.labels.validationLabels}</label>
            <Select
              value={selectedOutput}
              disabled={!onnxAvailable}
              onChange={(val): void => setSelectedOutput(val)}
              style={{ width: 170 }}
            >
              {outputNames.map(name => <Option key={name} value={name}>{name}</Option>)}
            </Select>
          </div>

          {provalidation && (
            // The CSS rule ".AVC-container-last-row .fileInputContainer { margin-left: -120px }"
            // compensates for the empty 120px label inside FileInputBoxComponent.
            // We move that offset to this wrapper div and reset it inside via customEditableStyle.
            // pointerEvents: 'none' on the wrapper ensures the Select to the left is not blocked
            // in the overlapping region; the FileInputBoxComponent restores 'auto' for itself.
            <div style={{ position: 'relative', marginLeft: '-120px', pointerEvents: 'none' }}>
              <FileInputBoxComponent
                fileInputBox={{ ...provalidation, disabled: !onnxAvailable || selectedOutput === 'None', content: selectedOutput === 'None' ? '' : provalidation.content }}
                isShowInput={false} fileExt="csv"
                onInputChange={(value, key): void => handleInputChange(value, key, provalidation.group)}
                filePickerType="local"
                inputPlaceholder={BENCHMARK_TEXT.labels.labelFilePlaceholder}
                customEditableStyle={{ marginLeft: 0, pointerEvents: 'none' }}
              />
              {!onnxAvailable && (
                <div style={{ position: 'absolute', inset: 0, cursor: 'not-allowed', pointerEvents: 'auto' }} onClick={notifyNoOnnx} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button className="left-bt" type="primary" onClick={handleAccuracy}>
              {BENCHMARK_TEXT.buttons.accuracy}
            </Button>
            {accuracyPending && (
              <Button className="left-bt" danger onClick={(e): void => { e.stopPropagation(); vscode.postMessage({ method: ApiMethod.STOP_PROFILING }); }}>
                {BENCHMARK_TEXT.buttons.abort}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // History pop-up.
  const PopUp = (): React.JSX.Element => (
    <BenchmarkModal isOpen={isModalOpen} onClose={(): void => { setModalOpen(false); findHistory(); }}>
      <BenchmarkModal.Header>
        <div className="modal-body">
          <strong>{BENCHMARK_TEXT.modal.title}</strong>
          <div>
            <Button className="modal-button" style={{ background: '#60606040' }} onClick={(e): void => { e.stopPropagation(); handleDeleteSelected(); }}>
              <img src={deleteIcon} alt="arrow" className="rt-icon-class" />&nbsp;{BENCHMARK_TEXT.modal.delete}
            </Button>&nbsp;&nbsp;
            <Button className="modal-button" style={{ background: '#60606040' }} onClick={(e): void => { e.stopPropagation(); setExportMessageState(true); }}>
              <img src={exportIcon} alt="arrow" className="rt-icon-class" style={{ width: '16px', height: '16px' }} />
              &nbsp;{BENCHMARK_TEXT.modal.csvExport}
            </Button>
          </div>
        </div>
      </BenchmarkModal.Header>
      <BenchmarkModal.Body>
        <ProfilingResultFC onSelectionChange={(keys, rows): void => { setSelectedRowKeys(keys); setSelectedRows(rows); }} selectedRowKeys={selectedRowKeys} target={target} />
      </BenchmarkModal.Body>
      <CustomModal open={modalOpen} config={config} onClose={closeModal} />
    </BenchmarkModal>
  );

  // Port / baud-rate options.
  const portOptions = ports?.map((p: PortInfo) => ({ value: p.path, label: p.label }));
  const baudrateOptions = {
    baudrate1: [{ value: '921600', label: '921600' }],
    baudrate2: [{ value: '115200', label: '115200' }],
  };

  // Performance metric values for the current target (from schema, no hardcoded strings).
  const metrics = PERFORMANCE_METRICS[target as keyof typeof PERFORMANCE_METRICS] ?? [];
  const metricValues: Record<string, any> = { inferenceTime, modelSize, dbgSize, timeValue, ramValue, flashValue };

  // ─── Page layout ──────────────────────────────────────────────────────
  return (
    <div className="navigation">
      <div className="profiling-body">

        {/* ── Serial Config + Performance section ─────────────────────── */}
        <div className="profiling-container-1">

          <div className="SC-container">
            <div className="SC-container-1">
              <div style={{ fontSize: '17px', fontWeight: 'bold' }}>{BENCHMARK_TEXT.sections.serialConfig}</div>
              <div className="SC-info-content">
                <div className="SC-info-content-group">
                  <SelectSerial label={target === 'CPU' ? 'Port' : 'Data Port'} selectVal={port1} portOptions={portOptions} selectWidth={target === 'NPU' ? '90px' : '150px'} selectTop="6px" changeHandler={setPort1} />
                  <SelectSerial label="Baud Rate" selectVal={baudRate1} portOptions={baudrateOptions.baudrate1} selectWidth={target === 'NPU' ? '90px' : '150px'} changeHandler={setBaudRate1} />
                </div>
                {target === 'NPU' && (
                  <div className="SC-info-content-group">
                    <SelectSerial label="Command Port" selectVal={port2} portOptions={portOptions} selectWidth="90px" selectTop="6px" changeHandler={setPort2} />
                    <SelectSerial label="Baud Rate" selectVal={baudRate2} portOptions={baudrateOptions.baudrate2} selectWidth="90px" changeHandler={setBaudRate2} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="SC-container-2">
            <div className="ProC-title-bt">
              <strong className="ProC-title" />
              <div className="profiling-performance-btn" style={{ display: 'flex' }}>
                <Button className="performance-Verification" type="primary" onClick={handleProfiling}>
                  {BENCHMARK_TEXT.buttons.performance}
                </Button>
                {performancePending && (
                  <Button className="performance-Verification" danger style={{ marginLeft: '10px' }}
                    onClick={(e): void => { e.stopPropagation(); vscode.postMessage({ method: ApiMethod.STOP_PROFILING }); }}>
                    {BENCHMARK_TEXT.buttons.abort}
                  </Button>
                )}
                <PopUp />
              </div>
            </div>

            {/* Performance metric tiles (from schema, no hardcoded labels) */}
            <div className="ProC-container">
              {metrics.map((m, i) => (
                <div key={m.label} className={`ProC-container-${i + 1}`}>
                  <div className={`ProC-container-${i + 1}-1`}>
                    <span style={{ color: '#FFFFFF', fontSize: '18px' }}>{m.label}</span>
                    <span style={{ color: '#FFFFFF', fontSize: '18px' }}>{metricValues[m.valueKey]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Accuracy Evaluation Config section ──────────────────────── */}
        <div className="profiling-container-2">

          <div className="AVC-title">
            <strong>{BENCHMARK_TEXT.sections.accuracyConfig}</strong>
          </div>

          <div className="AVC-container">
            {renderAccuracyConfig()}

            <div className="AVC-container-1-row">
              <div className="AVC-container-1-2">
                <div className="AVC-container-1-2-1">
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>ACCURACY</div>
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>{accuracyValue}</div>
                </div>
              </div>
              <div className="AVC-container-1-2" style={{ backgroundColor: '#bbae79' }}>
                <div className="AVC-container-1-2-1">
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>COSINE SIMILARITY</div>
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>{cosineSimilarity}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="AVC-container-2">
            <CommonCard title="Evaluation Data" width="50vw" chartChange={setTableConfig}
              children={<ProValidation profilingValidationData={proValidationCfgData} overflowX={tableConfig.overflowX} target={target} />} />
            <CommonCard title="Probability Density Histogram" chartChange={setChartConfig} width="37vw"
              children={profilingCfgData.length > 0
                ? <ProfilingGraph width={chartConfig.width} height={chartConfig.height} overflowX={chartConfig.overflowX} profilingGraphData={profilingCfgData} />
                : <Empty style={{ height: '300px' }} />} />
          </div>
        </div>
      </div>

      <div className="PV-bt">
        <Button className="performance-Verification Jg-bt" type="primary" onClick={(): void => { setModalOpen(true); queryProfilingData(); }}>
          {BENCHMARK_TEXT.buttons.summaryOfResults}
        </Button>
        <PopUp />
      </div>
    </div>
  );
}

export default Benchmark;
