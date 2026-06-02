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
import { Space, Modal, TreeSelect, Button, Empty, ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getInfo, save2Ini } from '../../actions';
import { CloseCircleOutlined } from '@ant-design/icons';

const SelectFile = (props: any): JSX.Element => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
  
    const [libSourcePathArr, setLibSourcePathArr] = useState([]);
    const libSourcePathArrInfo: any = useSelector((state: any) => state.entities.libSourcePathArrInfo);
  
    const operateData: any = {
      operationType: '',
      paramData: '',
      source: 'setting',
    };
  
    useEffect(() => {
      initTreeSourceData();
    }, [dispatch]);
  
    useEffect(() => {
      if (props.folderAndFileModalFlag) {
        initTreeSourceData();
      }
    }, [props.folderAndFileModalFlag]);
  
    useEffect(() => {
      if (libSourcePathArrInfo) {
        setLibSourcePathArr(libSourcePathArrInfo);
      }
    }, [libSourcePathArrInfo]);
  
    useEffect(() => {
      const dom = document.querySelectorAll('.selectFolderAndFile .ant-select-selection-overflow');
      if (dom[0]?.scrollTop !== undefined) {
        dom[0].scrollIntoView({ block: 'end' });
      }
    }, [props.pathList]);
  
    const initTreeSourceData = (): void => {
      operateData.operationType = 'getFileAndFolder';
      operateData.paramData = { key: 'libSourcePathArrInfo' };
      dispatch(getInfo(operateData));
    };
  
    const getTreesData = (pathArr: any): Array<any> => {
        if (pathArr && Array.isArray(pathArr) && pathArr.length > 0) {
          return pathArr
            .filter((item: any) => {
              // 只选择 user 目录或 user 根目录下的 .o 文件
              return (
                (item.isDir && item.relative === 'user') || // 只选择 user 目录
                (!item.isDir && item.title.endsWith('.o')) // 只选择 user 根目录下的 .o 文件
              );
            })
            .map((item: any): any => {
              if (item.isDir && item.relative === 'user') {
                // user 目录节点
                return {
                  title: item.title,
                  value: '', // 不设置 value，防止被选中
                  key: '', // 不设置 key，防止被选中
                  fullPath: item.path,
                  isLeaf: false, // 目录节点有子节点
                  children: getTreesData(item.children), // 递归获取子节点
                };
              } else {
                // 文件节点
                return {
                  title: item.title,
                  value: item.relative,
                  key: item.relative,
                  fullPath: item.path,
                  isLeaf: true, // 文件节点没有子节点
                  children: [], // 文件节点没有子节点
                };
              }
            });
        }
        return [];
      };
  
    const onLoadData = async (node: any): Promise<void> => {
      operateData.operationType = 'updateTreeArr';
      operateData.paramData = { key: 'libSourcePathArrInfo', path: node.fullPath, treeArr: libSourcePathArr };
      dispatch(getInfo(operateData));
    };
  
    const tableEmptyRender = (): JSX.Element => {
      return <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<></>}
      ></Empty>;
    };
  
    return <Modal
      visible={props.folderAndFileModalFlag}
      destroyOnClose={true}
      footer={[
        <Space direction="horizontal" size="large">
          <Button type='primary' onClick={(): void => props.setFolderAndFileModalFlag(false)}>
            {t('finished')}
          </Button>
        </Space>,
      ]}
      onCancel={(): void => props.setFolderAndFileModalFlag(false)}
    >
      <ConfigProvider renderEmpty={tableEmptyRender}>
        <TreeSelect
          className='selectFolderAndFile'
          fieldNames={{ label: 'title', value: 'key', children: 'children' }}
          allowClear
          clearIcon={<CloseCircleOutlined />}
          multiple
          style={{ width: '100%', marginTop: '24px' }}
          value={props.pathList ? props.pathList.split(',') : undefined}
          dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          placeholder={t('choseFileEndwith.o')}
          onChange={(a): any => props.setPathList(a.join(','))}
          loadData={onLoadData}
          treeData={getTreesData(libSourcePathArr)}
  
        />
      </ConfigProvider>
    </Modal>;
  };
  
  export default SelectFile;
  