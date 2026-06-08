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
import { Button, Empty } from 'antd';
import { BackEndStorage } from '../core/store/tools';
import type { Message } from '@src/backEnd/interface/api';
import { vscode } from '..';
import InputBoxComponent from './utils/InputBox';
import type { InputBoxProps } from './utils/InputBox';
import type { SelectBoxProps } from './utils/SelectBox';
import SelectBoxComponent from './utils/SelectBox';
import { ramFlashtoKBFunc } from '../util';
import FileInputBoxComponent from './utils/ProPathComponents';
import type { FileInputBoxProps } from './utils/ProPathComponents';
import ConvertStarkGraph from './utils/ConvertStarkGraph';
import type { ConvertStarkData } from './utils/ConvertStarkGraph';
import { PanelType } from '@src/backEnd/interface/model';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import History from './utils/History';
import { IStore } from '../core/store/store';
import { updateEntity } from '../core/store/actions';
import '../a-styles/app.css';
import SwitchInput from './utils/SwitchInput';
import { notify } from '../common';
import { ImageInfo } from '../component/ImageInfo';
import CommonCard from '@src/frontEnd/component/commonTemplate/common';
import { CONVERT_KEYS, CONVERT_TEXT, NODE_TABLE_HEADERS } from './convertConfig';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux';

// ─── Data types ───────────────────────────────────────────────────────────

interface ConvertItem {
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
}

type ConvertStarkDataType =
  | { type: 'fileSize'; exeomSize: number; dbgSize: number }
  | {
      type: 'ramFlash';
      ram:   { workspace: number; packWeight: number; stack: number; other: number };
      flash: { code: number; data: number; weight: number };
    };

