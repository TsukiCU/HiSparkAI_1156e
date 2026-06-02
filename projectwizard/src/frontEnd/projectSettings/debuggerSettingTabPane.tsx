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
import { Select, Input, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import type { SaveIniStruct, MultiModeStruct } from '../../backEnd/interface/model';
import { getInfo, save2Ini, setMultiCoreModeValue } from '../actions';
import { useDispatch, useSelector } from 'react-redux';
import OpenocdConfig from './debugTool/openocdConfig';
import QemuConfig from './debugTool/qemuConfig';
import { FolderOpenOutlined } from '@ant-design/icons';
import Title from './title';
import { setDocumentById } from './setDocumentById';
const multiCoreArr: string[] = ['singleDebugMode', 'singleMultiCoreDebugMode', 'multiProjectMultiCoreDebugMode'];
const singleDebugMode: string = multiCoreArr[0];
const singleMultiCoreDebugMode: string = multiCoreArr[1];
const multiProjectMultiCoreDebugMode: string = multiCoreArr[2];
const multiCoreChipList: string[] = ['nb17e', 'nb18'];
const multiCoreElfList: string[] = ['nb17e', 'nb18'];

function isNeedSelectMultiCoreElfPath(board: string, isMultiCore: boolean, multiCoreMode: string) : boolean {
  return multiCoreElfList.includes(board) && isMultiCore && multiCoreMode === singleMultiCoreDebugMode;
}

const DebuggerInfoTabPane = (props: any): JSX.Element => {
  const group = props?.group;
  const { Option } = Select;
  const { t } = useTranslation();
  const debugIni = props?.debugInfo?.debug;
  const board = props?.debugInfo?.information?.board;
  let isMultiCore = false;
  // 目前仅nb17e和nb18支持多核调试，2131系列虽然是多核
  // 但是C核编译不会生成elf文件，因此IDE不支持其C核调试。
  // 3322 只支持A核调试
  if (multiCoreChipList.includes(board)) {
    isMultiCore = true;
  }
  const [client, setClient] = useState<string>(debugIni?.client);
  const [tool, setTool] = useState<string>(debugIni?.tool);
  const [tmpTool, setTmpTool] = useState<string>('');
  const refElf = useRef<any>();
  let [clients, setClients] = useState<Array<string>>([]);
  let [tools, setTools] = useState<Array<string>>([]);
  const [timeout, setTimeout] = useState<any>(props?.debugInfo?.debug?.timeout);
  let [timeoutList, setTimeoutList] = useState<Array<any>>([]);
  const [multiCoreMode, setMultiCoreMode] = useState<string>(debugIni?.debug_mode);
  const operateData: any = {
    operationType: '',
    paramData: '',
    source: 'setting',
    pathType: '',
  };

  const saveParams: SaveIniStruct = {
    operationType: 'replaceIni',
    data: '',
  };
  const dispatch = useDispatch();
  const [elfPath, setElfPath] = useState<string>(props?.debugInfo?.debug?.elf_path);
  const [elfPathNew, setElfPathNew] = useState<string>(props?.debugInfo?.debug?.new_elf_path);

  const chip: any = useSelector((state: any) => state?.entities?.chipConfig);
  const elfPathInfo: any = useSelector((state: any) => state?.entities?.elfPathInfo);
  const elfPathInfoNew: any = useSelector((state: any) => state?.entities?.elfPathInfoNew);
  // triggered at the first time
  useEffect(() => {
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: props?.debugInfo?.information?.json_path,
      sdkPath: props?.debugInfo?.information?.sdk_path,
    };
    dispatch(getInfo(operateData));
  }, [dispatch]);

  useEffect(() => {
    if (chip?.debug) {
      clients = [];
      tools = [];
      setClients(clients);
      setTools(clients);
      clients.push(...chip?.debug?.client);
      tools.push(...chip?.debug?.tool);
      setClients(clients);
      setTools(tools);

      timeoutList = [];
      setTimeoutList(timeoutList);
      const timeoutArr = chip.debug.timeout_list ?? [];
      timeoutList.push(...timeoutArr);
      setTimeoutList(timeoutList);
    }
  }, [chip]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        tool: tool,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
    setTmpTool(tool);
  }, [tool]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        elf_path: elfPath,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [elfPath]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        debug_mode: multiCoreMode,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [multiCoreMode]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        new_elf_path: elfPathNew,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [elfPathNew]);

  useEffect(() => {
    if (elfPathInfo) {
      setElfPath(elfPathInfo);
    }
  }, [elfPathInfo]);

  useEffect(() => {
    if (elfPathInfoNew) {
      setElfPathNew(elfPathInfoNew);
    }
  }, [elfPathInfoNew]);

  useEffect(() => {
    let data: MultiModeStruct = {
      value: multiCoreMode,
    };
    dispatch(setMultiCoreModeValue(data));
  }, [multiCoreMode]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        client: client,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [client]);

  useEffect(() => {
    saveParams.operationType = 'save2Ini';
    saveParams.data = {
      section: 'debug',
      params: {
        timeout: timeout,
      },
    };
    props.updateConfigInfo(saveParams.data);
    dispatch(save2Ini(saveParams));
  }, [timeout]);

  const configComponents = (): any => {
    let components: JSX.Element[] = [];
    let toolInfo = '';
    const configs = chip?.debug?.params;
    for (let i = 0; i < configs?.length; ++i) {
      if (tmpTool === configs[i]?.name) {
        toolInfo = configs[i];
        break;
      }
    }
    if (toolInfo) {
      components.push(
        <OpenocdConfig
          chipInfo={toolInfo}
          iniInfo={props}
          tool={tool}
          group={group}
          updateConfigInfo={props.updateConfigInfo}
          multiCoreMode={multiCoreMode}
        />
      );
    } else if (tmpTool === 'qemu') {
      components.push(
        <QemuConfig
          qemuInfo={props}
          group={group}
          updateConfigInfo={props.updateConfigInfo}
        />
      );
    } else {
      components = [];
    }
    return (
      <>
        {components}
      </>
    );
  };

  return <>
    {isMultiCore && (<div className='config-card' id={setDocumentById(group, 'multicore')}>
      <Title name={t('multicore')} description='' />
      <Select
        getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
        defaultValue={multiCoreMode}
        className='width100'
        showArrow={tools.length > 0 ? true : false}
        open={tools.length > 0 ? undefined : false}
        onChange={(value): void => {
          setMultiCoreMode(value);
        }}
      >
        <Option key={multiCoreArr[0]} value={singleDebugMode}>
          {t(multiCoreArr[0])}
        </Option>
        <Option key={multiCoreArr[1]} value={singleMultiCoreDebugMode}>
          {t(multiCoreArr[1])}
        </Option>
        <Option key={multiCoreArr[2]} value={multiProjectMultiCoreDebugMode}>
          {t(multiCoreArr[2])}
        </Option>
      </Select>
    </div>
    )}
    <div className='config-card' id={setDocumentById(group, 'elf_path')}>
      <Title name={'elf_path'} description='' />
      <Input.Group compact>
        <Input
          className='ant-input-text'
          readOnly={true}
          value={elfPath}
          style={{ width: 'calc(100% - 37px)' }}
          onClick={(): void => {
            operateData.operationType = 'selectFilePath';
            operateData.paramData = {
              key: 'elfPathInfo',
              currentValue: elfPath,
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
              key: 'elfPathInfo',
              currentValue: elfPath,
            };
            operateData.pathType = 'relativePath';
            dispatch(getInfo(operateData));
          }}
          icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
      </Input.Group>
    </div>
    {isNeedSelectMultiCoreElfPath(board, isMultiCore, multiCoreMode) && <div className='config-card' id={setDocumentById(group, 'elfPathNew')}>
      <Title name={'elfPathNew'} description='' />
      <Input.Group compact>
        <Input
          className='ant-input-text'
          readOnly={true}
          value={elfPathNew}
          style={{ width: 'calc(100% - 37px)' }}
          onClick={(): void => {
            operateData.operationType = 'selectFilePath';
            operateData.paramData = {
              key: 'elfPathInfoNew',
              currentValue: elfPathNew,
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
              key: 'elfPathInfoNew',
              currentValue: elfPathNew,
            };
            operateData.pathType = 'relativePath';
            dispatch(getInfo(operateData));
          }}
          icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
      </Input.Group>
    </div>}
    <div className='config-card' id={setDocumentById(group, 'client')}>
      <Title name={t('client')} description='' />
      <Select
        getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
        defaultValue={client}
        showArrow={clients.length > 0 ? true : false}
        open={clients.length > 0 ? undefined : false}
        className='width100'
        onChange={(value): void => {
          setClient(value);
        }}
      >
        {
          clients.map((item) => {
            return <Option key={item} value={item}>
              {item}
            </Option>;
          })
        }
      </Select>
    </div>
    <div className='config-card' id={setDocumentById(group, 'tool')}>
      <Title name={t('tool')} description='' />
      <Select
        getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
        defaultValue={tool}
        className='width100'
        showArrow={tools.length > 0 ? true : false}
        open={tools.length > 0 ? undefined : false}
        onChange={(value): void => {
          setTool(value);
        }}
      >
        {
          tools.map((item) => {
            return <Option key={item} value={item}>
              {item}
            </Option>;
          })
        }
      </Select>
    </div>
    {configComponents()}
    <div className='config-card' id={setDocumentById(group, 'timeout')}>
      <Title name={t('timeout')} description='' />
      <Select className="width100" value={timeout}
        getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
        showArrow={timeoutList.length > 0 ? true : false}
        open={timeoutList.length > 0 ? undefined : false}
        onChange={(value): void => {
          setTimeout(value);
        }}>
        {
          timeoutList.map((item) => {
            return <Option key={item} value={item}>
              {item === '-1' ? t('unlimited') : item / 1000}
            </Option>;
          })
        }
      </Select>
    </div>
  </>;
};

export default DebuggerInfoTabPane;
