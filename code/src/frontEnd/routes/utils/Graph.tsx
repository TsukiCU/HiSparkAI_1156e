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

export interface HistogramGraphData {
  x: number;
  y: number;
}
export interface HistogramGraphs {
  xTitle?: string;
  yTitle?: string;
  width?: string;
  height?: string;
  overflowX?: CSSProperties['overflowX'];
  histogramGraphData: HistogramGraphData[];
}
type EChartsOption = echarts.EChartsOption;
const fontFamily = 'Arial, "Microsoft YaHei", sans-serif';

// 使用 React.FC 定义组件类型
const histogramGraph: React.FC<HistogramGraphs> = ({
  xTitle = 'Cosine  Similarity',
  yTitle = 'Probability Distribution(%)',
  width = '425px',
  height = '280px',
  overflowX = 'auto',
  histogramGraphData,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartOption = useMemo<EChartsOption>((): any => {
    return {
      grid: {
        left: 60,
        right: 20,
        top: 10,
        bottom: '20%', // 调整这个值来减少下方空白
      },
      tooltip: {
        show: true,
        trigger: 'item',
        formatter: (params: any, index: any): any => {
          const { data, marker, name } = params;
          return `${marker}${data?.x_ticks ?? name}        ${(data.value * 100).toFixed(2)}%`;
        },
        textStyle: { fontFamily },
      },
      xAxis: {
        type: 'category',
        name: xTitle, // x 轴标题
        nameLocation: 'center',
        nameGap: 25,
        nameTextStyle: { fontFamily },
        data: histogramGraphData.map(item => (parseFloat(`${item.x}`)).toFixed(4)),
        axisLabel: {
          show: true,
          fontFamily,
        },
        axisTick: {
          alignWithLabel: true,
          callback: (value: any, index: any): boolean => {
            // 在特定位置添加刻度
            return [-1.0, -0.5, 0, 0.5, 1].indexOf(value) !== -1;
          },
        },
        splitLine: { show: false }, // 增加分隔线
      },
      yAxis: {
        type: 'value',
        name: yTitle, // y 轴标题
        nameTextStyle: { fontFamily },
        axisLabel: {
          formatter: (value: any, index: any): string => {
            return `${value * 100}`;
          },
          fontFamily,
        },
        nameLocation: 'center', // 标题位置居中
        nameGap: 35, // y轴标题与轴线的距离
        splitLine: {
          show: true,
          z: 0,
          lineStyle: {
            color: '#616161',
            opacity: 0.2,
          },
        }, // 增加分隔线
      },
      series: [
        {
          data: histogramGraphData.map(item => {
            if (item.y > 1) {
              return { ...item, value: parseFloat(`${item.y / 100}`) }; // 实际柱子高度
            } else {
              return { ...item, value: item.y };
            }
          }),
          type: 'bar',
          itemStyle: {
            color: '#D74C00', // 设置柱子颜色
          },
          label: {
            show: false,
            position: 'top',
            fontFamily,
          },
          barWidth: '40%', // 控制宽度，避免太窄
          barCategoryGap: '20%', // 柱子间距，避免挤在一起
          barMinHeight: 1, // 确保柱子不被压缩
        },
      ],
    };
  }, [xTitle, yTitle, histogramGraphData]);

  const chartInstance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!chartRef.current) {
      return (): void => { };
    }

    // 1. 初始化
    chartInstance.current = echarts.init(chartRef.current);
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
  }, [width]);

  return (
    <div style={{
      width: '100%',
      overflowX: overflowX,
      overflowY: 'auto',
      textAlign: 'center',
    }}>
      <div
        ref={chartRef}
        style={{
          width,
          height,
          minHeight: overflowX === 'hidden' ? '200px' : '',
          display: 'inline-block',
        }}
      />
    </div>
  );
};

export default histogramGraph;