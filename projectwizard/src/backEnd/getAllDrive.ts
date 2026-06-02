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
/**
 * @Description 获取电脑中所盘符及其名称
 * @Author 
 * @Date 2023-6-12 15:36:55
 */

const process = require('child_process');

import * as fs from 'fs';
// cmd命令
const cmdOrder = {
    getAllDrive: (): string => ('wmic logicaldisk where drivetype=3 get deviceid'),
    getOneDriveName: (drive: string): string => (`wmic logicaldisk where name="${drive}:" get volumename`),
};

/**
 * 获取电脑中所有盘符及其名称
 * @returns 电脑中所有盘符及其名称
 */
export default async function getAllDrive(): Promise<string[]> {
    let result: string[] = [];
    let promise = new Promise((resolve, reject) => {
        // 获取电脑中所有盘符
        process.exec(cmdOrder.getAllDrive(), (error: any, stdout: any) => {
            if (error !== null) {
                return;
            }
            let stdoutArr = [...stdout];
            let res: string[] = [];
            stdoutArr.forEach((val: string, i: number) => {
                if (val === ':') {
                    res.push(stdoutArr[i - 1]);
                }
            });
            let resList: Array<{
                drive: string;
                name: string;
                path: string;
            }> = [];
            let promiseArr: Array<Promise<any>> = [];
            // 获取所有盘符的所有名称
            getResList(res, promiseArr, resList);
            Promise.all(promiseArr).then(re => {
                resolve(resList);
            });
        });
    });
    await promise.then((res: any) => {
        result = res.map((item: any) => {
            let isD = true;
            try {
                const stat = fs.statSync(item.path);
                isD = stat.isDirectory();
            } catch {
                isD = true;
            }
            return {
                title: item.drive,
                path: item.path,
                isDir: isD,
            };
        });
    });
    return result;
}

function getResList(res: any, promiseArr: any, resList: any): void {
    res.forEach((v: string) => {
        promiseArr.push(
            new Promise((resolve, reject) => {
                process.exec(cmdOrder.getOneDriveName(v), (error: any, stdout: any) => {
                    if (error !== null) {
                        return;
                    }
                    let stdoutArr = [...stdout];
                    let result: string[] = [];
                    stdoutArr.forEach((ele: string, i: number) => {
                        if (ele !== ' ' && ele !== '\n' && ele !== '\r') {
                            result.push(ele);
                        }
                    });
                    result.splice(0, 10);
                    resList.push({
                        drive: `${v}:`,
                        name: result.join(''),
                        path: `${v.toLocaleLowerCase()}:\\`,
                    });
                    resolve(true);
                });
            })
        );
    });
}
