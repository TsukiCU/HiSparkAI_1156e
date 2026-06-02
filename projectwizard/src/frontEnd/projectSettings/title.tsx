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
import { useTranslation } from 'react-i18next';

interface TitleProps {
  name: string;
  description: string;
}

const filterDescription = (description: string): string => {
  return description ? description.replace(/\\%3A/g, ': ') : '';
};

const Title = (props: TitleProps): JSX.Element => {
  const { t } = useTranslation();
  return (
    <>
      <h3>{t(props?.name)}</h3>
      <h4 style={{ whiteSpace: 'pre-line' }}>{filterDescription(t(props?.description) ?? '')}</h4>
    </>
  );
};

export default Title;
