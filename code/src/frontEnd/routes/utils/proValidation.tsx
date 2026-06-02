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

import React, { CSSProperties } from 'react';
import { Table, Space } from 'antd';
import type { TableProps } from 'antd';
import '../../a-styles/app.css';
import '../../a-styles/proValidation.css';

export interface ProfilingValidationData {
  sample: string;
  predict: number;
  golden: number;
  label: number;
  sim: number;
}

export interface ProfilingValidation {
  profilingValidationData: ProfilingValidationData[];
  overflowX?: CSSProperties['overflowX'];
  target: string;
}

const useTableContent = (val: any, item: any, overflowX: string): any => {
  return (<Space size="small" style={{ flexDirection: 'column' }} title={val}>
    {Array.isArray(val) ? (
      val.map((single: any, index: number) => {
        if (index < 3) {
          return <div key={`${item + index + single}`}>{index === 2 ? `${single}...` : single}</div>; //  必须加 key！
        }
        return '';
      })
    ) : <div style={{ width: overflowX === 'hidden' ? '15vw' : '100px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={val}>{val}</div>}
  </Space>);
};

const proValidation: React.FC<ProfilingValidation> = ({
  profilingValidationData,
  overflowX = 'auto',
  target,
}) => {
  const columnArr = ['Sample Name', 'Output Name', 'Predict', 'Golden', 'Accuracy', 'Cosine Similarity'];
  const columns: TableProps<any>['columns'] = columnArr.map((item: any) => {
    let widthVar = 120;
    if (item === 'Accuracy' || item === 'Cosine Similarity') {
      widthVar = 90;
    }
    const isWordItem = item === 'Sample Name' || item === 'Output Name' || item === 'Cosine Similarity';
    let titleHtml: any = '';
    if (isWordItem) {
      titleHtml = <>
        {item.split(' ')[0]}<br />
        {item.split(' ')[1]}
      </>;
    }
    return {
      title: titleHtml === '' ? item : titleHtml,
      dataIndex: item,
      key: item,
      width: widthVar,
      ellipsis: true,
      render: (placeholder: any, record: any): any => {
        let val = record[item] ?? '----';
        const isHandleItem = item === 'Predict' || item === 'Golden' || item === 'Cosine Similarity';
        if (isHandleItem && val !== '----') {
          try {
            if (Array.isArray(val)) {
              val = val.map((one: any) => {
                if (one === 'inf' || one === '-inf') {
                  return one;
                }
                return parseFloat(one).toFixed(6);
              });
            } else {
              val = parseFloat(val).toFixed(6);
            }
          } catch (error) {
            val = '----';
          }
        }
        return useTableContent(val, item, overflowX);
      },
    };
  });
  return (
    <section className="pro-Validation">
      <Table<any>
        columns={columns}
        dataSource={profilingValidationData}
        scroll={{ x: 600, y: overflowX === 'hidden' ? 'calc(100vh - 150px)' : '243px' }}
        pagination={false} />
    </section>
  );
};
export default proValidation;