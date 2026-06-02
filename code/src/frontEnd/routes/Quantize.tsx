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
import {
  Select,
  Button,
  Modal,
  Empty,
  message,
  Divider,
  Tooltip
} from 'antd';
import { notify } from '../common';
import type { CommandMsg } from '@src/backEnd/interface/api';
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
};
interface RootState {
  entities: {
    compressionHisgraphData: HistogramGraphData[] | null;
  };
}

// Quantize
function Quantize(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const pickType = (source === 'linux') ? 'linux' : 'local';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'PTQ' | 'QAT'>('PTQ');
  const [model, setModel] = useState<string>('');
  const [mappedData, setMappedData] = useState<any>([]);
  const [switchMode, setSwitchMode] = useState(false);
  const [inputBoxes, setInputBoxes] = useState<InputBoxProps[]>([]);
  const [newInputBoxes, setnewInputBoxes] = useState<InputBoxProps[]>([]);
  const [filePathBoxes, setFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const [newFilePathBoxes, setnewFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const [selectBoxes, setSelectBoxes] = useState<SelectBoxProps[]>([]);
  const [newSelectBoxes, setnewSelectBoxes] = useState<SelectBoxProps[]>([]);
  const [layerCfgData, setLayerCfgData] = useState<LayerBoxProps[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [disableValLabel, setDisableValLabel] = useState(true);
  const compressionData = useSelector((state: any) => state.entities.compressionData);
  const layerData = useSelector((state: any) => state.entities.layerwiseData);
  const hisGraphData = useSelector((state: RootState) => state.entities.compressionHisgraphData);
  const [histogramCfgData, setHistogramCfgData] = useState<HistogramGraphData[]>([]);
  const ptqEnabled = useSelector((state: any) => state.entities.ptq);
  const qatEnabled = useSelector((state: any) => state.entities.qat);
  // convert not enabled -> exeom file chosen. Enable Next without quantization.
  const convertEnabled = useSelector((state: any) => state.entities.convert);
  const [disableBtn, setDisableBtn] = useState(true);
  const quantPending = useSelector((state: any) => state.entities.quantPending);
  const dispatch = useDispatch();
  const [validLabelsSelectValue, setValidLabelsSelectValue] = useState<string>('None');
  const [disable, setDisable] = useState(true);
  // 滑块状态
  const [switchStatus, setSwitchStatus] = useState(false);
  const [netStrucQatStatus, setNetStrucQatStatus] = useState(true);
  // 输入框的值
  const [switchInputValue, setSwitchInputValue] = useState('');
  const [outputNames, setOutputNames] = useState<string[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<string>('');

  useEffect(() => {
    const store = IStore.getStore();
    const names = store.getState().entities.modelOutputNames || [];
    const namesWithNone = ['None', ...names];
    setOutputNames(namesWithNone);
    if (names.length > 0) {
      setSelectedOutput(namesWithNone[0]);
    }
  }, []);

  // 监听开关变化
  const handleSwitchChange = (checked: boolean): void => {
    setSwitchStatus(checked);

    // 开关变化时更新selectBoxes中firstRow对应项的禁用状态
    const updatedSelects = selectBoxes.map(item => {
      // 匹配比特数选择框（firstRow对应的组件）
      if (item.title === 'Quantized Data Type' || item.key === 'bit_num') {
        return { ...item, disabled: checked };
      }
      // 如果还有其他需要跟随开关禁用的组件，也可以在这里添加
      return item;
    });
    setSelectBoxes(updatedSelects);
    setnewSelectBoxes(updatedSelects);
  };

  // 监听文件选择框变化
  const handleSwitchInputChange = (value: string): void => {
    setSwitchInputValue(value);
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

    if (ptqEnabled) {
      setActiveTab('PTQ');
    } else if (qatEnabled) {
      setActiveTab('QAT');
    }

    // 组件卸载时取消订阅
    return () => unsubscribe();
  }, [model, ptqEnabled, qatEnabled]);

  useEffect(() => {
    if (compressionData && compressionData.length > 0) {
      updateBtnStatus(compressionData);
    }
  }, [navigate]);

  const updateBtnStatus = (compressionDataCopy: any): void => {
    if (target === 'CPU') {
      const fileOrNoneSelect = compressionDataCopy.filter((item: any) => item.key === 'validation_cpu')[0];
      const validationLabelsCPU = compressionDataCopy.filter((item: any) => item.key === 'selectedOutputNode')[0];
      setDisableBtn(fileOrNoneSelect?.defaultValue === 'NONE');
      setValidLabelsSelectValue(validationLabelsCPU?.defaultValue);
    } else {
      const validationNPU = compressionDataCopy.filter((item: any) => item.key === 'validation_npu')[0];
      const validationLabelsNPU = compressionDataCopy.filter((item: any) => item.key === 'selectedOutputNode')[0];
      const selectValueQat = compressionData.filter((item: any) => item.key === 'config_file')[0];
      const selectAdvanced = compressionData.filter((item: any) => item.key === 'switch_status')[0];
      const selectAdvancedConfig = compressionData.filter((item: any) => item.key === 'switch_input_value')[0];
      const networkStructure = compressionData.filter((item: any) => item.key === 'network_structure')[0];
      setDisable(selectValueQat?.defaultValue === 'Default');
      setDisableBtn(validationNPU?.defaultValue === 'NONE');
      setValidLabelsSelectValue(validationLabelsNPU?.defaultValue);
      setSwitchStatus(selectAdvanced?.defaultValue ?? false);
      if (networkStructure?.content) {
        setNetStrucQatStatus(networkStructure.content.trim() === '');
      }
      if (selectAdvanced?.defaultValue) {
        handleSwitchInputChange(selectAdvancedConfig?.content ?? '');
      } else {
        handleSwitchInputChange('');
      }
    }
  };

  useEffect(() => {
    if (hisGraphData) {
      if (hisGraphData.length === 0) {
        setHistogramCfgData([]);
      } else {
        const shiftHisGraphData = hisGraphData.filter((item: any) => {
          return Object.keys(item).includes('x');
        });
        setHistogramCfgData(shiftHisGraphData);
      }
    }
  }, [hisGraphData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      switch (msg.type) {
        case 'modelChosen': {
          const { fileName } = msg.params;
          setModel(fileName);
          IStore.getStore().dispatch(updateEntity('selectedFileName', fileName));
          break;
        }

        case 'QuantSuccess': {
          dispatch(updateEntity('quantPending', false));
          break;
        }

        case 'QuantFailed': {
          dispatch(updateEntity('quantPending', false));
          const desc = msg.params?.description || '';
          if (desc.includes('aborted by user')) {
            notify('Quantization aborted.', { type: 'warning', stack: false, duration: 2 });
          } else {
            const errorMsg = `Failed to quantize. ${desc}`;
            notify(errorMsg, { type: 'error', stack: false, duration: 2 });
          }
          break;
        }

        case 'LostConnection': {
          if (quantPending) {
            dispatch(updateEntity('quantPending', false));
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

  const validateShape = (value: string): any => {
    const ok = /^[0-9,]+$/.test(value) && value[0] !== ',' && value[value.length - 1] !== ',';
    return { valid: ok, errorMsg: ok ? undefined : 'Shapes should only contain numbers and commas.' };
  };

  const validateBatchNum = (value: string): any => {
    const ok = /^[0-9]+$/.test(value) && Number(value) >= 1;
    return { valid: ok, errorMsg: ok ? undefined : 'Batch Number should only contain integer not smaller than 1.' };
  };
  const handleNext = (): void => {
    if (convertEnabled) {
      notify(
        'Not supported for the selected file.',
        { type: 'info', stack: false, duration: 2 }
      );
      return;
    } else {
      navigate('/convert');
    }
  };
  const handleQuantizeClick = (type?: string): void => {
    // 校验开关开启但输入框为空的情况
    if (switchStatus && !switchInputValue) {
      notify(
        'Advanced options are enabled. Additional arguments are required.',
        { type: 'error', stack: false, duration: 2 }
      );
      return;
    }
    // 清空后面的状态
    IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'process', 'wait', 'wait', 'wait']));
    IStore.getStore().dispatch(updateEntity('lastQuantTS', 0));
    if (quantPending) {
      notify(
        'Quantization already in progress... Check the output panel for details.',
        { type: 'info', stack: false, duration: 2 }
      );
      return;
    }
    dispatch(updateEntity('quantPending', true));
    const compressionPayload = assembleCompressionPayload(
      mappedData,
      {
        inputs: newInputBoxes,
        selects: newSelectBoxes,
        files: newFilePathBoxes,
      },
      switchStatus, // 新增：传入滑块状态
      switchInputValue, // 新增：传入输入框值
      selectedOutput, // 新增：传入下拉框值
    );
    let isThrough = true;
    const valOutInput = compressionPayload.filter(item => item.key === 'val_out_cpu' || item.key === 'vi2_file');
    if (activeTab === 'PTQ' && target === 'NPU') {
      const validationNPU = compressionPayload.filter((item: any) => item.key === 'validation_npu')[0] ?? {};
      const validationLabelNPU = compressionPayload.filter((item: any) => item.key === 'selectedOutputNode')[0] ?? {};
      const validation = validationLabelNPU.defaultValue !== 'None' && validationNPU.defaultValue === 'FILE' &&
        Object.keys(validationLabelNPU).length > 0 && Object.keys(validationNPU).length > 0;
    }
    if (target === 'CPU') {
      const validationCPU = compressionPayload.filter((item: any) => item.key === 'validation_cpu')[0] ?? {};
      const validationLabelCPU = compressionPayload.filter((item: any) => item.key === 'selectedOutputNode')[0] ?? {};
      const validation = validationLabelCPU.defaultValue !== 'None' && validationCPU.defaultValue === 'FILE' &&
        Object.keys(validationLabelCPU).length > 0 && Object.keys(validationCPU).length > 0;
    }
    if (!isThrough) {
      dispatch(updateEntity('quantPending', false));
      return;
    }

    const lastData = handleErrorBoxContent(compressionPayload);
    IStore.getStore().dispatch(updateEntity('compressionData', lastData)); // optimistic update 
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: lastData, key: 'compressionData' },
    });

    try {
      const compressionMsg: Message = {
        method: ApiMethod.START_DATA_QUANTIZE,
        params: {
          coreParams: { target: target, source: source },
          paramType: type,
          paramData: lastData,
          layerData,
        },
      };
      vscode.postMessage(compressionMsg);
    } catch (error) {
      notify(
        'Error: handleQuantizeClick',
        { type: 'error', stack: false, duration: 2 }
      );
      // 新增：异常时重置量化状态
      dispatch(updateEntity('quantPending', false));
    }
  };
  const handleErrorBoxContent = (compressionSaveData: any): any => {
    if (activeTab === 'PTQ' && target === 'NPU') {
      const validationNPU = compressionSaveData.filter((item: any) => item.key === 'validation_npu')[0] ?? {};
      const validationLabelNPU = compressionSaveData.filter((item: any) => item.key === 'selectedOutputNode')[0] ?? {};
      if (Object.keys(validationNPU).length === 0) {
        return compressionSaveData;
      }
      return compressionSaveData.map((item: any) => {
        if (validationNPU.defaultValue === 'NONE') {
          if (item.key === 'selectedOutputNode') {
            return { ...item, defaultValue: 'None' };
          }
          if (item.key.includes('validation_input') && item.key !== 'validation_inputs') {
            return { ...item, content: ' ' };
          }
          if (item.key === 'vi2_file') {
            return { ...item, content: ' ' };
          }
        }
        if (validationNPU.defaultValue === 'FILE' && (validationLabelNPU.defaultValue === 'NONE' || validationLabelNPU.defaultValue === 'None')) {
          if (item.key === 'selectedOutputNode') {
            return { ...item, defaultValue: 'None' };
          }
          if (item.key === 'vi2_file') {
            return { ...item, content: ' ' };
          }
        }
        return item;
      });
    }
    if (target === 'CPU') {
      const validationCPU = compressionSaveData.filter((item: any) => item.key === 'validation_cpu')[0] ?? {};
      const validationLabelCPU = compressionSaveData.filter((item: any) => item.key === 'selectedOutputNode')[0] ?? {};
      if (Object.keys(validationCPU).length === 0) {
        return compressionSaveData;
      }
      return compressionSaveData.map((item: any) => {
        if (validationCPU.defaultValue === 'NONE') {
          if (item.key.includes('validation_input') && item.key !== 'validation_inputs') {
            return { ...item, content: ' ' };
          }
          if (item.key === 'val_out_cpu') {
            return { ...item, content: ' ' };
          }
        }
        if (validationCPU.defaultValue === 'FILE' && (validationLabelCPU.defaultValue === 'NONE' || validationLabelCPU.defaultValue === 'None')) {
          if (item.key === 'val_out_cpu') {
            return { ...item, content: ' ' };
          }
        }
        return item;
      });
    }
    return compressionSaveData;
  };

  const handleRetrainScripts = (): void => {
    const retrainMsg: Message = {
      method: ApiMethod.EDIT_RETRAIN_SCRIPTS,
    };
    vscode.postMessage(retrainMsg);
  };

  const handleTrainConfig = (): void => {
    const retrainMsg: Message = {
      method: ApiMethod.EDIT_RETRAIN_CONFIG,
    };
    vscode.postMessage(retrainMsg);
  };

  const handleModalOpen = (): void => {
    if (layerCfgData.length === 0) {
      const layerMessage: Message = {
        method: ApiMethod.IMPORT_LAYER,
      };
      vscode.postMessage(layerMessage);
    }
    setModalOpen(!isModalOpen);
  };

  const handleModalOk = (): void => {
    IStore.getStore().dispatch(updateEntity('layerwiseData', layerCfgData)); // optimistic update
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: layerCfgData, key: 'layerwiseData' },
    });
    setModalOpen(!isModalOpen);
  };

  const handleModalCancel = (): void => {
    setModalOpen(!isModalOpen);
  };

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

  const getNormalSelectedDropDown = (value: string, selectKey: string, isCtrlOthers?: boolean): void => {
    if (selectKey === 'selectedOutputNode') {
      setValidLabelsSelectValue(value);
    }

    if (isCtrlOthers) {
      switch (value) {
        case 'None':
          setDisableValLabel(true);
          break;

        case 'Choose from File System':
          setDisableValLabel(false);
          break;

        case 'Default':
          setDisable(true);
          break;

        case 'Custom':
          setDisable(false);
          break;

        default:
          notify('Unknown type', { type: 'error', stack: false, duration: 2 });
          break;
      }
    }

    let newValue: any = null;
    newValue = value;

    const updataselectBoxes = selectBoxes.map((selectBox) => {
      if (selectBox.key === selectKey) {
        return { ...selectBox, defaultValue: newValue };
      }
      return selectBox;
    });

    if (selectKey === 'validation_npu' || selectKey === 'validation_cpu') {
      setDisableBtn(value === 'NONE');
    }
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
  interface CompressionFormComponents {
    inputs: InputBoxProps[];
    selects: SelectBoxProps[];
    files: FileInputBoxProps[];
  };
  const assembleCompressionPayload = (
    base: CompressionItem[], // mappedData.
    components: CompressionFormComponents,
    newSwitchStatus: boolean, // 新增：滑块状态
    newSwitchInputValue: string, // 新增：输入框值
    newSelectedOutput: string, // 新增：下拉框值
  ): CompressionItem[] => {
    const { inputs, selects, files } = components;
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
        return { ...item, content: src.content, disabled: src.disabled, title: src.title, group: src.group, folder: src.folder ?? false };
      }
      return item;
    });
    // 先过滤掉已有的 switch 相关条目以及下拉框的值，避免重复
    const filteredMergedData = mergedData.filter(item => {
      return item.key !== 'switch_status' && item.key !== 'switch_input_value' && item.key !== 'selectedOutputNode';
    });
    // 追加最新的 switch 条目
    if (target === 'NPU') {
      filteredMergedData.push(
        // 滑块状态项
        {
          target: target,
          type: 'switch',
          page: 'quant',
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
          target: target,
          type: 'switch',
          page: 'quant',
          kind: 'input',
          group: 'switch_config',
          key: 'switch_input_value',
          title: 'Switch Input Value',
          content: newSwitchInputValue,
          disabled: false,
          defaultValue: newSwitchInputValue,
        },
      );
    }
    filteredMergedData.push(
      // 下拉框的值
      {
        target: target,
        type: 'output',
        page: 'quant',
        kind: 'input',
        group: 'output_config',
        key: 'selectedOutputNode',
        title: 'Selected Output Node',
        content: newSelectedOutput,
        defaultValue: newSelectedOutput,
        disabled: false,
      }
    );
    // 返回处理后的数组
    return filteredMergedData;
  };

  useEffect(() => {
    setInputBoxes([]);
    setSelectBoxes([]);
    if (compressionData && compressionData.length > 0) {
      const newMappedData = compressionData.map(
        (data: {
          target: any;
          type?: any;
          disabled?: any;
          page: any;
          kind: any;
          group: any;
          key: any;
          title: any;
          content: any;
          defaultValue?: any;
          folder?: any;
        }) => ({
          target: data.target,
          type: data.type,
          page: data.page,
          kind: data.kind,
          group: data.group,
          key: data.key,
          title: data.title,
          content: data.content,
          defaultValue: data.defaultValue,
          disabled: data.disabled,
          folder: data.folder ?? false,
        })
      );
      setMappedData(newMappedData);
      const selectedOutputItem = compressionData.find(
        (item: any) => item.key === 'selectedOutputNode'
      );
      if (selectedOutputItem) {
        setSelectedOutput(selectedOutputItem.content || selectedOutputItem.defaultValue);
      }
      const filteredSelectBoxes = newMappedData.filter(
        (item: { page: string; kind: string; type?: string }) => item.page === 'quant' && item.kind === 'select' && item.type !== 'switch'
      );
      const filteredFileBoxes = newMappedData.filter(
        (item: { page: string; kind: string; type?: string }) => item.page === 'quant' && item.kind === 'file' && item.type !== 'switch'
      );
      const filteredInputBoxes = newMappedData.filter(
        (item: { page: string; kind: string; type?: string; key: string }) => item.page === 'quant' && item.kind === 'input' && item.type !== 'switch' && item.key !== 'selectedOutputNode'
      );
      const updatedSelectBoxes = [
        ...filteredSelectBoxes.map(
          (item: { disabled: any; group: any; key: any; title: any; content: any; defaultValue: any }) => ({
            group: item.group,
            key: item.key,
            title: item.title,
            content: item.content,
            defaultValue: item.defaultValue,
            // 初始渲染时就根据switchStatus设置禁用状态
            disabled: item.title === 'Target Quant Type' ? switchStatus : item.disabled,
          })
        ),
      ];
      const updatedFileBoxes = [
        ...filteredFileBoxes.map(
          (item: { disabled: any; group: any; key: any; title: any; content: any; defaultValue: any; folder: any }) => ({
            group: item.group,
            key: item.key,
            title: item.title,
            content: item.content,
            defaultValue: item.defaultValue,
            disabled: item.disabled,
            folder: item.folder ?? false,
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
      updateBtnStatus(compressionData);
    }
  }, [compressionData]);

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
      BackEndStorage.set('compressionData', updatedData, PanelType.CHIPCONFIG);
    };
    updateNewSideData();
  }, [
    newInputBoxes,
    newSelectBoxes,
    mappedData,
  ]);

  useEffect(() => {
    if (Array.isArray(layerData)) {
      setLayerCfgData(layerData);
    }
  }, [layerData]);

  const updateLayerField = (index: number, field: keyof LayerBoxProps, value: string): void => {
    setLayerCfgData(prev =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const getLayerCfg = (): React.JSX.Element => {
    return (
      <Modal
        title='Layerwise Config'
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={599}
        footer={[
          <div key="footerButtons" className='footer-ok-cancel-class'>
            <Button key="submit" type="primary" onClick={handleModalOk}>
              确认
            </Button>
          </div>,
        ]}
        maskClosable={false}
        style={{ top: '39%' }}
        bodyStyle={{
          overflow: 'auto',
        }}
      >
        <div className="option-description">
          <span className="description" style={{ marginLeft: '35px' }}>layer_name</span>
          <span className="description" style={{ marginLeft: '96px' }}>layer_type</span>
          <span className="description" style={{ marginLeft: '101px' }}>quantized_data_type</span>
        </div>
        <div >
          {layerCfgData.map((layerBox, index) => (
            <LayerBoxComponent
              key={index}
              layerBox={layerBox}
              onChange={(field, value): void => updateLayerField(index, field, value)}
            />
          ))}
        </div>
      </Modal>
    );
  };

  const handleBlur = (e: any): void => {
    const blurValue =
      typeof e === 'string' ? e.trim() : e?.target?.value?.trim(); // support scenarios: both dom events and simple strings!

    if (!blurValue || !blurValue.endsWith('.py')) {
      setNetStrucQatStatus(true);
      return;
    }

    const filePickMsg: Message = {
      method: ApiMethod.SHOW_NET_STRUCT,
      params: { input: blurValue },
    };

    vscode.postMessage(filePickMsg);
    setNetStrucQatStatus(false);
  };

  const renderByConfig = (): React.JSX.Element => {
    if (target === 'NPU') {
      const setLen = inputBoxes.length - 5;

      // PTQ: The first row
      const npuBatchNumInput = inputBoxes.slice(0, 1);
      const npuValidSelect = selectBoxes.slice(0, 1);
      const npuBitNumSelect = selectBoxes.slice(1, 2);

      // PTQ: The last row
      const npuValidLabelsSelect = selectBoxes.slice(2, 3);
      const npuValidLabelFile = filePathBoxes.slice(0, 1);

      const npuFlatPtq = [
        ...npuBatchNumInput.map((inputBox, i) => (
          <InputBoxComponent key={`bn-${i}`} inputBox={inputBox} labelOrP={true} transmitStyle={true} getInputed={getNormalInputed} validate={validateBatchNum} />
        )),
        ...npuValidSelect.map((selectBox, i) => (
          <SwitchBoxComponent
            key={`nvs-${i}`}
            selectBox={selectBox}
            labelOrP={true}
            transmitStyle={true}
            onChange={(checked, selectKey): void => {
              npuValidSelect[0].defaultValue = checked ? 'FILE' : 'NONE';
              // 滑块开启（checked=true）→ disableBtn=false；滑块关闭→disableBtn=true
              if (selectKey === 'validation_npu' || selectKey === 'validation_cpu') {
                setDisableBtn(!checked);
              }
            }}
            labelWidth={65}
            customEditableStyle={{
              marginRight: '15px',
            }}
          />
        )),
        ...npuBitNumSelect.map((selectBox, i) => (
          <SelectBoxComponent
            key={`bns-${i}`}
            selectBox={{
              ...selectBox,
              disabled: switchStatus, // 强制使用switchStatus控制禁用状态
            }}
            labelOrP={true}
            transmitStyle={true}
            getSelected={getNormalSelectedDropDown}
          />
        )),
      ];

      for (let i = 0; i < setLen; ++i) {
        npuFlatPtq.push(
          <FileInputBoxComponent
            key={`fibc-${i}`}
            fileInputBox={filePathBoxes[((2 * i) + 7)]}
            isShowInput={false}
            onInputChange={handleInputChange}
            filePickerType={pickType}
            inputPlaceholder={'上传包含.npy文件的文件夹'}
          />,
          <InputBoxComponent
            key={`ibc-${i}`}
            inputBox={inputBoxes[i + 5]}
            labelOrP={true}
            transmitStyle={true}
            getInputed={getNormalInputed}
            validate={validateShape}
            editable={false}
          />,
          <SelectBoxComponent
            key={`sbc-${i}`}
            selectBox={selectBoxes[i + 4]}
            labelOrP={true}
            transmitStyle={true}
            getSelected={getNormalSelectedDropDown}
          />,
          <FileInputBoxComponent
            key={`cfc-${i}`}
            fileInputBox={filePathBoxes[(2 * i) + 8]}
            isShowInput={false}
            onInputChange={handleInputChange}
            filePickerType={pickType}
            inputPlaceholder={'上传包含.npy文件的文件夹'}
            customEditableStyle={{
              display: 'flex',
              flexDirection: 'row',
              gap: '5px',
              marginLeft: '-100px',
            }}
          />,
        );
      }

      npuFlatPtq.push(
        ...npuValidLabelFile.map((filePathBox, i) => (
          <FileInputBoxComponent
            key={`vlf-${i}`}
            labelWidth={135}
            fileInputBox={filePathBox}
            isShowInput={false}
            fileExt='csv'
            onInputChange={handleInputChange}
            filePickerType={pickType}
            disableByOthers={(selectedOutput === 'None')}
            customEditableStyle={{ marginLeft: '-120px' }}
            inputPlaceholder={'需传入输入文件与label的对应关系'}
          />
        )),
      );

      // NPU - QAT
      const npuTrainCode = inputBoxes.slice(1, 2); // QAT tab — row 1, col 1
      const npuNetStruc = filePathBoxes.slice(1, 2); // QAT tab — row 1, col 1
      const npuRetrainInput = filePathBoxes.slice(2, 3); // QAT tab — row 1, col 2
      const npuValidInput = filePathBoxes.slice(3, 4); // QAT tab — row 1, col 3
      const npuConfigFile = selectBoxes.slice(3, 4); // QAT tab — row 2, col 1
      const npuRTOutputFile = filePathBoxes.slice(4, 5); // QAT tab — row 2, col 2
      const npuValidOutput = filePathBoxes.slice(5, 6); // QAT tab — row 2, col 3
      const npuModelPath = filePathBoxes.slice(6, 7); // QAT tab — row 3, col 1
      const npuEpochNum = inputBoxes.slice(2, 3); // QAT tab — row 4, col 1
      const npuBatchSize = inputBoxes.slice(3, 4); // QAT tab — row 5, col 1
      const npuLearningRate = inputBoxes.slice(4, 5); // QAT tab — row 6, col 1

      const npuflatQat = [
        ...npuTrainCode.map((inputBox, i) => (
          <InputBoxComponent key={`ssi-${i}`} inputBox={inputBox} labelOrP={true} transmitStyle={true} getInputed={getNormalInputed} />
        )),
        ...npuRetrainInput.map((filePathBox, i) => (
          <FileInputBoxComponent key={`mp-${i}`} fileInputBox={filePathBox} labelWidth={99} isShowInput={false} onInputChange={handleInputChange} filePickerType={pickType} inputPlaceholder={'上传包含.npy文件的文件夹'} />
        )),
        ...npuValidInput.map((filePathBox, i) => (
          <FileInputBoxComponent key={`ti-${i}`} fileInputBox={filePathBox} labelWidth={0} isShowInput={false} onInputChange={handleInputChange} filePickerType={pickType} inputPlaceholder={'上传包含.npy文件的文件夹'} />
        )),
        ...npuRTOutputFile.map((filePathBox, i) => (
          <FileInputBoxComponent key={`vrto-${i}`} fileInputBox={filePathBox} labelWidth={99} isShowInput={false} onInputChange={handleInputChange} fileExt={'csv'} filePickerType={pickType} inputPlaceholder={'上传对应的labels.csv'} />
        )),
        ...npuValidOutput.map((filePathBox, i) => (
          <FileInputBoxComponent key={`vi-${i}`} fileInputBox={filePathBox} labelWidth={0} isShowInput={false} onInputChange={handleInputChange} fileExt={'csv'} filePickerType={pickType} inputPlaceholder={'上传对应的labels.csv'} />
        )),
        ...npuConfigFile.map((selectBox, i) => (
          <SelectBoxComponent key={`ro-${i}`} selectBox={selectBox} labelOrP={true} transmitStyle={true} getSelected={(value, key): void => (getNormalSelectedDropDown(value, key, true))} />
        )),
        ...npuModelPath.map((filePathBox, i) => (
          <FileInputBoxComponent key={`vo-${i}`} fileInputBox={filePathBox} isShowInput={false} onInputChange={handleInputChange} filePickerType={pickType} />
        )),
        ...npuEpochNum.map((inputBox, i) => (
          <InputBoxComponent key={`en-${i}`} inputBox={inputBox} labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={getNormalInputed} editable={true} />
        )),
        ...npuBatchSize.map((inputBox, i) => (
          <InputBoxComponent key={`bs-${i}`} inputBox={inputBox} labelOrP={true} labelWidth={88} transmitStyle={true} getInputed={getNormalInputed} editable={true} />
        )),
        ...npuLearningRate.map((inputBox, i) => (
          <InputBoxComponent key={`lr-${i}`} inputBox={inputBox} labelOrP={true} transmitStyle={true} getInputed={getNormalInputed} editable={true} />
        )),
        ...npuNetStruc.map((filePathBox, i) => (
          <FileInputBoxComponent key={`ns-${i}`} fileInputBox={filePathBox} isShowInput={false} onBlur={handleBlur} onInputChange={handleInputChange} fileExt={'py'} filePickerType={pickType} inputPlaceholder={'上传.py文件'} />
        )),
      ];

      return (
        <div className='tab-container'>
          <div className="tab-header">
            <button
              className={`tab-btn ${activeTab === 'PTQ' ? 'active' : ''} ${!ptqEnabled ? 'disabled' : ''}`}
              disabled={!ptqEnabled}
              onClick={(): void => ptqEnabled && setActiveTab('PTQ')}
              style={{
                ...(activeTab === 'PTQ' && {
                  borderBottom: '2px solid #5391FF',
                }),
              }}
            >
              PTQ
            </button>
            <button
              className={`tab-btn ${activeTab === 'QAT' ? 'active' : ''} ${!qatEnabled ? 'disabled' : ''}`}
              disabled={!qatEnabled}
              onClick={(): void => qatEnabled && setActiveTab('QAT')}
              style={{
                ...(activeTab === 'QAT' && {
                  borderBottom: '2px solid #5391FF',
                }),
              }}
            >
              QAT
            </button>
          </div>
          <Divider />
          <div className="tab-content">
            {/* Platform target : NPU, Tab: PTQ */}
            {activeTab === 'PTQ' && ptqEnabled && (
              <div className="ant-model-body">
                <div className="square-container-1-1">
                  <div className="app-common-font">
                    <h2 className="section-title">Quantization Config</h2>
                  </div>
                  {((): React.JSX.Element => {
                    const rows: React.JSX.Element[] = [];
                    const firstRow = npuFlatPtq.filter((_, index) => index === 2);
                    rows.push(
                      <div key={0} className="row-ptq firstNpu">
                        {firstRow}
                        <Button className='left-bt' type='primary' style={{ marginLeft: '30px', background: switchStatus ? '#cccccc' : '' }} onClick={handleModalOpen} disabled={switchStatus}>Layerwise Config</Button>
                        {getLayerCfg()}
                      </div>
                    );
                    const newRow: React.JSX.Element[] = [];
                    newRow.push(
                      <div className="app-common-font">
                        <h2 className="section-title">Calibration Inputs</h2>
                      </div>
                    );
                    newRow.push(
                      <div key={1} className="row-ptq th-ptq">
                        <span className="th-ptq">Input Node</span>
                        <span className="th-ptq" style={{ marginLeft: '-49px' }}>Path</span>
                        <span className="th-ptq" style={{ marginLeft: '110px' }}>Shape</span>
                        <span className="th-ptq" style={{ marginLeft: '71px' }}>Data Type</span>
                      </div>
                    );
                    for (let i = 0; i < setLen; ++i) {
                      const midRow = npuFlatPtq.slice(3 + (4 * i), 6 + (4 * i));
                      newRow.push(<div key={i + 2} className="row-ptq sedNpu" style={{ marginTop: '5px' }} >{midRow}</div>);
                    }
                    rows.push(
                      <div className='inputs-class-table'>
                        {newRow}
                      </div>
                    );

                    const secondElement = npuFlatPtq.slice(1, 2);
                    const lastElement = npuFlatPtq.slice(3 + (setLen * 4));
                    const labelSwitch = npuFlatPtq.slice(3 + (setLen * 4), 4 + (setLen * 4));
                    const lastRow: any = [];
                    lastRow.push(
                      <div className="app-common-font">
                        <h2 className="section-title">Validation Inputs</h2>
                      </div>
                    );
                    lastRow.push(
                      <div key={1} className="row-ptq th-ptq">
                        <span className="th-ptq">Input Node</span>
                        <span className="th-ptq" style={{ marginLeft: '-49px' }}>Path</span>
                      </div>
                    );
                    for (let i = 0; i < setLen; ++i) {
                      const midRow = npuFlatPtq.slice(6 + (4 * i), 7 + (4 * i));
                      lastRow.push(<div key={i + 2} className="row-ptq sedNpu" style={{ marginTop: '13px', marginLeft: '100px' }} >{midRow}</div>);
                    }
                    rows.push(
                      <div> {secondElement} </div>
                    );
                    const tmpRows: any = [];
                    tmpRows.push(
                      <div className="inputs-class-table"> {lastRow} </div>
                    );
                    rows.push(
                      <>
                        {!disableBtn && tmpRows}
                      </>
                    );
                    const lastIfNotDisabled = [...lastElement];
                    rows.push(
                      <div className="row-ptq">
                        {!disableBtn && (
                          <div style={{ marginLeft: target === 'NPU' ? '0' : '-135px', display: 'flex', gap: '50px', alignItems: 'center' }}>
                            <label>
                              Validation Labels
                            </label>
                            <Select
                              style={{ width: 170 }}
                              placeholder="请选择输出节点"
                              value={selectedOutput}
                              onChange={setSelectedOutput}
                              disabled={outputNames.length === 0}
                            >
                              {outputNames.map((name) => (
                                <Select.Option key={name} value={name}>
                                  {name}
                                </Select.Option>
                              ))}
                            </Select>
                            {lastIfNotDisabled}
                          </div>)}
                      </div>
                    );
                    rows.push(
                      <div>
                        <SwitchInput
                          checked={switchStatus}
                          inputValue={switchInputValue}
                          onSwitchChange={handleSwitchChange}
                          onInputChange={handleSwitchInputChange}
                          switchText="Advanced"
                          inputPlaceholder="Ascend Config"
                          showButton={true}
                          fileExt='cfg'
                          quantType='ptq'
                          filePickerType={pickType}
                          targetKey="selectedPath"
                          folder={false}
                        />
                        <Button className="left-bt"
                          type='primary'
                          onClick={(e): void => {
                            e.stopPropagation();
                            handleQuantizeClick('PTQ');
                          }} style={{ marginTop: '10px' }}>
                          {quantPending ? 'Processing...' : 'Quantize'}
                        </Button>
                      </div>
                    );
                    return (<div key={'form-grid-npu'} className="form-grid npu"> {rows} </div>);
                  })()}
                </div>
              </div>
            )}

            {/* Platform target : NPU, Tab: QAT */}
            {activeTab === 'QAT' && qatEnabled && (
              <div className="ant-model-body">
                <div className="square-container-1-1">
                  <div className="app-common-font">
                    <h2 className="section-title">Quantization Config</h2>
                  </div>
                  {((): React.JSX.Element => {
                    const row1 = npuflatQat.slice(0, 1);
                    const row2 = npuflatQat.slice(1, 3);
                    const row3 = npuflatQat.slice(3, 5);
                    const row4 = npuflatQat.slice(5, 6);
                    const row5 = npuflatQat.slice(7, 10);
                    const row6 = npuflatQat.slice(10, 11);
                    const inputRow: any = [];

                    inputRow.push(
                      <div key={1} className="row-ptq th-ptq">
                        <span className="th-ptq">Input</span>
                        <span className="th-ptq" style={{ marginLeft: '-28px' }}>Training Dataset</span>
                        <span className="th-ptq" style={{ marginLeft: '6px' }}>Validation Dataset</span>
                      </div>
                    );
                    inputRow.push(<div className="row-qat sedQat">{row2}</div>);
                    const outputRow: any = [];
                    outputRow.push(
                      <div key={1} className="row-ptq th-ptq">
                        <span className="th-ptq">Label</span>
                        <span className="th-ptq" style={{ marginLeft: '-28px' }}>Training Dataset</span>
                        <span className="th-ptq" style={{ marginLeft: '6px' }}>Validation Dataset</span>
                      </div>
                    );
                    outputRow.push(<div className="row-qat threeQat">{row3}</div>);
                    const status = switchStatus ? switchStatus : netStrucQatStatus;
                    return (
                      <div className="form-grid npu">
                        <div className="row-qat">
                          <div className="row1-first">
                            {row6}
                          </div>

                        </div>
                        <div className='inputs-class-table' style={{ width: '560px' }}>{inputRow}</div>
                        <div className="inputs-class-table" style={{ width: '560px' }}>{outputRow}</div>
                        <div className="row-qat threeQat">{row5}</div>
                        {/* <div className="row-qat threeQat">{row6}</div>
                        <div className="row-qat threeQat">{row7}</div> */}
                        <div key={0} className="row-ptq firstNpu">
                          <Button
                            className='left-bt'
                            type='primary'
                            style={{ marginLeft: '100px', background: status ? '#cccccc' : '' }}
                            onClick={handleModalOpen}
                            disabled={status}>
                            Layerwise Config
                          </Button>
                          {getLayerCfg()}
                        </div>
                        <div className="row-qat threeQat">
                          <SwitchInput
                            checked={switchStatus}
                            inputValue={switchInputValue}
                            onSwitchChange={handleSwitchChange}
                            onInputChange={handleSwitchInputChange}
                            switchText="Advanced Settings"
                            inputPlaceholder="Ascend Config"
                            showButton={true}
                            fileExt='cfg'
                            quantType='qat'
                            filePickerType={pickType}
                            targetKey="selectedPath"
                            folder={false}
                          />
                        </div>
                        <div className="row-qat last" style={{ gap: '5px' }}>
                          <Button className="left-bt"
                            type='primary'
                            onClick={(e): void => {
                              e.stopPropagation();
                              handleQuantizeClick('QAT');
                            }}>
                            {quantPending ? 'Processing...' : 'Quantize'}
                          </Button>
                          {quantPending && (
                            <Button
                              className='left-bt'
                              danger
                              style={{ marginLeft: '10px' }}
                              onClick={(e: any): void => {
                                e.stopPropagation();
                                vscode.postMessage({ method: ApiMethod.STOP_DATA_QUANTIZE });
                              }}>
                              Abort
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (target === 'CPU') {
      const setLen = inputBoxes.length - 1;

      // The first row.
      const cpuBatchNumInput = inputBoxes.slice(0, 1);
      const cpuValidSelect = selectBoxes.slice(0, 1);
      const cpuBitNumSelect = selectBoxes.slice(1, 2);
      const cpuQuantTypeSelect = selectBoxes.slice(2, 3);

      // The last row.
      const cpuValidLabelsSelect = selectBoxes.slice(3, 4);
      const cpuValidOutputFile = filePathBoxes.slice(0, 1);

      const cpuFlat = [
        ...cpuBatchNumInput.map((inputBox, i) => (
          <InputBoxComponent key={`cbn-${i}`} labelWidth={120} inputBox={inputBox} labelOrP={true} transmitStyle={true} getInputed={getNormalInputed} validate={validateBatchNum} />
        )),
        ...cpuValidSelect.map((selectBox, i) => (
          <SwitchBoxComponent
            key={`nvs-${i}`}
            selectBox={selectBox}
            labelOrP={true}
            transmitStyle={true}
            onChange={(checked, selectKey): void => {
              cpuValidSelect[0].defaultValue = checked ? 'FILE' : 'NONE';
              // 滑块开启（checked=true）→ disableBtn=false；滑块关闭→disableBtn=true
              if (selectKey === 'validation_npu' || selectKey === 'validation_cpu') {
                setDisableBtn(!checked);
              }
            }}
            labelWidth={65}
            customEditableStyle={{
              marginRight: '15px',
            }}
          />
        )),
        ...cpuBitNumSelect.map((selectBox, i) => (
          <SelectBoxComponent key={`cbns-${i}`} labelWidth={140} selectBox={selectBox} labelOrP={true} transmitStyle={true} getSelected={getNormalSelectedDropDown} />
        )),
        ...cpuQuantTypeSelect.map((selectBox, i) => (
          <SelectBoxComponent key={`cqt-${i}`} labelWidth={97} selectBox={selectBox} labelOrP={true} transmitStyle={true} getSelected={getNormalSelectedDropDown} />
        )),
      ];

      for (let i = 0; i < setLen; ++i) {
        cpuFlat.push(
          <FileInputBoxComponent
            key={`cfc-${i}`}
            labelWidth={105}
            fileInputBox={filePathBoxes[(2 * i) + 1]}
            isShowInput={false}
            onInputChange={handleInputChange}
            filePickerType={pickType}
            inputPlaceholder={'上传包含.npy文件的文件夹'}
          />,
          <InputBoxComponent
            key={`cfis-${i}`}
            inputBox={inputBoxes[i + 1]}
            labelWidth={120}
            labelOrP={true}
            transmitStyle={true}
            getInputed={getNormalInputed}
            validate={validateShape}
          />,
          <FileInputBoxComponent
            key={`cfv-${i}`}
            fileInputBox={filePathBoxes[(2 * i) + 2]}
            isShowInput={false}
            labelWidth={105}
            onInputChange={handleInputChange}
            filePickerType={pickType}
            inputPlaceholder={'上传包含.npy文件的文件夹'}
          />
        );
      }

      cpuFlat.push(
        ...cpuValidLabelsSelect.map((selectBox, i) => (
          <SwitchBoxComponent
            key={`vls-${i}`}
            selectBox={selectBox}
            labelOrP={true}
            transmitStyle={true}
            onChange={(checked, selectKey): void => {
              cpuValidLabelsSelect[0].defaultValue = checked ? 'Choose from File System' : 'NONE';
              getNormalSelectedDropDown(cpuValidLabelsSelect[0].defaultValue, selectKey);
            }}
            labelWidth={128}
            customEditableStyle={{
              marginRight: '15px',
            }}
          /> // Controls if the following file box is enabled.
        )),
        ...cpuValidOutputFile.map((filePathBox, i) => (
          <FileInputBoxComponent
            key={`cvo-${i}`}
            validationStatus={disableBtn}
            labelWidth={131}
            fileInputBox={filePathBox}
            isShowInput={false}
            {...(pickType === 'local' ? { fileExt: 'csv' } : {})}
            onInputChange={handleInputChange}
            filePickerType={pickType}
            disableByOthers={(selectedOutput === 'None')}
            customEditableStyle={{ marginBottom: '8px' }}
            inputPlaceholder={'上传.csv文件'}
          />
        )),
      );

      return (
        <div className="ant-model-body">
          <div className="square-container-1">
            <div className="app-common-font">
              <h2 className="section-title">Quantization Config</h2>
            </div>
            {((): React.JSX.Element => {
              const rows: React.JSX.Element[] = [];
              const validationRow = cpuFlat.slice(1, 2);
              const firstRow = cpuFlat.slice(2, 4);
              const firstRowCol = firstRow.map((item: any, index: any) => {
                return (
                  <div key={`firstRow${index}`} className="gutter-row">
                    {item}
                  </div>
                );
              });
              rows.push(<div className="row-ptq" key={0}>{firstRowCol}</div>);
              const tableRows: React.JSX.Element[] = [];
              tableRows.push(
                <div className="app-common-font">
                  <h2 className="section-title">Calibration Inputs</h2>
                </div>
              );
              tableRows.push(
                <div key={1} className="row-ptq th-cpu">
                  <div className="th-cpu first-cpu">
                    <span>Input Node</span>
                    <span style={{ marginLeft: '-54px' }}>Path</span>
                  </div>
                  <span className="th-ptq" style={{ marginLeft: '11px' }}>Shape</span>
                </div>
              );
              for (let i = 0; i < setLen; ++i) {
                const midRow = cpuFlat.slice(4 + (3 * i), 6 + (3 * i));
                tableRows.push(<div className='row-ptq cpuSed cpu-tab-margin cpu-shape-gap' key={i + 2} >{midRow}</div>);
              }
              rows.push(
                <div className='inputs-class-cpu'>
                  {tableRows}
                </div>
              );
              rows.push(
                <>
                  {validationRow}
                </>
              );
              const inputRows: React.JSX.Element[] = [];
              inputRows.push(
                <div className="app-common-font">
                  <h2 className="section-title">Validation Inputs</h2>
                </div>
              );
              inputRows.push(
                <div key={1} className="row-ptq th-cpu">
                  <div className="th-cpu first-cpu">
                    <span>Input Node</span>
                    <span style={{ marginLeft: '-54px' }}>Path</span>
                  </div>
                </div>
              );
              for (let i = 0; i < setLen; ++i) {
                const midRow = cpuFlat.slice(6 + (3 * i), 7 + (3 * i));
                inputRows.push(<div className='row-ptq cpuSed cpu-tab-margin' key={i + 2} >{midRow}</div>);
              }
              const cputmpRows: React.JSX.Element[] = [];
              cputmpRows.push(
                <div className='inputs-class-cpu'>
                  {inputRows}
                </div>
              );
              rows.push(
                <>
                  {!disableBtn && cputmpRows}
                </>
              );
              const labelSwitch = cpuFlat.slice(4 + (setLen * 3), 5 + (setLen * 3));
              const lastElement = cpuFlat.slice(5 + (setLen * 3));
              if (!disableBtn) {
                rows.push(
                  <div key={rows.length} className="row-ptq">
                    <label>
                      Validation Labels
                    </label>
                    <Select
                      style={{ width: 170 }}
                      placeholder="请选择输出节点"
                      value={selectedOutput}
                      onChange={setSelectedOutput}
                      disabled={outputNames.length === 0}
                    >
                      {outputNames.map((name) => (
                        <Select.Option key={name} value={name}>
                          {name}
                        </Select.Option>
                      ))}
                    </Select>
                    <div style={{ marginLeft: '-135px' }}>
                      {lastElement}
                    </div>
                  </div>
                );
              }
              rows.push(
                <div>
                  <Button className="left-bt"
                    type='primary'
                    onClick={(e): void => {
                      e.stopPropagation();
                      handleQuantizeClick('PTQ'); // only ptq on cpu.
                    }}>
                    {quantPending ? 'Processing...' : 'Quantize'}
                  </Button>
                </div>
              );
              return (<div key={'form-grid-cpu'} className="form-grid cpu"> {rows} </div>);
            })()}
          </div>
        </div>
      );
    } else {
      notify(
        'Unexpected Entrance : Quantize.',
        { type: 'error', stack: false, duration: 2 }
      );
      return <></>;
    }
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
        <div className='model-selected'>
          <ImageInfo modelName={model} />
          <span style={{ marginLeft: '8px', fontSize: '18px' }}>{model}</span>
        </div>
        {target === 'CPU' && <Button className="left-bt next-without-quantization"
          type='primary'
          onClick={(e): void => {
            e.stopPropagation();
            handleQuantizeClick('skip'); // only ptq on cpu.
          }}>
          Next Without Quantization
        </Button>}
      </div>

      {/* render based on target platform */}
      <div>
        {renderByConfig()}
      </div>

      <div className='results-style'>
        <CommonCard title={'Quantization Result History'} width={'56.5vw'} children={<History nextPage='../convert' target={target} activeTab={activeTab} />} />
        <CommonCard title={'Probability Density Histogram'} chartChange={chartChange} width={'33vw'} children={histogramCfgData.length > 0 ? <HistogramGraph width={sharedChartConfig.width} height={sharedChartConfig.height} overflowX={sharedChartConfig.overflowX} histogramGraphData={histogramCfgData} /> : <Empty style={{ height: '300px' }} />} />
      </div>
    </div>
  );
}
export default Quantize;