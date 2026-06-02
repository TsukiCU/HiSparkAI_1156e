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
import React, { useEffect } from 'react';
import { useState } from 'react';
import { useSelector } from 'react-redux';

export interface SelectBoxProps {
  group: string;
  key: string;
  title: string;
  content: number[] | string[];
  defaultValue: string;
  disabled: boolean;
  isHidden?: boolean;
}

const SelectBoxComponent: React.FC<{
  selectBox: SelectBoxProps;
  labelOrP?: boolean;
  labelWidth?: number;
  transmitStyle?: boolean;
  customEditableStyle?: React.CSSProperties;
  getSelected: (value: string, selectKey: string, isCtrlOthers?: boolean) => void;
}> = (prop) => {
  const { selectBox, labelOrP, labelWidth, transmitStyle, getSelected, customEditableStyle } = prop;
  const { title, content, key: selectKey, defaultValue, disabled, isHidden } = selectBox;
  const [selectedValue, setSelectedValue] = useState<string>(defaultValue);
  const importDefaultConfigData = useSelector((state: any) => state.entities.importDefaultConfigData);
  const [isDisabled, setIsDisabled] = useState(disabled);
  const { Option } = Select;

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [importDefaultConfigData, defaultValue]);

  useEffect(() => {
    setSelectedValue(defaultValue);
    setIsDisabled(disabled);
  }, [disabled, defaultValue]);

  const dropdownChoose = (value: any): void => {
    const dropdown = value;
    setSelectedValue(dropdown);
    getSelected(dropdown, selectKey);
  };
  const isUpperCase = (char: any): boolean => {
    if (!char) {
      return false;
    }
    const code = char.charCodeAt(0);
    return code >= 65 && code <= 90;
  };
  return (
    <div className="selectContainer" hidden={isHidden} style={{ ...customEditableStyle }}>
      {labelOrP ? <label style={{ marginTop: '5px', width: `${labelWidth}px`, display: 'inline-block' }}>{title}</label> : <p>{title}</p>}
      <Select
        className={`${transmitStyle ? 'selectFile' : 'selectChip'}`}
        style={{ fontSize: isUpperCase(selectedValue) && selectedValue === 'FULL_QUANT' ? '13px' : '14px' }}
        value={selectedValue} // selectedValue 应该是选中的值
        onChange={dropdownChoose} // dropdownChoose 应该接收选中的值
        disabled={isDisabled}
      >
        {content.map((option: string | number) => (
          <Option key={option} value={option}>
            {option}
          </Option>
        ))}
      </Select>
    </div>
  );
};

export default SelectBoxComponent;
