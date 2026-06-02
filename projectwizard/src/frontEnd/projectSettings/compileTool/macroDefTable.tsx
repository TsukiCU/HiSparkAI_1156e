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
import { setDocumentById } from '../setDocumentById';
import React, { useEffect, useState } from 'react';
import { Row, Button, Empty, ConfigProvider, Table, Modal, Space } from 'antd';
import Title from '../title';
import { useTranslation } from 'react-i18next';
import { clone } from '../../component/utils';
import MacroModal from './addAndEditMacro';

const MacroDefTable = (props: any): JSX.Element => {
  const { group, globalMacroDef, setGlobalMacroDef } = props;
  const { t } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [deleteModalFlag, setDeleteModalFlag] = useState<boolean>(false);
  const [globalMacroObj, setGlobalMacroObj] = useState<any>({});
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [newModalVisible, setNewModalVisible] = useState<boolean>(false);
  const [deleteAllModal, setDeleteAllModal] = useState<boolean>(false);

  const columns = [
    {
      title: t('macro'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('value'),
      dataIndex: 'value',
      key: 'value',
    },
  ];

  useEffect(() => {
    if (globalMacroDef) {
      let obj: any = {};
      try {
        obj = JSON.parse(globalMacroDef);
      } catch (e) {
        return;
      }
      setGlobalMacroObj(obj);
    }
  }, [globalMacroDef]);

  const tableEmptyRender = (): JSX.Element => {
    return <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<></>}
    ></Empty>;
  };

  const handleRowClick = (record: any): void => {
    setSelectedRowKeys([record.key]);
  };

  const getRowClassName = (record: any): string => {
    let str = 'global-macro-row:hover';
    if (selectedRowKeys.includes(record.key)) {
      return `${str} global-macro-row-selected`;
    } else {
      return `${str} strglobal-macro-row-default`;
    }
  };

  const getDataSource = (): Array<any> => {
    let result: any[] = [];
    Object.keys(globalMacroObj).forEach((key: string) => {
      result.push({
        name: key,
        value: globalMacroObj[key],
        key: key,
      });
    });
    return result;
  };

  const buttonDisabled = (): boolean => {
    if (selectedRowKeys.length === 0) {
      return true;
    };
    let exist = selectedRowKeys.some((item) => {
      return globalMacroObj[item] !== undefined;
    });
    if (!exist) {
      return true;
    }
    return false;
  };

  const deleteItems = (): void => {
    if (deleteAllModal) {
      setGlobalMacroDef(JSON.stringify({}));
    } else {
      selectedRowKeys.forEach((item) => {
        let obj = clone(globalMacroObj);
        delete obj[item];
        setGlobalMacroDef(JSON.stringify(obj));
      });
    }

    setSelectedRowKeys([]);
    setDeleteModalFlag(false);
    setDeleteAllModal(false);
  };

  const editItem = (): void => {
    setEditModalVisible(true);
    return;
  };

  const newItem = (): void => {
    setNewModalVisible(true);
    return;
  };

  const getDeleteDataSource = (): Array<any> => {
    if (deleteAllModal) {
      return getDataSource();
    } else {
      return selectedRowKeys.map(key => ({
        name: key,
        value: globalMacroObj[key],
        key: key,
      }));
    }
  };

  const createButton = (title: string, cb: () => void, disable: boolean): JSX.Element => {
    let style = {
      width: '100%',
      marginBottom: '10px',
      borderRadius: '4px',
      overflow: 'hidden',
    };
    let clickCallback = cb;
    if (disable) {
      const newStyle = {
        backgroundColor: '#f5f5f5',
        color: 'rgba(0, 0, 0, 0.25)',
        cursor: 'not-allowed',
        borderColor: '#d9d9d9',
      };
      style = Object.assign(style, newStyle);
      clickCallback = (): void => { };
    }
    return <Row>
      <Button type='primary'
        style={style}
        onClick={clickCallback}
      >
        {t(title)}
      </Button>
    </Row>;
  };

  const createAllButtons = (): Array<any> => {
    const buttonArgs: Array<[string, () => void, boolean]> = [
      ['new', (): void => newItem(), false],
      ['edit', (): void => editItem(), buttonDisabled()],
      ['delete', (): void => setDeleteModalFlag(true), buttonDisabled()],
      ['deleteAll', (): void => {
        setDeleteModalFlag(true);
        setDeleteAllModal(true);
      }, false],
    ];
    return buttonArgs.map((item: [string, () => void, boolean]) => createButton(...item));
  };

  return <>
    <div className='config-card' id={setDocumentById(group, 'global_macro_definition')}>
      <Title name={t('global_macro_definition')} description='' />
      <Row style={{ display: 'flex' }}>
        <div style={{ flex: '20', minWidth: '120px' }}>
          <ConfigProvider renderEmpty={tableEmptyRender}>
            <Table
              columns={columns}
              size='small'
              scroll={{ x: '100%', y: '700px' }}
              dataSource={getDataSource()}
              onRow={(record): any => ({
                onClick: (): void => {
                  handleRowClick(record);
                },
                className: getRowClassName(record),
              })
              }
              pagination={false}
            />
          </ConfigProvider>
        </div>
        <div style={{ flex: '3', marginLeft: '4.5%', minWidth: '100px' }}>
          {createAllButtons()}
        </div>
      </Row>
    </div>
    {editModalVisible && <MacroModal
      inputName={selectedRowKeys[0]}
      inputValue={globalMacroObj[selectedRowKeys[0]]}
      visible={editModalVisible}
      setVisible={setEditModalVisible}
      title={t('edit')}
      globalMacroObj={globalMacroObj}
      setGlobalMacroDef={setGlobalMacroDef}
    />}
    {newModalVisible && <MacroModal
      inputName={''}
      inputValue={''}
      visible={newModalVisible}
      setVisible={setNewModalVisible}
      title={t('new')}
      globalMacroObj={globalMacroObj}
      setGlobalMacroDef={setGlobalMacroDef}
    />}
    {deleteModalFlag && <Modal
      className={'macroDeleteModal'}
      destroyOnClose
      visible={deleteModalFlag}
      title={`${t('delete')} ${t('macro')}`}
      onCancel={(): void => {
        setDeleteModalFlag(false);
        setDeleteAllModal(false);
      }}
      footer={[
        <Space direction='horizontal' size='large'>
          <div className='footerBar'>
            <Button type='primary' onClick={deleteItems}>
              {t('confirm')}
            </Button>
            <Button onClick={(): void => {
              setDeleteModalFlag(false);
              setDeleteAllModal(false);
            }}>
              {t('cancel')}
            </Button>
          </div>
        </Space>,
      ]}
      width={800}
    >
      <span>{t('confirmDeletemacro')}</span>
      <ConfigProvider renderEmpty={tableEmptyRender}>
        <Table
          scroll={{ y: 400 }}
          columns={columns}
          size='small'
          dataSource={getDeleteDataSource()}
          pagination={false}
        />
      </ConfigProvider>
    </Modal>}
  </>;
};

export default MacroDefTable;