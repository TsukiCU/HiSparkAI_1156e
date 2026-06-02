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

import { Select, Input, Button } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { SaveIniStruct } from '../../../backEnd/interface/model';
import { getInfo, save2Ini } from '../../actions';
import { setDocumentById } from '../setDocumentById';
import Title from '../title';

export const speedDir: any = {
  KHz10: { value: 10, label: '10kHz' },
  KHz20: { value: 20, label: '20kHz' },
  KHz30: { value: 30, label: '30kHz' },
  KHz50: { value: 50, label: '50kHz' },
  KHz100: { value: 100, label: '100kHz' },
  KHz200: { value: 200, label: '200kHz' },
  KHz300: { value: 300, label: '300kHz' },
  KHz400: { value: 400, label: '400kHz' },
  KHz500: { value: 500, label: '500kHz' },
  KHz600: { value: 600, label: '600kHz' },
  KHz700: { value: 700, label: '700kHz' },
  KHz800: { value: 800, label: '800kHz' },
  KHz900: { value: 900, label: '900kHz' },
  MHz1: { value: 1000, label: '1MHz' },
  MHz2: { value: 2000, label: '2MHz' },
  MHz3: { value: 3000, label: '3MHz' },
  MHz4: { value: 4000, label: '4MHz' },
  MHz5: { value: 5000, label: '5MHz' },
  MHz6: { value: 6000, label: '6MHz' },
  MHz7: { value: 7000, label: '7MHz' },
  MHz8: { value: 8000, label: '8MHz' },
  MHz9: { value: 9000, label: '9MHz' },
  MHz10: { value: 10000, label: '10MHz' },
  MHz12: { value: 12000, label: '12MHz' },
  MHz15: { value: 15000, label: '15MHz' },
  MHz20: { value: 20000, label: '20MHz' },
  MHz25: { value: 25000, label: '25MHz' },
  MHz30: { value: 30000, label: '30MHz' },
  MHz40: { value: 40000, label: '40MHz' },
  MHz50: { value: 50000, label: '50MHz' },
};
export const jLinkJtagSwd = ['KHz10', 'KHz20', 'KHz30', 'KHz50', 'KHz100', 'KHz200',
  'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800', 'KHz900', 'MHz1',
  'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7', 'MHz8', 'MHz9', 'MHz10',
  'MHz12', 'MHz15', 'MHz20', 'MHz25', 'MHz30', 'MHz40', 'MHz50'];

export const debugHiSparkLinkJtag = ['KHz10', 'KHz20', 'KHz30', 'KHz50', 'KHz100', 'KHz200',
  'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800',
  'KHz900', 'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7'];

export const debugHiSparkTraceJtag = ['KHz100', 'KHz200',
  'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800',
  'KHz900', 'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7'];

export const debugHiSparkLinkSwd = ['KHz10', 'KHz20', 'KHz30', 'KHz50', 'KHz100',
  'KHz200', 'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800', 'KHz900',
  'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7', 'MHz8', 'MHz9', 'MHz10'];

export const debugHiSparkTraceSwd = ['KHz10', 'KHz20', 'KHz30', 'KHz50', 'KHz100',
  'KHz200', 'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800', 'KHz900',
  'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7', 'MHz8', 'MHz9', 'MHz10'];

export function getDefaultSpeed(speed: string): string {
  const strSpeed = Number(speed);
  if (speed && strSpeed > 0 && strSpeed < 1000) {
    return `KHz${speed}`;
  } else {
    return `MHz${(strSpeed / 1000)}`;
  }
}

const projectDebugType: string = 'singleMultiCoreDebugMode';

