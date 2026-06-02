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
import React, { useEffect, useState, useCallback, CSSProperties } from 'react';
import type { TableProps } from 'antd';
import { Button, Descriptions, Select, Tooltip, message, Empty } from 'antd';
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

// 扩展原有类型，添加validation字段
interface ProfilingParams {
  targetPlatform: { target: Target };
  paramType: string;
  selectedOutputNode?: string;
  source?: Source;
}

// 重新定义CommandMsg类型（兼容原有结构）
type ProfilingCommandMsg = Omit<CommandMsg, 'params'> & {
  params: ProfilingParams;
};

const Modal = (
  { isOpen, onClose, children }:
    { isOpen: boolean; onClose: () => void; children: React.ReactNode }
): React.JSX.Element | null => {
  if (!isOpen) {
    return null;
  }
  return (
    <div className="modal-overlay">
      <div className="ant-modal-content">
        <label className='label-style'>
          <img
            src={pathIcon}
            alt="arrow"
            className='lt-icon-class'
          />
          &nbsp;&nbsp;Benchmark History
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

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

const csvRawData: any = {
  parsedSampleData: [
    { date: '07/17/2025 11:28:33 AM', trailID: '1', modelName: 'model1', avgSim: 0.987, ram: '18.72KB', flash: '141.32KB', time: '14.28ms' },
    { date: '07/17/2025 11:28:33 AM', trailID: '2', modelName: 'model2', avgSim: 0.999, ram: '22.83KB', flash: '141.32KB', time: '12.23ms' },
  ],
};

// Benchmark
function Benchmark(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;
  const navigate = useNavigate();

  const [port1, setPort1] = useState<string>('');
  const [port2, setPort2] = useState<string>('');
  const [baudRate1, setBaudRate1] = useState<string>('');
  const [baudRate2, setBaudRate2] = useState<string>('');

  // CPU benchmark
  const timeValue = useSelector((state: any) => state.entities.timeValue);
  const ramValue = useSelector((state: any) => state.entities.ramValue);
  const flashValue = useSelector((state: any) => state.entities.flashValue);
  const lastConvertTS = useSelector((state: any) => state.entities.lastConvertTS);

  // NPU benchmark
  const dbgSize = useSelector((state: any) => state.entities.dbgSize);
  const modelSize = useSelector((state: any) => state.entities.modelSize);
  const inferenceTime = useSelector((state: any) => state.entities.inferenceTime);

  // CPU Accuracy
  const accuracyValue = useSelector((state: any) => state.entities.balancedAccuracy);
  const cosineSimilarity = useSelector((state: any) => state.entities.cosineSimilarity);

  const benchmarkSelectValue = useSelector((state: any) => state.entities.benchmarkSelectValue);
  const selectResultRecord = useSelector((state: any) => state.entities.selectResultRecord);

  const [isModalOpen, setModalOpen] = useState(false);
  const [exportMessageState, setExportMessageState] = useState(false);
  const [filePathBoxes, setFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const [newFilePathBoxes, setnewFilePathBoxes] = useState<FileInputBoxProps[]>([]);
  const { Option } = Select;
  const profHistoryData = useSelector((state: any) => state.entities.profHistoryData);

  const profilingData = useSelector((state: any) => state.entities.profilingData) as ProfilingItem[];
  const [profilingBoxes, setProfilingBoxes] = useState<ProfilingItem[]>([]);
  const proGraphData = useSelector((state: any) => state.entities.importProGraphCallbackData);
  const [profilingCfgData, setProfilingCfgData] = useState<ProfilingGraphData[]>([]);
  const proValidationData = useSelector((state: any) => state.entities.importProValidationCallbackData);
  const ports = useSelector((state: any) => state.entities.ports) as [];

  const [proValidationCfgData, setProValidationCfgData] = useState<ProfilingValidationData[]>([]);
  const [pending, setPending] = useState(false);
  const [performancePending, setPerformancePending] = useState(false);
  const [accuracyPending, setAccuracyPending] = useState(false);
  const [mappedData, setMappedData] = useState<ProfilingItem[]>([]);

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
    setFilePathBoxes([]);
    setnewFilePathBoxes([]);
    setProfilingBoxes([]);
    setMappedData([]);
  }, []);

  let isFlashed = useSelector((state: any) => state.entities.isFlashed);
  let skipFlashing = useSelector((state: any) => state.entities.skipFlashing);

  useEffect(() => {
    setProfilingCfgData([]);
    if (proGraphData && proGraphData.length > 0) {
      setProfilingCfgData(proGraphData);
    }
  }, [proGraphData]);
  // 定义选中状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const handleTableChange = (newSelectedRowKeys: any, newSelectedRows: any): void => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
  };

  const setIsFlashed = (flashed: boolean): void => {
    isFlashed = flashed;
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: flashed, key: 'isFlashed' },
    });
    IStore.getStore().dispatch(updateEntity('isFlashed', flashed));
  };

  const setSkipFlashing = (skip: boolean): void => {
    skipFlashing = skip;
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: skip, key: 'skipFlashing' },
    });
    IStore.getStore().dispatch(updateEntity('isFlashed', skip));
  };

  useEffect(() => {
    findHistory();
    const configAccuracy = [
      { key: 'balancedAccuracy', value: undefined },
      { key: 'cosineSimilarity', value: undefined },
    ];
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: {
        config: configAccuracy,
      },
    });
    IStore.getStore().dispatch(updateEntity('balancedAccuracy', undefined));
    IStore.getStore().dispatch(updateEntity('cosineSimilarity', undefined));
    IStore.getStore().dispatch(updateEntity('importProGraphCallbackData', []));
    IStore.getStore().dispatch(updateEntity('importProValidationCallbackData', []));
    updateSelectPortBaut();
  }, [navigate]);

  const findHistory = (): void => {
    vscode.postMessage({
      method: ApiMethod.FIND_BENCHMARK_HISTORY_CONFIG,
      params: { data: lastConvertTS, target },
    });
  };
  const updateSelectPortBaut = (): void => {
    if (benchmarkSelectValue) {
      setPort1(benchmarkSelectValue.port1);
      setBaudRate1(benchmarkSelectValue.baudRate1);
      if (target === 'NPU') {
        setPort2(benchmarkSelectValue.port2);
        setBaudRate2(benchmarkSelectValue.baudRate2);
      }
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      // Skip flashing.
      if (msg.type === 'SkipFlashing') {
        const stage = msg.params?.stage;
        setSkipFlashing(true);

        if (stage === 'accuracy') {
          handleAccuracy();
        } else {
          handleProfiling();
        }
      }

      // Message from executing scripts.
      if (msg.type === 'Failed') {
        setPending(false);
        setPerformancePending(false);
        setAccuracyPending(false);
        const stage = msg.params?.stage;
        if (stage === 'profiling') {
          setPort1('');
          setBaudRate1('');
          if (target === 'CPU') {
            IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1: '', baudRate1: '' }));
          } else {
            setPort2('');
            setBaudRate2('');
            IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1: '', baudRate1: '', port2: '', baudRate2: '' }));
          }
        }
        const errorMsg = `Failed. ${msg.params?.description || ''}`;
        notify(errorMsg, { type: 'error', stack: false, duration: 2 });
      }
      if (msg.type === 'Success') {
        setPending(false);
        setPerformancePending(false);
        setAccuracyPending(false);
        IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'finish', 'finish']));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setIsFlashed, setSkipFlashing]);
  useEffect(() => {
    updateSelectPortBaut();
  }, [benchmarkSelectValue]);
  useEffect(() => {
    if (selectResultRecord && selectResultRecord.length > 0) {
      setSelectedRowKeys(selectResultRecord);
    }
  }, [selectResultRecord]);
  useEffect(() => {
    setProValidationCfgData([]);
    if (proValidationData) {
      setProValidationCfgData(proValidationData);
    }
  }, [proValidationData]);

  const dispatch = useDispatch();
  const openResultModal = (): void => {
    setModalOpen(true);
    queryProfilingData();
  };
  const closeResultModal = (): void => {
    setModalOpen(false);
    findHistory();
  };
  const handleExportMessage = (): void => {
    setExportMessageState(true);
  };
  // 生成删除提示
  const { openModal, closeModal, modalOpen, config } = useCustomModal();
  const handleOk = (): void => {
    closeModal();
    const historyMessage: Message = {
      method: ApiMethod.DELETE_PROFILING_HISTORY_INFO,
      params: {
        timeStamp: selectedRowKeys,
      },
    };
    vscode.postMessage(historyMessage);
    setTimeout(() => {
      setSelectedRowKeys([]);
      setSelectedRows([]);
      queryProfilingData();
    }, 1000);
  };
  const handleCancel = (): void => {
    closeModal();
  };
  const handleDeleteSelected = (): void => {
    if (selectedRowKeys.length) {
      openModal({
        title: 'Info',
        content: 'Are you sure you want to delete the selected data?',
        okText: 'Delete',
        okBtnProps: { danger: true },
        onOK: handleOk,
        onCancel: handleCancel,
      });
    } else {
      message.error({
        content: 'no selected Record.',
        duration: 1,
      });
    }
  };
  const queryProfilingData = (): void => {
    const historyMessage: Message = {
      method: ApiMethod.GET_PROFILING_HISTORY_INFO,
    };
    vscode.postMessage(historyMessage);
  };

  const handleInputChange = (value: string, key: string, group?: string): void => {
    // 如果是provali且validationType为NONE，强制值为空
    const finalValue = key === 'provali' && selectedOutput === 'None' ? '' : value;

    // 同时匹配key和group，避免同key不同组数据覆盖
    const updated = filePathBoxes.map((x) =>
      (x.key === key && (group ? x.group === group : true)) ? { ...x, content: finalValue } : handleConfig(x)
    );
    const updatedNew = newFilePathBoxes.map((x) =>
      (x.key === key && (group ? x.group === group : true)) ? { ...x, content: finalValue } : handleConfig(x)
    );

    // 更新本地状态
    setFilePathBoxes(updated as FileInputBoxProps[]);
    setnewFilePathBoxes(updatedNew as FileInputBoxProps[]);

    // 立即更新mappedData，触发后端存储同步
    setMappedData(prev =>
      prev.map(item =>
        (item.key === key && (group ? item.group === group : true))
          ? { ...item, content: finalValue }
          : handleConfig(item)
      )
    );

    // 实时更新Redux中的profilingData
    const updatedProfilingData = profilingBoxes.map(item =>
      (item.key === key && (group ? item.group === group : true))
        ? { ...item, content: finalValue }
        : handleConfig(item)
    );
    IStore.getStore().dispatch(updateEntity('profilingData', updatedProfilingData));

    // 主动向后端发送最新数据
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: updatedProfilingData, key: 'profilingData' },
    });
  };

  const handleConfig = (item: any): any => {
    if (item.key && item.key === 'validation_labels') {
      return {
        ...item,
        selectedOutputNode: selectedOutput,
      };
    }
    return item;
  };

  useEffect(() => {
    if (!profilingData || profilingData.length === 0) {
      setFilePathBoxes([]);
      setnewFilePathBoxes([]);
      return;
    }
    let selectedOutputInfo = '';
    if (Array.isArray(profilingData) && profilingData.length > 0) {
      setProfilingBoxes(profilingData);
      setMappedData([...profilingData]);
      const selectNode = profilingData.filter(item => item.key === 'validation_labels')[0] ?? {};
      if (selectedOutputInfo === '') {
        setSelectedOutput(selectNode?.selectedOutputNode ?? 'None');
      }
      selectedOutputInfo = selectNode?.selectedOutputNode ?? selectedOutput;
      const newFileBoxes = profilingData.map((item: ProfilingItem) => ({
        target: item.target,
        type: item.type,
        page: item.page,
        kind: item.kind,
        group: item.group,
        key: item.key,
        title: item.title,
        content: item.key === 'provali' && selectedOutputInfo === 'None' ? '' : (item.content || ''),
        disabled: item.key === 'provali' ? selectedOutputInfo === 'None' : item.disabled,
        folder: item.folder ?? false,
      }));
      setFilePathBoxes(newFileBoxes as FileInputBoxProps[]);
      setnewFilePathBoxes(newFileBoxes as FileInputBoxProps[]);
      if (newFileBoxes.length > 0) {
        const updatedFilePathBoxes = newFileBoxes.map(item => {
          if (item.key === 'provali') {
            return {
              ...item,
              // 修复：用 selectedOutput 控制禁用
              disabled: selectedOutputInfo === 'None',
              content: selectedOutputInfo === 'None' ? '' : item.content,
            };
          }
          return item;
        });
        setFilePathBoxes(updatedFilePathBoxes as FileInputBoxProps[]);
        setnewFilePathBoxes(updatedFilePathBoxes as FileInputBoxProps[]);
      }
    }
  }, [profilingData]);

  // 优化updateNewSideData，增加兜底逻辑，确保文件数据写入后端存储
  useEffect(() => {
    const updateNewSideData = (): void => {
      // 优先使用最新的profilingBoxes，避免mappedData为空
      const baseData = [...(profilingBoxes.length > 0 ? profilingBoxes : mappedData)];

      const updatedData = baseData.map((data: ProfilingItem) => {
        if (data.kind === 'file') {
          // 从filePathBoxes读取，匹配key+group
          const updatedFile = newFilePathBoxes.find(
            (file) => file.key === data.key && file.group === data.group
          );
          if (updatedFile) {
            let fileContent = updatedFile.content || '';
            // 如果是provali且selectedOutput为None，强制内容为空
            if (data.key === 'provali' && selectedOutput === 'None') {
              fileContent = '';
            }
            return {
              ...data,
              content: fileContent,
              selectedOutputNode: selectedOutput,
            };
          }
        }
        const finalContent = data.key === 'provali' && selectedOutput === 'None' ? '' : data.content;
        return { ...data, content: finalContent, selectedOutputNode: selectedOutput };
      });
      // 写入后端存储
      BackEndStorage.set('compressionData', JSON.stringify(updatedData), PanelType.CHIPCONFIG);
    };
    updateNewSideData();
  }, [newFilePathBoxes, mappedData, profilingBoxes, selectedOutput]);

  const sendPortBaudrate = (): void => {
    vscode.postMessage({
      method: 'saveProfSelectItems',
      port1: port1,
      port2: port2,
      baudRate1: baudRate1,
      baudRate2: baudRate2,
    });
  };

  const benchmarkSetup = (): void => {
    sendPortBaudrate();
    const newProfilingItem = profilingBoxes.map(item => {
      if (item.kind === 'file') {
        const fileBox = newFilePathBoxes.find(
          f => f.key === item.key && f.group === item.group
        );
        let fileContent = fileBox?.content || '';
        if (item.key === 'provali' && selectedOutput === 'None') {
          fileContent = '';
        }
        return {
          ...item,
          content: fileContent,
          selectedOutputNode: selectedOutput,
        };
      }
      const finalContent = item.key === 'provali' && selectedOutput === 'None' ? '' : item.content;
      return { ...item, content: finalContent, selectedOutputNode: selectedOutput };
    });
    IStore.getStore().dispatch(updateEntity('profilingData', newProfilingItem));
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: {
        data: newProfilingItem,
        key: 'profilingData',
        selectedOutputNode: selectedOutput,
      },
    });
  };

  const checkAccuracyConfig = (): boolean => {
    const validateInput = filePathBoxes.filter((item: any) => item.key.includes('input/profiling'));
    const contentArr = validateInput.map(item => item.content);
    if (contentArr.includes(' ') || contentArr.includes('')) {
      // 输入框校验非空
      message.error({
        content: 'Upload required files: Validation input files',
        duration: 1,
      });
      return false;
    }
    const validateLabel = filePathBoxes.filter((item: any) => item.key === 'provali')[0] ?? {};
    if (selectedOutput !== 'None' && validateLabel?.content === '') {
      // label框校验非空
      message.error({
        content: 'Upload required files: Label files',
        duration: 1,
      });
      return false;
    }
    return true;
  };

  // handleAccuracy: 精度验证
  const handleAccuracy = (): void => {
    if (!lastConvertTS) {
      message.error({
        content: 'No convert record is configured. Aborting...',
        duration: 1,
      });
      return;
    }
    if (target === 'CPU' && !checkAccuracyConfig()) {
      return;
    }
    const isSerial = target === 'CPU' && checkAccuracyConfig() && (!port1 || !baudRate1);
    if (isSerial) {
      message.error({
        content: 'No serial parameter is configured. Aborting...',
        duration: 1,
      });
      return;
    }
    if (pending) {
      notify('Script is running..', { type: 'info', stack: false, duration: 1 });
      return;
    }
    if (target === 'NPU' && !isFlashed && !skipFlashing) {
      const stage = 'accuracy';
      vscode.postMessage({ method: 'confirmFlash', isFlashed, stage });
      return;
    }
    const configAccuracy = [
      { key: 'balancedAccuracy', value: undefined },
      { key: 'cosineSimilarity', value: undefined },
    ];
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: {
        config: configAccuracy,
      },
    });

    // Set pending state
    setPending(true);
    setAccuracyPending(true);

    // Benchmark setup
    benchmarkSetup();
    if (target === 'CPU') {
      IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1 }));
    } else {
      IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1, port2, baudRate2 }));
    }

    const accuracyMsg: ProfilingCommandMsg = {
      method: ApiMethod.START_PROFILING,
      params: {
        targetPlatform: { target: target },
        paramType: 'accuracy',
        selectedOutputNode: selectedOutput,
        source: source,
      },
    };
    vscode.postMessage(accuracyMsg);
  };
  // handleProfiling: 性能验证
  const handleProfiling = (): void => {
    if (!lastConvertTS) {
      message.error({
        content: 'No convert record is configured. Aborting...',
        duration: 1,
      });
      return;
    }
    const ClearPerformance = [
      { key: 'dbgSize', value: undefined },
      { key: 'modelSize', value: undefined },
      { key: 'inferenceTime', value: undefined },
      { key: 'timeValue', value: undefined },
      { key: 'ramValue', value: undefined },
      { key: 'flashValue', value: undefined },
    ];
    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: {
        config: ClearPerformance,
      },
    });

    let missing: string[] = [];
    if (port1 === undefined) { missing.push('port'); }
    if (baudRate1 === undefined) { missing.push('baud rate'); }
    if (missing.length > 0) {
      notify(`Configure ${missing.join(missing.length === 2 ? ' and ' : ', and ')}.`, { type: 'info', stack: false, duration: 3 });
      return;
    }
    if (pending) {
      notify('Script is running..', { type: 'info', stack: false, duration: 1 });
      return;
    }
    if (target === 'NPU' && !isFlashed && !skipFlashing) {
      const stage = 'profiling';
      vscode.postMessage({ method: 'confirmFlash', isFlashed, stage });
      return;
    }

    // Set pending state
    setPending(true);
    setPerformancePending(true);

    // Benchmark setup
    benchmarkSetup();
    if (target === 'CPU') {
      IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1 }));
    } else {
      IStore.getStore().dispatch(updateEntity('benchmarkSelectValue', { port1, baudRate1, port2, baudRate2 }));
    }

    const profilingMsg: ProfilingCommandMsg = {
      method: ApiMethod.START_PROFILING,
      params: {
        targetPlatform: { target: target },
        paramType: 'profiling',
        selectedOutputNode: selectedOutput,
        source: source,
      },
    };
    vscode.postMessage(profilingMsg);
  };

  useEffect(() => {
    if (exportMessageState) {
      if (selectedRowKeys.length === 0) {
        message.error({
          content: 'No selected record.',
          duration: 1,
        });
        setExportMessageState(false);
        return;
      }
      let data = csvRawData;
      if (profHistoryData.data?.length) {
        const selectData: any = [];
        profHistoryData?.data.forEach((item: any, index: number) => {
          if (selectedRowKeys.includes(item.updateTime)) {
            const common = {
              Date: item.date,
              TrailID: index + 1,
              ModelName: item.modelName,
              Accuracy: item.accuracyB,
              CosineSimilarity: item.avgSimB,
              AccuracyQuantize: item.accuracy,
              CosineSimilarityQuantize: item.avgSim,
              MSE: item.mse,
            };
            if (target === 'NPU') {
              selectData.push({
                ...common,
                DbgSize: item.ram,
                ModelSize: item.flash,
                InferenceTime: item.time,
              });
            } else {
              selectData.push({
                ...common,
                RAM: item.ram,
                Flash: item.flash,
                InferenceTime: item.time,
              });
            }
          }
        });
        data = { parsedSampleData: selectData, target };
        if (selectData.length) {
          dispatch(exportDataMessage(JSON.stringify(data)));
        } else {
          message.error({
            content: 'No selected record.',
            duration: 1,
          });
        }
      }
      setExportMessageState(false);
    }
  }, [exportMessageState, dispatch]);

  const PopUp = (): React.JSX.Element => (<Modal isOpen={isModalOpen} onClose={closeResultModal}>
    <Modal.Header>
      <div className='modal-body'>
        <strong>Benchmark History</strong>
        <div>
          <Button className='modal-button' style={{ background: '#60606040' }} onClick={(e): void => {
            e.stopPropagation(); // 防止点击按钮时触发整行点击
            handleDeleteSelected();
          }}>
            <img
              src={deleteIcon}
              alt="arrow"
              className='rt-icon-class'
            />
            &nbsp;Delete
          </Button>&nbsp;&nbsp;
          <Button className='modal-button'
            style={{ background: '#60606040' }}
            onClick={(e): void => {
              e.stopPropagation(); // 防止点击按钮时触发整行点击
              handleExportMessage();
            }}>
            <img
              src={exportIcon}
              alt="arrow"
              className='rt-icon-class'
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            &nbsp;CSV Export
          </Button>
        </div>
      </div>
    </Modal.Header>
    <Modal.Body>
      <ProfilingResultFC onSelectionChange={handleTableChange} selectedRowKeys={selectedRowKeys} target={target} />
    </Modal.Body>
    <CustomModal
      open={modalOpen}
      config={config}
      onClose={closeModal}
    />
  </Modal>
  );

  const renderByConfig = (): React.JSX.Element => {
    const setLen = filePathBoxes.length;
    const maxItemsPerRow = 1; // 每个普通文件框单独占一行
    // 核心修改：普通文件框总数 = 总长度 - 2（排除最后两个：下拉框+provali）
    const normalFileLen = Math.max(0, setLen - 2);
    // 计算普通文件框需要的行数（每个占一行，所以行数=普通文件框数量）
    const totalRows = normalFileLen > 0 ? Math.ceil(normalFileLen / maxItemsPerRow) : 0;
    // 提取最后一个文件框（provali，对应倒数第二个元素之后的那个）
    const profOutputFile = setLen > 1 ? filePathBoxes.slice(setLen - 1, setLen) : [];
    const rows: React.JSX.Element[] = [];

    // 渲染普通文件框（仅处理前 normalFileLen 个，避开最后两个）
    for (let idx = 0; idx < totalRows; ++idx) {
      // 计算当前行的数量（最多1个，确保每个占一行）
      const numThisRow = Math.min(maxItemsPerRow, normalFileLen - (idx * maxItemsPerRow));
      if (numThisRow <= 0) { break; } // 防止空行

      const startIndex = idx * maxItemsPerRow;
      const fileInputComponents = filePathBoxes
        // 核心：只截取前 normalFileLen 个元素，完全避开最后两个
        .slice(startIndex, startIndex + numThisRow)
        .map((filePathBox, x) => (
          <FileInputBoxComponent
            key={`prvi-${startIndex + x}`}
            fileInputBox={filePathBox}
            isShowInput={false}
            // 传递group参数确保数据同步
            onInputChange={(value, key): void => handleInputChange(value, key, filePathBox.group)}
            filePickerType={'local'}
            inputPlaceholder={'上传包含.npy文件的文件夹'}
          />
        ));
      const newRow: React.JSX.Element[] = [];
      if (idx === 0) {
        newRow.push(
          <div key={1} className="row-ptq th-ptq">
            <span className="th-ptq" style={{ marginLeft: '8px' }}>Input Node</span>
            <span className="th-ptq" style={{ marginLeft: '-54px' }}>Path</span>
          </div>
        );
      }
      newRow.push(
        <div key={`row-${idx}`} className='AVC-container-rows'>
          {fileInputComponents}
        </div>
      );
      rows.push(...newRow);
    }
    const lastRowComponents: React.ReactNode[] = [];
    lastRowComponents.push(
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '5px' }}>
        <label>
          Validation Labels
        </label>
        <Select
          value={selectedOutput}
          onChange={(val): void => {
            setSelectedOutput(val);
          }}
          style={{ width: 170 }}
        >
          {outputNames.map((name) => (
            <Option key={name} value={name}>
              {name}
            </Option>
          ))}
        </Select></div>
    );
    // 添加provali文件框（最后一个元素）
    if (profOutputFile.length > 0) {
      lastRowComponents.push(
        ...profOutputFile.map((filePathBox, i) => (
          <FileInputBoxComponent
            key={`pvo-${i}`}
            fileInputBox={{
              ...filePathBox,
              // 保留provali的禁用状态逻辑
              disabled: selectedOutput === 'None',
              content: selectedOutput === 'None' ? '' : filePathBox.content,
            }}
            isShowInput={false}
            fileExt='csv'
            onInputChange={(value, key): void => handleInputChange(value, key, filePathBox.group)}
            filePickerType={'local'}
            inputPlaceholder={'上传label.csv文件'}
          />
        ))
      );
    }

    // 添加精度验证按钮
    lastRowComponents.push(
      <div key="accuracy-btn-group" style={{ display: 'flex', gap: '10px' }}>
        <Button
          key="accuracy-btn"
          className="left-bt"
          type="primary"
          onClick={handleAccuracy}
        >
          Accuracy Evaluation
        </Button>
        {accuracyPending && (
          <Button
            key="accuracy-abort-btn"
            className="left-bt"
            danger
            onClick={(e): void => {
              e.stopPropagation();
              vscode.postMessage({ method: ApiMethod.STOP_PROFILING });
            }}
          >
            Abort
          </Button>
        )}
      </div>
    );

    return (
      <div>
        <div className='inputs-class-table' style={{ width: 'auto' }}>
          {rows}
        </div>
        <div key="output" className='AVC-container-last-row' style={{ display: 'flex', alignItems: 'center', padding: '5px' }}>
          {lastRowComponents}
        </div>
      </div>
    );
  };

  const portOptions = ports?.map((port: PortInfo) => ({
    value: port.path,
    label: port.label,
  }));

  const baudrateOptions = {
    baudrate1: [
      { value: '921600', label: '921600' },
    ],
    baudrate2: [
      { value: '115200', label: '115200' },
    ],
  };
  // 全屏状态
  interface ChartConfig {
    width?: string;
    height?: string;
    overflowX?: CSSProperties['overflowX'];
  };
  const [sharedChartConfig, setSharedChartConfig] = useState<ChartConfig>({});
  const [sharedTableConfig, setSharedTableConfig] = useState<ChartConfig>({});

  const chartChange = (newMsg: ChartConfig): void => {
    setSharedChartConfig(newMsg);
  };
  const tableChange = (newMsg: ChartConfig): void => {
    setSharedTableConfig(newMsg);
  };

  return (
    <div className="navigation">

      <div className="profiling-body">

        <div className="profiling-container-1">

          <div className="SC-container">
            <div className="SC-container-1">
              <div style={{ fontSize: '17px', fontWeight: 'bold' }}>Serial Config</div>
              <div className="SC-info-content">
                <div className="SC-info-content-group">
                  <div>
                    <SelectSerial
                      label={target === 'CPU' ? 'Port' : 'Data Port'} selectVal={port1} portOptions={portOptions} selectWidth={target === 'NPU' ? '90px' : '150px'} selectTop={'6px'} changeHandler={setPort1}
                    />
                  </div>
                  <div>
                    <SelectSerial
                      label={'Baud Rate'} selectVal={baudRate1} portOptions={baudrateOptions.baudrate1} selectWidth={target === 'NPU' ? '90px' : '150px'} changeHandler={setBaudRate1}
                    />
                  </div>
                </div>
                {(target === 'NPU') && <div className="SC-info-content-group">
                  <div><SelectSerial label={'Command Port'} selectVal={port2} portOptions={portOptions} selectWidth={'90px'} selectTop={'6px'} changeHandler={setPort2} /></div>
                  <div><SelectSerial label={'Baud Rate'} selectVal={baudRate2} portOptions={baudrateOptions.baudrate2} selectWidth={'90px'} changeHandler={setBaudRate2} /></div>
                </div>}
              </div>
            </div>
          </div>

          <div className="SC-container-2">

            <div className="ProC-title-bt">

              <strong className="ProC-title">
              </strong>

              <div className="profiling-performance-btn" style={{ display: 'flex' }}>
                <Button className="performance-Verification" type="primary" onClick={handleProfiling}>
                  Performance Evaluation
                </Button>
                {performancePending && (
                  <Button
                    className="performance-Verification"
                    danger
                    style={{ marginLeft: '10px' }}
                    onClick={(e): void => {
                      e.stopPropagation();
                      vscode.postMessage({ method: ApiMethod.STOP_PROFILING });
                    }}>
                    Abort
                  </Button>
                )}
                <PopUp />
              </div>

            </div>

            <div className="ProC-container">

              <div className="ProC-container-1">

                <div className="ProC-container-1-1">

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    INFERENCE TIME
                  </span>

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    {(target === 'NPU') ? inferenceTime : timeValue}
                  </span>

                </div>

              </div>

              <div className="ProC-container-2">

                <div className="ProC-container-2-1">

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    {(target === 'NPU') ? 'MODEL SIZE' : 'RAM'}
                  </span>

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    {(target === 'NPU') ? modelSize : ramValue}
                  </span>
                </div>

              </div>

              <div className="ProC-container-3">

                <div className="ProC-container-3-1">

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    {(target === 'NPU') ? 'DBG SIZE' : 'FLASH'}
                  </span>

                  <span style={{ color: '#FFFFFF', fontSize: '18px' }}>
                    {(target === 'NPU') ? dbgSize : flashValue}
                  </span>

                </div>

              </div>

            </div>

          </div>

        </div>

        <div className="profiling-container-2">

          <div className="AVC-title">
            <strong>
              Accuracy Evaluation Config
            </strong>
          </div>

          <div className="AVC-container">

            {renderByConfig()}

            <div className="AVC-container-1-row">
              <div className="AVC-container-1-2">

                <div className="AVC-container-1-2-1">

                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>
                    ACCURACY
                  </div>
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>
                    {accuracyValue}
                  </div>

                </div>

              </div>
              <div className="AVC-container-1-2" style={{ backgroundColor: '#bbae79' }}>

                <div className="AVC-container-1-2-1">

                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>
                    COSINE SIMILARITY
                  </div>
                  <div style={{ color: '#FFFFFF', fontSize: '22px' }}>
                    {cosineSimilarity}
                  </div>

                </div>

              </div>
            </div>

          </div>

          <div className="AVC-container-2">
            <CommonCard
              title={'Evaluation Data'}
              width={'50vw'}
              chartChange={tableChange}
              children={<ProValidation
                profilingValidationData={proValidationCfgData}
                overflowX={sharedTableConfig.overflowX}
                target={target}
              />} />
            <CommonCard
              title={'Probability Density Histogram'}
              chartChange={chartChange}
              width={'37vw'}
              children={profilingCfgData.length > 0 ? <ProfilingGraph
                width={sharedChartConfig.width}
                height={sharedChartConfig.height}
                overflowX={sharedChartConfig.overflowX}
                profilingGraphData={profilingCfgData}
              />
                : <Empty style={{ height: '300px' }} />} />
          </div>

        </div>

      </div>

      <div className="PV-bt">
        <Button className="performance-Verification Jg-bt" type="primary" onClick={openResultModal}>
          Summary of Results
        </Button>
        <PopUp />

      </div>

    </div>
  );
}
export default Benchmark;