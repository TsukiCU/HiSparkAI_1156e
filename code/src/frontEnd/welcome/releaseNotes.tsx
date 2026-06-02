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
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getReleaseNotes, openReleaseNote } from '../actions';
import releaseNotesIcon from '../../../resources/welcome/release_notes.svg';
import timeIcon from '../../../resources/welcome/time.svg';
import moreIcon from '../../../resources/welcome/more.svg';
import type { Release } from '../../backEnd/interface/model';

const ReleaseNotes: React.FC = () => {
  const [releaseNotes, setReleaseNotes] = useState<Release[]>([]);

  const { t } = useTranslation();

  const dispatch = useDispatch();
  const releaseNotesBn = useSelector((state: any) => state.entities.releaseNotes);

  useEffect(() => {
    dispatch(getReleaseNotes());
  }, [dispatch]);

  useEffect(() => {
    if (releaseNotesBn && releaseNotesBn.length > 0) {
      setReleaseNotes(releaseNotesBn);
    }
  }, [releaseNotesBn]);

  const openClickRelease = (version: string): void => {
    dispatch(openReleaseNote(version));
  };

  return (
    <>
      <div id='release-note' className='section'>
        <div className='section-title'>
          <img className='section-title-icon' src={releaseNotesIcon} alt={t('releaseNotes')}></img>
          <div className='primary-text section-title-text'>{t('releaseNotes')}</div>
        </div>
        <div className='section-content'>
          {
            releaseNotes.map((releaseNote) => (
              <a key={releaseNote.version} className='section-entry' onClick={(): void => openClickRelease(releaseNote.version)}>
                <div className='release-section-entry-time secondary-text'>
                  <img className='release-section-entry-time-icon' src={timeIcon} alt={t('releaseTime')}></img>
                  {releaseNote.time}
                </div>
                <div className='release-section-entry-desc-primary primary-text'>{releaseNote.version} {t('version') + t('releaseNotes')}</div>
              </a>
            ))
          }
        </div>
        <div className='section-more'>
          <img className='section-more-icon' src={moreIcon} alt={t('releaseNotesMore')}></img>
          <a onClick={(): void => openClickRelease('all')}>{t('releaseNotesMore')} &gt;</a>
        </div>
      </div>
    </>
  );
};

export default ReleaseNotes;
