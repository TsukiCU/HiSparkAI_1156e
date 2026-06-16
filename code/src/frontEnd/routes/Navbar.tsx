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
import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Logger } from '../core/log4jsfrontend';
import { vscode } from '..';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Steps, Button } from 'antd';
import { updateEntity } from '../core/store/actions';
import { IStore } from '../core/store/store';
import '../a-styles/Navbar.css';
import ConvertIcon from '../../../resources/button/ConvertIcon.svg';
import DeployIcon from '../../../resources/button/DeployIcon.svg';
import ProfilingIcon from '../../../resources/button/ProfilingIcon.svg';
import SelectModelIcon from '../../../resources/button/SelectModelIcon.svg';
import CompressionIcon from '../../../resources/button/CompressionIcon.svg';
import ConvertLight from '../../../resources/button/convertLight.svg';
import DeployLight from '../../../resources/button/deployLight.svg';
import ProfilingLight from '../../../resources/button/ProfilingLight.svg';
import SelectModelLight from '../../../resources/button/SelectModelLight.svg';
import CompressionLight from '../../../resources/button/CompressionLight.svg';
import SelectedIcon from '../../../resources/button/SelectedIcon.svg';
import ConvertActiveIcon from '../../../resources/button/ConvertActiveIcon.svg';
import SelectModelActiveIcon from '../../../resources/button/SelectModelActiveIcon.svg';
import ProfilingActiveIcon from '../../../resources/button/ProfilingActiveIcon.svg';
import CompressionActiveIcon from '../../../resources/button/CompressionActiveIcon.svg';
import DeployActiveIcon from '../../../resources/button/DeployActiveIcon.svg';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { Message } from '@src/backEnd/interface/api';
import { notify } from '../common';

declare global {
  interface Window {
    initialData?: any;
  }
};

const enum STEPSTATUS {
  MODEL = 0,
  COMPRESSION = 1,
  CONVERT = 2,
  DEPLOY = 3,
  PROFILING = 4,
};

