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
import Icon from '@ant-design/icons';

const SelectSvg = (props: any): JSX.Element => {
    const className = document.getElementsByTagName('body')[0].getAttribute('class');
    const theme = className?.includes('dark') ? 'dark' : 'light';
  
    const svgContent = (
      <svg width="16px" height="16px" viewBox="-0.5 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#FFFFFF">
        <g id="SVGRepo_iconCarrier">
          <path d="M6.54504 12.5H21.705" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.54504 6.5H21.705" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6.54504 18.5H21.705" stroke="#FFFFFF" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3.29504 7.5C3.84733 7.5 4.29504 7.05228 4.29504 6.5C4.29504 5.94772 3.84733 5.5 3.29504 5.5C2.74276 5.5 2.29504 5.94772 2.29504 6.5C2.29504 7.05228 2.74276 7.5 3.29504 7.5Z" fill="#FFFFFF"/>
          <path d="M3.29504 13.5C3.84733 13.5 4.29504 13.0523 4.29504 12.5C4.29504 11.9477 3.84733 11.5 3.29504 11.5C2.74276 11.5 2.29504 11.9477 2.29504 12.5C2.29504 13.0523 2.74276 13.5 3.29504 13.5Z" fill="#FFFFFF"/>
          <path d="M3.29504 19.5C3.84733 19.5 4.29504 19.0523 4.29504 18.5C4.29504 17.9477 3.84733 17.5 3.29504 17.5C2.74276 17.5 2.29504 17.9477 2.29504 18.5C2.29504 19.0523 2.74276 19.5 3.29504 19.5Z" fill="#FFFFFF"/>
        </g>
      </svg>
    );
  
    return <Icon component={() => svgContent} {...props} />;
  };

export default SelectSvg;