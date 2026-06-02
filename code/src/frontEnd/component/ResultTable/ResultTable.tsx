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
import React, { useEffect, useState } from 'react';
import { Table, Space, Popover } from 'antd';
import type { TableProps } from 'antd';
import { useSelector } from 'react-redux';
import { timeToDate, handleAscDesc } from '../../util';
import { ImageInfo } from '@src/frontEnd/component/ImageInfo';
import AscImage from '../../../../resources/Image/asc.svg';
import DescImage from '../../../../resources/Image/desc.svg';
import './ResultTable.css';

interface Row {
    key?: number;
    trailId?: number;
    date?: string;
    modelName?: string;
    contentLength?: string;
    lastModified?: string;
    accuracy?: string;
    avgSim?: string;
    accuracyB?: string;
    avgSimB?: string;
    mse?: string;
    ram?: string;
    flash?: string;
    time?: string;
    dtype?: string;
}

interface profilingResult {
    onSelectionChange: (newSelectedRowKeys: any, newSelectedRows: any) => void;
    selectedRowKeys: number[];
    target: string;
}

export const ProfilingResultFC: React.FC<profilingResult> = ({
    onSelectionChange,
    selectedRowKeys,
    target,
}) => {
    const profHistoryData = useSelector((state: any) => state.entities.profHistoryData);
    const colData = ['trailID', 'modelName', ['accuracyB', 'avgSimB', 'time', 'ram', 'flash'], ['accuracy', 'avgSim', 'mse']];
    const titleDataCpu = ['Trail ID', 'Model Name', ['Accuracy', 'Cosine Similarity', 'Inference Time(MS)', 'RAM(KB)', 'Flash(KB)'], ['Accuracy', 'Cosine Similarity', 'MSE']];
    const titleDataNpu = ['Trail ID', 'Model Name', ['Accuracy', 'Cosine Similarity', 'Inference Time(MS)', 'Model Size(KB)', 'Dbg Size(KB)'], ['Accuracy', 'Cosine Similarity', 'MSE']];
    const nowTitle = target === 'CPU' ? titleDataCpu : titleDataNpu;
    const columns: TableProps<any>['columns'] = colData.map((item: any, index: number) => {
        if (Array.isArray(item)) {
            const titles = item.includes('ram') ? 'Benchmark' : 'Quantize';
            return {
                title: titles,
                children: item.map((one: any, ind: number) => {
                    if (titles === 'Quantize' && one === 'accuracy') {
                        return {
                            title: nowTitle[index][ind],
                            key: one,
                            dataIndex: one,
                            render: (_, record) => (
                                <Space size="middle">
                                    <div>
                                        {handleAscDesc(record?.accuracyChange ?? '----') !== '-' && (<span>
                                            {record.accuracy}({record.accuracyChange?.slice(1)}<img src={handleAscDesc(record?.accuracyChange ?? '----') === 'asc' ? AscImage : DescImage} alt="descAscImage " />)
                                        </span>)}
                                        {handleAscDesc(record?.accuracyChange ?? '----') === '-' && record.accuracy}
                                    </div>
                                </Space>
                            ),
                        };
                    }
                    return {
                        title: nowTitle[index][ind],
                        key: one,
                        dataIndex: one,
                    };
                }),
            };
        }
        if (item === 'modelName') {
            return {
                title: nowTitle[index],
                key: item,
                dataIndex: item,
                render: (_, record) => (
                    <Space size="middle">
                        <ImageInfo modelName={record.modelName} />
                        <div className="model-cell__text">
                            <Popover content={record.modelName} placement="topLeft" trigger="hover">
                                <div className="model-cell__name hover">
                                    {record.modelName}
                                </div>
                            </Popover>
                            <div className="model-cell__meta">
                                Last modified: {record.lastModified}
                            </div>
                        </div>
                    </Space>
                ),
            };
        }
        return {
            title: nowTitle[index],
            key: item,
            dataIndex: item,
        };
    });
    const [tableData, setTableData] = useState<Row[]>([]);
    const [localSelectedRowKeys, setLocalSelectedRowKeys] = useState([]);
    const [localSelectedRows, setLocalSelectedRows] = useState([]);
    useEffect(() => {
        if (profHistoryData) {
            const { data } = profHistoryData;
            setTableDataFunc(data);
        }
    }, [profHistoryData]);
    const rowSelection = {
        // 如果父组件传了 selectedRowKeys 进来，这里就用 props 的，否则用本地的
        selectedRowKeys: selectedRowKeys || localSelectedRowKeys,

        onChange: (newSelectedRowKeys: any, newSelectedRows: any): void => {
            // 更新子组件本地状态（保持表格 UI 响应）
            setLocalSelectedRowKeys(newSelectedRowKeys);
            setLocalSelectedRows(newSelectedRows);

            // 调用父组件传来的回调，通知父组件
            if (onSelectionChange) {
                onSelectionChange(newSelectedRowKeys, newSelectedRows);
            }
        },
    };
    const setTableDataFunc = (data: any): void => {
        if (data?.length) {
            data.sort((a: any, b: any) => b.updateTime - a.updateTime);
            const tableDataInfo = data.map((item: any, index: number) => {
                let ram = item.ram;
                let flash = item.flash;
                return {
                    ...item,
                    trailID: index + 1,
                    key: item.updateTime,
                    avgSim: item.avgSim !== '----' && item.avgSim ? (item.avgSim).toFixed(6) : item.avgSim,
                    mse: item.mse !== '----' && item.mse ? (item.mse).toFixed(6) : item.mse,
                    lastModified: timeToDate(item.updateTime),
                    // 内联处理ram
                    ram,
                    // 内联处理flash
                    flash,
                    dbgSize: item.dbgSize ?? '----',
                    exeomSize: item.exeomSize ?? '----',
                };
            });
            setTableData(tableDataInfo);
        } else {
            setTableData([]);
        }
    };
    return (
        <section className="pro-result">
            <Table<any>
                className="bordered-header-table"
                columns={columns}
                rowKey="key"
                rowSelection={rowSelection}
                dataSource={tableData}
                pagination={false} />
        </section>
    );
};