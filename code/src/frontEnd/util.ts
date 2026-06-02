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

const MB_UNIT = 1024 * 1024;
const KB_UNIT = 1024;

export const handleUnit = (size: number): string => {
    if (size > MB_UNIT) {
        const val = size / MB_UNIT;
        return `${val.toFixed(2)} MB`;
    } else if (size > KB_UNIT) {
        const val = size / KB_UNIT;
        return `${val.toFixed(2)} KB`;
    } else {
        return `${size} B`;
    }
};

export const timeToDate = (time: number): string => {
    const date = new Date(time);
    const str = date.toString();
    const arr = str.split(' ');
    return `${arr.slice(1, 3).join(' ')},${arr.slice(3, 4)} ${arr[4]}`;
};

export const ramFlashFunc = (value: number): number => {
    const val = value / KB_UNIT;
    return parseFloat(val.toFixed(2));
};

export const ramFlashtoKBFunc = (obj: any): any => {
    const newObj = deepCopy(obj);
    for (const key in newObj) {
        if (Object.prototype.hasOwnProperty.call(newObj, key)) {
            newObj[key] = ramFlashFunc(newObj[key]);
        }
    }
    return newObj;
};

export const deepCopy = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    const copy: any = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
};

export const timestampToDateTime = (timestamp: number): any => { // 
    if (!timestamp || isNaN(timestamp)) {
        return undefined;
    }
    const date = new Date(timestamp); // 通常时间戳单位是秒，乘以1000转毫秒
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours() % 12).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const aMOrPM = date.getHours() > 12 ? 'PM' : 'AM';

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${aMOrPM}`;
};

export const arrayToObject = (keyArr: any, valueArr: any): any => {
    if (isBeArray(keyArr) || isBeArray(valueArr)) {
        return valueArr;
    }
    try {
        const obj = keyArr.reduce((acc: any, key: any, index: any) => {
            acc[key] = valueArr[index];
            return acc;
        }, {});
        return obj;
    } catch (error) {
        return valueArr;
    }
};

export const isBeArray = (arr: any): boolean => {
    if (arr && Array.isArray(arr) && arr.length > 0) {
        return false;
    }
    return true;
};

export const capitalize = (str: string): string => {
    if (typeof str !== 'string' || !str) { return str; }
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const handleAscDesc = (accuracyChange: string): string => {
    if (typeof accuracyChange !== 'string' || accuracyChange === '----') {
        return '-';
    }
    const accuracyArr = accuracyChange.split('');
    if (accuracyArr.length === 0) { return '-' };
    return accuracyArr[0] === '-' ? 'desc' : 'asc';
};