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
import { vscode } from '@src/frontEnd/index';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { Message, FileNameMsg } from '@src/backEnd/interface/api';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { RadioChangeEvent, TableColumnsType, PaginationProps } from 'antd';
import React, { useEffect, useState } from 'react';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Button, Radio, Table, Pagination } from 'antd';
import { notify } from '../common';
import { updateEntity } from '../core/store/actions';
import { IStore } from '../core/store/store';
import { useCustomModal, CustomModal } from '../hooks/useCustomModal';
import '../a-styles/app.css';
import NewModelIcon from '../../../resources/selectModel/NewModelIcon.svg';
import TrashIcon from '../../../resources/selectModel/TrashIcon.svg';
import { handleUnit, timeToDate } from '../util';
import { useImageInfo } from '../component/ImageInfo';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux';

const STATUS = 1;
interface historyInfoInterface {
  source: Source;
  icon: string;
  modelName: string;
  contentLength: string;
  updateTime: string;
}
interface historyDataType {
  key: React.Key;
  name: historyInfoInterface;
  age: number;
}

// 首页Select Model
function SelectModel(props: { target: Target; source: Source }): React.JSX.Element {
  const { target, source } = props;

  const navigate = useNavigate();
  const [sortType, setSortType] = useState([
    { type: 'Date', active: true },
    { type: 'Name', active: false },
    { type: 'Size', active: false },
  ]);
  const [model, setModel] = useState('Date');
  const [sortBy, setSortBy] = useState(true);
  const historyInfoData = useSelector((state: any) => state.entities.historyInfoData);
  const themeData = useSelector((state: any) => state.entities.themeData);
  const [serverHost, setServerHost] = useState(window.initialData?.kind);
  const borderColor = themeData === 'dark' || (!themeData && serverHost === 2) ? '#2b2b2b' : '#d9d9d9';

  const handleModelChange = ({ target: { value } }: RadioChangeEvent): void => {
    const newSortType = sortType?.map(item => {
      return {
        ...item,
        active: item.type === value ? true : false,
      };
    });
    setSortBy(true);
    setModel(value);
    setSortType(newSortType);
    sortMsgInfo(value);
    setTimeout(() => {
      setCurrent(1);
      queryData(1);
    }, 500);
  };
  const sortMsgInfo = (val: string, sortByInfo?: string): void => {
    // 处理排序
    const sortHistoryMessage: Message = {
      method: ApiMethod.SORT_SELECT_MODEL_HISTORY_INFO,
      params: {
        sortType: val,
        sortByInfo: sortByInfo ?? 'desc',
      },
    };
    vscode.postMessage(sortHistoryMessage);
  };
  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(0);
  const [tableData, setTableData] = useState([]);

  const onChange: PaginationProps['onChange'] = (page) => {
    setCurrent(page);
    queryData(page);
  };
  const columns: TableColumnsType<historyDataType> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (tags: historyInfoInterface) => (
        <div className="config-card" style={{ background: 'none' }}>

          <div className="avatar" aria-hidden="true">
            <img src={tags.icon} alt="icon" style={{ width: '32px', height: '32px' }} />
          </div>

          <div className="cf-c">

            <h2 className="sub-title">
              {target === 'NPU' && <span style={{ fontSize: '14px' }}>{tags.modelName} (on {tags.source === 'linux' || !tags.source ? 'Linux' : 'WSL'}) </span>}
              {target === 'CPU' && <span style={{ fontSize: '14px' }}>{tags.modelName} (on {tags.source === 'linux' || !tags.source ? 'Linux' : 'Windows'}) </span>}
            </h2>

            <h2 className="sub-title">
              <span style={{ color: '#808080', fontSize: '12px' }}>Current Size: {tags.contentLength}</span>
            </h2>

            <h2 className="sub-title">
              <span style={{ color: '#808080', fontSize: '12px' }}>Last modified: {tags.updateTime}</span>
            </h2>

          </div>
        </div>
      ),
    },
    {
      title: 'time',
      dataIndex: 'time',
      align: 'right',
      render: (val: any, record: historyDataType) => (<div className="Next-bt">
        <img onClick={(): void => deleteData(val)} src={TrashIcon} alt="icon" style={{ cursor: 'pointer', width: '20px', height: '20px' }} />
        <Button className="Next" type="primary" onClick={(): void => handleNextClick(val, record.name.modelName)}>
          Next
        </Button>
      </div>),
    },
  ];

  const handleNextClick = (val: any, modelName: string): void => {
    // Set current working cache directory.
    IStore.getStore().dispatch(updateEntity('selectedFileName', modelName));
    const historyMessage: Message = {
      method: ApiMethod.SET_CURRENT_MODEL_HISTORY,
      params: { timeStamp: val, target: target },
    };
    vscode.postMessage(historyMessage);
    clearReduxSaveId();
  };

  const clearReduxSaveId = (): void => {
    const ZERO = 0;
    IStore.getStore().dispatch(updateEntity('lastQuantTS', ZERO));
    IStore.getStore().dispatch(updateEntity('lastConvertTS', ZERO));
    IStore.getStore().dispatch(updateEntity('lastDeployTS', ZERO));
    IStore.getStore().dispatch(updateEntity('lastProfTS', ZERO));
    IStore.getStore().dispatch(updateEntity('importProValidationCallbackData', []));
    IStore.getStore().dispatch(updateEntity('importProGraphCallbackData', []));
  };

  const queryData = (page?: number): void => {
    const historyMessage: Message = {
      method: ApiMethod.GET_SELECT_MODEL_HISTORY_INFO,
      params: {
        page: page ?? 1,
      },
    };
    vscode.postMessage(historyMessage);
  };

  const { openModal, closeModal, modalOpen, config } = useCustomModal();
  const handleOk = (val: any): void => {
    closeModal();
    const deleteHistoryMessage: Message = {
      method: ApiMethod.DELETE_SELECT_MODEL_HISTORY_INFO,
      params: {
        timeStamp: val,
      },
    };
    vscode.postMessage(deleteHistoryMessage);
    setTimeout(() => {
      setCurrent(1);
      queryData();
    }, 500);
  };
  const handleCancel = (): void => {
    closeModal();
  };

  const deleteData = (val: any): void => {
    openModal({
      title: 'Info',
      content: 'Are you sure you want to delete the selected data?',
      okText: 'Delete',
      okBtnProps: { danger: true },
      onOK: (): void => handleOk(val),
      onCancel: handleCancel,
    });
  };

  // 挂载
  useEffect(() => {
    sortMsgInfo('Date');
    queryData();
  }, []);

  useEffect(() => {
    if (historyInfoData) {
      const { data, totalData } = historyInfoData;
      setTotal(totalData);
      const tableDataInfo = data.map((item: any) => {
        return {
          name: {
            ...item,
            contentLength: handleUnit(item.contentLength),
            updateTime: timeToDate(item.updateTime),
            icon: useImageInfo(item.modelName),
          },
          time: item.updateTime,
        };
      });
      setTableData(tableDataInfo);
    } else {
      setTotal(0);
      setTableData([]);
    }
  }, [historyInfoData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      if (msg.type === 'modelChosen') { // selected a new model.
        const { fileName } = msg.params;
        IStore.getStore().dispatch(updateEntity('selectedFileName', fileName));
      }

      // Connected to remote server.
      if (msg.type === 'Connected') {
        const filePickMsg: Message = {
          method: ApiMethod.SHOW_FILE_PICKER,
          params: { type: 'remoteNewModel' },
        };
        vscode.postMessage(filePickMsg);
      }

      // WSL ready.
      if (msg.type === 'WSLReady') {
        const filePickMsg: Message = {
          method: ApiMethod.SHOW_FILE_PICKER,
          params: { type: 'wslNewModel' },
        };
        vscode.postMessage(filePickMsg);
      }

      if (msg.type === 'Error') {
        const errorMsg = `${msg.params?.description || ''}`;
        notify(errorMsg, { type: 'error', stack: false, duration: 1.5 });
      }

      if (msg.type === 'AllDone') {
        const realSource = msg.params.source;
        const skipQuantize = Boolean(msg.params?.skipQuantize);

        if (skipQuantize) {
          // 1156e: quantize step is auto-completed; navigate directly to Convert.
          // Ensure Quantize (index 1) always shows 'finish' regardless of msg.data.
          const base: string[] = Array.isArray(msg.data) ? [...msg.data] : ['finish', 'finish', 'process', 'wait', 'wait'];
          base[1] = 'finish';
          IStore.getStore().dispatch(updateEntity('navbarStatus', base));
          IStore.getStore().dispatch(updateEntity('skipQuantize', true));
        } else {
          if (msg.data) {
            IStore.getStore().dispatch(updateEntity('navbarStatus', msg.data));
          } else {
            IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'process', 'wait', 'wait', 'wait']));
          }
        }

        if (realSource === 'linux') {
          IStore.getStore().dispatch(updateEntity('isConnected', true));
        }

        if (skipQuantize) {
          IStore.getStore().dispatch(updateEntity('nowStatus', 2)); // 2 = CONVERT
          navigate('/convert', { state: { params: msg } });
        } else {
          IStore.getStore().dispatch(updateEntity('nowStatus', STATUS)); // STATUS = 1 = COMPRESSION
          navigate('/quantize', { state: { params: msg } });
        }
      }

      // Connect to remote server through 'New Model'.
      if (msg.type === 'ConnectToRemote') {
        vscode.postMessage({
          type: 'newmodel',
          method: ApiMethod.CONNECT_TO_SERVER,
          params: { target, source },
        });
      }

      // Connect to WSL through 'New Model'.
      if (msg.type === 'ConnectToWsl') {
        vscode.postMessage({
          type: 'newmodel',
          method: ApiMethod.CONNECT_TO_WSL,
        });
      }

      // Do everything locally. Do this for consistency.
      if (msg.type === 'LocalNewModel') {
        vscode.postMessage({
          method: ApiMethod.SHOW_FILE_PICKER,
          params: { type: 'localNewModel' },
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, target, source]);

  const handleNewModelClick = (): void => {
    clearReduxSaveId();
    vscode.postMessage({ method: 'newModelPicker', target });
  };

  const handleSortBy = (): void => {
    const nowSort = !sortBy;
    const sortWays = nowSort ? 'desc' : 'asc';
    setSortBy(nowSort);
    sortMsgInfo(model, sortWays);
    setTimeout(() => {
      setCurrent(1);
      queryData(1);
    }, 500);
  };

  return (
    <div className="navigation">

      <div className="c-container">

        <div className="cc-container">

          <div className="cc-title">
            <span style={{ fontSize: '17px', fontWeight: 'bold' }}>
              Model Library
            </span>
          </div>

          <div className="ccc">

            <div className="Nm-bt">
              <Button className="Nm" type="primary" onClick={handleNewModelClick}>
                <img src={NewModelIcon} alt="icon" style={{ width: '13px', height: '13px' }} />
                Import Model
              </Button>
            </div>

            <h2 className="subtitle">
              <span style={{ fontSize: '13px', margin: '1px', color: '#808080' }}>
                {target === 'NPU' ? 'Click here to open a file browser. Supported file formats include .onnx, .pt, .pth.' : 'Click here to open a file browser. Supported file formats include .onnx, .tflite.'}
              </span>
            </h2>

            <h2 className="subtitle">
              <span style={{ display: 'flex', color: '#808080', fontSize: '12px', margin: '1px' }}>Max file size: 256 M<p>B</p></span>
            </h2>

          </div>

        </div>

        <div className="cc1-container">

          <div className="SQM">

            <span style={{ fontSize: '17px', fontWeight: 'bold' }}>
              History Files
            </span>

            <div className="DNS-bt">
              <Radio.Group value={model} defaultValue="a" buttonStyle="solid" onChange={handleModelChange}>
                {
                  sortType.map(item => {
                    const arrow = <span
                      onMouseDown={handleSortBy}
                      style={{ marginLeft: '0', cursor: 'pointer' }}
                    >
                      {sortBy ? <span className='select-model-btn'><ArrowDownOutlined style={{ fontSize: '16px' }} /></span> : <span className='select-model-btn'><ArrowUpOutlined style={{ fontSize: '16px' }} /></span>}
                    </span>;
                    return (
                      <Radio.Button key={item.type} value={item.type} style={{ fontSize: '14px', border: `1px solid ${borderColor}`, boxShadow: 'none' }}>{item.type} {item.active ? arrow : ''}</Radio.Button>
                    );
                  })
                }
              </Radio.Group>

            </div>

          </div>
          <div className="config-cards">
            <Table<historyDataType>
              columns={columns}
              bordered={false}
              dataSource={tableData}
              showHeader={false}
              pagination={false}
            />
          </div>
          <div style={{ textAlign: 'right', width: '100%' }}>
            <Pagination
              className="select-model-pagination"
              current={current}
              pageSize={5}
              showSizeChanger={false}
              onChange={onChange}
              total={total} />
          </div>

        </div>

      </div>
      <CustomModal
        open={modalOpen}
        config={config}
        onClose={closeModal}
      />
    </div>
  );
}
export default SelectModel;