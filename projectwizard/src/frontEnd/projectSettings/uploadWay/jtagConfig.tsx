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

import { Select } from 'antd';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import type { SaveIniStruct } from '../../../backEnd/interface/model';
import { save2Ini } from '../../actions';
import { speedDir, jLinkJtagSwd, getDefaultSpeed } from '../debugTool/openocdConfig';
import { setDocumentById } from '../setDocumentById';
import Title from '../title';

export const uploadHiSparkLinkJtag = [
  'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800',
  'KHz900', 'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7'];

export const uploadHiSparkTraceJtag = [
  'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800',
  'KHz900', 'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7'];

export const uploadHiSparkLinkSwd = [
  'KHz200', 'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800', 'KHz900',
  'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7', 'MHz8', 'MHz9', 'MHz10'];

export const uploadHiSparkTraceSwd = [
  'KHz200', 'KHz300', 'KHz400', 'KHz500', 'KHz600', 'KHz700', 'KHz800', 'KHz900',
  'MHz1', 'MHz2', 'MHz3', 'MHz4', 'MHz5', 'MHz6', 'MHz7', 'MHz8', 'MHz9', 'MHz10'];

const { Option } = Select;

const JtagConfig = (uploadInfo: any): JSX.Element => {
  const group = uploadInfo?.group;
  const { t } = useTranslation();
  const [debugBoard, setDebugBoard] = useState<string>(uploadInfo?.iniInfo?.debug_board ||
    (uploadInfo?.jsonInfo?.param?.debug_board ? uploadInfo?.jsonInfo?.param?.debug_board[0] : ''));
  const [frequency, setFrequency] = useState<string>('');
  const [speedArr, setSpeedArr] = useState<any[]>([]);

  const address = uploadInfo?.iniInfo?.address || uploadInfo?.jsonInfo?.param?.address;
  const debugBoards: string[] = uploadInfo?.jsonInfo?.param?.debug_board;
  const defaultFrequency = uploadInfo?.jsonInfo?.param?.frequency;
  const dispatch = useDispatch();
  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };
  const saveFormData = (): void => {
    const data = {
      section: 'upload',
      params: {
        debug_board: debugBoard,
        frequency: frequency,
        address: address,
      },
    };
    saveParams.data = data;
    uploadInfo.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };

  useEffect(() => {
    // 当swd和jtag切换变化时，重新设置其默认frequency
    setFrequency(uploadInfo?.jsonInfo?.param?.frequency || uploadInfo?.iniInfo?.frequency);
  }, [uploadInfo?.jsonInfo?.name]);
 
  useEffect(() => {
    saveFormData();
  }, [debugBoard, frequency, address, uploadInfo?.jsonInfo?.name, uploadInfo?.showComponent]);

  useEffect(() => {
    if (debugBoard === 'jlink') {
      setSpeedArr(jLinkJtagSwd);
    } else if (debugBoard === 'HiSpark-Trace') {
      if (uploadInfo?.jsonInfo?.name === 'jtag') {
        setSpeedArr(uploadHiSparkTraceJtag);
      } else {
        setSpeedArr(uploadHiSparkTraceSwd);
      }
    } else {
      if (uploadInfo?.jsonInfo?.name === 'jtag') {
        setSpeedArr(uploadHiSparkLinkJtag);
      } else {
        setSpeedArr(uploadHiSparkLinkSwd);
      }
    }
  }, [debugBoard, uploadInfo?.jsonInfo?.name]);

  useEffect(() => {
    if (Array.isArray(speedArr) && speedArr.length > 0 &&
      !speedArr.includes(getDefaultSpeed(frequency))) {
      setFrequency(defaultFrequency);
    }
  }, [speedArr]);

  return (
    <>
      {uploadInfo?.showComponent && <>
        <div className='config-card' id={setDocumentById(group, 'debug_board')}>
          <Title name={t('debug_board')} description='' />
          <Select
            getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
            className='width100'
            showArrow={debugBoards.length > 0 ? true : false}
            open={debugBoards.length > 0 ? undefined : false}
            onChange={(value): void => {
              setDebugBoard(value);
            }}
            value={debugBoard}
          >
            {
              debugBoards?.map((debugBoardItem) => (
                <Option key={debugBoardItem} value={debugBoardItem}>
                  {debugBoardItem}
                </Option>
              ))
            }
          </Select>
        </div>
        <div className='config-card' id={setDocumentById(group, 'frequency')}>
          <Title name={t('frequency')} description='' />
          <Select
            getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
            value={speedDir[getDefaultSpeed(frequency)]?.label}
            className='width100'
            showArrow={speedArr.length > 0 ? true : false}
            open={speedArr.length > 0 ? undefined : false}
            onChange={(value): void => {
              setFrequency(value);
            }}
          >
            {
              speedArr.map((item) => {
                return <Option key={speedDir[item].value} value={speedDir[item].value}>
                  {speedDir[item]?.label}
                </Option>;
              })
            }
          </Select>
        </div>
      </>
      }
    </>
  );
};

export default JtagConfig;
