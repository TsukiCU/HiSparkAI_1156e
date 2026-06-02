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
import { getInfo } from '../../actions';
import { CloseCircleOutlined } from '@ant-design/icons';

const selectFolderAndExtern = (props: any): JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [externSourcePathArr, setExternSourcePathArr] = useState([]);
  const externSourcePathArrInfo: any = useSelector((state: any) => state.entities.externSourcePathArrInfo);

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
    if (externSourcePathArrInfo) {
      setExternSourcePathArr(externSourcePathArrInfo);
    }
  }, [externSourcePathArrInfo]);

  useEffect(() => {
    const dom = document.querySelectorAll('.selectFolderAndExtern .ant-select-selection-overflow');
    if (dom[0]?.scrollTop !== undefined) {
      dom[0].scrollIntoView({ block: 'end' });
    }
  }, [props.pathList]);

  const initTreeSourceData = (): void => {
    operateData.operationType = 'getFileAndFolder';
    operateData.paramData = { key: 'externSourcePathArrInfo', diskinfo: props?.diskinfo };
    dispatch(getInfo(operateData));
  };

  const getTreesData = (pathArr: any): any => {
    if (pathArr && Array.isArray(pathArr) && pathArr.length > 0) {
      return pathArr.map((item: any): any => {
        return {
          title: item.title,
          value: item.path,
          key: item.path,
          isLeaf: !item.isDir,
          children: getTreesData(item.children),
        };
      }).sort();
    }
    return [];
  };

  const onLoadData = async (node: any): Promise<void> => {
    operateData.operationType = 'updateTreeArr';
    operateData.paramData = { key: 'externSourcePathArrInfo', path: node.key, treeArr: externSourcePathArr };
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
        className='selectFolderAndExtern'
        fieldNames={{ label: 'title', value: 'key', children: 'children' }}
        allowClear
        clearIcon={<CloseCircleOutlined />}
        multiple
        style={{ width: '100%', marginTop: '24px' }}
        value={props.pathList ? props.pathList.split(',') : undefined}
        dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        placeholder={t('choseFileOrFolder')}
        onChange={(a): any => props.setPathList(a.join(','))}
        loadData={onLoadData}
        treeData={getTreesData(externSourcePathArr)}

      />
    </ConfigProvider>
  </Modal>;
};

export default selectFolderAndExtern;

