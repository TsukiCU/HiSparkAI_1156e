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
import { Anchor, Collapse } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { getInfo } from '../actions';
import { useTranslation } from 'react-i18next';
import type { OperateStruct, GroupConfigItem } from '../../backEnd/interface/model';
import BaseInfoTabPane from './baseSettingTabPane';
import UploadTabPane from './uploadSettingTabPane';
import SimulatorInfoTabPane from './simulatorSettingTabPane';
import CompilerInfoTabPane from './compileSettingTabPane';
import DebuggerInfoTabPane from './debuggerSettingTabPane';
import { clone } from '../component/utils';
import { allAnchorList, compileAnchorList, listSort } from '../component/projConfigListSequence';
import {
  COMPILE,
  DEBUG,
  INFORMATION,
  JLINK,
  jlinkSubitems,
  openocdSubitems,
  PORT,
  MULTICORE,
  PROTOCOL,
  QEMU,
  SERIAL,
  USB,
  JTAG,
  SWD,
  I2C,
  STATICLIBRARYENABLE,
  staticLibraryEnableSubitems,
  TOOL,
  toolSubitems,
  UPLOAD,
  WARNING,
  warningSubitems,
  armGccUnsupportedCompilationOptions,
  fbbUnsupportedCompilationOptions,
  debugaToolNullSubitems,
  uploadTransModeNullSubitems
} from '../component/projConfigStaticData';
import { addGenerateAllinoneBin } from './compileSettingTabPane';

