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
import { Switch, Input, Button } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import type { Message } from '@src/backEnd/interface/api';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import { vscode } from '@src/frontEnd/index';
import { Tooltip } from 'antd';

interface SwitchInputProps {
    // 开关受控状态（必传）
    checked: boolean;
    // 输入框受控值（必传）
    inputValue: string;
    // 开关变化回调（必传）
    onSwitchChange: (checked: boolean) => void;
    // 输入框变化回调（必传）
    onInputChange: (value: string) => void;
    // 自定义开关文案
    switchText?: string;
    // 输入框占位符
    inputPlaceholder?: string;
    filePickerType?: string;
    fileExt?: string | string[]; // file ext if to select a file.
    quantType?: 'ptq' | 'qat';
    showButton: boolean;
    // 唯一标识（必传！用于匹配回调消息）
    targetKey?: string;
    folder?: boolean;
    title?: string;
    toolTips?: string;
}

const SwitchInput: React.FC<SwitchInputProps> = ({
    checked,
    inputValue,
    onSwitchChange,
    onInputChange,
    switchText = 'Advanced Options',
    inputPlaceholder = 'Additional Arguments',
    filePickerType,
    showButton,
    targetKey,
    fileExt,
    quantType,
    folder = false,
    title = 'Advanced Options Input', // 默认标题
    toolTips,
}) => {
    // 内联样式
    const styles = {
        container: {
            width: '100%',
            boxSizing: 'border-box' as const,
        },
        switchWrapper: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
            marginBottom: '12px',
        },
        inputWrapper: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            width: '100%',
        },
        inputLabel: {
            whiteSpace: 'nowrap',
            fontSize: '14px',
            flexShrink: 0,
        },
        fullWidthInput: {
            flex: 1,
        },
        sampleLink: {
            cursor: 'pointer',
            color: '#1890ff', // 匹配antd primary色
            textDecoration: 'underline',
            marginLeft: '8px',
            fontSize: '14px',
        },
    };

    // 处理文件选择按钮点击
    const handleBrowseClick = useCallback((): void => {
        const filePickMsg: Message = {
            method: ApiMethod.SHOW_FILE_PICKER,
            params: {
                type: filePickerType,
                targetKey: targetKey,
                folder: folder,
                fileExt: fileExt,
            },
        };
        vscode.postMessage(filePickMsg);
    }, [filePickerType, targetKey, folder]);

    // 处理示例文件下载
    const handleSampleDownload = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        // 阻止a标签默认跳转行为
        e.preventDefault();

        // 向后端发送下载请求
        const downloadMsg = {
            method: 'downloadSampleConfig',
            params: {
                fileName: quantType === 'ptq' ? 'quant_ptq.cfg' : 'quant_qat.cfg',
            },
        };

        if (vscode && typeof vscode.postMessage === 'function') {
            vscode.postMessage(downloadMsg);
        } else {
            vscode.window?.showErrorMessage('插件通信异常，无法下载文件');
        }
    }, []);

    // 输入框失焦
    const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>): void => {
        // 去除首尾空格
        const blurValue = e.target.value.trim();
        // 构造消息
        const logMsg: Message = {
            method: ApiMethod.LOG_MANUAL_INPUT_TO_CHANNEL,
            params: {
                inputKey: targetKey,
                manualInput: blurValue,
                folder,
                title,
            },
        };

        // 发送消息到后端
        if (vscode && typeof vscode.postMessage === 'function') {
            vscode.postMessage(logMsg);
        }
    }, [targetKey, folder, title]);

    // 处理VSCode消息回调
    const handleMessage = useCallback((event: MessageEvent) => {
        try {
            const { method, params } = event.data;

            // 只处理文件选择回调消息
            if (method === ApiMethod.SHOW_FILE_PICKER_CALLBACK) {
                const { path, targetKey: callbackTargetKey, cancelled } = params;
                if (callbackTargetKey === targetKey && !cancelled && path) {
                    // 更新输入框值
                    onInputChange(path);
                }
            }
        } catch (err) {
            // 文件选择失败
        }
    }, [targetKey, onInputChange]);

    // 消息监听
    useEffect(() => {
        window.addEventListener('message', handleMessage);
        // 组件卸载时移除监听
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleMessage]);

    const buttonStyle: React.CSSProperties = {
        paddingLeft: '10px',
        backgroundColor: undefined,
        borderColor: undefined,
        cursor: 'pointer',
        pointerEvents: 'auto',
    };

    return (
        <div style={styles.container}>
            <div style={styles.switchWrapper}>
                <span>{switchText}</span>
                <Switch
                    checked={checked}
                    onChange={onSwitchChange}
                    checkedChildren={''}
                    unCheckedChildren={''}
                    size="default"
                />
            </div>
            {checked && showButton && (
                <div>
                    <div style={styles.inputWrapper}>
                        <span style={styles.inputLabel}>{inputPlaceholder}</span>
                        <Tooltip title={inputValue.trim() === '' ? '上传.cfg文件' : inputValue}>
                            <Input
                                value={inputValue}
                                onChange={(e): void => onInputChange(e.target.value)}
                                onBlur={handleInputBlur}
                                style={showButton ? { width: '180px', height: '32px' } : styles.fullWidthInput}
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
                        {/* 修改后的a标签，实现下载功能 */}
                        <a
                            href="#"
                            style={styles.sampleLink}
                            onClick={handleSampleDownload} // 添加点击事件
                        >
                            sample
                        </a>
                    </div>
                    {quantType === 'ptq' && <div style={{ color: ' #8c8c8c', fontSize: '14px', lineHeight: '20px', marginTop: '8px' }}>
                        *Quantized Data Type and Layer-wise Config do not take effect when Ascend Config is enabled
                    </div>}
                    {quantType === 'qat' && <div style={{ color: ' #8c8c8c', fontSize: '14px', lineHeight: '20px', marginTop: '8px' }}>
                        *Layer-wise Config does not take effect when Ascend Config is enabled
                    </div>}
                </div>

            )}
            {checked && !showButton && (
                <div style={styles.inputWrapper}>
                    <span style={styles.inputLabel}>{inputPlaceholder}</span>
                    <Tooltip title={inputValue.trim() === '' ? toolTips : inputValue}>
                        <Input
                            value={inputValue}
                            onChange={(e): void => onInputChange(e.target.value)}
                            onBlur={handleInputBlur}
                            style={styles.fullWidthInput}
                        />
                    </Tooltip>
                </div>
            )}
        </div>
    );
};

export default SwitchInput;