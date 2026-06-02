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
import { useDispatch, useSelector } from 'react-redux';
import { Input, Col, Button, Form } from 'antd';
import type { OperateStruct, ProjectConfig } from '../backEnd/interface/model';
import { getInfo } from './actions';
import { useTranslation } from 'react-i18next';
import { FolderOpenOutlined } from '@ant-design/icons';

export const SdkModal: React.FC<ProjectConfig> = (projectConfigObj) => {
  const { sdkContentWrong, validateFields } = projectConfigObj;
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const sdkPathInfo: any = useSelector((state: any) => state.entities.sdkPathInfo);
  const [sdkPath, setSdkPath] = useState('');
  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
    source: 'wizard',
  };

  const onSdkPathClick = (): void => {
    // select sdk folders path
    operateData.operationType = 'selectFolderPath';
    operateData.paramData = {
      key: 'sdkPathInfo',
      currentValue: sdkPath,
      seriesName: projectConfigObj.projectData.seriesName,
    };
    dispatch(getInfo(operateData));
  };

  // triggered by select the SDK path
  useEffect(() => {
    if (sdkPathInfo) {
      setSdkPath(sdkPathInfo);
      projectConfigObj.setFieldsValue({ sdkPath: sdkPathInfo });
      projectConfigObj.setSdkPath(sdkPathInfo);
      validateFields(['sdkPath']);
    }
  }, [sdkPathInfo]);

  useEffect(() => {
    if (projectConfigObj?.lastSdkPath) {
      setSdkPath(projectConfigObj?.lastSdkPath);
      projectConfigObj.setFieldsValue({ sdkPath: projectConfigObj?.lastSdkPath });
      projectConfigObj.setSdkPath(projectConfigObj?.lastSdkPath);
    }
  }, [projectConfigObj?.lastSdkPath]);

  return (
    <>
      <Col>
        <p>{t('sdk')}</p>
        <Form.Item
          name="sdkPath"
          rules={[
            { required: true, message: t('fieldCannotEmpty', { field: t('sdk') }) ?? 'SDK cannot be Empty' },
            {
              validator: (): Promise<void> => {
                if (sdkContentWrong) {
                  // 根据 seriesName 来显示不同的错误提示
                  const errorMessage = projectConfigObj.projectData.seriesName === 'cfbb' 
                    ? t('sdkCfbbWrongInfo') 
                    : t('sdkMcuWrongInfo');
                  return Promise.reject(errorMessage);
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input.Group compact>
            <Input className='ant-input-text'
              placeholder={t('choosedSDKpath') ?? 'Selecting the SDK source path'}
              value={sdkPath}
              style={{ width: 'calc(100% - 37px)' }}
              onClick={(): void => onSdkPathClick()}
            />
            <Button
              className='browse'
              type='primary'
              style={{ paddingLeft: '10px' }}
              onClick={(): void => onSdkPathClick()} icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}
            />
          </Input.Group>
        </Form.Item>
      </Col>
    </>
  );
};
