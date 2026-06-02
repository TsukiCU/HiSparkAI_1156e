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
import { Input, Button, Select } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { OperateStruct, SaveIniStruct } from '../../backEnd/interface/model';
import { getInfo, save2Ini } from '../actions';
import { FolderOpenOutlined } from '@ant-design/icons';
import Title from './title';
import { setDocumentById } from './setDocumentById';

const BaseInfoTabPane = (props: any): JSX.Element => {
  const jsonGetParam = {
    soc : props?.baseInfo?.board,
    boardJsonPath : props?.baseInfo?.json_path,
    sdkPath: props?.baseInfo?.sdk_path,
  };
  const { setPresentTarget } = props;
  const { Option } = Select;
  const group = props?.group;
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [sdkPath, setSdkPath] = useState<string>(props?.baseInfo?.sdk_path);
  const sdkPathInfo: any = useSelector((state: any) => state.entities.sdkPathInfo);
  const jsonData: any = useSelector((state: any) => state.entities.jsonData);
  let ifRefresh: any = useSelector((state: any) => state.entities.ifRefresh);
  const [target, setTarget] = useState<string>(props?.baseInfo?.target);
  const configScript = jsonData.config_script;
  const extractKeys = (data: any): any[] => {
    let keys: any[] = [];
    Object.keys(data).forEach((outerKey) => {
      const innerObject = data[outerKey];
      Object.keys(innerObject).forEach((key) => {
        keys.push(key);
      });
    });

    return keys;
  };
  let keys = jsonData?.target ? extractKeys(jsonData.target) : [];
  const chipListBoaedsMap: any = useSelector((state: any) => state.entities.chipListBoaedsMap);

  if (ifRefresh === undefined) {
    const ifRefreshOperateData: OperateStruct = {
      operationType: 'stopRefresh',
      paramData: {
        key: 'ifRefresh',
        ifRefresh: ifRefresh,
      },
    };
    dispatch(getInfo(ifRefreshOperateData));
    const operateData: OperateStruct = {
      operationType: 'getJsonData',
      paramData: {
        key: 'jsonData',
        jsonGetParam: jsonGetParam,
      },
    };
    dispatch(getInfo(operateData));
  }

  useEffect(() => {
    if (sdkPathInfo) {
      setSdkPath(sdkPathInfo);
      const saveParams: SaveIniStruct = {
        operationType: 'save2Ini',
        data: {
          section: 'information',
          params: {
            sdk_path: sdkPathInfo,
          },
        },
      };
      props.updateConfigInfo(saveParams.data);
      dispatch(save2Ini(saveParams));
    }
  }, [sdkPathInfo]);

  const onSdkPathClick = (): void => {
    // select sdk folders path
    const operateData: OperateStruct = {
      operationType: 'selectFolderPath',
      paramData: {
        key: 'sdkPathInfo',
        currentValue: sdkPath,
      },
    };
    dispatch(getInfo(operateData));
  };

  useEffect(() => {
    if (!target) {
      return;
    }
    const operateData: OperateStruct = {
      operationType: 'saveTarget',
      paramData: {
        target: target,
        jsonGetParam: jsonGetParam,
      },
    };
    dispatch(getInfo(operateData));
  }, [target]);

  const onTargetClick = (): void => {
    const operateData: OperateStruct = {
      operationType: 'getJsonData',
      paramData: {
        key: 'jsonData',
        jsonGetParam: jsonGetParam,
      },
    };
    dispatch(getInfo(operateData));
  };

  const getBoardTitle = (board: string): string => {
    return chipListBoaedsMap?.[board] ?? board;
  };

  const onTargetManageClick = () => {
    const operateData: OperateStruct = {
      operationType: 'executeCommand',
      paramData: 'showTargetManage',
    };
    dispatch(getInfo(operateData));
  };

  const handleSearch = (value: string): void => {
    if (value && !keys.includes(value)) {
      setTarget(value);
      setPresentTarget(value);
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value) {
      setTarget(value);
      setPresentTarget(value);
    }
  };

  return <>
      <div className='config-card' id={setDocumentById(group, 'series_name')}>
        <Title name={t('series_name')} description='' />
        <p className='ant-modal-title' style={{ fontSize: 15 }}>{props?.baseInfo?.series_name}</p>
      </div>
      <div className='config-card' id={setDocumentById(group, 'board')}>
        <Title name={t('board')} description='' />
        <p className='ant-modal-title' style={{ fontSize: 15 }}>{getBoardTitle(props?.baseInfo?.board)}</p>
      </div>
      <div className='config-card' id={setDocumentById(group, 'sdk_path')}>
        <Title name={t('sdk_path')} description='' />
        <Input.Group compact>
          <Input
            className='ant-input-text'
            readOnly={true}
            value={sdkPath}
            style={{ width: 'calc(100% - 37px)' }}
          onClick={(): void => onSdkPathClick()} />
          <Button
            className='browse'
            type='primary'
            style={{ paddingLeft: '10px' }}
            onClick={(): void => onSdkPathClick()}
          icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
        </Input.Group>
      </div>
      {keys.length > 0 && (
        <div className='config-card' id={setDocumentById(group, 'target')}>
          <Title name={t('target')} description='' />
          <Select
            getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
            value={target}
            className='width100'
            onChange={(value): void => {
              if (value !== 'null') {
                setTarget(value);
                setPresentTarget(value);
              }
            }}
            onClick={(): void => onTargetClick()}
            showSearch
            onSearch={handleSearch}
            allowClear
            placeholder={t('selectOrEnterTarget')}
            onBlur={handleInputBlur}
          >
            {keys.map((key, index) => (
              <Option key={`transType_${index + 1}`} value={key}>
                {key}
              </Option>
            ))
          }
          </Select>
          {/* 添加false,暂时隐藏Target管理功能 */}
          {false && configScript && (<div style={{ marginTop: '8px', fontSize: '12px' }}>
            <span>{t('targetEntry')}
              <a onClick={onTargetManageClick} style={{ color: '#1890ff', cursor: 'pointer' }}>{t('targetManage')}</a>
              </span>
          </div>)}
        </div>
      )}
  </>;
};

export default BaseInfoTabPane;
