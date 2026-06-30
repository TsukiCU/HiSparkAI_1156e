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

import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Popover, message } from 'antd';
import { vscode } from '@src/frontEnd/index';
import type { Message } from '@src/backEnd/interface/api';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import { FolderOpenOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

export interface FileInputBoxProps {
  group: string;
  key: string;
  title: string;
  folder: boolean;
  content: string | string[];
  disabled: boolean;
  isHidden?: boolean;
}

function getIsShow(inputKey: string, isShowInput?: boolean): boolean {
  if (isShowInput !== undefined) {
    return isShowInput;
  }
  if (inputKey.includes('validation_input') || inputKey.includes('path')) {
    return false;
  }
  return true;
}

const FileInputBoxComponent: React.FC<{
  fileInputBox: FileInputBoxProps;
  isShowInput?: boolean;
  onInputChange: (value: string, inputKey: string) => void;
  onBlur?: (val: any) => void;
  filePickerType: string;
  fileExt?: string | string[]; // file ext if to select a file.
  labelWidth?: number;
  disableByOthers?: boolean;
  validationStatus?: boolean;
  inputPlaceholder?: string;
  customEditableStyle?: React.CSSProperties;
}> = (prop) => {
  const { fileInputBox, isShowInput, onInputChange, onBlur, fileExt,
    filePickerType, disableByOthers, validationStatus, inputPlaceholder, customEditableStyle } = prop;
  const {
    title,
    content,
    key: inputKey,
    folder,
    disabled,
    isHidden,
  } = fileInputBox;

  const [inputValue, setInputValue] = useState<string>(Array.isArray(content) ? content[0] : content);
  const [open, setOpen] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null); // 存储 setTimeout 的 ID
  const [manualInput, setManualInput] = useState<string>(Array.isArray(content) ? content[0] : content);

  const isShow = getIsShow(inputKey, isShowInput);
  const inactive = disableByOthers === undefined ? disabled : disableByOthers;

  // 同步 content 变化
  useEffect(() => {
    const initValue = Array.isArray(content) ? content[0] : content;
    setInputValue(initValue);
    setManualInput(initValue);
  }, [content]);

  // 监听 VSCode 消息回调
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const msg = event.data;
      if (msg?.method === ApiMethod.SHOW_FILE_PICKER_CALLBACK) {
        const { path, targetKey, cancelled } = msg.params ?? {};
        if (cancelled) { return; }
        if (targetKey === inputKey && typeof path === 'string') {
          setInputValue(path);
          setManualInput(path);
          onInputChange(path, inputKey);
          if (onBlur) { onBlur(path); }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [inputKey, onInputChange]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (validationStatus || inactive) { return; }
    const { value } = e.target;
    setInputValue(value);
    onInputChange(value, inputKey);
    const filePickMsg: Message = {
      method: ApiMethod.SHOW_FILE_PICKER,
      params: { type: filePickerType, targetKey: inputKey, folder, input: value },
    };
    vscode.postMessage(filePickMsg);
  };

  // 失焦：验证手动输入路径是否有效
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    if (validationStatus || inactive) { return; }
    const blurValue = e.target.value.trim();
    setManualInput(blurValue);
    if (!blurValue) { return; } // 空值不验证
    vscode.postMessage({
      method: ApiMethod.VALIDATE_MANUAL_PATH,
      params: { path: blurValue, filePickerType, folder, title, inputKey },
    } as Message);
  };

  const handleBrowseClick = (): void => {
    if (validationStatus || inactive) { return; }
    const filePickMsg: Message = {
      method: ApiMethod.SHOW_FILE_PICKER,
      params: { type: filePickerType, targetKey: inputKey, folder: folder, fileExt: fileExt },
    };
    vscode.postMessage(filePickMsg);
  };
  const isDisabled = validationStatus || inactive;

  // 动态行内样式：条件满足时背景变灰，同时调整 hover/active 状态
  const buttonStyle: React.CSSProperties = {
    paddingLeft: '10px',
    // 基础背景色：条件满足时设为灰色，否则用 primary 主题色
    backgroundColor: isDisabled ? '#cccccc' : undefined, // undefined 会继承组件库 primary 色
    borderColor: isDisabled ? '#cccccc' : undefined,
    // 禁用态光标
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    // 禁用 hover/active 效果
    pointerEvents: isDisabled ? 'none' : 'auto',
  };

  return (
    <div className="fileInputContainer" hidden={isHidden} style={{
      display: 'flex', alignItems: 'center',
      ...customEditableStyle,
    }}>
      <Tooltip placement="top" title={title}>
        <span className='titleSpan' style={{ width: `${prop.labelWidth ?? 120}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </Tooltip>
      <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
        <Tooltip title={inputValue.trim() === '' ? inputPlaceholder : inputValue}>
          <Input
            className="inputFile"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={onBlur ? onBlur : handleInputBlur} // 绑定失焦事件
            disabled={isDisabled}
            style={{ width: '180px', height: '32px' }}
          />
        </Tooltip>
        <Button
          className="browse"
          type="primary"
          style={buttonStyle}
          icon={
            <FolderOpenOutlined
              style={{ color: '#FFFFFF', width: '14px', height: '14px' }}
            />
          }
          onClick={handleBrowseClick}
        />

        {isShow && (
          <Input
            className="inputFile"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={inactive}
          />
        )}
      </div>
    </div>
  );
};

export default FileInputBoxComponent;