const SettingApp = (props: any): JSX.Element => {
  const { t } = useTranslation();
  const [isReadIni, setIsReadIni] = useState<boolean>(true);
  const [activeKeys, setActiveKeys] = useState<string | Array<string>>([]);
  const [configInfo, setConfigInfo] = useState<Array<object>>([]);
  const [copyProjectInfo, setCopyProjectInfo] = useState<Array<object>>([]);
  const projectInfo: any = useSelector((state: any) => state.entities.project);
  const independentConfig: any = useSelector((state: any) => state.entities.independentConfig);
  const jsonData: any = useSelector((state: any) => state.entities.jsonData);
  const factory: number = useSelector((state: any) => state.entities.factory);
  const [componentKey, setComponentKey] = useState(0);
  // baseSetting面板的target改变时，会影响到其它面板的参数
  const [presentTarget, setPresentTarget] = useState('');

  const dispatch = useDispatch();
  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
  };

  useEffect(() => {
    operateData.operationType = 'getLanguage';
    dispatch(getInfo(operateData));
    if (props.path) {
      operateData.operationType = 'getIndependentConfig';
      operateData.paramData = props.path;
      dispatch(getInfo(operateData));
    }
  }, [dispatch]);

  useEffect(() => {
    // read ini info
    if (isReadIni) {
      dispatch(getInfo({
        operationType: 'getChipListBoaedsMap',
        paramData: 'chipListBoaedsMap',
        source: 'setting',
      }));
      operateData.operationType = 'getIniInfo';
      dispatch(getInfo(operateData));
      setIsReadIni(false);
    }
  }, [isReadIni]);
  useEffect(() => {
    // get tabs from ini info
    let flag = (!props.path && projectInfo) || (props.path && independentConfig !== void 0 && projectInfo);
    if (flag && jsonData) {
      let setions: string[] = [];
      let configs: GroupConfigItem[] = [];
      const anchorList = props.path ? compileAnchorList : allAnchorList;
      for (const key of Object.keys(anchorList)) {
        setions.push(key);
        configs = getConfigInfo(key, configs, projectInfo);
      }
      setConfigInfo(configs);
      setActiveKeys(setions);
      setCopyProjectInfo(projectInfo);
    }
  }, [projectInfo, independentConfig, jsonData]);

  useEffect(() => {
    if (factory) {
      setComponentKey(factory);
    }
  }, [factory]);

  const updateConfigInfo = (param: any): void => {
    let newProjectInfo = clone(copyProjectInfo);
    if (newProjectInfo?.[param?.section] && param?.params) {
      for (const key of Object.keys(param.params)) {
        newProjectInfo[param.section][key] = param.params[key];
      }
    }
    let configs: GroupConfigItem[] = [];
    const anchorList = props.path ? compileAnchorList : allAnchorList;
    for (const key of Object.keys(anchorList)) {
      configs = getConfigInfo(key, configs, newProjectInfo);
    }
    setCopyProjectInfo(newProjectInfo);
    setConfigInfo(configs);
  };

  const getConfigInfo = (key: string, configs: Array<GroupConfigItem>, projInfo: any): Array<any> => {
    const anchorList = props.path ? Object.assign({}, compileAnchorList) : Object.assign({}, allAnchorList);
    if (!projInfo?.[key]) {
      projInfo[key] = {};
    }
    let children: GroupConfigItem[] = [];
    if (key === INFORMATION) {
      children = getInfoItems(key, anchorList[key]);
    } else if (key === COMPILE) {
      children = getCompileItems(key, anchorList[key]);
    } else if (key === DEBUG) {
      children = getDebugItems(key, projInfo[key], anchorList[key]);
    } else if (key === UPLOAD) {
      children = getUploadItems(key, projInfo[key]);
    } else {
      children = [];
    }
    configs.push({
      name: key,
      group: key,
      children: children,
    });
    return configs;
  };
  const getInfoItems = (key: string, anchorListCompile: string[]): Array<any> => {
    let children: GroupConfigItem[] = [];
    for (const innerKey of anchorListCompile) {
      if (innerKey === 'target' && !projectInfo.information[innerKey]) {
        continue;
      }
      children.push({ name: innerKey, group: key });
    }
    return children;
  };

  const getCompileItems = (key: string, anchorListCompile: string[]): any => {
    let children: GroupConfigItem[] = [];
    const isGccArmOrNot = projectInfo?.information?.board?.includes('3071') ? true : false;
    const isFbb = projectInfo?.information?.project_type?.includes('CFBB') ? true : false;
    // 3321和3322需要增加一个编译选项
    const isAddParameter = (projectInfo?.information?.board?.includes('3322') || projectInfo?.information?.board?.includes('brandy')) ? true : false;
    const constantType = 'constant_type';
    if (isAddParameter) {
      if (!anchorListCompile.includes('add_nhso_build_parameter')) {
        anchorListCompile.push('add_nhso_build_parameter');
      }
    } else {
      const index = anchorListCompile.indexOf('add_nhso_build_parameter');
      if (index !== -1) {
        anchorListCompile.splice(index, 1);
      }
    }
    for (const innerKey of anchorListCompile) {
      // fbb不支持部分编译选项配置
      if (isFbb && fbbUnsupportedCompilationOptions.includes(innerKey)) {
        continue;
      }
      // 3071不支持部分编译选项配置
      if (isGccArmOrNot && armGccUnsupportedCompilationOptions.includes(innerKey)) {
        continue;
      }
      let flag = warningSubitems.indexOf(innerKey) === -1 &&
        innerKey !== WARNING &&
        staticLibraryEnableSubitems.indexOf(innerKey) === -1 &&
        innerKey !== STATICLIBRARYENABLE &&
        innerKey !== constantType;
      if (flag) {
        children.push({ name: innerKey, group: key });
      }
      if (innerKey === WARNING) {
        let warningChildren: GroupConfigItem[] = [];
        warningChildren = warningSubitems.map((item: string) => {
          return { name: item, group: innerKey };
        });
        children.push({ name: innerKey, group: key, children: warningChildren });
      }
      if (innerKey === STATICLIBRARYENABLE) {
        let staticlibenChildren: GroupConfigItem[] = [];
        staticlibenChildren = staticLibraryEnableSubitems.map((item: string) => {
          return { name: item, group: innerKey };
        });
        children.push({ name: innerKey, group: key, children: staticlibenChildren });
      }
      if (innerKey === constantType) {
        if (jsonData?.[key]?.[constantType]) {
          children.push({ name: innerKey, group: key });
        }
      }
    }
    return children;
  };

  const getDebugItems = (key: string, projInfo: any, anchorListDebug: string[]): any => {
    let children: GroupConfigItem[] = [];
    const multiCoreChipList: string[] = ['nb17e', 'nb18'];
    const board = projectInfo?.information?.board;
    for (const innerKey of anchorListDebug) {
      if (innerKey === MULTICORE && !multiCoreChipList.includes(board)) {
        continue;
      }
      if (innerKey === PORT) {
        continue;
      }
      if (!projInfo[TOOL] && debugaToolNullSubitems.indexOf(innerKey) === -1) {
        continue;
      }
      if (projInfo[TOOL] !== JLINK && jlinkSubitems.indexOf(innerKey) !== -1) {
        continue;
      }
      const isNotToos = projInfo?.[TOOL] !== QEMU && toolSubitems.indexOf(innerKey) !== -1;
      if (isNotToos) {
        continue;
      }
      if (projInfo[TOOL] === QEMU && openocdSubitems.indexOf(innerKey) !== -1 && jlinkSubitems.indexOf(innerKey) !== -1) {
        continue;
      }
      if (innerKey === 'jlinkScriptPath' && projectInfo?.information?.project_type === 'MCU') {
        continue;
      }
      children.push({ name: innerKey, group: key });
    }
    return listSort(children, key);
  };

  const getUploadItems = (key: string, projInfo: any): any => {
    let children: GroupConfigItem[] = [];
    if (!projInfo[PROTOCOL]) {
      uploadTransModeNullSubitems.forEach((defaultKeyItem) => {
        children.push({ name: defaultKeyItem, group: key });
      });
    } else {
      const frontCommonKey = ['protocol', 'bin_path'];
      frontCommonKey.forEach((frontCommonKeyItem) => {
        children.push({ name: frontCommonKeyItem, group: key });
      });
      switch (projInfo[PROTOCOL]) {
        case SERIAL: {
          const serialKey = ['port', 'baud'];
          serialKey.forEach((serialKeyItem) => {
            children.push({ name: serialKeyItem, group: key });
          });
          break;
        }
        case USB: {
          const usbKey = ['usb_device_list'];
          usbKey.forEach((usbKeyItem) => {
            children.push({ name: usbKeyItem, group: key });
          });
          break;
        }
        case JTAG:
        case I2C:
        case SWD: {
          const jtagSwdKey = ['debug_board', 'frequency'];
          jtagSwdKey.forEach((jtagSwdI2cKeyItem) => {
            children.push({ name: jtagSwdI2cKeyItem, group: key });
          });
          break;
        }
        default:
          break;
      }
      const backCommonKey = ['reset', 'burn_verification'];
      backCommonKey.forEach((backCommonKeyItem) => {
        children.push({ name: backCommonKeyItem, group: key });
      });
    }
    return children;
  };

  const isNotDisplayAllinoneAnchor = (item: any): boolean => {
    if (!projectInfo?.information) {
      return true;
    }
    return item?.name === 'generate_allinone_bin' && projectInfo?.information &&
      !addGenerateAllinoneBin.includes(projectInfo?.information['board_build.mcu']);
  };

  const getAnchorLinkUI = (item: GroupConfigItem, trans: any): JSX.Element | null => {
    if (!item) {
      return null;
    }
    if (isNotDisplayAllinoneAnchor(item)) {
      return null;
    }
    return (<>
      <Anchor.Link
        key={`${item.group}-${item.name}`}
        href={`#${item.group}-${item.name}`}
        title={trans(item.name)}
      >
        {item?.children ? item.children.map((submitItem: GroupConfigItem) => (getAnchorLinkUI(submitItem, trans))) : null}
      </Anchor.Link>
    </>);
  };

  return <>
    <div className='project-config'>
      <div className='config-edit'>
        <div className='config-index'>
          <Anchor
            getContainer={(): HTMLElement | Window => document.querySelector('#config-container') as HTMLElement | Window}
            showInkInFixed
            affix={false}
          >
            {configInfo?.map((item: GroupConfigItem) => (getAnchorLinkUI(item, t)))}
          </Anchor>
        </div>
        <div className='config-container' id={`config-container`}>
          <Collapse activeKey={activeKeys} expandIcon={(): null => { return null }}>
            {configInfo.map((item: any) => {
              let headerName = t(item.name);
              if (props.path) {
                headerName = `${t(item.name)} (${t('independentCompileOptionTip', { path: props.path })})`;
              }
              return (
                <Collapse.Panel
                  key={`${item.group}`}
                  id={`${item.group}-${item.name}`}
                  header={headerName}
                >
                  {getTabPane({
                    name: item.group,
                    projectInfo,
                    independentConfig,
                    updateConfigInfo,
                    path: props.path,
                    componentKey,
                    presentTarget,
                    setPresentTarget,
                  })}
                </Collapse.Panel>
              );
            })}
          </Collapse>
        </div>
      </div>
    </div>
  </>;
};

const getTabPane = (tabPaneParam: any): JSX.Element => {
  const { name, projectInfo, independentConfig, updateConfigInfo, path, componentKey, presentTarget, setPresentTarget } = tabPaneParam;
  switch (name) {
    case INFORMATION:
      return <BaseInfoTabPane
        baseInfo={projectInfo.information}
        group={name}
        updateConfigInfo={updateConfigInfo}
        setPresentTarget = {setPresentTarget}
      />;
    case UPLOAD:
      return <UploadTabPane
        uploadInfo={projectInfo}
        group={name}
        updateConfigInfo={updateConfigInfo}
      />;
    case QEMU:
      return <SimulatorInfoTabPane simulationInfo={projectInfo} />;
    case COMPILE:
      return <CompilerInfoTabPane
        key={componentKey}
        path={path}
        compileInfo={projectInfo}
        independentConfig={independentConfig}
        group={name}
        updateConfigInfo={updateConfigInfo}
        presentTarget = {presentTarget}
      />;
    case DEBUG:
      return <DebuggerInfoTabPane
        debugInfo={projectInfo}
        group={name}
        updateConfigInfo={updateConfigInfo}
      />;
    default:
      return <div>TODO</div>;
  }
};

export default SettingApp;

