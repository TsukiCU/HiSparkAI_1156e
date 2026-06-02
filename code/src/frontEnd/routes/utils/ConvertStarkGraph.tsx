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
import React, { useEffect, useRef, useMemo, CSSProperties } from 'react';
import * as echarts from 'echarts';

export interface ConvertStarkData {
  name: string;
  value: number;
  itemStyle?: { color: string };
}

export interface ConvertStarkGraphProps {
  xTitle?: string;
  yTitle?: string;
  width?: string;
  height?: string;
  overflowX?: CSSProperties['overflowX'];
  yAxisLabels?: string[]; // 新增：自定义 y 轴标签
  convertStarkData: ConvertStarkData[];
  target?: string;
}

interface seriesInterface {
  name: string;
  data: any;
  value: string;
}

type EChartsOption = echarts.EChartsOption;
const fontFamily = 'Arial, "Microsoft YaHei", sans-serif';

const convertStarkGraph: React.FC<ConvertStarkGraphProps> = ({
  xTitle = '',
  yTitle = '',
  yAxisLabels = ['filesize'],
  width = '480px',
  height = '280px',
  overflowX = 'auto',
  convertStarkData,
  target,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // 使用 useMemo 缓存图表配置
  const chartOption = useMemo<EChartsOption>((): any => {
    return {
      tooltip: {
        show: true,
        trigger: 'item',
        formatter: (params: any, index: any): any => {
          const { data, marker, name } = params;
          return `${marker}${data.category}-${name}        ${data.value}KB`;
        },
        textStyle: { fontFamily },
      },
      legend: {
        data: convertStarkData.map(item => item.name),
        show: false,
        bottom: '1%', // 小方块离底部的距离
        left: 'center',
        orient: 'horizontal', // 横向排列
        itemGap: 40, // 调整小方块之间的间距
        itemWidth: 30, // 小方块宽度
        itemHeight: 15, // 小方块高度
      },
      grid: {
        top: 20,
        left: 50,
        right: 55,
        bottom: 10,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        name: 'type',
        data: convertStarkData.map(item => item.name),
        show: true,
        offset: 0, // 根据需要调整偏移量
        axisTick: {
          show: true,
        },
        nameTextStyle: { fontFamily },
        axisLabel: {
          interval: 0,
          fontFamily,
        },
        splitLine: { show: false }, // 去掉分隔线
      },
      yAxis: {
        type: 'value',
        name: `Size (KB)`,
        nameLocation: 'center',
        nameGap: 50,
        nameTextStyle: { fontFamily },
        axisLabel: {
          fontFamily,
        },
        axisTick: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          show: true,
          z: 0,
          lineStyle: {
            color: '#616161',
            opacity: 0.2,
          }
        },
        z: 0,
      },
      series: [{
        type: 'bar',
        emphasis: {
          focus: 'series',
        },
        z: 20,
        data: convertStarkData.map(item => {
          return {
            ...item,
            label: {
              show: true,
              position: 'top',
              z: 100,
              fontFamily,
              formatter: (val: seriesInterface): string => {
                const { name, value } = val;
                return `{a|${value} KB}`;
              },
              rich: {
                a: {
                  color: item.itemStyle?.color
                }
              },
            },
          };
        }),
        barWidth: 30, // 设置柱子宽度
      }],
    };
  }, [xTitle, yTitle, yAxisLabels, convertStarkData]);

  const chartInstance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!chartRef.current) {
      return (): void => { };
    }

    // 1. 初始化
    chartInstance.current = echarts.init(chartRef.current);
    if (chartOption?.grid) {
      chartOption.grid = {
        ...chartOption.grid,
        bottom: overflowX === 'hidden' ? '15%' : 10,
        right: overflowX === 'hidden' ? 70 : 55,
      };
    }
    chartInstance.current.setOption(chartOption);

    // 2. 创建 ResizeObserver 监听器
    const resizeObserver = new ResizeObserver((): void => {
      // 当容器尺寸变化时，自动重绘
      // 建议加个简单的防抖或检查实例是否存在
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    });

    // 开始观察
    resizeObserver.observe(chartRef.current);

    // 3. 清理函数
    return (): void => {
      resizeObserver.disconnect(); // 断开观察
      chartInstance.current?.dispose(); // 销毁实例
    };
  }, [xTitle, yTitle, yAxisLabels, convertStarkData, width]);

  return (
    <div style={{
      width: '100%',
      overflowX: overflowX,
      overflowY: 'auto',
      textAlign: 'center',
    }}>
      <div
        ref={chartRef}
        style={{ width, height, minHeight: overflowX === 'hidden' ? '200px' : '', margin: overflowX === 'hidden' ? 0 : '5px 10px 0 1px', display: 'inline-block' }}
      />
    </div>
  );
};

export default convertStarkGraph;
