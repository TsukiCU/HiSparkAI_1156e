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
import { Table, Input, Select, ConfigProvider, Empty } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { getProjectData, projectAction } from '../actions';
import { useTranslation } from 'react-i18next';
import projectListIcon from '../../../resources/welcome/project_list.svg';
import type { ProjectData } from '../../backEnd/interface/model';
import { State } from '../state';
import { vscode } from '..';
import { Message } from '@src/backEnd/interface/api';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
declare global {
  interface Window {
    initialDemoData?: any;
  }
}
const ProjectList: React.FC = () => {
  const [projectList, setProjectList] = useState<ProjectData[]>(window.initialDemoData ?? []);
  const [projectListShow, setProjectListShow] = useState<ProjectData[]>(window.initialDemoData ?? []);
  const [keyword, setKeyword] = useState<string>('');
  const [chipType, setChipType] = useState<string>('');
  const [chipTypeOptions, setChipTypeOptions] = useState<Array<{ value: string; label: string }>>([]);
  const { t } = useTranslation();
  const deleteProjectCallBackData = useSelector((state: any) => state.entities.deleteProjectCallBackData);
  const dispatch = useDispatch();
  const dataSource = window.initialDemoData;
  const seenPaths = new Set();

  const onClickOpen = (project: ProjectData): void => {
    const openProjectMsg: Message = {
      method: ApiMethod.OPEN_PROJECT,
      params: { project },
    };
    vscode.postMessage(openProjectMsg);
  };

  const onClickDelete = (project: ProjectData): void => {
    const deleteProjectMsg: Message = {
      method: ApiMethod.DELETE_PROJECT,
      params: { project },
    };
    vscode.postMessage(deleteProjectMsg);

    const data = window.initialDemoData.filter((item: any) => {
      return item.name !== project.name;
    });
    setProjectList(data);
    setProjectListShow(data);
  };

  const handleSelectChange = (value: string): void => {
    const newChipType = value;
    setChipType(newChipType);
  };

  useEffect(() => {
    // init projectListShow
    let filterProjectList = projectList;
    filterProjectList = filterProjectList
      .map((project) => {
        const lowercasedPath = project.path ? project.path.replace(/^[A-Z]/, (match) => match.toLowerCase()) : project.path;
        return { ...project, path: lowercasedPath };
      })
      .filter((project) => {
        // 如果路径已经存在，则跳过
        if (seenPaths.has(project.path)) {
          return false;
        }
        seenPaths.add(project.path);
        return true;
      });
    if (keyword) {
      filterProjectList = filterProjectList.filter((project) => project.name.includes(keyword));
    }
    if (chipType !== 'All') {
      filterProjectList = filterProjectList.filter((project) => project.chip === chipType);
    }
    setProjectListShow(filterProjectList);
  }, [projectList, keyword, chipType]);

  function handleKeywordChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const newKeyword = event.target.value;
    setKeyword(newKeyword);
  }

  useEffect(() => {
    // 从 projectList 中提取唯一的 chip 类型
    const uniqueChipTypes = Array.from(new Set(projectList.map(project => project.chip)))
      .map(chip => ({ value: chip, label: chip }));

    // 添加 "All" 选项
    setChipTypeOptions([{ value: 'All', label: t('All') }, ...uniqueChipTypes]);
  }, [projectList]);

  const columns = [
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('path'),
      dataIndex: 'path',
      key: 'age',
    },
    {
      title: t('chip'),
      dataIndex: 'chip',
      key: 'chip',
    },
    {
      title: t('board'),
      dataIndex: 'board',
      key: 'board',
    },
    {
      title: t('time'),
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: t('operation'),
      dataIndex: 'operation',
      width: `${State.lang === 'zh' ? 100 : 120}px`,
      render: (_: any, record: ProjectData): JSX.Element => {
        return (
          <span>
            <a onClick={(): void => onClickOpen(record)}>{t('open')}</a>
            <a style={{ marginLeft: '10px' }} onClick={(): void => onClickDelete(record)}>{t('delete')}</a>
          </span>
        );
      },
    },
  ];

  useEffect(() => {
    dispatch(getProjectData());
  }, [dispatch]);

  useEffect(() => {
    if (dataSource) {
      setProjectList(dataSource);
      setProjectListShow(dataSource);
      setChipType('All');
    }
  }, [dataSource]);
  useEffect(() => {
    if (deleteProjectCallBackData) {
      setProjectList(deleteProjectCallBackData);
      setProjectListShow(deleteProjectCallBackData);
      setChipType('All');
    }
  }, [deleteProjectCallBackData]);
  const tableEmptyRender = (): JSX.Element => {
    return <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<></>}
    ></Empty>;
  };

  return (
    <>
      <div id='project-list' className='section'>
        <div className='section-title'>
          <img src={projectListIcon} alt='Project List' className='section-title-icon'></img>
          <div className='section-title-text primary-text'>{t('projectList')}</div>
          <Input.Search placeholder={t('SearchProject')} onChange={handleKeywordChange} />
          <Select
            defaultValue='All'
            onChange={handleSelectChange}
            options={chipTypeOptions}
          />
        </div>
        <ConfigProvider renderEmpty={tableEmptyRender}>
          <Table
            dataSource={projectListShow}
            columns={columns}
            pagination={{
              size: 'small',
              showTotal: (total: any) => `${t('totalItems', { 0: total })}`,
              pageSize: 10,
              showSizeChanger: false,
            }}
          />
        </ConfigProvider>
      </div>
    </>
  );
};

export default ProjectList;
