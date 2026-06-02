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
import { useTranslation } from 'react-i18next';

const WelcomeInfo: React.FC = (): JSX.Element => {
  const { t } = useTranslation();

  return (
    <div className="welcome-info">
      <h1 id="welcomeInfoTitle" className="welcome-info__title">
        {t('welcomeInfo.prefix', 'Welcome to')}{'    '}
        <span className="welcome-info__brand">HiSpark Studio AI</span>
      </h1>

      <p className="welcome-info__desc">
        {t(
          'welcomeInfo.desc',
          'AI toolkit for HiSilicon edge devices. Create datasets, train models, and deploy to MCU and NPU platforms with ease.'
        )}
      </p>
    </div>
  );
};

export default WelcomeInfo;