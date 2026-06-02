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

import { Input } from 'antd';
import { t } from 'i18next';
import type { ChangeEventHandler, FocusEventHandler } from 'react';
import React, { useEffect } from 'react';
import { useState } from 'react';
import { notify } from '../../common';
import { Tooltip } from 'antd';

export type Validator = (value: string, inputKey: string) => { valid: boolean; errorMsg?: string };

export interface InputBoxProps {
  group: string;
  key: string;
  title: string;
  content: number | string | string[];
  disabled: boolean;
  isHidden?: boolean;
  isPlainTextInput?: boolean;
}

// 调整回调函数类型：支持返回 string | string[]
type GetInputed = (value: string | string[], inputkey: string) => void;

const InputBoxComponent: React.FC<{
  inputBox: InputBoxProps;
  labelOrP?: boolean;
  labelWidth?: number;
  transmitStyle?: boolean;
  getInputed: GetInputed;
  validate?: Validator;
  editable?: boolean;
}> = (prop) => {
  const { inputBox, labelOrP, labelWidth, transmitStyle, getInputed, validate, editable } = prop;
  const {
    title,
    content,
    key: inputkey,
    disabled,
    isHidden,
    isPlainTextInput = false, // 新增：默认关闭纯文本模式
  } = inputBox;

  let initDisplayValue: string;
  ((): void => {
    const rawValue = Array.isArray(content) ? (content[0] || '').toString() : String(content);
    const trimmedValue = rawValue.trim().replace(/，/g, ',');
    initDisplayValue = isPlainTextInput
      ? trimmedValue
      : trimmedValue.replace(/[^0-9,.]/g, '');
  })();

  const [inputValue, setInputValue] = useState(initDisplayValue);
  const [isDisabled, setIsDisabled] = useState(disabled);
  const [lastValidValue, setLastValidValue] = useState(initDisplayValue);

  useEffect(() => {
    const rawValue = Array.isArray(content) ? (content[0] || '').toString() : String(content);
    const trimmedValue = rawValue.trim().replace(/，/g, ',');
    const displayValue = isPlainTextInput
      ? trimmedValue
      : trimmedValue.replace(/[^0-9,.]/g, '');

    setInputValue(displayValue);
    setLastValidValue(displayValue);
    setIsDisabled(disabled);
  }, [disabled, content, isPlainTextInput]); // 新增依赖：isPlainTextInput
  const formatDisplayValue = (value: string): string => {
    let trimmedValue = value.trim().replace(/，/g, ',');
    if (!isPlainTextInput) {
      trimmedValue = trimmedValue.replace(/,,+/g, ',');
      trimmedValue = trimmedValue.replace(/[^0-9,.]/g, '');
    }
    return trimmedValue;
  };

  // 核心处理：返回传递给父组件的格式（字符串/数组）
  const getTransmitValue = (formattedValue: string): string | string[] => {
    if (formattedValue.includes(',')) {
      return [formattedValue]; // 有逗号返回数组
    } else {
      return formattedValue; // 无逗号返回字符串
    }
  };

  // 失去焦点处理（改为onBlur，非捕获阶段）
  const handleInputBlur: FocusEventHandler<HTMLInputElement> = (e): void => {
    const formattedValue = formatDisplayValue(e.target.value);
    if (validate && !isPlainTextInput) {
      const { valid, errorMsg } = validate(formattedValue, inputkey);
      if (!valid) {
        if (errorMsg) {
          notify(errorMsg, { type: 'error', stack: false, duration: 2 });
        }

        // 校验失败：回滚到上次有效值
        const rollbackValue = getTransmitValue(lastValidValue);
        setInputValue(lastValidValue);
        getInputed(rollbackValue, inputkey);
        return;
      }
    }
    // 校验成功/无校验：更新有效值并传递
    setLastValidValue(formattedValue);
    const transmitValue = getTransmitValue(formattedValue);
    getInputed(transmitValue, inputkey);
  };

  // 输入变化处理：先格式化再显示，避免重复值
  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e): void => {
    const rawInput = e.target.value;
    // 格式化输入值
    const formattedValue = formatDisplayValue(rawInput);
    // 仅当值变化时更新，避免重复渲染
    if (formattedValue !== inputValue) {
      setInputValue(formattedValue);
      // 实时传递格式化后的值
      const transmitValue = getTransmitValue(formattedValue);
      getInputed(transmitValue, inputkey);
    }
  };

  return (
    <div className="inputContainer" hidden={isHidden}>
      <Tooltip placement="top" title={title}>
        {labelOrP ? (
          <label
            style={{
              marginTop: '5px',
              width: `${labelWidth}px`,
              display: 'inline-block',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </label>
        ) : (
          <p>{title}</p>
        )}
      </Tooltip>
      <Input
        className={`${transmitStyle ? 'inputFile' : 'inputChip'}`}
        value={inputValue} // 绑定格式化后的值，而非原始输入
        onChange={handleInputChange}
        readOnly={false}
        disabled={!editable}
        onBlur={handleInputBlur} // 改为普通onBlur，避免捕获阶段重复触发
      />
    </div >
  );
};

export default InputBoxComponent;