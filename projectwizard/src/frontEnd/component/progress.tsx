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
import { Button, Progress, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';

interface propsType {
  progress: number;
  clickStopBtn: () => void;
  info?: string;
}

const App = (props: propsType): JSX.Element => {
  const { t } = useTranslation();
  return (
  <>
    {props.info && <div style={{ marginBottom: '-10px', marginTop: '10px' }}>{props.info}</div>}
    <div style = {{ display: 'flex', alignItems: 'center' }}>
    <Progress percent={props.progress} strokeColor={'#666666'} size={'default'} style={{ width: 'calc(100% - 70px)', marginRight: '5px' }} trailColor={'transparent'} />
    <Tooltip >
      <Button 
        type="primary" 
        onClick={props.clickStopBtn}
        style = {{ marginLeft: '5px', borderRadius: '16px', fontSize: '14px', lineHeight: '18px', backgroundColor: '#FF6347', borderColor:'#FF6347', padding: '4px 15px 4px 15px', paddingLeft: '10px', display: 'inline-flex', alignItems: 'center'}} 
      >
        {t('stop')}
      </Button>
    </Tooltip>
    </div>
  </>
  );
};

export default App;
