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
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { notify } from '../common';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import { vscode } from '@src/frontEnd/index';
import demoIcon from '../../../resources/deploy/graph_icon.svg';
import downloadIcon from '../../../resources/deploy/downInfo.svg';
import type { Message } from '@src/backEnd/interface/api';
import '../a-styles/app.css';
import { IStore } from '../core/store/store';
import { updateEntity } from '../core/store/actions';
import { useSelector } from 'react-redux';
import { ImageInfo } from '../component/ImageInfo';
import { SelectSerial } from '../component/SelectSerial/SelectSerial';
import { Button } from 'antd';
import flash from '../../../resources/flash.svg';
import compile from '../../../resources/compile.svg';
import { PortInfo } from '@src/backEnd/interface/api';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux' | 'windows';

// Deploy
function Deploy(props: { target: Target; source: Source }): React.JSX.Element {
  const [model, setModel] = useState<string>('');
  const { target, source } = props;
  const navigate = useNavigate();
  const lastConvertTS = useSelector((state: any) => state.entities.lastConvertTS);
  // CPU Deploy Value
  const deploySelectValue = useSelector((state: any) => state.entities.deploySelectValue);
  const [flashPort, setflashPort] = useState<string>('');
  const [baudRate, setBaudRate] = useState<string>('');
  const [buildPending, setBuildPending] = useState(false);
  const ports = useSelector((state: any) => state.entities.ports) as [];
  let isFlashed = useSelector((state: any) => state.entities.isFlashed);

  const logSuccess = (): void => {
    const deployMsg: Message = {
      method: ApiMethod.UPDATE_LAST_TS,
      params: {
        timeStamp: lastConvertTS,
        page: 'Deploy',
      },
    };
    vscode.postMessage(deployMsg);
  };

  const handleProfClick = (): void => {
    vscode.postMessage({
      method: 'generateDeployTS', params: {
        timeStamp: lastConvertTS,
      },
    });
    if (target === 'CPU') {
      setBuildPending(true);
      vscode.postMessage({ method: 'cpuDeploySetup', source });
      return;
    }
    const buildTarget = 'pack_3322_wstp';
    setBuildPending(true);
    notify(
      'Start compiling. Check the output channel for more detail.',
      { type: 'info', stack: false, duration: 1 }
    );
    vscode.postMessage({ method: 'startBuilding', buildTarget });
  };

  const handleDownloadModel = (): void => {
    const nextPage = '../benchmark';
    const chipMessage: Message = {
      method: ApiMethod.DOWNLOAD_OUTPUTS,
      params: { target, nextPage },
    };
    vscode.postMessage(chipMessage);
  };

  const portOptions = ports?.map((port: PortInfo) => ({
    value: port.path,
    label: port.label,
  }));

  const baudrateOptions = {
    baudRate: [
      { value: '921600', label: '921600' },
    ],
  };

  const handleFlashing = (): void => {
    if (isFlashed) {
      vscode.postMessage({ method: 'confirmFlash', isFlashed });
      return;
    }

    // flash.
    let missing: string[] = [];
    if (!flashPort) { missing.push('port'); }
    if (!baudRate) { missing.push('baud rate'); }
    if (missing.length > 0) {
      notify(`Configure ${missing.join(' and ')} before flashing.`, { type: 'info', stack: false, duration: 3 });
      return;
    }
    IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: flashPort, baudRate: baudRate, target: target }));
    vscode.postMessage({ method: ApiMethod.START_FLASHING, params: { port: flashPort, baudRate: baudRate, target: target } });
  };

  useEffect(() => {
    const store = IStore.getStore();
    const currentFileName = store.getState().entities.selectedFileName;
    if (currentFileName) {
      setModel(currentFileName);
    }

    const unsubscribe = store.subscribe(() => {
      const newFileName = store.getState().entities.selectedFileName;
      if (newFileName) {
        setModel(newFileName);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (deploySelectValue) {
      setflashPort(deploySelectValue.port);
      setBaudRate(deploySelectValue.baudRate);
    }
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      // Failed to build
      if (msg === 'compileFailed' || msg?.type === 'compileFailed') {
        setBuildPending(false);
        IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: '', baudRate: '', target: target }));
        notify(
          'Compilation failed. Check output panel for more details',
          { type: 'error', stack: false, duration: 2 }
        );
        return;
      }

      // Build aborted by user
      if (msg?.type === 'compileAborted') {
        setBuildPending(false);
        notify('Compilation terminated.', { type: 'info', stack: false, duration: 2 });
        return;
      }

      // Build done
      if (msg === 'compileDone') {
        setBuildPending(false);
        return;
      }

      // Update status
      if (msg?.type === 'UpdateModelStatus') {
        if (lastConvertTS) {
          IStore.getStore().dispatch(
            updateEntity('navbarStatus', msg.data)
          );
        }
        return;
      }

      // Info
      if (msg?.type === 'Info') {
        if (msg.params?.description?.includes('Binary found')) {
          setBuildPending(false);
        }
        notify(msg.params.description, { type: 'info', stack: false, duration: 2 });
        return;
      }

      // Failed to flash
      if (msg?.type === 'FlashFailed') {
        setIsFlashed(false);
        IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: '', baudRate: '', target: target }));
        const errMsg = msg.params?.description ?? 'Unknown reason';
        if (errMsg.includes('aborted by user')) {
          notify('Flashing aborted.', { type: 'warning', stack: false, duration: 2 });
        } else {
          notify(
            `Failed to flash : ${errMsg}`,
            { type: 'error', stack: false, duration: 2 }
          );
        }

        return;
      }

      // FlashSuccess
      if (msg?.type === 'FlashSuccess') {
        setIsFlashed(true);
        notify(
          'Successfully flashed.',
          { type: 'info', stack: false, duration: 2 }
        );

        return;
      }

      // FlashAgain
      if (msg?.type === 'FlashAgain') {
        setIsFlashed(false);
        handleFlashing();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate]);

  // Flash 状态
  const setIsFlashed = (flashed: boolean): void => {
    isFlashed = flashed;

    vscode.postMessage({
      method: ApiMethod.SAVE_CONFIG,
      params: { data: flashed, key: 'isFlashed' },
    });

    IStore.getStore().dispatch(updateEntity('isFlashed', flashed));
  };
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;

      // Message from flashing.
      if (msg.type === 'FlashFailed') {
        setIsFlashed(false);
        IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: '', baudRate: '', target: target }));
        const errMsg = msg.params?.description;
        const failMsg = errMsg ? errMsg : 'Unknown reason';
        if (failMsg.includes('aborted by user')) {
          notify('Flashing aborted.', { type: 'warning', stack: false, duration: 2 });
        } else {
          notify(
            `Failed to flash : ${failMsg}`,
            { type: 'error', stack: false, duration: 2 }
          );
        }
      }
      if (msg.type === 'FlashSuccess') {
        setIsFlashed(true);
        notify(
          'Successfully flashed.',
          { type: 'info', stack: false, duration: 2 }
        );
        IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'finish', 'finish']));
      }
      if (msg.type === 'FlashAgain') {
        setIsFlashed(false);
        handleFlashing();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setIsFlashed]);

  return (
    <div className="navigation">
      <div className="aa-container">
        <strong style={{ fontSize: '17px' }}>Model currently selected</strong>
        <div>
          <div className='model-selected'>
            <ImageInfo modelName={model} />
            <span style={{ marginLeft: '8px', fontSize: '18px' }}>{model}</span>
          </div>
        </div>
      </div>
      <div className="deploy-feature">
        <strong style={{ fontSize: '17px' }}>Build and Burn</strong>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '20px',
        }}>
          <div className='inputs-class-table' style={{ display: 'flex', justifyContent: 'space-between', width: 'unset' }}>
            <span style={{ marginTop: '7px', minWidth: '85px' }}>SDK Compile</span>
            <div className="SC-info-btn" style={{ marginLeft: '10px', display: 'flex' }}>
              <Button className="deploy-btn" onClick={handleProfClick}>
                <img src={compile} alt="compile" style={{ marginRight: '8px', marginBottom: '3px', width: '16px', height: '16px' }} />
                Build</Button>
              {buildPending && (
                <Button
                  className='deploy-btn'
                  danger
                  style={{ marginLeft: '10px' }}
                  onClick={(e): void => {
                    e.stopPropagation();
                    vscode.postMessage({ method: ApiMethod.STOP_BUILDING });
                  }}>
                  Abort
                </Button>
              )}
            </div>
          </div>
          <p className="deploy-p" style={{ marginTop: '10px' }}>|</p>

          <div className='inputs-class-table' style={{ display: 'flex', gap: '10px', width: 'unset' }}>
            <div style={{ whiteSpace: 'nowrap' }}>
              <SelectSerial label={'Burn Port'} labelwidth={'70'} selectVal={flashPort} portOptions={portOptions} selectWidth={'15vw'} changeHandler={setflashPort} />
            </div>
            <div style={{ whiteSpace: 'nowrap' }}>
              <SelectSerial label={'Baud Rate'} selectVal={baudRate} portOptions={baudrateOptions.baudRate} selectWidth={'15vw'} changeHandler={setBaudRate} />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '10px',
            }}>
              <div className="SC-info-btn" style={{ display: 'flex' }}>
                <Button className="deploy-btn" onClick={
                  (e): void => {
                    e.currentTarget.blur();
                    handleFlashing();
                  }
                }><img src={flash} alt="flash" style={{ marginRight: '8px', marginBottom: '3px', width: '16px', height: '16px' }} /> Burn </Button>
              </div>
            </div>
          </div>
          <div className="SC-info-btn" style={{ marginTop: '10px' }}>
            <Button className="left-bt" onClick={(): void => {
              if (lastConvertTS) {
                vscode.postMessage({ method: 'generateDeployTS', params: { timeStamp: lastConvertTS } });
                IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'finish', 'process']));
                IStore.getStore().dispatch(updateEntity('nowStatus', 4));
              }
              navigate('/benchmark');
            }}>
              &nbsp;&nbsp;Next&nbsp;&nbsp;</Button>
          </div>
        </div>
      </div>
      <div className="Deply-container">
        <strong style={{ fontSize: '17px' }}>Download Results</strong>

        <div className="D-c-1">
          <div className="Deply1-container" hidden={target === 'CPU' ? false : true}>
            <div>
              <img src={demoIcon} alt="download icon" style={{ width: '60px', height: '60px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div>
                <h2 className="title" > Download MSLite Micro Libraries </h2>
                <p className="subtitle">
                  Download optimized codes with libs associated with your pre-trained Neural Network.
                </p>
              </div>
            </div>
            <button className="btn-deploy-bright" onClick={handleDownloadModel} >
              <img src={downloadIcon} alt="save_as" />
            </button>
          </div>

          <div className="Deply1-container" hidden={target === 'NPU' ? false : true}>
            <div>
              <img src={demoIcon} alt="download icon" style={{ width: '60px', height: '60px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 className="title"> Download OM Model </h2>
              <p className="subtitle">
                Download offline model adapted to Ascend AI devices.
              </p>
            </div>
            <button className="btn-deploy-bright" onClick={handleDownloadModel}>
              <img src={downloadIcon} alt="save_as" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Deploy;