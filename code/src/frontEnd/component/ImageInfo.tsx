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
import React from 'react';
import TFLiteIcon from '../../../resources/selectModel/TFLiteIcon.svg';
import PyTorchIcon from '../../../resources/selectModel/PyTorchIcon.svg';
import OnnxIcon from '../../../resources/selectModel/OnnxIcon.svg';

export const useImageInfo = (model: string | undefined): any => {
    const modelStr = model ?? '';
    const ext = modelStr.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'tflite':
            return TFLiteIcon;

        case 'pt':
        case 'pth':
            return PyTorchIcon;

        case 'onnx':
            return OnnxIcon;

        default:
            return OnnxIcon;
    }
};

export interface ProfilingValidation {
    modelName?: string;
};

// 导出 ImageInfo 组件（供使用）
export const ImageInfo: React.FC<ProfilingValidation> = ({ modelName }) => {
    const imageSrc = useImageInfo(modelName);
    return (<div style={{ width: '32px', height: '32px' }}>
        <img src={imageSrc} alt="icon" style={{ width: '100%', height: '100%' }} />
    </div>);
};
