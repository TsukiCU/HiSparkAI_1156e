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
import { save2Ini, getUsbValueList } from '../../actions';
import { setDocumentById } from '../setDocumentById';
import Title from '../title';

const { Option } = Select;
const UsbConfig = (uploadInfo: any): JSX.Element => {
  const group = uploadInfo?.group;
  const { t } = useTranslation();
  const usbValueList: any = useSelector((state: any) => state.entities.usbValueList);
  const [usbValue, setUsbValue] = useState<string>(uploadInfo?.iniInfo?.usbValue);
  const [pidValue, setPidValue] = useState<string>(uploadInfo?.iniInfo?.pidValue);
  const [vidValue, setVidValue] = useState<string>(uploadInfo?.iniInfo?.vidValue);
  const [usage, setUsage] = useState<string>(uploadInfo?.iniInfo?.usage);
  const [usagePage, setUsagePage] = useState<string>(uploadInfo?.iniInfo?.usagePage);
  const dispatch = useDispatch();

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const saveFormData = (): void => {
    const data = {
      section: 'upload',
      params: {
        usb_value: usbValue,
        pid_value: pidValue,
        vid_value: vidValue,
        usage: usage,
        usage_page: usagePage,
      },
    };
    saveParams.data = data;
    uploadInfo.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };

  const formattedUsbValueList =
    usbValueList === undefined
      ? []
      : usbValueList.map((usbDevice: any, index: number) => {
          return {
            id: index,
            value: `${usbDevice.name}`,
            label: `${usbDevice.name} (vid: ${usbDevice.vid}, pid: ${usbDevice.pid}, usage: ${usbDevice.usage}, usage page: ${usbDevice.usagePage})`,
          };
        });

  useEffect(() => {
    saveFormData();
  }, [usbValue, uploadInfo?.showComponent]);

  useEffect(() => {
    dispatch(getUsbValueList({ operationType: 'getUsbValueList' }));
  }, []);

  return (
    <>
      {uploadInfo?.showComponent && (
        <>
          <div className="config-card" id={setDocumentById(group, 'usbValueList')}>
            <Title name={t('usbValueList')} description='' />
            <Select
              getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
              defaultValue={usbValue}
              className="width100"
              showArrow={usbValueList && usbValueList.length > 0 ? true : false}
              open={usbValueList && usbValueList.length > 0 ? undefined : false}
              onClick={(): any => dispatch(getUsbValueList({ operationType: 'getUsbValueList' }))}
              onChange={(value): void => {
                setUsbValue(value);
                const selectedDevice = formattedUsbValueList.find((device: any) => device.label === value);
                if (selectedDevice) {
                  const vidMatch = selectedDevice.label.match(/vid: (?<vid>\w+),/);
                  const pidMatch = selectedDevice.label.match(/pid: (?<pid>\w+),/);
                  const usageMatch = selectedDevice.label.match(/usage: (?<usage>\w+),/);
                  const usagePageMatch = selectedDevice.label.match(/usage page: (?<usagePage>\w+)/);
                  setPidValue(pidMatch ? pidMatch[1] : '');
                  setVidValue(vidMatch ? vidMatch[1] : '');
                  setUsage(usageMatch ? usageMatch[1] : '');
                  setUsagePage(usagePageMatch ? usagePageMatch[1] : '');
                }
              }}
            >
              {formattedUsbValueList.map((usbDevice: any) => (
                <Option key={usbDevice.id} value={usbDevice.label}>
                  {usbDevice.label}
                </Option>
              ))}
            </Select>
          </div>
        </>
      )}
    </>
  );
};

export default UsbConfig;
