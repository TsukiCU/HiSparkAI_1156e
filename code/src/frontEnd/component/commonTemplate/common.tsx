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

import React, { useState, useCallback, useEffect, useRef, Ref } from 'react';
import { useSelector } from 'react-redux';
import Shrink from '../../../../resources/Image/shrink.svg';
import Expand from '../../../../resources/Image/expand.svg';
import './common.css';


interface CardProps {
    title?: string;
    width?: string;
    chartChange?: (val: any) => void;
    // children 的类型通常是 ReactNode
    children: React.ReactNode;
};

interface returnProps {
    isActive: boolean;
    activate: (element: HTMLDivElement | null, serverHost: any) => void;
    deactivate: (element: HTMLDivElement | null, width: string) => void;
    handleOpenFullscreen: (val: boolean, element: HTMLDivElement | null, width: string, serverHost: any) => void;
}

const useFakeFullscreen = (chartChange: (val: any) => void): returnProps => {
    const [isActive, setIsActive] = useState(false);
    const scrollPosition = useRef(0);
    const elementRef = useRef<HTMLDivElement | null>(null);
    const [elementWidth, setElementWidth] = useState('');

    const activate = useCallback((element: HTMLDivElement | null, serverHost: any): void => {
        if (element === null) {
            return;
        }
        scrollPosition.current = window.scrollY || document.documentElement.scrollTop;

        element.style.overflow = 'hidden';
        element.style.position = 'fixed';
        element.style.width = '100%';
        element.style.zIndex = '999';
        element.style.background = serverHost ? 'black' : 'white';
        element.style.inset = '0';
    }, []);

    const deactivate = useCallback((element: HTMLDivElement | null, width: string): void => {
        if (element === null) {
            return;
        }
        element.style.overflow = '';
        element.style.position = '';
        element.style.width = width;
        element.style.zIndex = '1';
        element.style.background = 'unset';
        element.style.top = '';

        window.scrollTo(0, scrollPosition.current);
    }, []);

    const handleOpenFullscreen = (val: boolean, element: HTMLDivElement | null, width: string, serverHost: any): void => {
        setIsActive(!val);
        let widthChart: string;
        let height: string;
        let overflowX: string;
        elementRef.current = element ?? null;
        setElementWidth(width);
        if (val) {
            deactivate(element, width);
            widthChart = '480px';
            height = '280px';
            overflowX = 'auto';
        } else {
            activate(element, serverHost);
            widthChart = 'calc(100vw - 40px)';
            height = 'calc(100vh - 99px)';
            overflowX = 'hidden';
        }
        if (chartChange) {
            chartChange({ width: widthChart, height, overflowX });
        }
    };

    useEffect(() => {
        if (!isActive) {
            return (): void => { };
        }
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                e.preventDefault();
                deactivate(elementRef.current, elementWidth);
                const widthChart = '480px';
                const height = '280px';
                const overflowX = 'auto';
                setIsActive(false);
                chartChange({ width: widthChart, height, overflowX });
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return (): any => document.removeEventListener('keydown', handleKeyDown);
    }, [isActive, deactivate, elementWidth]);

    // 修改全屏样式设置
    return {
        isActive,
        activate,
        deactivate,
        handleOpenFullscreen,
    };
};

const CommonCard: React.FC<CardProps> = ({ title, width, chartChange, children }) => {
    const { isActive, handleOpenFullscreen } = useFakeFullscreen(chartChange ?? ((): void => { }));
    const containerRef = useRef<HTMLDivElement>(null);
    const [serverHost, setServerHost] = useState(window.initialData?.kind);
    const themeData = useSelector((state: any) => state.entities.themeData);
    const isDark = themeData === 'dark' || (!themeData && serverHost === 2);
    const str = isDark ? 'black' : 'white';

    return (
        <div ref={containerRef} className="common-card" style={{ width: width ?? '59.5vw', background: isActive ? str : 'unset' }}>
            {/* 需要放大的div */}
            <div className={`app-common-font title-relative ${isActive ? 'full-style' : 'none-full-style'}`}>
                <h2 className="section-title">{title ?? 'Quantization Result History'}</h2>
                <div className="full-screen">
                    <div className="full-btn" onClick={(): void => handleOpenFullscreen(isActive, containerRef.current, width ?? '59.5vw', isDark)}>
                        {!isActive ? <img src={Expand} ></img> : <img src={Shrink} ></img>}
                    </div>
                </div>
            </div>
            <div className={`results-style ${isActive ? 'full-style' : 'none-full-style'}`} >
                <div className='common-history'>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default CommonCard;