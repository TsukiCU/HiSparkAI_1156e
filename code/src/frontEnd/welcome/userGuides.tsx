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
import { useDispatch, useSelector } from 'react-redux';
import userGuideIcon from '../../../resources/welcome/user_guide.svg';
import { useEffect, useState } from 'react';
import { getUserGuideWebsite } from '../actions';
 
const UserGuides: React.FC = () => {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const [quickUserGuideWebsite, setQuickUserGuideWebsite] = useState<string>();
  const [userGuideWebsite, setUserGuideWebsite] = useState<string>();
  const quickUserGuideWebsiteTemp = useSelector((state: any) => state.entities.quickUserGuideWebsite);
  const userGuideWebsiteTemp = useSelector((state: any) => state.entities.userGuideWebsite);
 
  useEffect(() => {
    dispatch(getUserGuideWebsite());
  }, [dispatch]);
 
  useEffect(() => {
    if (userGuideWebsiteTemp && userGuideWebsiteTemp.length > 0) {
      setUserGuideWebsite(userGuideWebsiteTemp);
    }
    if (quickUserGuideWebsiteTemp && quickUserGuideWebsiteTemp.length > 0) {
      setQuickUserGuideWebsite(quickUserGuideWebsiteTemp);
    }
  }, [userGuideWebsiteTemp, quickUserGuideWebsiteTemp]);

  return (
    <>
      <div id='user-guides' className='section'>
        <div className='section-title'>
          <img className='section-title-icon' src={userGuideIcon} alt={t('userGuides')}></img>
          <div className='primary-text section-title-text'>{t('userGuides')}</div>
        </div>
        <a className='section-entry' href={quickUserGuideWebsite}>
          <div className='primary-text'>HiSpark AI {t('quickUserGuides')}</div>
        </a>
        <a className='section-entry' href={userGuideWebsite}>
          <div className='primary-text'>HiSpark Studio AI for VS Code {t('userGuides')}</div>
        </a>
        <div className='section-more'>
        </div>
        { }
      </div>
    </>
  );
};

export default UserGuides;
