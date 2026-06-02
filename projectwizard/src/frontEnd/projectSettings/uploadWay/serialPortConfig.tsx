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

import { Select } from 'antd';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { SaveIniStruct } from '../../../backEnd/interface/model';
import { save2Ini, getSerialPorts } from '../../actions';
import { setDocumentById } from '../setDocumentById';
import Title from '../title';

const { Option } = Select;

const SerialPortConfig = (uploadInfo: any): JSX.Element => {
  const group = uploadInfo?.group;
  const { t } = useTranslation();
  const portsList: any = useSelector((state: any) => state.entities.portsList);
  const [serialPort, setSerialPort] =
    useState<string>(uploadInfo?.iniInfo?.port || uploadInfo?.jsonInfo?.param?.port);
  const [baudRate, setBaudRate] =
    useState<string>(uploadInfo?.iniInfo?.baud || uploadInfo?.jsonInfo?.param?.baud);
  const stopBit = uploadInfo?.iniInfo?.stop_bit || uploadInfo?.jsonInfo?.param?.stop_bit;
  const verifyType = uploadInfo?.iniInfo?.parity || uploadInfo?.jsonInfo?.param?.parity;

  const dispatch = useDispatch();

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const saveFormData = (): void => {
    const data = {
      section: 'upload',
      params: {
        port: serialPort,
        baud: baudRate,
        stop_bit: stopBit,
        parity: verifyType,
      },
    };
    saveParams.data = data;
    uploadInfo.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };

  useEffect(() => {
    saveFormData();
  }, [serialPort, baudRate, stopBit, verifyType, uploadInfo?.showComponent]);

  useEffect(() => {
    dispatch(getSerialPorts({ operationType: 'getSerialPorts' }));
  }, []);

  useEffect(() => {
    if (baudRate) {
      return;
    }
    const comingbaud = uploadInfo?.iniInfo?.baud || uploadInfo?.jsonInfo?.param?.baud;
    if (comingbaud) {
      setBaudRate(comingbaud);
    }
  }, [uploadInfo?.iniInfo?.baud || uploadInfo?.jsonInfo?.param?.baud]);

  return (<>
    {uploadInfo?.showComponent && <>
      <div className='config-card' id={setDocumentById(group, 'port')}>
        <Title name={t('port')} description='' />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          defaultValue={serialPort}
          className='width100'
          showArrow={portsList && portsList.length > 0 ? true : false}
          open={portsList && portsList.length > 0 ? undefined : false}
          onClick={(): any => dispatch(getSerialPorts({ operationType: 'getSerialPorts' }))}
          onChange={(value): void => {
            setSerialPort(value);
          }}
          options={portsList}
        />
      </div>
      <div className='config-card' id={setDocumentById(group, 'baud')}>
        <Title name={t('baud')} description='' />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          className='width100'
          showArrow={uploadInfo.baudRateList.length > 0 ? true : false}
          open={uploadInfo.baudRateList.length > 0 ? undefined : false}
          onChange={(value): void => {
            setBaudRate(value);
          }}
          value={baudRate}
        >
          {
            uploadInfo.baudRateList.map((baudRateItem: any) => (
              <Option key={baudRateItem} value={baudRateItem}>
                {baudRateItem}
              </Option>
            ))
          }
        </Select>
      </div>
    </>}
  </>
  );
};

export default SerialPortConfig;
