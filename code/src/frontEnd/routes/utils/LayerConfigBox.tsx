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

import { Input, Select } from 'antd';
import React from 'react';
import '../../a-styles/app.css';

export interface LayerBoxProps {
  name: string;
  opType: string;
  dataType: string;
}

interface LayerBoxComponentProps {
  layerBox: LayerBoxProps;
  onChange: (field: keyof LayerBoxProps, value: string) => void;
};

const LayerBoxComponent: React.FC<LayerBoxComponentProps> = ({ layerBox, onChange }) => {
  const { name, opType, dataType } = layerBox;
  const options = [
    { value: 'default', label: 'default' },
    { value: 'int8', label: 'int8' },
    { value: 'int16', label: 'int16' },
  ];

  return (
    <div className='layerContainer'>
      <Input
        className='layerInputStyle'
        value={name}
        onChange={(e): void => onChange('name', e.target.value)}
        readOnly
      />
      <Input
        className='layerInputStyle'
        value={opType}
        onChange={(e): void => onChange('opType', e.target.value)}
        readOnly
      />
      <Select
        value={dataType}
        onChange={(e): void => onChange('dataType', e)}
        style={{ width: '150px' }}
        options={options}
      />
    </div>
  );
};

export default LayerBoxComponent;