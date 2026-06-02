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

import { Popover, Table, Space } from 'antd';
import type { TableProps } from 'antd';
import React, { useState, useEffect } from 'react';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { Message } from '@src/backEnd/interface/api';
import { vscode } from '../..';
import '../../a-styles/app.css';
import '../../a-styles/History.css';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCustomModal, CustomModal } from '../../hooks/useCustomModal';
import { updateEntity } from '../../core/store/actions';
import { IStore } from '../../core/store/store';
import { handleUnit, timeToDate, handleAscDesc } from '../../util';
import deleteIcon from '../../../../resources/selectModel/TrashIcon.svg';
import DownIcon from '../../../../resources/button/down.svg';
import { ImageInfo } from '@src/frontEnd/component/ImageInfo';
import AscImage from '../../../../resources/Image/asc.svg';
import DescImage from '../../../../resources/Image/desc.svg';
import { useNavigate } from 'react-router-dom';

type TableRowSelection<T extends object = object> = TableProps<T>['rowSelection'];
export interface Row {
  key?: number;
  trailId?: number;
  modelName?: string;
  contentLength?: string;
  lastModified?: string;
  accuracy?: string;
  avgSim?: string;
  mse?: string;
  ram?: string;
  flash?: string;
  time?: string;
  dtype?: string;
  accuracyChange?: string;
  quant?: string;
};

interface HistoryProps {
  header?: string;
  accuracy?: boolean;
  activeTab?: string;
  mse?: boolean;
  operation?: boolean;
  target: string;
  nextPage: string;
  time?: boolean;
  columnsDate?: boolean;
  selectParams?: string | number | boolean | object;
  isModal?: boolean;
  rowSelections?: any;
};

const CPU_COLUMN = ['trailId', 'name', 'accuracy', 'avgSim', 'mse', 'ram', 'flash'];
const NPU_COLUMN = ['trailId', 'name', 'accuracy', 'avgSim', 'mse', 'exeomSize', 'dbgSize'];
const STEP_STATUS2 = 2;
const STEP_STATUS3 = 3;
const DEFAULT_PARAM = 11111;