interface ConvertChartData {
  name: string;
  value: number;
  category?: string;
  itemStyle?: { color: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build the payload that is sent to the backend on Convert click.
 * Uses current field values from state; appends switch data for NPU.
 */
function buildConvertPayload(
  base:        ConvertItem[],
  inputs:      InputBoxProps[],
  selects:     SelectBoxProps[],
  files:       FileInputBoxProps[],
  target:      Target,
  switchStatus:   boolean,
  switchInput:    string,
): ConvertItem[] {
  const inputMap  = new Map(inputs.map(x => [x.key, x]));
  const selectMap = new Map(selects.map(x => [x.key, x]));
  const fileMap   = new Map(files.map(x => [x.key, x]));

  const merged = base
    // Strip any stale switch entries — we re-append below with fresh values.
    .filter(item => item.key !== CONVERT_KEYS.switchStatus && item.key !== CONVERT_KEYS.switchInput)
    .map(item => {
      if (item.kind === 'input' && inputMap.has(item.key)) {
        const s = inputMap.get(item.key)!;
        return { ...item, content: s.content, disabled: s.disabled };
      }
      if (item.kind === 'select' && selectMap.has(item.key)) {
        const s = selectMap.get(item.key)!;
        return { ...item, defaultValue: s.defaultValue, content: s.content, disabled: s.disabled };
      }
      if (item.kind === 'file' && fileMap.has(item.key)) {
        const s = fileMap.get(item.key)!;
        return { ...item, content: s.content, disabled: s.disabled };
      }
      return item;
    });

  if (target === 'NPU') {
    merged.push(
      {
        target: 'npu', page: 'convert', kind: 'input',
        group: CONVERT_KEYS.switchGroup, key: CONVERT_KEYS.switchStatus,
        title: 'Switch Status', content: switchStatus, defaultValue: switchStatus, disabled: false,
      },
      {
        target: 'npu', page: 'convert', kind: 'input',
        group: CONVERT_KEYS.switchGroup, key: CONVERT_KEYS.switchInput,
        title: 'Switch Input Value', content: switchInput, defaultValue: switchInput, disabled: false,
      },
    );
  }
  return merged;
}

/**
 * Derive typed field lists from the raw convertData array.
 * All filtering is key/group-based — no positional indexing.
 */
function splitConvertData(data: ConvertItem[]): {
  shapeInputs:     InputBoxProps[];
  nodeTypeSelects: SelectBoxProps[];
  outputTypeSelect: SelectBoxProps | undefined;
  fileBoxes:       FileInputBoxProps[];
  switchStatus:    boolean;
  switchInputValue: string;
} {
  const isConvertPage = (d: ConvertItem): boolean => d.page === 'convert';
  const isSwitchGroup = (d: ConvertItem): boolean => d.group === CONVERT_KEYS.switchGroup;

  // Shape inputs (one per node row) — everything that is an input but not switch data.
  const shapeInputs = data
    .filter(d => isConvertPage(d) && d.kind === 'input' && !isSwitchGroup(d))
    .map(d => ({ group: d.group, key: d.key, title: d.title, content: d.content, disabled: d.disabled }));

  // Data-type selects per node — all selects except the Output_Type one.
  const nodeTypeSelects: SelectBoxProps[] = data
    .filter(d => isConvertPage(d) && d.kind === 'select' && d.key !== CONVERT_KEYS.outputType)
    .map(d => ({
      group: d.group, key: d.key, title: d.title,
      content: d.content, defaultValue: String(d.defaultValue ?? ''), disabled: Boolean(d.disabled),
    }));

  // Output Type select (NPU only, identified by key).
  const rawOut = data.find(d => isConvertPage(d) && d.key === CONVERT_KEYS.outputType);
  const outputTypeSelect: SelectBoxProps | undefined = rawOut
    ? { group: rawOut.group, key: rawOut.key, title: rawOut.title,
        content: rawOut.content, defaultValue: String(rawOut.defaultValue ?? ''), disabled: Boolean(rawOut.disabled) }
    : undefined;

  // File boxes — preserve the `folder` flag if the backend provides it.
  const fileBoxes: FileInputBoxProps[] = data
    .filter(d => isConvertPage(d) && d.kind === 'file')
    .map(d => ({
      group: d.group, key: d.key, title: d.title,
      content: String(d.content ?? ''), folder: Boolean((d as any).folder), disabled: Boolean(d.disabled),
    }));

  // Switch state (from switch_config group, keyed by known keys).
  const switchStatusItem = data.find(d => isSwitchGroup(d) && d.key === CONVERT_KEYS.switchStatus);
  const switchInputItem  = data.find(d => isSwitchGroup(d) && d.key === CONVERT_KEYS.switchInput);

  return {
    shapeInputs:      shapeInputs as InputBoxProps[],
    nodeTypeSelects:  nodeTypeSelects as SelectBoxProps[],
    outputTypeSelect,
    fileBoxes:        fileBoxes as FileInputBoxProps[],
    switchStatus:     switchStatusItem ? Boolean(switchStatusItem.defaultValue) : false,
    switchInputValue: switchInputItem  ? String(switchInputItem.content)        : '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────

function Convert(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  // ── Model name ────────────────────────────────────────────────────────
  const [model, setModel] = useState<string>('');

  // ── Field state (single source of truth; no duplicated "new" mirrors) ─
  const [shapeInputs,     setShapeInputs]     = useState<InputBoxProps[]>([]);
  const [nodeTypeSelects, setNodeTypeSelects] = useState<SelectBoxProps[]>([]);
  const [outputTypeSelect, setOutputTypeSelect] = useState<SelectBoxProps | undefined>();
  const [fileBoxes,       setFileBoxes]       = useState<FileInputBoxProps[]>([]);

  // Switch (Advanced Options) — NPU only.
  const [switchStatus,     setSwitchStatus]     = useState(false);
  const [switchInputValue, setSwitchInputValue] = useState('');

  // ── Redux selectors ───────────────────────────────────────────────────
  const convertEnabled  = useSelector((state: any) => state.entities.convert);
  const convertData     = useSelector((state: any) => state.entities.convertData);
  const lastQuantTS     = useSelector((state: any) => state.entities.lastQuantTS);
  const conStarkData    = useSelector((state: any) => state.entities.importConStarkCallbackData);
  const convertPending  = useSelector((state: any) => state.entities.convertPending);

  // ── Chart state ───────────────────────────────────────────────────────
  const [chartData,   setChartData]   = useState<ConvertStarkData[]>([]);
  const [chartParams, setChartParams] = useState<{ xTitle: string; yTitle: string; yAxisLabels: string[] }>();
  const [chartConfig, setChartConfig] = useState<{
    width?: string; height?: string; overflowX?: CSSProperties['overflowX'];
  }>({});

  // ─── Field validation ─────────────────────────────────────────────────
  const validateShape = (value: string): { valid: boolean; errorMsg?: string } => {
    const { shapeRegex, shapeErrorMsg } = CONVERT_TEXT.validation;
    const ok = shapeRegex.test(value) && value[0] !== ',' && value[value.length - 1] !== ',';
    return { valid: ok, errorMsg: ok ? undefined : shapeErrorMsg };
  };

  // ─── Field update handlers ────────────────────────────────────────────
  const updateShapeInput = (value: string | string[], key: string): void => {
    setShapeInputs(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));
  };

  const updateSelect = (value: string, key: string): void => {
    const update = (boxes: SelectBoxProps[]): SelectBoxProps[] =>
      boxes.map(b => b.key === key ? { ...b, defaultValue: value } : b);
    setNodeTypeSelects(prev => update(prev));
    if (outputTypeSelect?.key === key) {
      setOutputTypeSelect(prev => prev ? { ...prev, defaultValue: value } : prev);
    }
  };

  const updateFileBox = (value: string, key: string): void => {
    setFileBoxes(prev => prev.map(b => b.key === key ? { ...b, content: value } : b));
  };

  // ─── Convert action ───────────────────────────────────────────────────
  const handleConvertClick = (): void => {
    if (target === 'NPU' && convertEnabled === false) {
      notify('Convert not enabled for the selected file format.', { type: 'info', stack: false, duration: 2 });
      return;
    }
    if (convertPending) {
      notify('Conversion already in progress... Check the output panel for details.', { type: 'info', stack: false, duration: 2 });
      return;
    }
    dispatch(updateEntity('convertPending', true));
    IStore.getStore().dispatch(updateEntity('lastConvertTs', 0));

    const payload = buildConvertPayload(
      convertData ?? [],
      shapeInputs,
      [...nodeTypeSelects, ...(outputTypeSelect ? [outputTypeSelect] : [])],
      fileBoxes,
      target,
      switchStatus,
      switchInputValue,
    );
    IStore.getStore().dispatch(updateEntity('convertData', payload));
    vscode.postMessage({ method: ApiMethod.SAVE_CONFIG, params: { data: payload, key: 'convertData' } });

    try {
      const msg: Message = {
        method: ApiMethod.START_DATA_CONVERT,
        params: { coreParams: { target, source }, paramData: payload },
      };
      vscode.postMessage(msg);
    } catch {
      notify('Error: handleConvertClick', { type: 'error', stack: false, duration: 2 });
    }
  };

  // ─── Message listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;
      switch (msg.type) {
        case 'ConvertSuccess':
          dispatch(updateEntity('convertPending', false));
          if (lastQuantTS) {
            IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'process', 'wait']));
          }
          break;
        case 'ConvertFailed':
          dispatch(updateEntity('convertPending', false));
          {
            const desc = msg.params?.description || '';
            if (desc.includes('aborted by user')) {
              notify('Conversion aborted.', { type: 'warning', stack: false, duration: 2 });
            } else {
              notify(`Failed to convert. ${desc}`, { type: 'error', stack: false, duration: 2 });
            }
          }
          break;
        case 'LostConnection':
          if (convertPending) {
            dispatch(updateEntity('convertPending', false));
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

  // ─── Sync model name from Redux ────────────────────────────────────────
  useEffect(() => {
    const store = IStore.getStore();
    const getFileName = (): string => store.getState().entities.selectedFileName ?? '';
    setModel(getFileName());
    const unsub = store.subscribe(() => {
      const name = getFileName();
      if (name) { setModel(name); }
    });
    return unsub;
  }, []);

  // ─── Populate fields from Redux convertData ────────────────────────────
  useEffect(() => {
    if (!convertData || convertData.length === 0) { return; }
    const split = splitConvertData(convertData);
    setShapeInputs(split.shapeInputs);
    setNodeTypeSelects(split.nodeTypeSelects);
    setOutputTypeSelect(split.outputTypeSelect);
    setFileBoxes(split.fileBoxes);
    setSwitchStatus(split.switchStatus);
    setSwitchInputValue(split.switchInputValue);
  }, [convertData]);

  // ─── Sync current field values to backend storage ─────────────────────
  useEffect(() => {
    if (!convertData || convertData.length === 0) { return; }

    // Rebuild the convert portion of the data with current user values.
    const allSelects = [...nodeTypeSelects, ...(outputTypeSelect ? [outputTypeSelect] : [])];
    const updated = (convertData as ConvertItem[]).map(item => {
      if (item.page !== 'convert') { return item; }
      const inp = shapeInputs.find(b => b.key === item.key);
      if (inp) { return { ...item, content: inp.content }; }
      const sel = allSelects.find(b => b.key === item.key);
      if (sel) { return { ...item, defaultValue: sel.defaultValue, content: sel.content }; }
      const fil = fileBoxes.find(b => b.key === item.key);
      if (fil) { return { ...item, content: fil.content }; }
      return item;
    });
    BackEndStorage.set('convertData', updated.filter((d: ConvertItem) => d.page === 'convert'), PanelType.CHIPCONFIG);
  }, [shapeInputs, nodeTypeSelects, outputTypeSelect, fileBoxes]);

  // ─── Chart: build from conStarkData ───────────────────────────────────
  useEffect(() => {
    if (!conStarkData || conStarkData.length === 0) {
      setChartData([]);
      setChartParams(undefined);
      return;
    }
    const raw: ConvertStarkDataType = conStarkData;
    let data: ConvertChartData[] = [];
    let params = { xTitle: '', yTitle: '', yAxisLabels: [] as string[] };

    if (raw.type === 'fileSize') {
      data = [
        { name: 'model', value: raw.exeomSize, category: 'Filesize', itemStyle: { color: '#0087AB' } },
        { name: 'dbg',   value: raw.dbgSize,   category: 'Filesize', itemStyle: { color: '#1F9D69' } },
      ];
      params = { xTitle: '', yTitle: '', yAxisLabels: ['filesize'] };
    } else if (raw.type === 'ramFlash') {
      const ram   = ramFlashtoKBFunc({ ...raw.ram });
      const flash = ramFlashtoKBFunc({ ...raw.flash });
      data = [
        { name: 'workspace',  value: ram.workspace,  category: 'Ram',   itemStyle: { color: '#0087AB' } },
        { name: 'stack',      value: ram.stack,      category: 'Ram',   itemStyle: { color: '#0087AB' } },
        { name: 'pack_weight',value: ram.pack_weight,category: 'Ram',   itemStyle: { color: '#0087AB' } },
        { name: 'other',      value: ram.other,      category: 'Ram',   itemStyle: { color: '#0087AB' } },
        { name: 'code',       value: flash.code,     category: 'Flash', itemStyle: { color: '#1F9D69' } },
        { name: 'data',       value: flash.data,     category: 'Flash', itemStyle: { color: '#1F9D69' } },
        { name: 'weight',     value: flash.weight,   category: 'Flash', itemStyle: { color: '#1F9D69' } },
      ];
      params = { xTitle: '', yTitle: '', yAxisLabels: ['RAM', 'Flash'] };
    }
    setChartData(data);
    setChartParams(params);
  }, [conStarkData]);

  // ─── Rendering ────────────────────────────────────────────────────────

  /**
   * Renders the Convert Config section.
   *
   * Layout (declarative — no positional magic):
   *   1. Node table  →  one row per model input node (shape input + data-type select)
   *   2. [NPU only]  →  Output Type select  (identified by CONVERT_KEYS.outputType)
   *   3. [NPU only]  →  Advanced Options switch
   *   4. Convert / Abort buttons
   *
   * To change layout, edit convertConfig.ts only.
   */
  const renderConvertConfig = (): React.JSX.Element => {
    const buttons = (
      <>
        <Button
          className="left-bt"
          type="primary"
          onClick={(e): void => { e.stopPropagation(); handleConvertClick(); }}
        >
          {convertPending ? CONVERT_TEXT.buttons.converting : CONVERT_TEXT.buttons.convert}
        </Button>
        {convertPending && (
          <Button
            className="left-bt"
            danger
            style={{ marginLeft: '10px' }}
            onClick={(e): void => {
              e.stopPropagation();
              vscode.postMessage({ method: ApiMethod.STOP_DATA_CONVERT });
            }}
          >
            {CONVERT_TEXT.buttons.abort}
          </Button>
        )}
      </>
    );

    return (
      <div className="form-grid npu">

        {/* ── 1. Node configuration table ───────────────────────────── */}
        <div className="inputs-class-table" style={{ width: 'auto' }}>
          {/* Table header */}
          <div className="row-ptq th-ptq">
            {NODE_TABLE_HEADERS.map(col => (
              <span key={col.label} className="th-ptq" style={col.style}>{col.label}</span>
            ))}
          </div>

          {/* One row per input node — no positional offset needed */}
          {shapeInputs.map((shape, i) => (
            <div key={shape.key} className="row-ptq" style={{ marginTop: '5px' }}>
              <InputBoxComponent
                inputBox={shape}
                labelWidth={80}
                labelOrP={true}
                transmitStyle={true}
                getInputed={updateShapeInput}
                validate={validateShape}
              />
              {nodeTypeSelects[i] && (
                <SelectBoxComponent
                  selectBox={nodeTypeSelects[i]}
                  labelOrP={true}
                  transmitStyle={true}
                  getSelected={updateSelect}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── 2. NPU: Output Type select (found by key, not position) ─ */}
        {target === 'NPU' && outputTypeSelect && (
          <div className="row-ptq">
            <SelectBoxComponent
              selectBox={outputTypeSelect}
              labelWidth={91}
              labelOrP={true}
              transmitStyle={true}
              getSelected={updateSelect}
            />
          </div>
        )}

        {/* ── 3. NPU: Advanced Options switch ─────────────────────── */}
        {target === 'NPU' && (
          <SwitchInput
            checked={switchStatus}
            inputValue={switchInputValue}
            onSwitchChange={setSwitchStatus}
            onInputChange={setSwitchInputValue}
            switchText={CONVERT_TEXT.advancedSwitch.label}
            inputPlaceholder={CONVERT_TEXT.advancedSwitch.placeholder}
            toolTips={CONVERT_TEXT.advancedSwitch.tooltip}
            showButton={false}
          />
        )}

        {/* ── 4. Convert / Abort buttons ──────────────────────────── */}
        <div className="row-ptq" style={{ gap: '10px' }}>
          {buttons}
        </div>

      </div>
    );
  };

  // ─── Page layout ──────────────────────────────────────────────────────
  return (
    <div className="navigation">

      {/* Model currently selected */}
      <div className="aa-container">
        <div className="app-common-font">
          <h2 className="section-title">Model currently selected</h2>
        </div>
        <div className="model-selected">
          <ImageInfo modelName={model} />
          <span style={{ marginLeft: '8px', fontSize: '18px' }}>{model}</span>
        </div>
      </div>

      {/* Convert Config form */}
      <div className="ant-model-body">
        <div className="square-container-1">
          <div className="app-common-font">
            <h2 className="section-title">{CONVERT_TEXT.sectionTitle}</h2>
          </div>
          {renderConvertConfig()}
        </div>
      </div>

      {/* Result history and chart */}
      <div className="results-style">
        <CommonCard
          title="Conversion Result History"
          width="59.5vw"
          children={<History nextPage="../deploy" target={target} />}
        />
        <CommonCard
          title="Conversion Result"
          chartChange={setChartConfig}
          width="30vw"
          children={
            chartData.length > 0
              ? <ConvertStarkGraph
                  xTitle={chartParams?.xTitle || ''}
                  yTitle={chartParams?.yTitle || ''}
                  yAxisLabels={chartParams?.yAxisLabels || []}
                  convertStarkData={chartData}
                  width={chartConfig.width}
                  height={chartConfig.height}
                  overflowX={chartConfig.overflowX}
                  target={target}
                />
              : <Empty style={{ height: '300px' }} />
          }
        />
      </div>

    </div>
  );
}

export default Convert;
