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

const tipsSvg = (): JSX.Element => {
  return (<svg width="16px" height="16px" viewBox="0 0 16 16" version="1.1">
      <title>tips</title>
      <g id="页面-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="model弹窗" transform="translate(-791.000000, -1546.000000)">
              <g id="编组" transform="translate(791.000000, 1546.000000)">
                  <circle id="Mask" fill="#0A59F7" cx="8" cy="8" r="8"></circle>
                  <path d="M8,6.25 C8.37655778,6.25 8.68829976,6.52750945 8.74186807,6.8891705 L8.75,7 L8.75,12 C8.75,12.4142136 8.41421356,12.75 8,12.75 C7.62344222,12.75 7.31170024,12.4724905 7.25813193,12.1108295 L7.25,12 L7.25,7 C7.25,6.58578644 7.58578644,6.25 8,6.25 Z M8,3 C8.55228475,3 9,3.44771525 9,4 C9,4.55228475 8.55228475,5 8,5 C7.44771525,5 7,4.55228475 7,4 C7,3.44771525 7.44771525,3 8,3 Z" id="Shape" fill="#FFFFFF" fill-rule="nonzero"></path>
              </g>
          </g>
      </g>
  </svg>);
};

const TipsSvg = (props: any): JSX.Element => <Icon component={tipsSvg} {...props} />;
export default TipsSvg;
