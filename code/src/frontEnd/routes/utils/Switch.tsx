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

import { Switch } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

export interface SelectBoxProps {
    group: string;
    key: string;
    title: string;
    content: number[] | string[];
    defaultValue: string;
    disabled: boolean;
    isHidden?: boolean;
    switchCheckedChildren?: React.ReactNode;
    switchUnCheckedChildren?: React.ReactNode;
}

interface SwitchBoxComponentProps {
    selectBox: SelectBoxProps;
    labelOrP?: boolean;
    labelWidth?: number;
    transmitStyle?: boolean;
    customEditableStyle?: React.CSSProperties;
    isProfile?: boolean;
    onChange: (checked: boolean, selectKey: string) => void;
}

const SwitchBoxComponent: React.FC<SwitchBoxComponentProps> = (prop) => {
    const { selectBox, labelOrP, labelWidth, transmitStyle, isProfile, customEditableStyle, onChange } = prop;
    const {
        title,
        content,
        key: selectKey,
        defaultValue,
        disabled,
        isHidden,
        switchCheckedChildren,
        switchUnCheckedChildren,
    } = selectBox;

    const [unCheckedValue, checkedValue] = useMemo(() => {
        if (content.length < 2) {
            return ['0', '1'];
        }
        return [String(content[0]), String(content[1])];
    }, [content, selectKey]);
    const [isChecked, setIsChecked] = useState<boolean>(() => {
        const initChecked = defaultValue === checkedValue;
        return initChecked;
    });

    const [isDisabled, setIsDisabled] = useState<boolean>(disabled);
    useEffect(() => {
        setIsDisabled(disabled);
    }, [disabled]);
    useEffect(() => {
        setIsChecked(defaultValue === checkedValue);
    }, [defaultValue]);

    const handleSwitchChange = (checked: boolean): void => {
        setIsChecked(checked);
        onChange(checked, selectKey);
    };

    if (isHidden) { return null; }

    return (
        <div
            className="switchContainer"
            style={{
                ...customEditableStyle,
                display: 'flex',
                alignItems: 'center',
                marginBottom: isProfile ? '0px' : '8px',
                pointerEvents: 'auto',
            }}
        >
            {labelOrP ? (
                <label
                    style={{
                        width: `${labelWidth ?? 120}px`,
                        marginRight: '8px',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                    }}
                >
                    {title}
                </label>
            ) : (
                <p style={{
                    marginRight: '8px',
                    marginBottom: 0,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                }}>{title}</p>
            )}

            <Switch
                className={`${transmitStyle ? 'switchFile' : 'switchChip'}`}
                checked={isChecked}
                onChange={handleSwitchChange}
                disabled={isDisabled}
                checkedChildren={switchCheckedChildren || ''}
                unCheckedChildren={switchUnCheckedChildren || ''}
                size="default"
                style={{
                    marginTop: '0',
                    pointerEvents: 'auto',
                }}
            />
        </div>
    );
};

export default SwitchBoxComponent;