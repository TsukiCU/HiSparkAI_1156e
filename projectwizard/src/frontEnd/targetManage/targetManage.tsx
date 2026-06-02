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
import React, { useState, useEffect } from 'react';
import { Button, Table, Space, Form, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDispatch, useSelector } from 'react-redux';
import type { OperateStruct } from '../../backEnd/interface/model';
import { getInfo } from '../actions';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

interface DataType {
  key: string;
  name: string;
  partition: string;
  nv: string;
  flashBoot: string;
  loaderBoot: string;
  liteOS: string;
}

const App = (): JSX.Element => {
  const [data, setData] = useState<DataType[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState<'table' | 'add' | 'edit'>('table');
  const [editingRecord, setEditingRecord] = useState<DataType | null>(null);
  const [partitionOptions, setPartitionOptions] = useState<string[]>([]);
  const [nvOptions, setNvOptions] = useState<string[]>([]);
  const [flashBootOptions, setFlashBootOptions] = useState<string[]>([]);
  const [loaderBootOptions, setLoaderBootOptions] = useState<string[]>([]);
  const [liteOSOptions, setLiteOSOptions] = useState<string[]>([]);
  const [localDeletedTargetName, setLocalDeletedTargetName] = useState<string | null>(null);
  const [targetPreset, setTargetPreset] = useState<string[]>([]);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const targetPresetFromStore = useSelector((state: any) => state?.entities?.targetPreset);
  let targetData: DataType[] = useSelector((state: any) => state?.entities?.targetData);
  let dynamicOptions = useSelector((state: any) => state?.entities?.dynamicOptions);
  let deletedTargetName = useSelector((state: any) => state?.entities?.deletedTargetName);

  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
    source: 'target',
  };

  const columns: ColumnsType<DataType> = [
    {
      title: <span style={{ fontWeight: 'bold' }}>{t('name')}</span>,
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>{t('partition')}</span>,
      dataIndex: 'partition',
      key: 'partition',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>NV</span>,
      dataIndex: 'nv',
      key: 'nv',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>Flash Boot</span>,
      dataIndex: 'flashBoot',
      key: 'flashBoot',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>Loader Boot</span>,
      dataIndex: 'loaderBoot',
      key: 'loaderBoot',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>LiteOS</span>,
      dataIndex: 'liteOS',
      key: 'liteOS',
    },
    {
      title: <span style={{ fontWeight: 'bold' }}>{t('action')}</span>,
      key: 'action',
      render: (_, record) => {
        const isPreset = targetPreset.includes(record.name);
        return (
          <Space size="middle">
            <Button
              type="link"
              disabled={isPreset}
              onClick={() => onEdit(record)}
              className="edit-btn"
              style={{
                paddingLeft: '2px',
              }}
            >
              {t('edit')}
            </Button>
            <Button
              type="link"
              disabled={isPreset}
              onClick={() => onDelete(record.name)}
              className="delete-btn"
            >
              {t('delete')}
            </Button>
          </Space>
        );
      },
    },
  ];

  useEffect(() => {
    operateData.operationType = 'getLanguage';
    dispatch(getInfo(operateData));
    operateData.operationType = 'getTargetDataFromChipInfo';
    dispatch(getInfo(operateData));
    operateData.operationType = 'getTargetPreset';
    dispatch(getInfo(operateData));
  }, [dispatch]);

  useEffect(() => {
    if (targetData && targetData.length > 0) {
      setData(targetData);
    }
  }, [targetData]);

  useEffect(() => {
    if (targetPresetFromStore) {
      setTargetPreset(targetPresetFromStore);
    }
  }, [targetPresetFromStore]);

  useEffect(() => {
    if (dynamicOptions) {
      setPartitionOptions(dynamicOptions.partitionOptions || []);
      setNvOptions(dynamicOptions.nvOptions || []);
      setFlashBootOptions(dynamicOptions.flashBootOptions || []);
      setLoaderBootOptions(dynamicOptions.loaderBootOptions || []);
      setLiteOSOptions(dynamicOptions.liteOSOptions || []);
    }
  }, [dynamicOptions]);

  useEffect(() => {
    if (deletedTargetName) {
      setLocalDeletedTargetName(deletedTargetName);
    }
  }, [deletedTargetName]);

  useEffect(() => {
    if (localDeletedTargetName) {
      setData((prevData) => prevData.filter((item) => item.name !== localDeletedTargetName));
      setLocalDeletedTargetName(null);
    }
  }, [localDeletedTargetName]);

  const onAdd = () => {
    setEditingRecord(null);
    setView('add');
  
    const addOperateData: OperateStruct = {
      operationType: 'getTargetConfigOptions',
      paramData: '',
      source: 'target',
    };
    dispatch(getInfo(addOperateData));
  };

  const onEdit = (record: DataType) => {
    setEditingRecord(record);
    setView('edit');
  
    const editOperateData: OperateStruct = {
      operationType: 'getTargetConfigOptions',
      paramData: '',
      source: 'target',
    };
    dispatch(getInfo(editOperateData));
  };

  const onDelete = (targetName: string) => {
    const deleteOperateData: OperateStruct = {
      operationType: 'deleteTarget',
      paramData: { targetName },
      source: 'target',
    };
    dispatch(getInfo(deleteOperateData));
  };

  const onAddFinish = (values: any) => {
    const newTarget = {
      key: Date.now().toString(),
      name: values.name,
      partition: values.partition,
      nv: values.nv,
      flashBoot: values.flashBoot,
      loaderBoot: values.loaderBoot,
      liteOS: values.liteOS,
    };
  
    setData((prevData) => [...prevData, newTarget]);
    setView('table');
  
    const addData = {
      targetName: values.name,
      baseTargetName: data.length > 0 ? data[0].name : '',
      partition: values.partition,
      nv: values.nv,
      flashBoot: values.flashBoot,
      loaderBoot: values.loaderBoot,
      liteOS: values.liteOS,
    };
    const addOperateData = {
      operationType: 'addTargetData',
      paramData: addData,
    };
    dispatch(getInfo(addOperateData));
  };
  
  const onEditFinish = async (values: any) => {
    if (!editingRecord) {
      return;
    }
  
    const isTargetNameChanged = values.name && values.name !== editingRecord.name;
  
    Object.entries(values).forEach(([key, value]) => {
      if (key !== 'name') {
        const updateData = {
          originalTargetName: editingRecord.name,
          updatedFieldName: key,
          updatedFieldValue: value,
        };
        const updateOperateData = {
          operationType: 'updateTargetData',
          paramData: updateData,
        };
        dispatch(getInfo(updateOperateData));
      }
    });
  
    if (isTargetNameChanged) {
      const updateData = {
        originalTargetName: editingRecord.name,
        updatedFieldName: 'name',
        updatedFieldValue: values.name,
      };

      const updateOperateData = {
        operationType: 'updateTargetData',
        paramData: updateData,
      };

      dispatch(getInfo(updateOperateData));
      editingRecord.name = values.name;
    }

    const updatedTarget = {
      ...editingRecord,
      ...values,
    };
  
    setData((prevData) =>
      prevData.map((item) =>
        item.key === editingRecord.key ? updatedTarget : item
      )
    );
    setView('table');
  };

  return (
    <div className="target-manage" style={{paddingTop: '20px'}}>
      {view === 'table' ? (
        <>
          <h2 className="target-title" style={{fontSize: '16px', marginBottom: '24px'}}>{t('targetManage')}</h2>
          <Button
            type="primary"
            className="target-add-button"
            style={{
              marginBottom: '16px',
              borderRadius: '16px',
              fontSize: '12px',
              height: '28px',
              width: '72px',
              marginLeft: '6px',
            }}
            onClick={onAdd}
          >
            {t('add')}
          </Button>
          <Table
            columns={columns}
            dataSource={data}
            pagination={{
              current: currentPage,
              total: data.length,
              pageSize: 10,
              showQuickJumper: true,
              showSizeChanger: false,
              onChange: (page) => setCurrentPage(page),
              className: 'target-pagination',
              locale: {
                jump_to: t('goTo'),
                page: t('page'),
              },
            }}
            rowKey="key"
            className="target-table"
          />
        </>
      ) : view === 'add' || view === 'edit' ? (
        <div className="target-form-container" style={{maxWidth: '600px'}}>
          <h2 className="target-form-title"
           style={{
            fontSize: '16px',
            marginBottom: '12px',
            }}>
            {view === 'add' ? t('addTarget') : t('editTarget')}
          </h2>
          <Form
            onFinish={view === 'add' ? onAddFinish : onEditFinish}
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 18 }}
            className="target-form"
            style={{
              padding: '20px',
              borderRadius: '8px',
              }}
            initialValues={view === 'add' ? {} : (editingRecord || {})}
          >
            <Form.Item
              label={t('targetName')}
              name="name"
              rules={[{ required: true, message: t('enterTargetName') }]}
            >
              <Input placeholder={t('enterRemind')} className="target-input" style={{borderRadius: '12px'}}/>
            </Form.Item>
  
            <Form.Item label={t('partition')} name="partition" rules={[{ required: true, message: t('choosePartition') }]}>
              <Select className="target-select" placeholder={t('chooseRemind')} style={{borderRadius: '12px'}}>
                {partitionOptions.map(option => (
                  <Option key={option} value={option}>{option}</Option>
                ))}
              </Select>
            </Form.Item>
  
            <Form.Item label="NV" name="nv" rules={[{ required: true, message: t('chooseNV') }]}>
              <Select className="target-select" placeholder={t('chooseRemind')} style={{borderRadius: '12px'}}>
                {nvOptions.map(option => (
                  <Option key={option} value={option}>{option}</Option>
                ))}
              </Select>
            </Form.Item>
  
            <Form.Item label="Flash Boot" name="flashBoot" rules={[{ required: true, message: t('chooseFlashBoot') }]}>
              <Select className="target-select" placeholder={t('chooseRemind')} style={{borderRadius: '12px'}}>
                {flashBootOptions.map(option => (
                  <Option key={option} value={option}>{option}</Option>
                ))}
              </Select>
            </Form.Item>
  
            <Form.Item label="Loader Boot" name="loaderBoot" rules={[{ required: true, message: t('chooseLoaderBoot') }]}>
              <Select className="target-select" placeholder={t('chooseRemind')} style={{borderRadius: '12px'}}>
                {loaderBootOptions.map(option => (
                  <Option key={option} value={option}>{option}</Option>
                ))}
              </Select>
            </Form.Item>
  
            <Form.Item label="LiteOS" name="liteOS" rules={[{ required: true, message: t('chooseLiteOS') }]}>
              <Select className="target-select" placeholder={t('chooseRemind')} style={{borderRadius: '12px'}}>
                {liteOSOptions.map(option => (
                  <Option key={option} value={option}>{option}</Option>
                ))}
              </Select>
            </Form.Item>
  
            <Form.Item wrapperCol={{ offset: 0, span: 18 }}>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  className="target-form-button primary"
                  style={{
                    borderRadius: '16px',
                    fontSize: '12px',
                    height: '28px',
                    width: '72px',
                    marginLeft: '6px',
                  }}
                >
                  {view === 'add' ? t('add') : t('save')}
                </Button>
                <Button
                  type="default"
                  onClick={() => setView('table')}
                  className="target-form-button cancel"
                  style={{
                    borderRadius: '16px',
                    fontSize: '12px',
                    height: '28px',
                    width: '72px',
                  }}
                >
                  {t('cancel')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      ) : null}
    </div>
  );
};

export default App;
