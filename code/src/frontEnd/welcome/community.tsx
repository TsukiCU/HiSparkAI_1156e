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
import supportCommunityIcon from '../../../resources/welcome/support_community.svg';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { getUserGuideWebsite } from '../actions';

const Community: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [hisiWebsite, setHisiWebsite] = useState<string>();
  const [hisiEcologyWebsite, setHisiEcologyWebsite] = useState<string>();
  const [vsStudioCodeMarketplaceWebsite, setVsStudioCodeMarketplaceWebsite] = useState<string>();
  const [extensionMarketplaceWebsite, setExtensionMarketplaceWebsite] = useState<string>();
  const hisiWebsiteTemp = useSelector((state: any) => state.entities.hisiWebsite);
  const hisiEcologyWebsiteTemp = useSelector((state: any) => state.entities.hisiEcologyWebsite);
  const vsStudioCodeMarketplaceWebsiteTep = useSelector((state: any) => state.entities.vsStudioCodeMarketplaceWebsite);
  const extensionMarketplaceWebsiteTemp = useSelector((state: any) => state.entities.extensionMarketplaceWebsite);

  useEffect(() => {
    dispatch(getUserGuideWebsite());
  }, [dispatch]);
  useEffect(() => {
    if (typeof hisiWebsiteTemp === 'string' && hisiWebsiteTemp.length > 0) {
      setHisiWebsite(hisiWebsiteTemp);
    }
    if (typeof hisiEcologyWebsiteTemp === 'string' && hisiEcologyWebsiteTemp.length > 0) {
      setHisiEcologyWebsite(hisiEcologyWebsiteTemp);
    }
    if (typeof vsStudioCodeMarketplaceWebsiteTep === 'string' && vsStudioCodeMarketplaceWebsiteTep.length > 0) {
      setVsStudioCodeMarketplaceWebsite(vsStudioCodeMarketplaceWebsiteTep);
    }
    if (typeof extensionMarketplaceWebsiteTemp === 'string' && extensionMarketplaceWebsiteTemp.length > 0) {
      setExtensionMarketplaceWebsite(extensionMarketplaceWebsiteTemp);
    }
  }, [hisiWebsiteTemp, hisiEcologyWebsiteTemp, vsStudioCodeMarketplaceWebsiteTep, extensionMarketplaceWebsiteTemp]);

  return (
    <>
      <div id='community' className='section'>
        <div className='section-title'>
          <img className='section-title-icon' src={supportCommunityIcon} alt={t('supportCommunity')}></img>
          <div className='primary-text section-title-text'>{t('supportCommunity')}</div>
        </div>
        <div className='section-content'>
          <a className='section-entry' href={hisiWebsite}>
            <div className='community-section-entry-desc primary-text'>{t('hisiWebsite')}</div>
          </a>
          <a className='section-entry' href={hisiEcologyWebsite}>
            <div className='community-section-entry-desc primary-text'>{t('hisiEcologyWebsite')}</div>
          </a>
          <a className='section-entry' href={vsStudioCodeMarketplaceWebsite}>
            <div className='community-section-entry-desc primary-text'>{t('vsStudioCodeMarketplaceWebsite')}</div>
          </a>
          <a className='section-entry' href={extensionMarketplaceWebsite}>
            <div className='community-section-entry-desc primary-text'>{t('extensionMarketplaceWebsite')}</div>
          </a>
        </div>
        { }
      </div>
    </>
  );
};

export default Community;
