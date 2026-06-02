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
import * as React from 'react';
import { Row, Col, Modal, Space, Input, Button, Table, Tooltip, Spin, Empty, ConfigProvider } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState, useRef } from 'react';
import { getInfo, sendProjectData, showWarnMsg } from '../actions';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { SyncOutlined, FolderOpenOutlined } from '@ant-design/icons';
import Progerss from '../component/progress';
import ImportProjectSvg from '../costomIcons/importProjectIcon';
import ErrSvg from '../costomIcons/errIcon';
import Drag from '../component/drag';
let drag: Drag | undefined;

interface DataType {
  key: React.Key;
  name: string;
  path: string;
  disabled: boolean;
};

let myObserver: any = null;
let gTableHeight: number = 0;
const App = (): JSX.Element => {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [importableItems, setImportableItems] = useState<any>([]);
  const [importPath, setImportPath] = useState('');
  const [spin, setSpin] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState('');
  const [progressDisplay, setProgressDisplay] = useState(false);
  const [interruptSpin, setInterruptSpin] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [hiprojDupDirDict, setHiprojDupDirDict] = useState<any>({});
  const [importWrongInfoModalFlag, setImportWrongInfoModalFlag] = useState(false);
  const [importWrongInfoArr, setImportWrongInfoArr] = useState<any[]>([]);

  const importableItemsInfo: any = useSelector((state: any) => state.entities.importableItemsInfo);
  const progressPercent: any = useSelector((state: any) => state.entities.progressPercent);
  const proDisplay: any = useSelector((state: any) => state.entities.progressDisplay);
  const key: any = useSelector((state: any) => state.entities.key);
  const importablePath: any = useSelector((state: any) => state.entities.importablePath);
  const killImportFinished: any = useSelector((state: any) => state.entities.killImportFinished);
  const userConfig: any = useSelector((state: any) => state.entities.userConfig);
  const importWrongInfoOpen: any = useSelector((state: any) => state.entities.importWrongInfoOpen);
  const importWrongInfoClose: any = useSelector((state: any) => state.entities.importWrongInfoClose);
  const importWrongInfoContent: any = useSelector((state: any) => state.entities.importWrongInfoContent);

  const tableRef = useRef<any>(null);
  const tableMinHeight = 100; // table的最小高度
  const [tableHeight, setTableHeight] = useState(300);

  const operateData: any = {
    operationType: '',
    paramData: '',
    source: 'import',
  };

  useEffect(() => {
    setImportWrongInfoModalFlag(true);
  }, [importWrongInfoOpen]);

  useEffect(() => {
    setImportWrongInfoModalFlag(false);
  }, [importWrongInfoClose]);

  useEffect(() => {
    if (importWrongInfoContent) {
      const { importFailedArr, importSuccessArr } = importWrongInfoContent;
      if (Array.isArray(importFailedArr) && Array.isArray(importSuccessArr)) {
        setImportWrongInfoArr([...importFailedArr, ...importSuccessArr]);
      }
    }
  }, [importWrongInfoContent]);

  useEffect(() => {
    if (isModalOpen) {
      if (!drag) {
        drag = new Drag('ant-modal', 'ant-modal-header', 0);
        drag.init();
      }
    }
  }, [isModalOpen]);

  useEffect(() => {
    operateData.operationType = 'getLanguage';
    dispatch(getInfo(operateData));
    operateData.operationType = 'getUserConfig';
    operateData.paramData = '';
    dispatch(getInfo(operateData));
  }, [dispatch]);

  useEffect(() => {
    if (userConfig?.projectImport_last_importPath) {
      setImportPath(userConfig.projectImport_last_importPath);
      refreshProjList(userConfig.projectImport_last_importPath);
    }
  }, [userConfig]);

  useEffect(() => {
    resizeObserver();
  }, []);

  useEffect(() => {
    if (killImportFinished) {
      setInterruptSpin(false);
    }
  }, [killImportFinished]);

  const resizeObserver = (): void => {
    myObserver = new ResizeObserver((entries: any) => {
      try {
        const [
          {
            contentRect: { height },
          },
        ] = entries;
        gTableHeight = height - (2 * (document.getElementsByClassName('content').length > 0
          ? document.getElementsByClassName('content')[0].clientHeight
          : 0)) - (3 * (document.getElementsByClassName('footerBar').length > 0
            ? document.getElementsByClassName('footerBar')[0].clientHeight
            : 0));
        const lastHeight = gTableHeight < tableMinHeight ? tableMinHeight : gTableHeight;
        setTableHeight(lastHeight);
      } catch (error) {
        // If an error occurs during a resize, skip the resize.
      }
    });
    myObserver.observe(tableRef.current);
  };

  useEffect(() => {
    if (importableItemsInfo && !interruptSpin) {
      setImportPath(importableItemsInfo?.importPath);
      setImportableItems(getDataSource(importableItemsInfo?.importableItems));
      setHiprojDupDirDict(importableItemsInfo?.hiprojDupDirDict);
    }
    if (importableItemsInfo) {
      setProgress(100);
      setTimeout(() => {
        setSpin(false);
        setProgressDisplay(false);
      }, 600);
    }
  }, [importableItemsInfo]);

  useEffect(() => {
    setImportPath(importablePath);
  }, [importablePath]);

  useEffect(() => {
    if (proDisplay) {
      setProgress(proDisplay?.progress);
      setProgressDisplay(proDisplay?.display);
    }
  }, [proDisplay]);

  useEffect(() => {
    if (progressPercent) {
      setProgress(progressPercent?.percent > 100 ? 100 : progressPercent?.percent);
      setProgressInfo(progressPercent?.currentPath);
    }
  }, [progressPercent]);

  useEffect(() => {
    if (importableItems?.length === 1 && importableItems[0]?.disabled === false) {
      setSelectedRowKeys([importableItems[0].key]);
    } else {
      setSelectedRowKeys([]);
    }
  }, [importableItems]);

  const onBrowseProjectPathClick = (): void => {
    // sending slect folder messages to the backend
    operateData.operationType = 'obtainImportableItems';
    operateData.paramData = {
      key: 'importableItemsInfo',
      defaultPath: importPath ? importPath : '',
    };
    dispatch(getInfo(operateData));
  };

  const tableEmptyRender = (): JSX.Element => {
    return <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<></>}
    ></Empty>;
  };

  const onClickFinish = (): void => {
    // sending cancel messages to the backend
    if (selectedRowKeys.length > 0) {
      operateData.operationType = 'setProgress';
      operateData.projectData = { progress: 20 };
      dispatch(sendProjectData(operateData));

      operateData.operationType = 'confirmImport';
      operateData.projectData = importableItems.filter((item: any) => selectedRowKeys.includes(item?.key));
      dispatch(sendProjectData(operateData));

      importableItems.forEach((item: any, index: number) => {
        if (selectedRowKeys.includes(item?.key)) {
          (importableItems[index] as any).disabled = true;
        }
      });
      setImportableItems(importableItems);
      setSelectedRowKeys([]);
    } else {
      dispatch(showWarnMsg(
        {
          operationType: 'ShowWarning',
          data: { content: t('selectImportItems') },
        }
      ));
    }
  };

  const onClickCancel = (): void => {
    // close project wizard window
    setIsModalOpen(false);
    // sending cancel messages to the backend
    operateData.operationType = 'closeProjectImport';
    dispatch(sendProjectData(operateData));
  };

  const rowSelection = {
    onChange: (selRowKeys: React.Key[]): void => {
      setSelectedRowKeys(selRowKeys);
    },
    getCheckboxProps: (record: DataType): any => ({
      disabled: record.disabled, // Column configuration not to be checked
      name: record.name,
    }),
    selectedRowKeys,
    // selectedRows
  };

  const columns: ColumnsType<any> = [
    {
      title: t('name'),
      dataIndex: 'name',
      render: (text: string, record) => record.disabled ? <span style={{ color: 'gray' }}>{text}</span> : text,
    },
    {
      title: t('path'),
      dataIndex: 'path',
      render: (text: string, record) => record.disabled ? <span style={{ color: 'gray' }}>{text}</span> : text,
    },
  ];

  const refreshProjList = (paramPath?: string | undefined): void => {
    let iPath = paramPath;
    if (!iPath) {
      iPath = importPath;
    }
    setSpin(true);
    setProgress(0);
    setProgressDisplay(true);
    if (!iPath) {
      setProgress(100);
      setTimeout(() => {
        setSpin(false);
        setProgressDisplay(false);
      }, 600);
      return;
    }
    operateData.operationType = 'obtainImportableItems';
    operateData.paramData = {
      key: 'importableItemsInfo',
      path: iPath,
    };
    dispatch(getInfo(operateData));
  };

  const clickStopBtn = (): void => {
    setProgressDisplay(false);
    setInterruptSpin(true);
    setSpin(false);
    operateData.operationType = 'stopObtainImportableItems';
    dispatch(sendProjectData(operateData));
  };

  const getDataSource = (importableEle: any[]): any => {
    let result = importableEle?.map((item: any) => {
      let description;
      let disabled = true;
      if (item.disabled) {
        description = 'pathExist';
      } else if (!reg.test(item.path)) {
        description = 'pathVerification';
      } else if (item.projectType !== 'CFBB' && hiprojDupDirDict[item.dir] && hiprojDupDirDict[item.dir] > 1) {
        description = 'moreThanOneHiproj';
      } else {
        disabled = false;
      }
      return {
        key: item.path,
        path: item.path,
        name: item.name,
        disabled,
        description,
      };
    });
    return result;
  };

  const confirmImportWrnModal = (): void => {
    operateData.operationType = 'confirmImportWrnModal';
    operateData.paramData = {
      key: 'confirmImportWrnModal',
      importSuccessArr: importWrongInfoContent?.importItemArr,
    };
    dispatch(getInfo(operateData));
    setImportWrongInfoModalFlag(false);
  };

  const failedColumns = [
    {
      title: t('path'),
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      width: '12%',
    },
  ];

  const reg = /^(?:[a-zA-Z]:[\\/]|\/)(?:[^\\/\0]*[\\/]?)*([^\\/\0]*)(?:\.hiproj|\.himpw)?$/i;

  return <div ref={tableRef} className="projectBox">
    <Modal
      className="projectImport"
      title={[
        <span>
          <ImportProjectSvg />
          <span style={{ color: '#666666', marginLeft: '8px' }}>{t('projectImport')}</span>
        </span>,
      ]}
      visible={isModalOpen}
      width={960}
      footer={[
        <Space direction="horizontal" size="large">
          <div className='footerBar'>
            <Button type='primary' onClick={(): void => onClickFinish()}>
              {t('finished')}
            </Button>
            <Button onClick={(): void => onClickCancel()}>
              {t('cancel')}
            </Button>
          </div>
        </Space>,
      ]}
      onCancel={(): void => onClickCancel()}
    >
      <Spin spinning={interruptSpin}>
        <Spin spinning={progressDisplay}>
          <div className='content'>
            <strong>{t('projectImportTitle')}</strong><br />
            <span style={{ color: '#A3A3A3' }}>{t('projectImportDescription')}</span><br /><br />
            <Row>
              <Col span={4}>
                <p>{t('importPath')}</p>
              </Col>
              <Col span={16} offset={1}>
                <Input.Group compact>
                  <Input className='ant-input-text' placeholder={t('projectPathInputPrompt') ?? 'Selecting the path for storing project files'}
                    value={importPath} disabled={true} style={{ width: 'calc(100% - 37px)' }} />
                  <Button
                    className='browse'
                    type='primary'
                    style={{ paddingLeft: '10px' }}
                    onClick={(): void => onBrowseProjectPathClick()} icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
                </Input.Group>
              </Col>
            </Row>
            {t('discoveredProjects')}
            <Tooltip title={t('refresh')}>
              <span> <SyncOutlined onClick={(): void => refreshProjList()} spin={spin} /> </span>
            </Tooltip>
          </div>
          <div className='not-show-expande'>
            <ConfigProvider renderEmpty={tableEmptyRender}>
              <Table
                rowSelection={{
                  ...rowSelection,
                }}
                scroll={{ x: '100%', y: tableHeight }}
                columns={columns}
                dataSource={importableItems}
                pagination={false}
                defaultExpandAllRows={true}
                expandIconColumnIndex={-1}
                expandedRowRender={(record: any): JSX.Element => {
                  return <span>{t(record.description)}</span>;
                }}
                expandedRowKeys={importableItems?.map((item: any) => item.key)}
              />
            </ConfigProvider>
          </div>
        </Spin>
        {progressDisplay && <Progerss progress={parseInt(String(progress))} clickStopBtn={clickStopBtn} info={progressInfo} />}
      </Spin>
      <Modal
        className='projectImport import_failed_modal'
        width={920}
        title={[
          <span>
            <ErrSvg />
            <span style={{ color: '#666666', marginLeft: '8px' }}>{t('importWarning')}</span>
          </span>,
        ]}
        destroyOnClose={true}
        open={importWrongInfoModalFlag} closable={false} footer={[
          <Button type='primary' onClick={confirmImportWrnModal}
          >
            {t('confirm')}
          </Button>,
        ]}>
        <Col>{t('importWarningContent')}</Col>
        <Col>{t('importWarningHandleWay1')}</Col>
        <Col>{t('importWarningHandleWay2')}</Col>
        <Col>{t('importWarningHandleWay3')}</Col>
        <Col>
          <Table
            columns={failedColumns}
            // rowSelection={{ ...rowSelection, checkStrictly }}
            dataSource={importWrongInfoArr}
            pagination={false}
            scroll={{ x: '100%', y: tableHeight }}
            defaultExpandAllRows={true}
            indentSize={30}
          />
        </Col>
      </Modal>
    </Modal>
  </div>;
};

export default App;
