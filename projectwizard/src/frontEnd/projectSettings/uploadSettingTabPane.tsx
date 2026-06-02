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

import { Select, Input, Button, Checkbox } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { SaveIniStruct } from '../../backEnd/interface/model';
import { getInfo, save2Ini } from '../actions';
import JtagConfig from './uploadWay/jtagConfig';
import SerialPortConfig from './uploadWay/serialPortConfig';
import UsbConfig from './uploadWay/usbConfig';
import I2cConfig from './uploadWay/i2cConfig';
import { FolderOpenOutlined } from '@ant-design/icons';
import Title from './title';
import { setDocumentById } from './setDocumentById';
import { getUsbBinPath, getDefaultBinPath, getI2cBinPath } from '../actions';

const oneZero2Boolean = (value: any): boolean => {
  if (value === 1 || value === '1') {
    return true;
  } else {
    return false;
  }
};
const oneZero2BooleanUndefinedTrue = (value: any): boolean => {
  if (value === 1 || value === '1' || value === undefined) {
    return true;
  } else {
    return false;
  }
};
const boolean2OneZero = (value: boolean): number => {
  return value ? 1 : 0;
};

const { Option } = Select;
const UploadTabPane = (props: any): JSX.Element => {
  const group = props?.group;
  const { t } = useTranslation();
  const [transWay, setTransWay] = useState<any>();
  const [tmpWay, setTmpWay] = useState<any>();
  let [transWayList, setTransWayList] = useState<Array<any>>([]);
  const [baudRateList, setBaudRateList] = useState<Array<string>>([]);
  const [binPath, setBinPath] = useState<string>(props?.uploadInfo?.upload?.bin_path);
  const [resetEnable, setResetEnable] = useState(oneZero2BooleanUndefinedTrue(props?.uploadInfo?.upload?.reset));
  const [burnVerificationEnable, setBurnVerificationEnable] = useState(oneZero2Boolean(props?.uploadInfo?.upload?.burn_verification));
  const dispatch = useDispatch();

  const chip: any = useSelector((state: any) => state.entities.chipConfig);
  const binPathInfo: any = useSelector((state: any) => state.entities.binPathInfo);

  const operateData: any = {
    operationType: '',
    paramData: '',
    source: 'setting',
    pathType: '',
  };
  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };
  // triggered at the first time
  useEffect(() => {
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: props?.uploadInfo?.information?.json_path,
      sdkPath: props?.uploadInfo?.information?.sdk_path,
    };
    dispatch(getInfo(operateData));
  }, [dispatch]);

  // triggered at the first time
  useEffect(() => {
    saveFormData();
    setTmpWay(transWay);
  }, [transWay, binPath, resetEnable, burnVerificationEnable]);

  useEffect(() => {
    if (binPathInfo) {
      setBinPath(binPathInfo);
    }
  }, [binPathInfo]);

  const saveFormData = (): void => {
    const data = {
      section: 'upload',
      key: 'protocol',
      params: {
        protocol: transWay?.name,
        bin_path: binPath,
        reset: boolean2OneZero(resetEnable),
        burn_verification: boolean2OneZero(burnVerificationEnable),
      },
    };
    saveParams.data = data;
    props.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };

  useEffect(() => {
    if (chip?.upload) {
      transWayList = [];
      setTransWayList(transWayList);
      const transWays = chip.upload.params;
      transWayList.push(...transWays);
      setTransWayList(transWayList);
      const defaultWay = props?.uploadInfo?.upload?.protocol;
      transWayList.some((item: any) => {
        if (item.name === defaultWay) {
          setTransWay(item);
          return true;
        }
        return false;
      });
      if (chip.upload.baudList) {
        setBaudRateList(chip.upload.baudList);
      }
    }
  }, [chip]);
 
  const updateUsbBinPath = (): void => {
    const data = {
      operationType: 'updateUsbBinPath',
    };
    dispatch(getUsbBinPath(data));
  };

  const updateDefaultBinPath = (): void => {
    const data = {
      operationType: 'updateDefaultBinPath',
    };
    dispatch(getDefaultBinPath(data));
  };

  const updateI2cHexPath = (): void => {
    const data = {
      operationType: 'updateI2cHexPath',
    };
    dispatch(getI2cBinPath(data));
  };

  const configComponents = (): any => {
    const components: JSX.Element[] = [];
    components.push(
      <SerialPortConfig
        showComponent={tmpWay?.name === 'serial'}
        jsonInfo={tmpWay}
        iniInfo={props?.uploadInfo?.upload}
        group={group}
        updateConfigInfo={props.updateConfigInfo}
        baudRateList={baudRateList}
      />
    );
    components.push(
      <JtagConfig
        showComponent={tmpWay?.name === 'jtag' || tmpWay?.name === 'swd'}
        jsonInfo={tmpWay}
        iniInfo={props?.uploadInfo?.upload}
        group={group}
        updateConfigInfo={props.updateConfigInfo}
      />
    );
    components.push(
      <UsbConfig
        showComponent={tmpWay?.name === 'usb'}
        jsonInfo={tmpWay}
        iniInfo={props?.uploadInfo?.upload}
        group={group}
        updateConfigInfo={props.updateConfigInfo}
      />
    );
    components.push(
      <I2cConfig
        showComponent={tmpWay?.name === 'i2c'}
        jsonInfo={tmpWay}
        iniInfo={props?.uploadInfo?.upload}
        group={group}
        updateConfigInfo={props.updateConfigInfo}
      />
    );
    return (
      <>
        {components}
      </>
    );
  };

  return (
    <>
      <div className='config-card' id={setDocumentById(group, 'protocol')}>
        <Title name={t('protocol')} description='' />
        <Select className='width100' value={transWay?.name}
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          showArrow={transWayList.length > 0 ? true : false}
          open={transWayList.length > 0 ? undefined : false}
          onChange={(value): void => {
            setTransWay(transWayList.find(item => item.name === value));
            // 每次切换特殊的烧写模式时都会把需要变化的bin_path发送到前端
            if (value === 'usb') {
              updateUsbBinPath();
            } else if (value === 'i2c') {
              updateI2cHexPath();
            } else {
              updateDefaultBinPath();
            }
          }}>
          {
            transWayList.map((item) => {
              return <Option key={item.name} value={item.name}>
                {item.name}
              </Option>;
            })
          }
        </Select>
      </div>
      <div className='config-card' id={setDocumentById(group, 'bin_path')}>
        <Title name={t('bin_path')} description='' />
        <Input.Group compact>
          <Input
            className='ant-input-text'
            readOnly={true}
            value={binPath}
            style={{ width: 'calc(100% - 37px)' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'binPathInfo',
                currentValue: binPath,
              };
              operateData.pathType = 'relativePath';
              dispatch(getInfo(operateData));
            }} />
          <Button
            className='browse'
            type='primary'
            style={{ paddingLeft: '10px' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'binPathInfo',
                currentValue: binPath,
              };
              operateData.pathType = 'relativePath';
              dispatch(getInfo(operateData));
            }}
            icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
        </Input.Group>
      </div>
      {configComponents()}
      <div className='config-card' id={setDocumentById(group, 'reset')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={resetEnable} onChange={(e): void => {
            setResetEnable(e.target.checked);
          }}>{t('reset')}</Checkbox>
      </div>
      <div className='config-card' id={setDocumentById(group, 'burn_verification')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={burnVerificationEnable} onChange={(e): void => {
            setBurnVerificationEnable(e.target.checked);
          }}>{t('burn_verification')}</Checkbox>
      </div>
    </>
  );
};

export default UploadTabPane;
