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
import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import type { SaveIniStruct } from '../../../backEnd/interface/model';
import { save2Ini } from '../../actions';
import Title from '../title';
import { setDocumentById } from '../setDocumentById';

const QemuConfig = (qemuInfo: any): JSX.Element => {
  const group = qemuInfo?.group;
  const { t } = useTranslation();
  const qemuIni = qemuInfo?.qemuInfo?.debugInfo?.qemu;
  const [debugPort, setDebugPort] = useState<string>(qemuIni?.debug_port);

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const dispatch = useDispatch();

  const saveFormData = (): void => {
    const data = {
      section: 'qemu',
      params: {
        debug_port: debugPort,
      },
    };
    saveParams.data = data;
    qemuInfo.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };
  useEffect(() => {
    saveFormData();
  }, [debugPort]);

  return <>
    <div className='config-card' id={setDocumentById(group, 'port')}>
      <Title name={t('port')} description='' />
      <Input className='ant-input-text width100' defaultValue={debugPort}
        onBlur={(e): void => {
          setDebugPort(e.target.value);
        }} />
    </div>
  </>;
};

export default QemuConfig;