const OpenocdConfig = (openocdInfo: any): JSX.Element => {
  const { Option } = Select;
  const { t } = useTranslation();
  const iniInfo = openocdInfo?.iniInfo?.debugInfo?.debug;
  const jsonInfos = openocdInfo?.chipInfo;
  const group = openocdInfo?.group;
  const multiCoreMode = openocdInfo?.multiCoreMode;
  const [debugInterface, setDebugInterface] = useState<string>(iniInfo?.interface || jsonInfos?.param?.interface[0]);
  const [port, setPort] = useState<string>(iniInfo?.port || jsonInfos?.param?.port);
  const [speed, setSpeed] = useState<string>(iniInfo?.speed || jsonInfos?.param?.speed);
  const [jlinkServerPath, setJlinkServerPath] = useState<string>(iniInfo?.jlinkServerPath);
  const [jlinkScriptPath, setJlinkScriptPath] = useState<string>(iniInfo?.jlinkScriptPath);
  const [jlinkScriptPathNew, setJlinkScriptPathNew] = useState<string>(iniInfo?.new_jlinkScript_Path);
  const [speedArr, setSpeedArr] = useState<any[]>([]);
  const dispatch = useDispatch();
  const jlinkServerPathInfo: any = useSelector((state: any) => state.entities.jlinkServerPathInfo);
  const jlinkScriptPathInfo: any = useSelector((state: any) => state.entities.jlinkScriptPathInfo);
  const jlinkScriptPathInfoNew: any = useSelector((state: any) => state.entities.jlinkScriptPathInfoNew);
  const defaultSpeed = jsonInfos?.param?.speed;

  let [interfaces, setInterfaces] = useState<Array<string>>([]);

  // triggered at the first time
  useEffect(() => {
    if (!jsonInfos) {
      return;
    }
    interfaces = [];
    setInterfaces(interfaces);
    interfaces.push(...jsonInfos?.param?.interface);
    setInterfaces(interfaces);
  }, [dispatch]);

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const operateData: any = {
    operationType: '',
    paramData: '',
    source: 'setting',
    pathType: '',
  };

  useEffect(() => {
    if (jlinkServerPathInfo) {
      setJlinkServerPath(jlinkServerPathInfo);
    }
  }, [jlinkServerPathInfo]);

  useEffect(() => {
    if (jlinkScriptPathInfo !== undefined) {
      setJlinkScriptPath(jlinkScriptPathInfo);
    }
    if (jlinkScriptPathInfoNew !== undefined) {
      setJlinkScriptPathNew(jlinkScriptPathInfoNew);
    } 
  }, [jlinkScriptPathInfo, jlinkScriptPathInfoNew]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        interface: debugInterface,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [debugInterface]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        port: port,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [port]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        speed: speed,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [speed]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        jlinkServerPath: jlinkServerPath,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [jlinkServerPath]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        jlinkScriptPath: jlinkScriptPath,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [jlinkScriptPath]);

  useEffect(() => {
    saveParams.data = {
      section: 'debug',
      params: {
        new_jlinkScript_Path: jlinkScriptPathNew,
      },
    };
    openocdInfo.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [jlinkScriptPathNew]);

  useEffect(() => {
    if (openocdInfo?.tool === 'jlink') {
      setSpeedArr(jLinkJtagSwd);
    } else if (openocdInfo?.tool === 'HiSpark-Trace') {
      if (debugInterface === 'jtag') {
        setSpeedArr(debugHiSparkTraceJtag);
      } else {
        setSpeedArr(debugHiSparkTraceSwd);
      }
    } else {
      if (debugInterface === 'jtag') {
        setSpeedArr(debugHiSparkLinkJtag);
      } else {
        setSpeedArr(debugHiSparkLinkSwd);
      }
    }
  }, [openocdInfo?.tool, debugInterface]);

  useEffect(() => {
    if (Array.isArray(speedArr) && speedArr.length > 0 &&
      !speedArr.includes(getDefaultSpeed(speed))) {
      setSpeed(defaultSpeed);
    }
  }, [speedArr]);

  return (
    <>
      {jsonInfos.name === 'jlink' && <div className='config-card' id={setDocumentById(group, 'jlinkServerPath')}>
        <Title name={t('jlinkServerPath')} description='' />
        <Input.Group compact>
          <Input
            className='ant-input-text'
            readOnly={true}
            value={jlinkServerPath}
            style={{ width: 'calc(100% - 37px)' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkServerPathInfo',
                currentValue: jlinkServerPath,
              };
              dispatch(getInfo(operateData));
            }} />
          <Button
            className='browse'
            type='primary'
            style={{ paddingLeft: '10px' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkServerPathInfo',
                currentValue: jlinkServerPath,
              };
              dispatch(getInfo(operateData));
            }}
            icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
        </Input.Group>
      </div>}
      {jsonInfos.name === 'jlink' && openocdInfo?.iniInfo?.debugInfo?.information?.project_type !== 'MCU' && <div className='config-card' id={setDocumentById(group, 'jlinkScriptPath')}>
        <Title name={t('jlinkScriptPath')} description='' />
        <Input.Group compact>
          <Input
            className='ant-input-text'
            readOnly={true}
            value={jlinkScriptPath}
            style={{ width: 'calc(100% - 37px)' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkScriptPathInfo',
                currentValue: jlinkScriptPath,
              };
              dispatch(getInfo(operateData));
            }} />
          <Button
            className='browse'
            type='primary'
            style={{ paddingLeft: '10px' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkScriptPathInfo',
                currentValue: jlinkScriptPath,
              };
              dispatch(getInfo(operateData));
            }}
            icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
        </Input.Group>
      </div>}
      {jsonInfos.name === 'jlink' && openocdInfo?.iniInfo?.debugInfo?.information?.project_type !== 'MCU' && multiCoreMode === projectDebugType && <div className='config-card' id={setDocumentById(group, 'jlinkScriptPathNew')}>
        <Title name={t('jlinkScriptPathNew')} description='' />
        <Input.Group compact>
          <Input
            className='ant-input-text'
            readOnly={true}
            value={jlinkScriptPathNew}
            style={{ width: 'calc(100% - 37px)' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkScriptPathInfoNew',
                currentValue: jlinkScriptPathNew,
              };
              dispatch(getInfo(operateData));
            }} />
          <Button
            className='browse'
            type='primary'
            style={{ paddingLeft: '10px' }}
            onClick={(): void => {
              operateData.operationType = 'selectFilePath';
              operateData.paramData = {
                key: 'jlinkScriptPathInfoNew',
                currentValue: jlinkScriptPathNew,
              };
              dispatch(getInfo(operateData));
            }}
            icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
        </Input.Group>
      </div>}
      <div className='config-card' id={setDocumentById(group, 'interface')}>
        <Title name={t('interface')} description='' />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          defaultValue={debugInterface}
          className='width100'
          showArrow={interfaces.length > 0 ? true : false}
          open={interfaces.length > 0 ? undefined : false}
          onChange={(value): void => {
            setDebugInterface(value);
          }}
        >
          {
            interfaces?.map((item) => {
              return <Option key={item} value={item}>
                {item}
              </Option>;
            })
          }
        </Select>
      </div>
      <div className='config-card' id={setDocumentById(group, 'speed')}>
        <Title name={t('speed')} description='' />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          value={speedDir[getDefaultSpeed(speed)].label}
          className='width100'
          showArrow={speedArr.length > 0 ? true : false}
          open={speedArr.length > 0 ? undefined : false}
          onChange={(value): void => {
            setSpeed(value);
          }}
        >
          {
            speedArr.map((item) => {
              return <Option key={speedDir[item].value} value={speedDir[item].value}>
                {speedDir[item].label}
              </Option>;
            })
          }
        </Select>
      </div>
    </>
  );
};

export default OpenocdConfig;
