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
// hooks/useCustomModal.tsx

import React, { useState, ReactNode } from 'react';
import { Button, Modal } from 'antd';

// 弹窗配置类型
interface ModalConfigType {
    title?: string;
    content?: ReactNode;
    okText?: string;
    cancelText?: string;
    onOK?: (val?: any) => void | Promise<void>;
    onCancel?: () => void;
    okBtnProps?: React.ComponentProps<typeof Button>;
    cancelBtnProps?: React.ComponentProps<typeof Button>;
    width?: number | string;
};

// hooks返回类型
interface ModalReturn {
    openModal: (config: ModalConfigType) => void;
    closeModal: () => void;
    modalOpen: boolean;
    config: ModalConfigType;
};

// Element类
interface ElementType {
    open: boolean;
    config: ModalConfigType;
    onClose: () => void;
}

export const useCustomModal = (): ModalReturn => {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<ModalConfigType>({});
    const openModal = (newConfig: ModalConfigType): void => {
        setConfig(newConfig);
        setOpen(true);
    };

    const closeModal = (): void => {
        setOpen(false);
    };

    const handleOk = async (): Promise<void> => {
        if (config.onOK) {
            const result = config.onOK();
            if (result instanceof Promise) {
                await result;
            }
        }
        closeModal();
    };

    const handleCancle = (): void => {
        if (config.onCancel) {
            config.onCancel();
        }
        closeModal();
    };

    return {
        openModal,
        closeModal,
        modalOpen: open,
        config,
    };
};

// 导出 Modal 组件（供使用）
export const CustomModal = ({ open, config, onClose }: ElementType): any => {
    return (<Modal
        open={open}
        title={config.title || '提示'}
        onCancel={onClose}
        footer={[
            <Button
                key="submit"
                type="primary"
                onClick={config.onOK}
                {...config.okBtnProps}
            >
                {config.okText || 'OK'}
            </Button>,
            <Button
                key="cancel"
                onClick={onClose}
                {...config.cancelBtnProps}
            >
                {config.cancelText || 'Cancel'}
            </Button>,
        ]}
        width={config.width}
    >
        {config.content}
    </Modal>);
};