export default function History({ activeTab = 'QAT', header, target, selectParams = DEFAULT_PARAM,
  accuracy = true, mse = true, operation = true, time = false, columnsDate = false,
  rowSelections, isModal, nextPage }: HistoryProps): React.JSX.Element {
  const compHistoryData = useSelector((state: any) => state.entities.compHistoryData);
  const convHistoryData = useSelector((state: any) => state.entities.convHistoryData);
  const profHistoryData = useSelector((state: any) => state.entities.profHistoryData);
  const lastQuantTS = useSelector((state: any) => state.entities.lastQuantTS);
  const lastConvertTS = useSelector((state: any) => state.entities.lastConvertTS);
  const qatEnabled = useSelector((state: any) => state.entities.qat);
  const navigate = useNavigate();
  const columns: TableProps<Row>['columns'] = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: (<>
        Trail<br />
        ID
      </>),
      dataIndex: 'trailId',
      key: 'trailId',
    },
    {
      title: (
        <>
          Model<br />
          Name
        </>
      ),
      dataIndex: 'name',
      key: 'name',
      render: (_, record): any => {
        let finalDtype;
        if (target === 'NPU') {
          finalDtype = record.dtype ?? 'float32';
        } else {
          // CPU通路点击Quantize时quant的值为'1'，点击Next Without Quantization时quant的值为'0'
          finalDtype = record.quant === '1' ? 'int8' : 'float32';
        }
        return (<Space size="middle">
          <ImageInfo modelName={record.modelName} />
          <div className="model-cell__text">
            <Popover content={handleModelName(record.modelName, finalDtype)} placement="topLeft" trigger="hover">
              <div className="model-cell__name hover">
                {
                  ((): string => {
                    return handleModelName(record.modelName, finalDtype);
                  })()
                }
              </div>
            </Popover>
            <div className="model-cell__meta">
              Last modified: {record.lastModified}
            </div>
          </div>
        </Space>);
      },
    },
    {
      title: (
        <>
          Accuracy
        </>
      ),
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (_, record) => (
        <Space size="middle">
          <div>
            {handleAscDesc(record?.accuracyChange ?? '----') !== '-' && (<span>
              {record.accuracy}({record.accuracyChange?.slice(1)}<img src={handleAscDesc(record?.accuracyChange ?? '----') === 'asc' ? AscImage : DescImage} alt="descAscImage " />)
            </span>)}
            {handleAscDesc(record?.accuracyChange ?? '----') === '-' && record.accuracy}
          </div>
        </Space>
      ),
    },
    {
      title: (
        <>
          Cosine<br />
          Similarity
        </>
      ),
      key: 'avgSim',
      dataIndex: 'avgSim',
    },
    {
      title: 'MSE',
      key: 'mse',
      dataIndex: 'mse',
    },
    {
      title: nextPage === 'none' ? 'RAM' : 'RAM(KB)',
      key: 'ram',
      dataIndex: 'ram',
    },
    {
      title: nextPage === 'none' ? 'Flash' : 'Flash(KB)',
      key: 'flash',
      dataIndex: 'flash',
    },
    {
      title: (
        <>
          Model<br />
          Size(KB)
        </>
      ),
      key: 'exeomSize',
      dataIndex: 'exeomSize',
    },
    {
      title: (
        <>
          Dbg<br />
          Size(KB)
        </>
      ),
      key: 'dbgSize',
      dataIndex: 'dbgSize',
    },
    {
      title: 'Operation',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <div className="col col-ops" style={{ marginRight: '10px' }}>
            <img
              src={DownIcon}
              alt="arrow"
              className='rt-icon-load'
              onClick={(): void => handleDownload(record)}
            />
            <img
              src={deleteIcon}
              alt="arrow"
              onClick={(): void => handleDeleteMsg(record)}
              className='rt-icon-class'
            />
            {nextPage !== 'none' ? (
              <NavLink to={nextPage} state={{ params: { data: selectParams } }} onClick={(): void => toNextStep(nextPage, record)}>
                <button className="left-bt">Next</button>
              </NavLink>
            ) : (
              <button className="left-bt">Next</button>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: (
        <>
          Inference<br />
          Time
        </>
      ),
      key: 'time',
      dataIndex: 'time',
      render: (_, record) => (
        <span>{record.time}</span>
      ),
    },
  ];
  const [tableData, setTableData] = useState<Row[]>([]);
  const querycompHistoryData = (): void => {
    setSelectedRowKeys([]);
    setTableData([]);
    const historyMessage: Message = {
      method: ApiMethod.GET_COMPRESSION_HISTORY_INFO,
    };
    vscode.postMessage(historyMessage);
  };
  const handleModelName = (name: any, dtype: any): any => {
    if (typeof name !== 'string') {
      return '';
    }
    const nameArr = name.split('.');
    if (nameArr.length > 1) {
      return `${nameArr[0]}_${dtype}.${nameArr[1]}`;
    }
    return name;
  };
  const queryConvertData = (): void => {
    setSelectedRowKeys([]);
    setTableData([]);
    const historyMessage: Message = {
      method: ApiMethod.GET_CONVERT_HISTORY_INFO,
    };
    vscode.postMessage(historyMessage);
  };
  const queryData = (): void => {
    if (nextPage === '../convert') {
      querycompHistoryData();
    } else if (nextPage === '../deploy') {
      queryConvertData();
    }
  };
  useEffect(() => {
    queryData();
  }, []);
  useEffect(() => {
    const handleDataUpdate = (event: MessageEvent): void => {
      const msg = event.data;
      if (msg.type === 'UpdateHistory') {
        querycompHistoryData();
      }
      if (msg.type === 'UpdateConvertHistory') {
        queryConvertData();
      }
      if (msg.type === 'UpdateModelStatus') {
        IStore.getStore().dispatch(updateEntity('navbarStatus', msg.data));
      }
      if (msg.type === 'UpdateSkipHistory') {
        const { timeStamp } = msg?.params ?? {};
        updateLastTs('../convert', timeStamp);
        IStore.getStore().dispatch(updateEntity('lastQuantTS', timeStamp));
        IStore.getStore().dispatch(updateEntity('lastConvertTS', 0));
        IStore.getStore().dispatch(updateEntity('lastDeployTS', 0));
        IStore.getStore().dispatch(updateEntity('nowStatus', STEP_STATUS2));
        navigate('/convert');
      }
    };
    window.addEventListener('message', handleDataUpdate);
    return () => window.removeEventListener('message', handleDataUpdate);
  }, []);

  const newColumns = columns.map((item) => {
    let checkedList = target === 'NPU' ? NPU_COLUMN : CPU_COLUMN;
    if (nextPage === 'none') {
      checkedList = [...CPU_COLUMN, 'time'];
    }
    if (item.key === 'accuracy') {
      return {
        ...item,
        className: !accuracy ? 'hidden' : '',
      };
    } else if (item.key === 'mse') {
      return {
        ...item,
        className: !mse ? 'hidden' : '',
      };
    } else if (item.key === 'action') {
      return {
        ...item,
        className: !operation ? 'hidden' : '',
      };
    } else if (item.key === 'time') {
      let str = !time ? 'hidden' : '';
      return {
        ...item,
        className: str,
      };
    } else if (item.key === 'date') {
      return {
        ...item,
        className: !columnsDate ? 'hidden' : '',
      };
    } else {
      return {
        ...item,
        className: !checkedList.includes(item.key as string) ? 'hidden' : '',
      };
    }
  });
  useEffect(() => {
    if (profHistoryData && nextPage === 'none') {
      const { data } = profHistoryData;
      setTableDataFunc(data);
    }
  }, [profHistoryData]);

  useEffect(() => {
    if (compHistoryData && nextPage === '../convert') {
      const { data } = compHistoryData;
      setTableDataFunc(data);
    }
  }, [compHistoryData, nextPage]);

  useEffect(() => {
    if (convHistoryData && nextPage === '../deploy') {
      const { data } = convHistoryData;
      setTableDataFunc(data);
    }
  }, [convHistoryData, nextPage]);

  const setTableDataFunc = (data: any): void => {
    if (data?.length) {
      data.sort((a: any, b: any) => b.updateTime - a.updateTime);
      const tableDataInfo = data.map((item: any, index: number) => {
        let ram = item.ram;
        let flash = item.flash;
        if (nextPage !== 'none') {
          ram = item.ram !== '----' && item.ram ? (Number(item.ram) / 1024).toFixed(2) : '----';
          flash = item.flash !== '----' && item.flash ? (Number(item.flash) / 1024).toFixed(2) : '----';
        }
        return {
          ...item,
          trailId: index + 1,
          key: item.updateTime,
          avgSim: item.avgSim !== '----' && item.avgSim ? (item.avgSim).toFixed(6) : item.avgSim,
          mse: item.mse !== '----' && item.mse ? (item.mse).toFixed(6) : item.mse,
          contentLength: handleUnit(item.contentLength),
          updateTime: timeToDate(item.updateTime),
          lastModified: timeToDate(item.updateTime),
          // 内联处理ram
          ram,
          // 内联处理flash
          flash,
          dbgSize: item.dbgSize ?? '----',
          exeomSize: item.exeomSize ?? '----',
        };
      });
      setTableData(tableDataInfo);
      if (nextPage !== 'none') {
        // 存储当前的quantid  当前的convertId
        let selecKey = tableDataInfo[0].key;
        if (lastQuantTS && nextPage === '../convert') {
          selecKey = parseInt(lastQuantTS);
        } else if (lastConvertTS && nextPage === '../deploy') {
          selecKey = parseInt(lastConvertTS);
        }
        updateLastTs(nextPage, selecKey);
        const loaddingTableRow = tableDataInfo.filter((item: any) => item.key === selecKey)[0] ?? {};
        setSelectedRowKeys([selecKey]);
        getCompressDataConfig(loaddingTableRow);
      }
    } else {
      if (nextPage === '../convert') {
        IStore.getStore().dispatch(updateEntity('lastQuantTS', 0));
        IStore.getStore().dispatch(updateEntity('lastConvertTs', 0));
      } else if (nextPage === '../deploy') {
        IStore.getStore().dispatch(updateEntity('lastConvertTs', 0));
      }
      setSelectedRowKeys([]);
      setTableData([]);
    }
  };

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const rowSelection: TableRowSelection<Row> = {
    type: 'radio',
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys);
    },
    onSelect: (record, selected) => {
      if (selected && nextPage !== 'none') {
        // 发送消息  获取配置重新生成图跟compressdata;
        getCompressDataConfig(record);
      }
    },
  };
  // 行点击事件（增强点击区域）
  const onRow = (record: any): any => ({
    onClick: (e: any): void => {
      if (e?.target.nodeName === 'IMG') { // 点击删除和下载时不选中当前数据
        return;
      }
      setSelectedRowKeys([record.key]);
      if (nextPage !== 'none') {
        // 发送消息  获取配置重新生成图跟compressdata;
        getCompressDataConfig(record);
      }
    },
    style: { cursor: 'pointer' },
  });

  const getCompressDataConfig = (val: any): void => {
    const historyMessage: Message = {
      method: ApiMethod.GET_COMPRESSION_DATA_CONFIG,
      params: {
        timeStamp: val.key,
        preUUId: val.quantUUId ?? '',
        target,
        nextPage,
        activeTab,
      },
    };
    vscode.postMessage(historyMessage);
  };

  const deletecompHistoryData = (val: any): void => {
    const historyMessage: Message = {
      method: ApiMethod.DELETE_OMPRESSION_HISTORY_INFO,
      params: {
        timeStamp: val.key,
      },
    };
    vscode.postMessage(historyMessage);
    setTimeout(() => {
      querycompHistoryData();
    }, 500);
  };
  const deleteConvertData = (val: any): void => {
    const historyMessage: Message = {
      method: ApiMethod.DELETE_CONVERT_HISTORY_INFO,
      params: {
        timeStamp: val.key,
      },
    };
    vscode.postMessage(historyMessage);
    setTimeout(() => {
      queryConvertData();
    }, 500);
  };
  // 保存当前点击的内容  
  const handleDeleteMsg = (val: any): void => {
    openModal({
      title: 'Info',
      content: 'Are you sure you want to delete the selected data?',
      okText: 'Delete',
      okBtnProps: { danger: true },
      onOK: (): void => handleOk(val),
      onCancel: handleCancel,
    });
  };
  const updateLastTs = (val: any, nowKey: any): void => {
    const updateLastConvertTSMessage: Message = {
      method: ApiMethod.UPDATE_LAST_TS,
      params: {
        timeStamp: nowKey,
        page: val === '../convert' ? 'lastQuantTS' : 'lastConvertTS',
      },
    };
    vscode.postMessage(updateLastConvertTSMessage);
  };

  const toNextStep = (val: string, record: any): void => {
    updateLastTs(val, record.key);

    if (val === '../convert') {
      IStore.getStore().dispatch(updateEntity('lastQuantTS', record.key));
      IStore.getStore().dispatch(updateEntity('lastConvertTS', 0));
      IStore.getStore().dispatch(updateEntity('lastDeployTS', 0));
      IStore.getStore().dispatch(updateEntity('nowStatus', STEP_STATUS2));
      if (target === 'NPU' && qatEnabled) {
        // update compressionData.
        const updateQuantMsg: Message = {
          method: ApiMethod.UPDATE_CONFIG,
          params: { target: 'NPU', stage: 'quant' },
        };
        vscode.postMessage(updateQuantMsg);
      }

      if (target === 'NPU' && !qatEnabled) {
        // update convertData.
        const updateQuantMsg: Message = {
          method: ApiMethod.UPDATE_CONFIG,
          params: { target: 'NPU', stage: 'convert', lastQuantTS: record.key },
        };
        vscode.postMessage(updateQuantMsg);
      }
    } else {
      IStore.getStore().dispatch(updateEntity('lastConvertTS', record.key));
      IStore.getStore().dispatch(updateEntity('lastDeployTS', 0));
      IStore.getStore().dispatch(updateEntity('nowStatus', STEP_STATUS3));
    }
  };
  const handleDownload = (val: any): void => {
    const timestamp = val.key;
    const chipMessage: Message = {
      method: ApiMethod.DOWNLOAD_OUTPUTS,
      params: { target, nextPage, timestamp },
    };
    vscode.postMessage(chipMessage);
  };
  const { openModal, closeModal, modalOpen, config } = useCustomModal();
  const handleOk = (val: any): void => {
    closeModal();
    if (Object.keys(val).length > 0) {
      if (nextPage === '../convert') {
        if (val.key === parseInt(lastQuantTS)) {
          IStore.getStore().dispatch(updateEntity('lastQuantTS', 0));
        }
        deletecompHistoryData(val);
      } else if (nextPage === '../deploy') {
        if (val.key === parseInt(lastConvertTS)) {
          IStore.getStore().dispatch(updateEntity('lastConvertTS', 0));
        }
        deleteConvertData(val);
      }
    }
  };
  const handleCancel = (): void => {
    closeModal();
  };
  return (
    <section className="history">
      <div className="history-table-info">
        <Table<Row> rowKey="key" onRow={onRow} rowSelection={rowSelections ? rowSelections : rowSelection} columns={newColumns} dataSource={tableData} pagination={false} />
      </div>
      <CustomModal
        open={modalOpen}
        config={config}
        onClose={closeModal}
      />
    </section>
  );
}