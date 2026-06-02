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
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Select,
  Button,
  message,
  Empty
} from 'antd';
import { BackEndStorage } from '../core/store/tools';
import type { Message, CommandMsg } from '@src/backEnd/interface/api';
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

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux';

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
};

type ConvertStarkDataType =
  | {
    type: 'fileSize';
    exeomSize: number;
    dbgSize: number;
  }
  | {
    type: 'ramFlash';
    ram: {
      workspace: number;
      packWeight: number;
      stack: number;
      other: number;
    };
    flash: {
      code: number;
      data: number;
      weight: number;
    };
  };

interface ConvertChartData {
  name: string;
  value: number;
  category?: string;
  itemStyle?: { color: string };
}


function Convert(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const navigate = useNavigate();

  const [model, setModel] = useState<string>('');
  const [mappedData, setMappedData] = useState<any>([]);
  const [inputBoxes, setInputBoxes] = useState<InputBoxProps[]>([]);
  const [newInputBoxes, setnewInputBoxes] = useState<InputBoxProps[]>([]);
  const [filePathBoxes, setFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const [newFilePathBoxes, setnewFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const [selectBoxes, setSelectBoxes] = useState<SelectBoxProps[]>([]);
  const [newSelectBoxes, setnewSelectBoxes] = useState<SelectBoxProps[]>([]);
  const convertEnabled = useSelector((state: any) => state.entities.convert);
  const convertData = useSelector((state: any) => state.entities.convertData);
  const lastQuantTS = useSelector((state: any) => state.entities.lastQuantTS);
  const conStarkData = useSelector((state: any) => state.entities.importConStarkCallbackData);
  const [convertCfgDataFirst, setConvertCfgDataFirst] = useState<ConvertStarkData[]>([]);
  const convertPending = useSelector((state: any) => state.entities.convertPending);
  const dispatch = useDispatch();
  const [switchStatus, setSwitchStatus] = useState(false);
  // 输入框的值
  const [switchInputValue, setSwitchInputValue] = useState('');
  const [chartPropsFirst, setChartPropsFirst] = useState<{
    xTitle: string;
    yTitle: string;
    yAxisLabels: string[];
  }>();

  const validateShape = (value: string): any => {
    const ok = /^[0-9,]+$/.test(value) && value[0] !== ',' && value[value.length - 1] !== ',';
    return { valid: ok, errorMsg: ok ? undefined : 'Illegal input. Should only contain numbers and commas.' };
  };

  const handleConvertClick = (): void => {
    if (target === 'NPU' && convertEnabled === false) {
      notify(
        'Convert not enabled for the selected file format.',
        { type: 'info', stack: false, duration: 2 }
      );
      return;
    }
    if (convertPending) {
      notify(
        'Conversion already in progress... Check the output panel for details.',
        { type: 'info', stack: false, duration: 2 }
      );
      return;
    }
    dispatch(updateEntity('convertPending', true));
    IStore.getStore().dispatch(updateEntity('lastConvertTs', 0));
    const convertPayload = assembleConvertPayload(
      mappedData,
      newInputBoxes,
      newSelectBoxes,
      newFilePathBoxes,
      switchStatus, // 新增：传入滑块状态
      switchInputValue // 新增：传入输入框值
    );
    IStore.getStore().dispatch(updateEntity('convertData', convertPayload)); // optimistic update
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: convertPayload, key: 'convertData' },
    });

    try {
      const convertMsg: Message = {
        method: ApiMethod.START_DATA_CONVERT,
        params: {
          coreParams: { target: target, source: source },
          paramData: convertPayload,
        },
      };
      vscode.postMessage(convertMsg);
    } catch (error) {
      notify('Error: handleConvertClick', { type: 'error', stack: false, duration: 2 });
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      switch (msg.type) {
        case 'ConvertSuccess': {
          dispatch(updateEntity('convertPending', false));
          if (lastQuantTS) {
            IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'process', 'wait']));
          }
          break;
        }

        case 'ConvertFailed': {
          dispatch(updateEntity('convertPending', false));
          const desc = msg.params?.description || '';
          if (desc.includes('aborted by user')) {
            notify('Conversion aborted.', { type: 'warning', stack: false, duration: 2 });
          } else {
            const errorMsg = `Failed to convert. ${desc}`;
            notify(errorMsg, { type: 'error', stack: false, duration: 2 });
          }
          break;
        }

        case 'LostConnection': {
          if (convertPending) {
            dispatch(updateEntity('convertPending', false));
            notify('Lost connection to remote server', { type: 'error', stack: false, duration: 2 });
          }
          break;
        }

        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getNormalInputed = (value: string | string[], inputkey: string): void => {
    const updateInputBoxes = inputBoxes.map((inputBox) => {
      if (inputBox.key === inputkey) {
        return { ...inputBox, content: value };
      }
      return inputBox;
    });
    const updateNewInputBoxes = newInputBoxes.map((inputBox) => {
      if (inputBox.key === inputkey) {
        return { ...inputBox, content: value };
      }
      return inputBox;
    });
    setInputBoxes(updateInputBoxes);
    setnewInputBoxes(updateNewInputBoxes);
  };
  const getNormalSelectedDropDown = (value: string, selectKey: string): void => {
    let newValue: any = null;
    newValue = value;

    const updataselectBoxes = selectBoxes.map((selectBox) => {
      if (selectBox.key === selectKey) {
        return { ...selectBox, defaultValue: newValue };
      }
      return selectBox;
    });
    setSelectBoxes(updataselectBoxes);
    setnewSelectBoxes(updataselectBoxes);
  };
  const handleInputChange = (value: string, key: string): void => {
    const updated = filePathBoxes.map((x) =>
      x.key === key ? { ...x, content: value } : x
    );
    const updatedNew = newFilePathBoxes.map((x) =>
      x.key === key ? { ...x, content: value } : x
    );
    setFilePathBoxes(updated as FileInputBoxProps[]);
    setnewFilePathBoxes(updatedNew as FileInputBoxProps[]);
  };
  const handleSwitchInputChange = (value: string): void => {
    setSwitchInputValue(value);
  };

  // 监听开关变化
  const handleSwitchChange = (checked: boolean): void => {
    setSwitchStatus(checked);
  };
  const assembleConvertPayload = (
    base: ConvertItem[],
    inputs: InputBoxProps[],
    selects: SelectBoxProps[],
    files: FileInputBoxProps[],
    newSwitchStatus: boolean, // 新增：滑块状态
    newSwitchInputValue: string, // 新增：输入框值
  ): ConvertItem[] => {
    const inputMap = new Map(inputs.map(x => [x.key, x]));
    const selectMap = new Map(selects.map(x => [x.key, x]));
    const fileMap = new Map(files.map(x => [x.key, x]));

    const mergedData = base.map(item => {
      if (item.kind === 'input' && inputMap.has(item.key)) {
        const src = inputMap.get(item.key);
        if (src === undefined) { throw new Error(`Key ${item.key} not found in inputMap`); }
        return { ...item, content: src.content, disabled: src.disabled, title: src.title, group: src.group };
      }
      if (item.kind === 'select' && selectMap.has(item.key)) {
        const src = selectMap.get(item.key);
        if (src === undefined) { throw new Error(`Key ${item.key} not found in selectMap`); }
        return { ...item, defaultValue: src.defaultValue, content: src.content, disabled: src.disabled, title: src.title, group: src.group };
      }
      if (item.kind === 'file' && fileMap.has(item.key)) {
        const src = fileMap.get(item.key);
        if (src === undefined) { throw new Error(`Key ${item.key} not found in fileMap`); }
        return { ...item, content: src.content, disabled: src.disabled, title: src.title, group: src.group };
      }
      return item;
    });
    // 先过滤掉已有的 switch 相关条目，避免重复
    const filteredMergedData = mergedData.filter(item => {
      return item.key !== 'switch_status' && item.key !== 'switch_input_value';
    });

    // 追加最新的 switch 条目
    if (target === 'NPU') {
      filteredMergedData.push(
        // 滑块状态项
        {
          target: target.toLowerCase(),
          page: 'convert',
          kind: 'input',
          group: 'switch_config',
          key: 'switch_status',
          title: 'Switch Status',
          content: newSwitchStatus,
          disabled: false,
          defaultValue: newSwitchStatus,
        },
        // 输入框值项
        {
          target: target.toLowerCase(),
          page: 'convert',
          kind: 'input',
          group: 'switch_config',
          key: 'switch_input_value',
          title: 'Switch Input Value',
          content: newSwitchInputValue,
          disabled: false,
          defaultValue: newSwitchInputValue,
        }
      );
    }

    // 4. 返回处理后的数组（替代原来的 mergedData）
    return filteredMergedData;
  };
  useEffect(() => {
    // 获取 Redux 中的文件名（首次加载时读取）
    const store = IStore.getStore();
    const currentFileName = store.getState().entities.selectedFileName;
    if (currentFileName) {
      setModel(currentFileName);
    }

    // 订阅 Redux 状态变化（后续文件名更新时同步）
    const unsubscribe = store.subscribe(() => {
      const newFileName = store.getState().entities.selectedFileName;
      if (newFileName && newFileName !== model) {
        setModel(newFileName);
      }
    });

    // 组件卸载时取消订阅
    return () => unsubscribe();
  }, [model]);

  useEffect(() => {
    setInputBoxes([]);
    setSelectBoxes([]);
    if (convertData && convertData.length > 0) {
      const newMappedData = convertData.map(
        (data: {
          disabled?: any;
          page: any;
          kind: any;
          group: any;
          key: any;
          title: any;
          content: any;
          defaultValue?: any;
        }) => ({
          page: data.page,
          kind: data.kind,
          group: data.group,
          key: data.key,
          title: data.title,
          content: data.content,
          defaultValue: data.defaultValue,
          disabled: data.disabled,
        })
      );
      setMappedData(newMappedData);
      const filteredSelectBoxes = newMappedData.filter(
        (item: { page: string; kind: string }) => item.page === 'convert' && item.kind === 'select'
      );
      const filteredFileBoxes = newMappedData.filter(
        (item: { page: string; kind: string }) => item.page === 'convert' && item.kind === 'file'
      );
      const filteredInputBoxes = newMappedData.filter(
        (item: { page: string; kind: string; group: string }) => item.page === 'convert' && item.kind === 'input' && item.group !== 'switch_config'
      );
      const updatedSelectBoxes = [
        ...filteredSelectBoxes.map(
          (item: { disabled: any; group: any; key: any; title: any; content: any; defaultValue: any }) => ({
            group: item.group,
            key: item.key,
            title: item.title,
            content: item.content,
            defaultValue: item.defaultValue,
            disabled: item.disabled,
          })
        ),
      ];
      const updatedFileBoxes = [
        ...filteredFileBoxes.map(
          (item: { disabled: any; group: any; key: any; title: any; content: any; defaultValue: any }) => ({
            group: item.group,
            key: item.key,
            title: item.title,
            content: item.content,
            defaultValue: item.defaultValue,
            disabled: item.disabled,
          })
        ),
      ];
      const updatedInputBoxes = [
        ...filteredInputBoxes.map((item: { disabled: any; group: any; key: any; title: any; content: any }) => ({
          group: item.group,
          key: item.key,
          title: item.title,
          content: item.content,
          disabled: item.disabled,
        })),
      ];
      setInputBoxes(updatedInputBoxes as InputBoxProps[]);
      setnewInputBoxes(updatedInputBoxes as InputBoxProps[]);
      setFilePathBoxes(updatedFileBoxes as FileInputBoxProps[]);
      setnewFilePathBoxes(updatedFileBoxes as FileInputBoxProps[]);
      setSelectBoxes(updatedSelectBoxes as SelectBoxProps[]);
      setnewSelectBoxes(updatedSelectBoxes as SelectBoxProps[]);
      updateSwitchStatus(newMappedData);
    }
  }, [convertData]);
  useEffect(() => {
    if (convertData && convertData.length > 0) {
      updateSwitchStatus(convertData);
    }
  }, [navigate]);

  const updateSwitchStatus = (newMappedData: any): void => {
    const filteredSwitch = newMappedData.filter(
      (item: { page: string; kind: string; group: string }) => item.page === 'convert' && item.kind === 'input' && item.group === 'switch_config'
    );
    if (filteredSwitch && filteredSwitch.length > 0) {
      const switchNowStatus = filteredSwitch.filter((item: any) => item.key === 'switch_status')[0];
      const switchValue = filteredSwitch.filter((item: any) => item.key === 'switch_input_value')[0];
      handleSwitchChange(switchNowStatus.defaultValue);
      handleSwitchInputChange(switchValue.content);
    }
  };

  useEffect(() => {
    if (!conStarkData || conStarkData.length === 0) {
      setConvertCfgDataFirst([]);
      setChartPropsFirst(undefined);
      return;
    }

    const rawData: ConvertStarkDataType = conStarkData;
    let chartData: ConvertChartData[] = [];
    let chartParams = {
      xTitle: '',
      yTitle: '',
      yAxisLabels: [] as string[],
    };
    // 类型1：.exeom/.dbg文件大小（单分类堆叠）
    if (rawData.type === 'fileSize') {
      chartData = [
        {
          name: 'model',
          value: rawData.exeomSize,
          category: 'Filesize',
          itemStyle: { color: '#0087AB' },
        },
        {
          name: 'dbg',
          value: rawData.dbgSize,
          category: 'Filesize',
          itemStyle: { color: '#1F9D69' },
        },
      ];
      chartParams = {
        xTitle: '',
        yTitle: '',
        yAxisLabels: ['filesize'],
      };
    } else if (rawData.type === 'ramFlash') { // 类型2：ram/flash数据（双分类分组堆叠）
      const newRawData = Object.assign({}, rawData);
      const ram = ramFlashtoKBFunc(newRawData.ram);
      const flash = ramFlashtoKBFunc(newRawData.flash);
      // RAM子项（仅在RAM行显示）
      const ramItems = [
        {
          name: `workspace`,
          value: ram.workspace,
          category: 'Ram',
          itemStyle: { color: '#0087AB' },
        },
        {
          name: `stack`,
          value: ram.stack,
          category: 'Ram',
          itemStyle: { color: '#0087AB' },
        },
        {
          name: `pack_weight`,
          value: ram.pack_weight,
          category: 'Ram',
          itemStyle: { color: '#0087AB' },
        },
        {
          name: `other`,
          value: ram.other,
          category: 'Ram',
          itemStyle: { color: '#0087AB' },
        },
      ];

      // Flash子项（仅在Flash行显示）
      const flashItems = [
        {
          name: `code`,
          value: flash.code,
          category: 'Flash',
          itemStyle: { color: '#1F9D69' },
        },
        {
          name: `data`,
          value: flash.data,
          category: 'Flash',
          itemStyle: { color: '#1F9D69' },
        },
        {
          name: `weight`,
          value: flash.weight,
          category: 'Flash',
          itemStyle: { color: '#1F9D69' },
        },
      ];

      chartData = [...ramItems, ...flashItems];
      chartParams = {
        xTitle: '',
        yTitle: '',
        yAxisLabels: ['RAM', 'Flash'],
      };
    }

    setConvertCfgDataFirst(chartData);
    setChartPropsFirst(chartParams);
  }, [conStarkData]);

  useEffect(() => {
    const updateNewSideData = (): void => {
      const updatedData = mappedData.map((data: { kind: string; key: string; group: string }) => {
        if (data.kind === 'input') {
          const updatedInput = newInputBoxes.find((input) => input.key === data.key && input.group === data.group);
          if (updatedInput) {
            return {
              ...data,
              content: updatedInput.content,
            };
          }
        }

        if (data.kind === 'select') {
          const updatedSelect = newSelectBoxes.find((select) => select.key === data.key && select.group === data.group);
          if (updatedSelect) {
            return {
              ...data,
              content: updatedSelect.content,
              defaultValue: updatedSelect.defaultValue,
              disabled: updatedSelect.disabled,
            };
          }
        }
        if (data.kind === 'file') {
          const updatedSelect = newSelectBoxes.find((select) => select.key === data.key && select.group === data.group);
          if (updatedSelect) {
            return {
              ...data,
              content: updatedSelect.content,
            };
          }
        }
        return data;
      });
      const filterData = updatedData.filter((item: { page: string }) => item.page === 'convert');
      BackEndStorage.set('convertData', filterData, PanelType.CHIPCONFIG);
    };
    updateNewSideData();
  }, [
    newInputBoxes,
    newSelectBoxes,
    mappedData,
  ]);

  const renderByConfig = (): React.JSX.Element => {
    const npuOutputTypeSelect = selectBoxes.slice(0, 1);
    const setLen = inputBoxes.length;
    const convertFlat = [];
    const rows: React.JSX.Element[] = [];
    const newRow: React.JSX.Element[] = [];
    newRow.push(
      <div key={1} className="row-ptq th-ptq">
        <span className="th-ptq">Input Node</span>
        <span className="th-ptq" style={{ marginLeft: '-85px' }}>Shape</span>
        <span className="th-ptq" style={{ marginLeft: '73px' }}>Data Type</span>
      </div>
    );
    const startOffset = target === 'NPU' ? 1 : 0; // There is an existing select box on NPU but not on CPU.
    for (let i = 0; i < setLen; ++i) {
      convertFlat.push(
        <InputBoxComponent
          key={`ncis-${i}`}
          inputBox={inputBoxes[i]}
          labelWidth={80}
          labelOrP={true}
          transmitStyle={true}
          getInputed={getNormalInputed}
          validate={validateShape}
        />,
        <SelectBoxComponent
          key={`ncs-${i}`}
          selectBox={selectBoxes[i + startOffset]}
          labelOrP={true}
          transmitStyle={true}
          getSelected={getNormalSelectedDropDown}
        />,
      );
    }
    for (let i = 0; i < setLen; ++i) {
      const midRow = convertFlat.slice(2 * i, (2 * i) + 2);
      newRow.push(<div key={i + 1} className="row-ptq" style={{ marginTop: '5px' }}> {midRow} </div>);
    }
    rows.push(
      <div className='inputs-class-table' style={{ width: 'auto' }}>
        {newRow}
      </div>
    );

    const convertButton = (): React.JSX.Element => {
      return (
        <>
          <Button className="left-bt"
            type='primary'
            onClick={(e): void => {
              e.stopPropagation();
              handleConvertClick();
            }}>
            {convertPending ? 'Processing...' : 'Convert'}
          </Button>
          {convertPending && (
            <Button
              className='left-bt'
              danger
              style={{ marginLeft: '10px' }}
              onClick={(e: any): void => {
                e.stopPropagation();
                vscode.postMessage({ method: ApiMethod.STOP_DATA_CONVERT });
              }}>
              Abort
            </Button>
          )}
        </>
      );
    };

    if (target === 'NPU') {
      convertFlat.push(...npuOutputTypeSelect.map((selectBox, i) => (
        <SelectBoxComponent key={`cbns-${i}`} selectBox={selectBox} labelWidth={91} labelOrP={true} transmitStyle={true} getSelected={getNormalSelectedDropDown} />
      )));
      const flatLen = convertFlat.length;
      const convLastRow = convertFlat.slice(flatLen - 1, flatLen);
      rows.push(<div className="row-ptq"> {convLastRow}</div>);
      rows.push(
        <div>
          <SwitchInput
            checked={switchStatus}
            inputValue={switchInputValue}
            onSwitchChange={handleSwitchChange}
            onInputChange={handleSwitchInputChange}
            switchText="Advanced Options"
            inputPlaceholder="Additional Arguments"
            toolTips="可选参数，允许为空"
            showButton={false}
          />
          {convertButton()}
        </div>
      );
    } else {
      rows.push(<div className="row-ptq" style={{ gap: '10px' }}> {convertButton()} </div>);
    }

    return (<div key={'form-grid-npu'} className="form-grid npu"> {rows} </div>);
  };
  // 全屏状态
  interface ChartConfig {
    width?: string;
    height?: string;
    overflowX?: CSSProperties['overflowX'];
  };
  const [sharedChartConfig, setSharedChartConfig] = useState<ChartConfig>({});

  const chartChange = (newMsg: ChartConfig): void => {
    setSharedChartConfig(newMsg);
  };

  return (
    <div className="navigation">
      <div className="aa-container">
        <div className="app-common-font">
          <h2 className="section-title">Model currently selected</h2>
        </div>
        <div>
          <div className='model-selected'>
            <ImageInfo modelName={model} />
            <span style={{ marginLeft: '8px', fontSize: '18px' }}>{model}</span>
          </div>
        </div>
      </div>
      <div className="ant-model-body">
        <div className="square-container-1">
          <div className="app-common-font">
            <h2 className="section-title">Convert Config</h2>
          </div>
          <div>
            {renderByConfig()}
          </div>
        </div>
      </div>
      <div className='results-style'>
        <CommonCard
          title={'Conversion Result History'}
          width={'59.5vw'}
          children={<History nextPage='../deploy' target={target} />} />
        <CommonCard
          title={'Conversion Result'}
          chartChange={chartChange}
          width={'30vw'}
          children={convertCfgDataFirst.length > 0 ? <ConvertStarkGraph
            xTitle={chartPropsFirst?.xTitle || ''}
            yTitle={chartPropsFirst?.yTitle || ''}
            yAxisLabels={chartPropsFirst?.yAxisLabels || []}
            convertStarkData={convertCfgDataFirst}
            width={sharedChartConfig.width}
            height={sharedChartConfig.height}
            overflowX={sharedChartConfig.overflowX}
            target={target}
          />
            : <Empty style={{ height: '300px' }} />} />
      </div>
    </div >
  );
}
export default Convert;