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
import { useNavigate } from 'react-router-dom';
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
import { Button, Checkbox, Modal, Tag } from 'antd';
import InputBoxComponent from './utils/InputBox';
import flash from '../../../resources/flash.svg';
import compile from '../../../resources/compile.svg';
import { PortInfo } from '@src/backEnd/interface/api';
import type { ChipName } from '@src/backEnd/storage/ChipConfigMap';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux' | 'windows';

// Chips that don't show a baud-rate selector (they use a fixed rate).
const BAUDRATE_CHIPS: ChipName[] = ['1156e'];

const ERASE_TAG_OPTIONS = ['fac', 'cfga', 'cfgb', 'log', 'pstore', 'fwka', 'fwkb', 'app', 'rootfs_data'];

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

  // 1156e burn type (Serial / Usb)
  const [burnType, setBurnType] = useState<string>('Serial');

  // 1156e IP configuration
  const [ipAddr, setIpAddr] = useState<string>('');           // selected host-side IP
  const [ipAddress, setIpAddress] = useState<string>('');     // device target IP (editable via modal)
  const [gateway, setGateway] = useState<string>('');
  const [subnetMask, setSubnetMask] = useState<string>('255.255.254.0');
  const [isIPConfigOpen, setIPConfigOpen] = useState(false);

  // 1156e erase configuration
  const [isEraseConfigOpen, setEraseConfigOpen] = useState(false);
  const [selectedEraseTags, setSelectedEraseTags] = useState<string[]>([]);
  const [emptyFlash, setEmptyFlash] = useState<boolean>(false);

  // Chip info from Redux (populated by importConfigandTarget via SAVE_CONFIG_CALLBACK).
  const chipName = (useSelector((state: any) => state.entities.chipName) ?? 'NONE') as ChipName;
  const is1156e = chipName === '1156e';

  // Local IP list — populated by LocalIpWatcher (to be implemented separately).
  const localIps = (useSelector((state: any) => state.entities.localIps) ?? []) as Array<{ ip: string; netmask: string }>;

  const ports = useSelector((state: any) => state.entities.ports) as [];
  let isFlashed = useSelector((state: any) => state.entities.isFlashed);

  const handleProfClick = (): void => {
    vscode.postMessage({
      method: 'generateDeployTS', params: {
        timeStamp: lastConvertTS,
      },
    });

    if (is1156e) {
      setBuildPending(true);
      notify('Start compiling. Check the output channel for more detail.', { type: 'info', stack: false, duration: 1 });
      vscode.postMessage({ method: 'startBuilding', buildTarget: 'build_mkp', chipName });
      return;
    }

    if (target === 'CPU') {
      setBuildPending(true);
      vscode.postMessage({ method: 'cpuDeploySetup', source });
      return;
    }

    setBuildPending(true);
    notify('Start compiling. Check the output channel for more detail.', { type: 'info', stack: false, duration: 1 });
    vscode.postMessage({ method: 'startBuilding', buildTarget: 'pack_3322_wstp' });
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

    if (is1156e) {
      const missing: string[] = [];
      if (burnType === 'Serial' && !flashPort) { missing.push('port'); }
      if (!ipAddr) { missing.push('IP Addr'); }
      if (!ipAddress) { missing.push('IP address'); }
      if (!gateway) { missing.push('gateway'); }
      if (!subnetMask) { missing.push('subnet mask'); }
      if (missing.length > 0) {
        notify(`Configure ${missing.join(' and ')} before flashing.`, { type: 'info', stack: false, duration: 3 });
        return;
      }
      const flashParams = {
        burnType,
        port: burnType === 'Serial' ? flashPort : '',
        baudRate: '115200',
        target,
        chipName,
        ipAddr,
        ipAddress,
        gateway,
        subnetMask,
        eraseTags: selectedEraseTags,
        emptyFlash,
      };
      IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: flashParams.port, baudRate: flashParams.baudRate, target }));
      vscode.postMessage({ method: ApiMethod.START_FLASHING, params: flashParams });
      return;
    }

    // ws63 / 3322
    const missing: string[] = [];
    if (!flashPort) { missing.push('port'); }
    if (!baudRate) { missing.push('baud rate'); }
    if (missing.length > 0) {
      notify(`Configure ${missing.join(' and ')} before flashing.`, { type: 'info', stack: false, duration: 3 });
      return;
    }
    IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: flashPort, baudRate, target }));
    vscode.postMessage({ method: ApiMethod.START_FLASHING, params: { port: flashPort, baudRate, target, chipName } });
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
          IStore.getStore().dispatch(updateEntity('navbarStatus', msg.data));
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
          notify(`Failed to flash : ${errMsg}`, { type: 'error', stack: false, duration: 2 });
        }
        return;
      }

      // FlashSuccess
      if (msg?.type === 'FlashSuccess') {
        setIsFlashed(true);
        notify('Successfully flashed.', { type: 'info', stack: false, duration: 2 });
        return;
      }

      // FlashAgain
      if (msg?.type === 'FlashAgain') {
        setIsFlashed(false);
        handleFlashing();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
      if (msg.type === 'FlashFailed') {
        setIsFlashed(false);
        IStore.getStore().dispatch(updateEntity('deploySelectValue', { port: '', baudRate: '', target: target }));
        const errMsg = msg.params?.description;
        const failMsg = errMsg ? errMsg : 'Unknown reason';
        if (failMsg.includes('aborted by user')) {
          notify('Flashing aborted.', { type: 'warning', stack: false, duration: 2 });
        } else {
          notify(`Failed to flash : ${failMsg}`, { type: 'error', stack: false, duration: 2 });
        }
      }
      if (msg.type === 'FlashSuccess') {
        setIsFlashed(true);
        notify('Successfully flashed.', { type: 'info', stack: false, duration: 2 });
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
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'center' }}>

          {/* SDK Compile */}
          <div className='inputs-class-table' style={{ display: 'flex', justifyContent: 'space-between', width: 'unset', alignItems: 'center' }}>
            <span style={{ minWidth: '85px' }}>SDK Compile</span>
            <div className="SC-info-btn" style={{ marginLeft: '10px', display: 'flex' }}>
              <Button className="deploy-btn" onClick={handleProfClick}>
                <img src={compile} alt="compile" style={{ marginRight: '8px', marginBottom: '3px', width: '16px', height: '16px' }} />
                Build
              </Button>
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

          <p className="deploy-p">|</p>

          {/* Port / BaudRate / Burn + 1156e extras */}
          <div className='inputs-class-table' style={{ width: 'unset' }}>
            {/* Row 1: burn type, port, baud rate, burn button */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {is1156e && (
                <div style={{ whiteSpace: 'nowrap' }}>
                  <SelectSerial
                    label={'Burn Type'}
                    labelwidth={'63px'}
                    selectVal={burnType}
                    portOptions={[{ value: 'Serial', label: 'Serial' }, { value: 'Usb', label: 'Usb' }]}
                    selectWidth={'15vw'}
                    changeHandler={setBurnType}
                  />
                </div>
              )}
              {burnType !== 'Usb' && (
                <div style={{ whiteSpace: 'nowrap' }}>
                  <SelectSerial
                    label={'Burn Port'}
                    labelwidth={'63px'}
                    selectVal={flashPort}
                    portOptions={portOptions}
                    selectWidth={'15vw'}
                    changeHandler={setflashPort}
                  />
                </div>
              )}
              {!BAUDRATE_CHIPS.includes(chipName) && (
                <div style={{ whiteSpace: 'nowrap' }}>
                  <SelectSerial
                    label={'Baud Rate'}
                    labelwidth={'63px'}
                    selectVal={baudRate}
                    portOptions={baudrateOptions.baudRate}
                    selectWidth={'15vw'}
                    changeHandler={setBaudRate}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                <div className="SC-info-btn" style={{ display: 'flex' }}>
                  <Button className="deploy-btn" onClick={(e): void => { e.currentTarget.blur(); handleFlashing(); }}>
                    <img src={flash} alt="flash" style={{ marginRight: '8px', marginBottom: '3px', width: '16px', height: '16px' }} />
                    Burn
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2 (1156e only): IP Addr + IP Config + Erase Config + Empty Flash */}
            {is1156e && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <SelectSerial
                    label={'IP Addr'}
                    labelwidth={'63px'}
                    selectVal={ipAddr}
                    portOptions={localIps.map(item => ({ value: item.ip, label: item.ip }))}
                    selectWidth={'15vw'}
                    changeHandler={(value: string): void => {
                      setIpAddr(value);
                      // Auto-derive gateway (last octet = 1) and device IP (last octet = host + 1).
                      const parts = value.split('.');
                      const gwParts = [...parts];
                      gwParts[3] = '1';
                      setGateway(gwParts.join('.'));
                      parts[3] = String(Number(parts[3]) + 1);
                      setIpAddress(parts.join('.'));
                      const match = localIps.find(item => item.ip === value);
                      if (match) { setSubnetMask(match.netmask); }
                    }}
                  />
                </div>
                <Button className="deploy-btn" onClick={(): void => setIPConfigOpen(true)}>
                  <span className="ant-select">IP Config</span>
                </Button>
                <Button className="deploy-btn" onClick={(): void => setEraseConfigOpen(true)}>
                  <span className="ant-select">Erase Config</span>
                </Button>
                <Checkbox
                  style={{ marginTop: '6px', whiteSpace: 'nowrap' }}
                  checked={emptyFlash}
                  onChange={(e): void => setEmptyFlash(e.target.checked)}
                >
                  <span className="ant-select">Empty Flash</span>
                </Checkbox>
              </div>
            )}
          </div>

          <div className="SC-info-btn">
            <Button className="left-bt" onClick={(): void => {
              if (lastConvertTS) {
                vscode.postMessage({ method: 'generateDeployTS', params: { timeStamp: lastConvertTS } });
                IStore.getStore().dispatch(updateEntity('navbarStatus', ['finish', 'finish', 'finish', 'finish', 'process']));
                IStore.getStore().dispatch(updateEntity('nowStatus', 4));
              }
              navigate('/benchmark');
            }}>
              &nbsp;&nbsp;Next&nbsp;&nbsp;
            </Button>
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
                <h2 className="title">Download MSLite Micro Libraries</h2>
                <p className="subtitle">
                  Download optimized codes with libs associated with your pre-trained Neural Network.
                </p>
              </div>
            </div>
            <button className="btn-deploy-bright" onClick={handleDownloadModel}>
              <img src={downloadIcon} alt="save_as" />
            </button>
          </div>

          <div className="Deply1-container" hidden={target === 'NPU' ? false : true}>
            <div>
              <img src={demoIcon} alt="download icon" style={{ width: '60px', height: '60px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 className="title">Download OM Model</h2>
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

      {/* IP Config modal */}
      <Modal
        title="IP Config"
        open={isIPConfigOpen}
        onCancel={(): void => setIPConfigOpen(false)}
        footer={[
          <Button key="save" type="primary" onClick={(): void => setIPConfigOpen(false)}>Save</Button>,
          <Button key="cancel" onClick={(): void => setIPConfigOpen(false)}>Cancel</Button>,
        ]}
        width={360}
        maskClosable={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
          <InputBoxComponent
            labelWidth={90}
            labelOrP={true}
            transmitStyle={true}
            inputBox={{ group: 'ip', key: 'ipAddress', title: 'IP Address', content: ipAddress, disabled: false, isPlainTextInput: true }}
            getInputed={(val): void => setIpAddress(String(val))}
            editable={true}
          />
          <InputBoxComponent
            labelWidth={90}
            labelOrP={true}
            transmitStyle={true}
            inputBox={{ group: 'ip', key: 'subnetMask', title: 'Subnet Mask', content: subnetMask, disabled: false, isPlainTextInput: true }}
            getInputed={(val): void => setSubnetMask(String(val))}
            editable={true}
          />
          <InputBoxComponent
            labelWidth={90}
            labelOrP={true}
            transmitStyle={true}
            inputBox={{ group: 'ip', key: 'gateway', title: 'Gateway', content: gateway, disabled: false, isPlainTextInput: true }}
            getInputed={(val): void => setGateway(String(val))}
            editable={true}
          />
        </div>
      </Modal>

      {/* Erase Config modal */}
      <Modal
        title="Erase Config"
        open={isEraseConfigOpen}
        onCancel={(): void => setEraseConfigOpen(false)}
        footer={[
          <Button key="ok" type="primary" onClick={(): void => setEraseConfigOpen(false)}>OK</Button>,
        ]}
        width={400}
        maskClosable={false}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
          {ERASE_TAG_OPTIONS.map((tag) => (
            <Tag.CheckableTag
              key={tag}
              checked={selectedEraseTags.includes(tag)}
              onChange={(checked): void => {
                setSelectedEraseTags(
                  checked
                    ? [...selectedEraseTags, tag]
                    : selectedEraseTags.filter(t => t !== tag)
                );
              }}
              style={{ padding: '4px 12px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', textAlign: 'center' }}
            >
              <span className="ant-select">{tag}</span>
            </Tag.CheckableTag>
          ))}
        </div>
      </Modal>
    </div>
  );
}
export default Deploy;