function Navbar(): React.JSX.Element {
  const themeData = useSelector((state: any) => state.entities.themeData);
  const nowStatus = useSelector((state: any) => state.entities.nowStatus);
  const navbarStatus = useSelector((state: any) => state.entities.navbarStatus);
  const selectedFileNames = useSelector((state: any) => state.entities.selectedFileName);
  const skipQuantize = useSelector((state: any) => Boolean(state.entities.skipQuantize));
  const [serverHost, setServerHost] = useState(window.initialData?.kind);
  const [current, setCurrent] = useState(0);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const updateNavLinkArr = useCallback((ind: any) => {
    setNavLinkArr(prev =>
      prev.map((item, index) => {
        return { ...item, stepStatus: ind[index] };
      })
    );
  }, []);
  const handleProfilingModalOpen = (): void => {
    const proGraphMessage: Message = {
      method: ApiMethod.IMPORT_PROGRAPH,
    };
    Logger.info(`前端发送消息给后端 secondload, ${proGraphMessage}`);
    vscode.postMessage(proGraphMessage);

    const proValidationMessage: Message = {
      method: ApiMethod.IMPORT_PROVALIDATION,
    };
    Logger.info(`前端发送消息给后端 secondload, ${proValidationMessage}`);
    vscode.postMessage(proValidationMessage);
    updateNavLinkArr(STEPSTATUS.PROFILING);
  };
  const [navLinkArr, setNavLinkArr] = useState([
    { stepStatus: 'process', to: '/selectmodel', clickFunc: '', imgIcon: SelectModelIcon, activeIcon: SelectModelLight, selectIcon: SelectModelActiveIcon, desc: 'Select Model' },
    { stepStatus: 'waiting', to: '/quantize', clickFunc: '', imgIcon: CompressionIcon, activeIcon: CompressionLight, selectIcon: CompressionActiveIcon, desc: 'Quantize' },
    { stepStatus: 'waiting', to: '/convert', clickFunc: '', imgIcon: ConvertIcon, activeIcon: ConvertLight, selectIcon: ConvertActiveIcon, desc: 'Convert' },
    { stepStatus: 'waiting', to: '/deploy', clickFunc: '', imgIcon: DeployIcon, activeIcon: DeployLight, selectIcon: DeployActiveIcon, desc: 'Deploy' },
    { stepStatus: 'waiting', to: '/benchmark', clickFunc: handleProfilingModalOpen, imgIcon: ProfilingIcon, activeIcon: ProfilingLight, selectIcon: ProfilingActiveIcon, desc: 'Benchmark' },
  ]);
  const onSelectModel = pathname === '/' || pathname === '/selectmodel';
  const items = navLinkArr.map((item: any, index: number) => {
    const icon = SelectedIcon;
    const themeIcon = themeData === 'dark' || (!themeData && serverHost === 2) ? item.imgIcon : item.activeIcon;
    let selectIcon = pathname === item.to ? item.selectIcon : '';
    if (pathname === '/') {
      selectIcon = item.to === '/selectmodel' ? SelectModelActiveIcon : '';
    }

    // 1156e: Quantize (index 1) is always grayed (skipped/disabled) — never shows
    // a checkmark, since the step was bypassed rather than completed.
    const effectiveStatus = (skipQuantize && index === 1)
      ? 'wait'
      : item.stepStatus;

    let finalIcon = selectIcon;
    if (finalIcon === '') {
      finalIcon = effectiveStatus === 'finish' ? icon : themeIcon;
    }
    let finalFilter = '';
    if (!(themeData === 'dark' || (!themeData && serverHost === 2))) {
      if (effectiveStatus === 'finish' || selectIcon) {
        finalFilter = 'unset';
      } else { finalFilter = 'invert(60%)'; }
    }
    return {
      icon: <>
        <img
          src={finalIcon}
          alt='icon'
          style={{
            width: '20px',
            height: '20px',
            filter: finalFilter,
          }}
        /> <span className={selectIcon !== '' ? 'select-desc button-text' : 'ant-select button-text'}>{item.desc}</span></>
      ,
      status: effectiveStatus,
    };
  });
  const next = (): void => {
    const currents = current + 1;
    setCurrent(currents);
    mapRouter(currents);
    updateNavLinkArr(currents);
  };

  const prev = (): void => {
    const currents = current - 1;
    setCurrent(currents);
    mapRouter(currents);
    updateNavLinkArr(currents);
  };
  const handleChange = (currents: any): void => {
    if (!selectedFileNames) {
      notify('Select a model first.', { type: 'error', stack: false, duration: 2 });
      return;
    }
    // 1156e: Quantize step (index 1) is skipped — block direct navigation to it.
    if (skipQuantize && currents === STEPSTATUS.COMPRESSION) { return; }
    setCurrent(currents);
    mapRouter(currents);
  };

  const mapRouter = (routerNum: number): void => {
    IStore.getStore().dispatch(updateEntity('nowStatus', routerNum));
    switch (routerNum) {
      case 0:
        navigate('/selectmodel');
        break;
      case 1:
        navigate('/quantize');
        break;
      case 2:
        navigate('/convert');
        break;
      case 3:
        navigate('/deploy');
        break;
      case 4:
        navigate('/benchmark');
        break;
      default:
        break;
    }
  };
  useEffect(() => {
    // 挂载的时候执行
    updateNavLinkArr(['process', 'wait', 'wait', 'wait', 'wait']);
  }, []);
  useEffect(() => {
    setCurrent(nowStatus);
  }, [nowStatus]);
  useEffect(() => {
    if (navbarStatus) {
      updateNavLinkArr(navbarStatus);
    }
  }, [navbarStatus]);

  return (
    <div className="navbar-container">
      <div className="nav-buttons">
        <Steps current={current} className={(themeData === 'dark' || (!themeData && serverHost === 2)) ? '' : 'step-process'} labelPlacement="vertical" items={items} onChange={handleChange} responsive={false}/>
      </div>

      <div className="outlet-container">
        <Outlet />
      </div>
    </div>
  );
}
export default Navbar;