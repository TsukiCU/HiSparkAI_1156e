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

const errSvg = (): JSX.Element => {
  return (<svg width="16px" height="16px" viewBox="0 0 16 16" version="1.1">
  <title>icon69</title>
  <g id="ide-icon" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g transform="translate(-188.000000, -2186.000000)" fill="#F66F6A" fill-rule="nonzero" id="Group">
          <g transform="translate(188.000000, 2186.000000)" id="Shape">
              <path d="M8,0.75 C12.0040644,0.75 15.25,3.99593556 15.25,8 C15.25,12.0040644 12.0040644,15.25 8,15.25 C3.99593556,15.25 0.75,12.0040644 0.75,8 C0.75,3.99593556 3.99593556,0.75 8,0.75 Z M4.63728811,4.63960471 C4.37102155,4.90587127 4.3468155,5.32253495 4.56466996,5.61614645 L4.63728811,5.70026488 L6.9376182,8.0009348 L4.64056427,10.2997351 L4.56794612,10.3838536 C4.35009166,10.677465 4.37429771,11.0941287 4.64056427,11.3603953 C4.90683084,11.6266619 5.32349452,11.6508679 5.61710601,11.4330134 L5.70122445,11.3603953 L7.9986182,9.0619348 L10.2974185,11.3603953 L10.381537,11.4330134 C10.6751485,11.6508679 11.0918121,11.6266619 11.3580787,11.3603953 C11.6243453,11.0941287 11.6485513,10.677465 11.4306968,10.3838536 L11.3580787,10.2997351 L9.0596182,8.0009348 L11.3580787,5.70354104 L11.4306968,5.61942261 C11.6485513,5.32581111 11.6243453,4.90914743 11.3580787,4.64288087 C11.0918121,4.37661431 10.6751485,4.35240826 10.381537,4.57026272 L10.2974185,4.64288087 L7.9986182,6.9399348 L5.69794829,4.63960471 L5.61382985,4.56698656 C5.32021836,4.3491321 4.90355468,4.37333815 4.63728811,4.63960471 Z"></path>
          </g>
      </g>
  </g>
</svg>);
};

const ErrSvg = (props: any): JSX.Element => <Icon component={errSvg} {...props} />;
export default ErrSvg;