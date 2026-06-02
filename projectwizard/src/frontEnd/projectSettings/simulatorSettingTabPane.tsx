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
import { Row, Col, Select, Space, Input, Divider, Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import type { OperateStruct, SaveIniStruct } from '../../backEnd/interface/model';
import { getInfo, save2Ini } from '../actions';
import { useDispatch, useSelector } from 'react-redux';

const SimulatorInfoTabPane = (simulationInfo: any): JSX.Element => {
  const { Option } = Select;
  const { t } = useTranslation();
  const qemuIni = simulationInfo?.simulationInfo?.qemu;
  const [graphicEnable, setGraphicEnable] = useState<boolean>(qemuIni?.enable_graphic);
  const [ramSize, setRamSize] = useState<string>(qemuIni?.ram_size);
  const [debugPort, setDebugPort] = useState<string>(qemuIni?.debug_port);
  const [emulatorType, setEmulatorType] = useState<string>(qemuIni?.emulator_type);
  const [customParameter, setCustomParameter] = useState<string>(qemuIni?.custom_parameter);
  let [emulators, setEmulators] = useState<Array<string>>([]);

  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
    source: 'setting',
  };

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const dispatch = useDispatch();
  const chip: any = useSelector((state: any) => state.entities.chipConfig);
  // triggered at the first time
  useEffect(() => {
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: simulationInfo?.simulationInfo?.information?.json_path,
      sdkPath: simulationInfo?.simulationInfo?.information?.sdk_path,
    };
    dispatch(getInfo(operateData));
  }, [dispatch]);

  useEffect(() => {
    if (chip?.qemu) {
      emulators = [];
      setEmulators(emulators);
      emulators.push(...chip?.qemu?.emulator_type);
      setEmulators(emulators);
    }
  }, [chip]);

  const saveFormData = (): void => {
    const data = {
      section: 'qemu',
      params: {
        enable_graphic: graphicEnable,
        ram_size: ramSize,
        debug_port: debugPort,
        emulator_type: emulatorType,
        custom_parameter: customParameter,
      },
    };
    saveParams.data = data;
    dispatch(save2Ini(saveParams));
  };

  useEffect(() => {
    saveFormData();
  }, [graphicEnable, ramSize, debugPort, emulatorType, customParameter]);

  return <>
    <Space direction="vertical" size="large" className='width100'>
      <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }} className='font-lger' justify="center" align="bottom" wrap={false}>
        <p className='ant-modal-title' style={{ fontSize: 20 }}>{t('qemu')}{t('configuration')}</p>
      </Row>
      <Divider />
      <Row gutter={{ md: 16, lg: 8 }} wrap={false}>
        <Col className="gutter-row vertical-center left-content" md={3} lg={4} offset={2}>
          <p className='ant-modal-title' style={{ fontSize: 15 }}>{t('ramSize')}</p>
        </Col>
        <Col className="gutter-row right-content" md={12} lg={10}>
          <Input className='ant-input-text width100' defaultValue={ramSize}
            onBlur={(e): void => {
              setRamSize(e.target.value);
            }} />
        </Col>
      </Row>
      <Row gutter={{ md: 16, lg: 8 }} wrap={false}>
        <Col className="gutter-row vertical-center left-content" md={3} lg={4} offset={2}>
          <p className='ant-modal-title' style={{ fontSize: 15 }}>{t('port')}</p>
        </Col>
        <Col className="gutter-row right-content" md={12} lg={10}>
          <Input className='ant-input-text width100' defaultValue={debugPort}
            onBlur={(e): void => {
              setDebugPort(e.target.value);
            }} />
        </Col>
      </Row>
      <Row gutter={{ md: 16, lg: 8 }} wrap={false}>
        <Col className="gutter-row vertical-center left-content" md={3} lg={4} offset={2}>
          <p className='ant-modal-title' style={{ fontSize: 15 }}>{t('emulator')}</p>
        </Col>
        <Col className="gutter-row right-content" md={12} lg={10}>
          <Select
            defaultValue={emulatorType}
            className='width100'
            showArrow={emulators.length > 0 ? true : false}
            open={emulators.length > 0 ? undefined : false}
            onChange={(value): void => {
              setEmulatorType(value);
            }}
          >
            {
              emulators.map((item) => {
                return <Option key={item} value={item}>
                  {item}
                </Option>;
              })
            }
          </Select>
        </Col>
      </Row>
      <Row gutter={{ md: 16, lg: 8 }} wrap={false}>
        <Col className="gutter-row vertical-center left-content" md={3} lg={4} offset={2}>
          <p className='ant-modal-title' style={{ fontSize: 15 }}>{t('GPIOCustomParameter')}</p>
        </Col>
        <Col className="gutter-row right-content" md={12} lg={10}>
          <Input className='ant-input-text width100' defaultValue={customParameter}
            onBlur={(e): void => {
              setCustomParameter(e.target.value);
            }} />
        </Col>
      </Row>
      {!graphicEnable ? null : <Row gutter={{ md: 16, lg: 8 }} wrap={false}>
        <Col className="gutter-row" md={3} lg={4} offset={6}>
          <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
            defaultChecked={graphicEnable}
            onChange={(e): void => {
              setGraphicEnable(e.target.checked);
            }}>{t('enableGraphic')}</Checkbox>
        </Col>
      </Row>}
    </Space>
  </>;
};

export default SimulatorInfoTabPane;

