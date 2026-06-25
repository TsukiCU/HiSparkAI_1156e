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

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as os from 'os';
import { execSync, spawnSync } from 'child_process';

// 检查文件是否已存在且完整
export async function isFileComplete(filePath: string, expectedSize?: number): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
        return false;
    }

    try {
        const stats = fs.statSync(filePath);
        
        // 如果知道期望的大小，可以进行比较
        if (expectedSize && stats.size !== expectedSize) {
            return false;
        }
        
        // 文件大小为0，视为不完整
        if (stats.size === 0) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// 获取文件大小（HEAD请求）
export async function getFileSize(url: string): Promise<number | undefined> {
    return new Promise<number | undefined>((resolve) => {
        const options = {
            method: 'HEAD',
            headers: getBrowserLikeHeaders(),
        };
        
        const req = https.request(url, options, (res) => {
            if (res.headers['content-length']) {
                resolve(parseInt(res.headers['content-length'], 10));
            } else {
                resolve(undefined);
            }
        });
        
        req.on('error', () => {
            resolve(undefined);
        });
        
        req.end();
    });
}

// 获取浏览器一样的请求头
export function getBrowserLikeHeaders(): Record<string, string> {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="98", "Google Chrome";v="98"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    };
}

// 定义全局变量
let isDownloading: boolean = false;

// 提供一个函数，用于其他接口获取全局变量的当前值
export function getIsDownloading(): boolean {
    return isDownloading;
}

export function setIsDownloading(value: boolean): boolean {
    isDownloading = value;
    return isDownloading;
}

/**
 * 用 Python urllib 测试清华 PyPI 是否可达，使用与 pip 相同的 HTTP 栈。
 *
 * 关键点：
 *   - 免安装版 Python 没有内置 CA 证书，普通 HTTPS 请求会因 SSL 握手失败
 *     而在内网/外网都报错，无法区分。
 *   - 使用 ssl._create_unverified_context() 跳过证书验证：
 *       外网：代理不拦截，连接清华源成功 → exit 0
 *       内网：代理在 TCP 层返回 407，SSL 握手根本没机会进行 → 抛异常 → exit 1
 *   - 这个跳过只用于连通性检测，实际 pip 安装时 pip.pyz 使用自带的 certifi，
 *     安全性不受影响。
 */
async function isTsinghuaReachable(pythonPath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const childProcess = require('child_process');
        const script = [
            'import urllib.request, ssl, sys',
            'ctx = ssl._create_unverified_context()',
            'try:',
            '    urllib.request.urlopen("https://pypi.tuna.tsinghua.edu.cn/simple/", timeout=4, context=ctx)',
            '    sys.exit(0)',
            'except Exception:',
            '    sys.exit(1)',
        ].join('\n');

        const proc = childProcess.spawn(pythonPath, ['-c', script], { windowsHide: true });
        proc.on('close', (code: number) => resolve(code === 0));
        proc.on('error', () => resolve(false));
        setTimeout(() => { try { proc.kill(); } catch { /* ignore */ } resolve(false); }, 6000);
    });
}

export async function downloadFileWithRetry(
    file: { url: string; name: string; type: string },
    saveDir: string,
    maxRetries = 2
): Promise<void> {
    const fileName = path.basename(file.url);
    const saveFilePath = path.join(saveDir, fileName);

    // 获取远程文件大小
    const fileSize = await getFileSize(file.url);

    // 如果已存在完整文件
    if (fileSize && await isFileComplete(saveFilePath, fileSize)) {
        vscode.window.showInformationMessage(`${file.name} 已存在，跳过下载`);
        return;
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `正在下载 ${file.name} (尝试 ${attempt + 1}/${maxRetries + 1})`,
                    cancellable: true,
                },
                async (progress, token) => {
                    if (fileSize && fileSize > 10 * 1024 * 1024) {
                        await downloadLargeFile(file, saveFilePath, fileSize);
                    } else {
                        await downloadWithRedirect(
                            file.url,
                            saveFilePath,
                            progress,
                            token
                        );
                    }

                    // 校验 .whl 文件合法性：
                    // 有效的 wheel 至少数十 KB；若只有几 KB，说明服务器返回的是
                    // 错误页面（HTML）而非真实文件，必须删掉并报错。
                    if (file.type === 'whl') {
                        const downloadedSize = fs.statSync(saveFilePath).size;
                        if (downloadedSize < 10 * 1024) {
                            fs.unlinkSync(saveFilePath);
                            throw new Error(
                                `${file.name} 下载内容无效（仅 ${downloadedSize} bytes），` +
                                `URL 对应的文件在该镜像源不存在或已失效，请检查 downloadToolChain.json 中的 URL。`
                            );
                        }
                    }
                }
            );
            return;
        } catch (error) {
            attempt++;

            if (attempt > maxRetries) {
                throw error;
            }

            vscode.window.showWarningMessage(
                `下载失败，正在重试 (${attempt}/${maxRetries})`
            );
        }
    }
}

// 分块并行下载大文件
export async function downloadLargeFile(file: { url: string; name: string; type: string }, saveFilePath: string, fileSize: number): Promise<void> {
    // 每个分片的大小 (8MB)
    const chunkSize = 8 * 1024 * 1024;
    // 计算分片数量
    const chunks = Math.ceil(fileSize / chunkSize);
    // 限制并行数，避免打开过多连接
    const maxConcurrentDownloads = 5;

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `正在下载 ${file.name}`,
        cancellable: true,
    }, async (progress, token) => {
        return new Promise<void>(async (resolve, reject) => {
            let isCanceled = false;
            token.onCancellationRequested(() => {
                isCanceled = true;
            });

            // 创建临时目录存放分片
            const tempDir = path.join(os.tmpdir(), `download-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });
            
            try {
                // 创建下载队列
                const queue = [];
                let downloadedChunks = 0;
                let downloadedBytes = 0;
                let lastReportedProgress = 0;
                
                // 创建分片下载任务
                for (let i = 0; i < chunks; i++) {
                    const start = i * chunkSize;
                    const end = Math.min(fileSize - 1, start + chunkSize - 1);
                    const chunkPath = path.join(tempDir, `chunk-${i}`);
                    
                    queue.push(async (): Promise<void> => {                        
                        // 下载分片
                        await downloadChunk(file.url, chunkPath, start, end);
                        
                        // 更新进度
                        downloadedChunks++;
                        downloadedBytes += (end - start + 1);
                        
                        const percentage = Math.floor((downloadedBytes / fileSize) * 100);
                        if (percentage > lastReportedProgress) {
                            progress.report({
                                message: `${percentage}% (${(downloadedBytes / 1048576).toFixed(2)}/${(fileSize / 1048576).toFixed(2)} MB)`,
                                increment: percentage - lastReportedProgress,
                            });
                            lastReportedProgress = percentage;
                        }
                    });
                }
                
                // 并行执行下载任务，但限制并发数
                while (queue.length > 0) {                   
                    const tasks = queue.splice(0, maxConcurrentDownloads);
                    await Promise.all(tasks.map(task => task()));
                }
                
                // 合并分片
                await mergeChunks(tempDir, saveFilePath, chunks);
                
                // 清理临时文件
                await fs.promises.rm(tempDir, { recursive: true, force: true });
                
                resolve();
            } catch (error) {
                // 出错时清理
                try {
                    await fs.promises.rm(tempDir, { recursive: true, force: true });
                    if (fs.existsSync(saveFilePath)) {
                        fs.unlinkSync(saveFilePath);
                    }
                } catch (cleanupError) {
                    // 清理文件失败
                }
                reject(error);
            }
        });
    });
}

// 下载单个分片
export async function downloadChunk(url: string, savePath: string, start: number, end: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const fileStream = fs.createWriteStream(savePath);
        
        const headers = getBrowserLikeHeaders();
        headers['Range'] = `bytes=${start}-${end}`;
        
        const options = {
            headers: headers,
            timeout: 30000, // 30秒超时
        };
        
        const req = https.get(url, options, (response) => {
            if (response.statusCode !== 206 && response.statusCode !== 200) {
                reject(new Error(`HTTP错误状态码: ${response.statusCode}`));
                return;
            }
            
            response.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        });
        
        fileStream.on('error', (err) => {
            fs.unlinkSync(savePath);
            reject(err);
        });
        
        req.on('error', (err) => {
            fs.unlinkSync(savePath);
            reject(err);
        });
        
        req.on('timeout', () => {
            req.destroy();
            fs.unlinkSync(savePath);
            reject(new Error('请求超时'));
        });
        
        req.end();
    });
}

// 合并分片
export async function mergeChunks(tempDir: string, outputPath: string, chunks: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        
        const mergeNextChunk = (index: number): void => {
            if (index >= chunks) {
                output.end();
                resolve();
                return;
            }
            
            const chunkPath = path.join(tempDir, `chunk-${index}`);
            const chunkStream = fs.createReadStream(chunkPath);
            
            chunkStream.pipe(output, { end: false });
            
            chunkStream.on('end', () => {
                mergeNextChunk(index + 1);
            });
            
            chunkStream.on('error', (err) => {
                output.destroy();
                reject(err);
            });
        };
        
        output.on('error', (err) => {
            reject(err);
        });
        
        // 开始合并
        mergeNextChunk(0);
    });
}

async function downloadWithRedirect(
    url: string,
    saveFilePath: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken,
    redirectCount = 0
): Promise<void> {
    const MAX_REDIRECT = 5;

    if (redirectCount > MAX_REDIRECT) {
        throw new Error('重定向次数过多');
    }

    return new Promise<void>((resolve, reject) => {
        let lastPercentage = 0;
        let receivedBytes = 0;
        let totalBytes = 0;
        let fileStream: fs.WriteStream;

        fileStream = fs.createWriteStream(saveFilePath);

        fileStream.on('error', (err) => {
            reject(err);
        });

        token.onCancellationRequested(() => {
            fileStream.close();
            fs.unlinkSync(saveFilePath);
            reject(new Error('用户取消下载'));
        });

        const options = {
            headers: getBrowserLikeHeaders(),
            timeout: 30000,
        };

        const req = https.get(url, options, (response) => {
            // Handle redirecting
            if (
                response.statusCode &&
                [301, 302, 303, 307, 308].includes(response.statusCode)
            ) {
                const location = response.headers.location;
                if (!location) {
                    reject(new Error('重定向但未提供 location'));
                    return;
                }

                response.destroy();
                fileStream.close();
                fs.promises.unlink(saveFilePath).catch(() => {});

                const newUrl = location.startsWith('http')
                    ? location
                    : new URL(location, url).toString();

                downloadWithRedirect(
                    newUrl,
                    saveFilePath,
                    progress,
                    token,
                    redirectCount + 1
                ).then(resolve).catch(reject);

                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP错误状态码: ${response.statusCode}`));
                return;
            }

            if (response.headers['content-length']) {
                totalBytes = parseInt(response.headers['content-length'], 10);
            }

            response.on('data', (chunk) => {
                receivedBytes += chunk.length;

                if (totalBytes > 0) {
                    const percentage = Math.round(
                        (receivedBytes * 100) / totalBytes
                    );

                    if (percentage !== lastPercentage) {
                        progress.report({
                            message: `${percentage}% (${(
                                receivedBytes / 1048576
                            ).toFixed(2)}/${(
                                totalBytes / 1048576
                            ).toFixed(2)} MB)`,
                            increment: percentage - lastPercentage,
                        });

                        lastPercentage = percentage;
                    }
                } else {
                    progress.report({
                        message: `已下载 ${(receivedBytes / 1048576).toFixed(
                            2
                        )} MB`,
                    });
                }
            });

            response.pipe(fileStream);

            response.on('end', () => {
                fileStream.end();
                resolve();
            });
        });

        req.on('error', (err) => {
            fileStream.close();
            fs.unlinkSync(saveFilePath);
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.end();
    });
}

// 使用批处理脚本检查Python版本
export async function checkPythonVersion(): Promise<boolean> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在检查Python环境',
        cancellable: false,
    }, async () => {
        return new Promise<boolean>((resolve, reject) => {
            // 首先尝试直接检测Python
            const childProcess = require('child_process');
            childProcess.exec('python --version', (err: any, stdout: string) => {
                if (!err && stdout.includes('3.11.4')) {
                    // 直接检测到Python 3.11.4
                    vscode.window.showInformationMessage('系统已安装Python 3.11.4，无需重新安装');
                    resolve(false);
                    return;
                }
                
                // 获取扩展目录路径
                const extensionPath = path.dirname(__dirname); // 假设当前文件在扩展的out目录中
                const resourcesPath = path.join(extensionPath, 'resources');
                const scriptPath = path.join(resourcesPath, 'pythonCheck.bat');
                
                // 检查脚本文件是否存在
                if (!fs.existsSync(scriptPath)) {
                    vscode.window.showErrorMessage(`Python检查脚本不存在: ${scriptPath}`);
                    // 询问用户是否继续安装
                    vscode.window.showInformationMessage(
                        'Python检查脚本不存在，是否继续安装Python 3.11.4？',
                        { modal: true },
                        '安装', '跳过'
                    ).then(selection => {
                        if (selection === '安装') {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                    return;
                }
                
                // 执行检查脚本
                const pythonCheckProcess = childProcess.spawn('cmd.exe', ['/c', scriptPath], {
                    // 捕获标准输出和错误
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                
                let outputData = '';
                let errorData = '';
                
                pythonCheckProcess.stdout.on('data', (data: Buffer) => {
                    const chunk = data.toString('utf8');
                    outputData += chunk;
                });
                
                pythonCheckProcess.stderr.on('data', (data: Buffer) => {
                    const chunk = data.toString('utf8');
                    errorData += chunk;
                });
                
                pythonCheckProcess.on('close', (code: number) => {
                    // 使用同步方式处理，避免Promise丢失
                    let needInstall = false;
                    
                    try {
                        // 根据退出代码确定是否需要安装Python
                        switch (code) {
                            case 0: {
                                vscode.window.showInformationMessage('检测到Python 3.11.4，且已配置为系统默认Python');
                                needInstall = false;
                                break;
                            }
                            case 5: {
                                vscode.window.showInformationMessage('已将Python 3.11.4添加到环境变量中，请重启终端使其生效');
                                needInstall = false;
                                break;
                            }
                            case 1: {
                                vscode.window.showInformationMessage('系统中未找到任何Python安装');
                                needInstall = true;
                                break;
                            }
                            case 2: {
                                vscode.window.showInformationMessage('找到Python但无法获取安装路径');
                                needInstall = true;
                                break;
                            }
                            case 3: {
                                vscode.window.showInformationMessage('系统中未找到Python 3.11.4版本');
                                needInstall = true;
                                break;
                            }
                            case 4: {
                                vscode.window.showInformationMessage('已安装Python 3.11.4，但未设置为系统默认python版本,请手动修改环境变量');
                                needInstall = false;
                                break;
                            }
                            default: {
                                needInstall = true;
                                break;
                            }
                        }
                        
                        // 如果需要安装，询问用户
                        if (needInstall) {
                            vscode.window.showInformationMessage(
                                '系统中未找到Python 3.11.4，需要安装才能继续。是否立即安装？如果已安装python，请关闭IDE重新打开以确保环境正常。',
                                { modal: true }, // 使用模态对话框，强制用户响应
                                '安装', '跳过'
                            ).then(selection => {
                                if (selection === '安装') {
                                    resolve(true);
                                } else {
                                    vscode.window.showInformationMessage('已跳过Python安装，部分功能可能无法正常使用');
                                    resolve(false);
                                }
                            });
                        } else {
                            resolve(false);
                        }
                    } catch (error) {
                        // 出错时默认需要安装
                        resolve(true);
                    }
                });
                
                pythonCheckProcess.on('error', (err: any) => {
                    vscode.window.showErrorMessage(`Python检查失败: ${err.message}`);
                    
                    // 简化错误处理，直接询问
                    vscode.window.showInformationMessage(
                        'Python检查失败，是否安装Python 3.11.4？',
                        { modal: true },
                        '安装', '跳过'
                    ).then(selection => {
                        if (selection === '安装') {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                });
            });
        });
    });
}

// 安装Python - 使用简单直接的方式
export async function installPython(pythonExePath: string): Promise<void> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在安装Python 3.11.4',
        cancellable: false,
    }, async (progress) => {
        return new Promise<void>((resolve, reject) => {
            progress.report({ message: '正在启动Python安装程序...' });
            
            // 创建一个唯一的标识符用于进程检测
            const processId = Date.now().toString();
            const tempDir = os.tmpdir();
            const batchPath = path.join(tempDir, `install_python_${processId}.bat`);
            
            // 创建批处理文件 - 使用简单命令安装并等待完成
            const batchContent = `@echo off
echo Installing Python 3.11.4...
set "filename=${path.basename(pythonExePath)}"
set "installdir=%USERPROFILE%\\AppData\\Local\\Programs\\Python\\Python311"

if not exist "%installdir%" (
    mkdir "%installdir%"
)

"${pythonExePath.replace(/\\/g, '\\\\')}" /passive InstallAllUsers=1 PrependPath=1 TargetDir="%installdir%"

if %errorlevel% neq 0 (
    echo Installation failed with code: %errorlevel%
    exit /b %errorlevel%
)

echo Python installation completed successfully
exit /b 0
`;
            
            try {
                // 写入临时文件 - 使用ASCII编码
                fs.writeFileSync(batchPath, batchContent, {encoding: 'ascii'});
                
                // 执行批处理文件
                const childProcess = require('child_process');
                progress.report({ message: 'Python安装中，请稍候...' });
                
                // 使用exec同步执行安装程序，这样会等待安装完成
                childProcess.exec(`"${batchPath}"`, {windowsHide: false}, (error: any, stdout: string, stderr: string) => {
                    // 清理临时文件
                    try {
                        fs.unlinkSync(batchPath);
                    } catch (e) {
                        // 清理临时文件失败
                    }
                    
                    if (error) {
                        // 尝试手动安装
                        vscode.window.showErrorMessage(
                            'Python安装失败。是否要手动安装？',
                            '是', '否'
                        ).then(selection => {
                            if (selection === '是') {
                                childProcess.exec(`start "" "${pythonExePath}"`);
                                
                                vscode.window.showInformationMessage(
                                    '请完成Python安装程序，然后点击"完成"',
                                    '完成'
                                ).then(() => {
                                    resolve();
                                });
                            } else {
                                reject(new Error(`Python安装失败: ${error.message}`));
                            }
                        });
                        return;
                    }
                    vscode.window.showInformationMessage('Python 3.11.4 安装成功');
                    resolve();
                });
            } catch (err) {
                // 清理临时文件
                try {
                    fs.unlinkSync(batchPath);
                } catch (e) {
                    // 清理临时文件失败
                }
                
                vscode.window.showErrorMessage(`创建安装脚本失败: ${err}`);
                reject(err);
            }
        });
    });
}

// 安装wheel包
export async function installPipPackages(pipFilePaths: string[], pythonDir: string, downloadDir: string): Promise<void> {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在安装 Python 依赖包',
        cancellable: false,
    }, async (progress) => {
        const pythonPath = path.join(pythonDir, 'python.exe');
        const useMirror = await isTsinghuaReachable(pythonPath);
        vscode.window.showInformationMessage(
            useMirror ? '检测到外网可用，使用清华源安装依赖' : '内网模式，不使用镜像源'
        );

        return new Promise<void>((resolve, reject) => {
            const totalPackages = pipFilePaths.length;
            let installedCount = 0;
            // 记录成功和失败的包
            const successPackages: string[] = [];
            const failedPackages: string[] = [];

            const pippyzPath = path.join(downloadDir, 'pip.pyz');
            const installNextPackage = (index: number): void => {
                if (index >= pipFilePaths.length) {
                    // 显示安装总结
                    showInstallationSummary(successPackages, failedPackages);
                    if (failedPackages.length !== 0) {
                        reject(new Error(``));
                        return;
                    }
                    resolve();
                    return;
                }
                
                const packagePath = pipFilePaths[index];
                let packageName = path.basename(packagePath, '.whl');
                const mirrorFlag = useMirror ? '-i https://pypi.tuna.tsinghua.edu.cn/simple' : '';
                let command = `"${pythonPath}" ${pippyzPath} install "${packagePath}" ${mirrorFlag}`;
                if (packagePath.includes('.tar.gz')) {
                    packageName = path.basename(packagePath, '.tar.gz');
                    command = `"${pythonPath}" ${pippyzPath} install --target "${pythonDir}" "${packagePath}" ${mirrorFlag}`;
                }
                progress.report({ 
                    message: `安装 ${packageName} (${index + 1}/${totalPackages})`,
                    increment: (1 / totalPackages) * 100,
                });
                
                // 使用exec而不是spawn，并用引号包裹路径
                const childProcess = require('child_process');
                
                childProcess.exec(command, (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        failedPackages.push(packageName);
                        
                        // 显示详细错误信息
                        const detailOutput = 
                            `安装 ${packageName} 失败\n\n` +
                            `错误信息:\n${error.message}\n\n` +
                            `标准错误:\n${stderr}\n\n` +
                            `标准输出:\n${stdout}\n\n` +
                            `命令:\n${command}`;
                        
                        vscode.workspace.openTextDocument({
                            content: detailOutput,
                            language: 'log',
                        }).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                        
                        // 询问用户是否继续
                        vscode.window.showInformationMessage(
                            `安装 ${packageName} 失败，是否继续?`, 
                            '重试', '跳过', '中止',
                        ).then(choice => {
                            if (choice === '重试') {
                                installNextPackage(index);
                            } else if (choice === '跳过') {
                                installNextPackage(index + 1);
                            } else {
                                showInstallationSummary(successPackages, failedPackages);
                                reject(new Error(`用户中止安装: ${packageName}`));
                            }
                        });
                    } else {
                        successPackages.push(packageName);
                        installedCount++;                          
                        installNextPackage(index + 1);
                    }
                });
            };
            
            // 开始安装第一个包
            installNextPackage(0);
        });
    });
}

// 使用默认pip命令安装包
export function installPackagesWithDefaultPip(
    whlFilePaths: string[],
    index: number, 
    totalPackages: number,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    successPackages: string[],
    failedPackages: string[],
    resolve: () => void,
    reject: (reason: any) => void,
): void {
    if (index >= whlFilePaths.length) {
        resolve();
        return;
    }
    
    const packagePath = whlFilePaths[index];
    const packageName = path.basename(packagePath, '.whl');
    
    progress.report({ 
        message: `安装 ${packageName} (${index + 1}/${totalPackages})`,
        increment: (1 / totalPackages) * 100,
    });
    
    const childProcess = require('child_process');
    // 使用exec并用引号包裹路径
    const command = `pip install "${packagePath}"`;
    
    childProcess.exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
            failedPackages.push(packageName);
            
            // 询问用户是否继续
            vscode.window.showInformationMessage(
                `安装 ${packageName} 失败，是否继续?`, 
                '重试', '跳过', '中止',
            ).then(choice => {
                if (choice === '重试') {
                    installPackagesWithDefaultPip(
                        whlFilePaths, index, totalPackages, progress, 
                        successPackages, failedPackages, resolve, reject,
                    );
                } else if (choice === '跳过') {
                    installPackagesWithDefaultPip(
                        whlFilePaths, index + 1, totalPackages, progress, 
                        successPackages, failedPackages, resolve, reject,
                    );
                } else {
                    showInstallationSummary(successPackages, failedPackages);
                    reject(new Error(`用户中止安装: ${packageName}`));
                }
            });
        } else {
            successPackages.push(packageName);        
            installPackagesWithDefaultPip(
                whlFilePaths, index + 1, totalPackages, progress, 
                successPackages, failedPackages, resolve, reject,
            );
        }
    });
}

// 显示安装总结
export function showInstallationSummary(successPackages: string[], failedPackages: string[]): void {
    if (failedPackages.length === 0) {
        // 所有包安装成功
        vscode.window.showInformationMessage(
            `✅ 全部Python依赖包安装成功 (共${successPackages.length}个)`,
        );
    } else if (successPackages.length === 0) {
        // 所有包安装失败
        vscode.window.showErrorMessage(
            `❌ 全部Python依赖包安装失败 (共${failedPackages.length}个)`,
        );
    } else {
        // 部分成功，部分失败
        vscode.window.showWarningMessage(
            `⚠️ Python依赖包安装部分完成: ${successPackages.length}个成功, ${failedPackages.length}个失败`,
        );
    }
}

function getFileName(filePath: string): string {
  // 使用 lastIndexOf 找到最后一个斜杠的位置
  const lastSlashIndex = filePath.lastIndexOf('/');
  // 如果是 Windows 路径，还可以考虑反斜杠
  const lastBackslashIndex = filePath.lastIndexOf('\\');
  const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackslashIndex);

  // 如果没有找到斜杠，则返回原字符串
  if (lastSeparatorIndex === -1) {
    return filePath;
  }

  // 截取文件名部分
  return filePath.substring(lastSeparatorIndex + 1);
}

// 修改解压函数，避免多余的目录层级
export async function extractZipFile(zipPath: string, destPath: string): Promise<void> {
    const fileName = getFileName(zipPath);
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `正在解压 ${fileName}`,
        cancellable: false,
    }, async () => {
        return new Promise<void>((resolve, reject) => {
            // 使用PowerShell解压并处理目录结构
            const psCommand = `
            Add-Type -AssemblyName System.IO.Compression.FileSystem;
            $zipPath = '${zipPath.replace(/\\/g, '\\\\')}';
            $destPath = '${destPath.replace(/\\/g, '\\\\')}';
            
            try {
                $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath);
                $totalEntries = $zip.Entries.Count;
                $processed = 0;
                
                # 查找tools目录前缀
                $toolsPrefix = $null;
                foreach($entry in $zip.Entries) {
                    if($entry.FullName.StartsWith('tools/') -or $entry.FullName.StartsWith('tools\\\\')) {
                        $toolsPrefix = 'tools/';
                        break;
                    }
                    if($entry.FullName.Split('/')[0] -eq 'tools' -or $entry.FullName.Split('\\\\')[0] -eq 'tools') {
                        $toolsPrefix = 'tools/';
                        break;
                    }
                }
                
                if($toolsPrefix -eq $null) {
                    # 如果没有tools前缀，直接解压所有文件
                    foreach($entry in $zip.Entries) {
                        $processed++;
                        $targetPath = [System.IO.Path]::Combine($destPath, $entry.FullName);
                        $targetDir = [System.IO.Path]::GetDirectoryName($targetPath);
                        
                        if(![System.IO.Directory]::Exists($targetDir)) {
                            [System.IO.Directory]::CreateDirectory($targetDir) | Out-Null;
                        }
                        
                        if(!$entry.FullName.EndsWith('/') -and !$entry.FullName.EndsWith('\\\\')) {
                            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true);
                        }
                        
                        if($processed % 100 -eq 0) {
                            Write-Host "已解压: $processed / $totalEntries 文件";
                        }
                    }
                } else {
                    # 如果有tools前缀，去掉前缀后解压
                    foreach($entry in $zip.Entries) {
                        # 跳过tools目录本身
                        if($entry.FullName -eq $toolsPrefix -or $entry.FullName -eq 'tools\\\\') {
                            continue;
                        }
                        
                        # 只处理tools目录下的文件
                        if($entry.FullName.StartsWith($toolsPrefix) -or $entry.FullName.StartsWith('tools\\\\')) {
                            $processed++;
                            # 去掉tools/前缀
                            $relativePath = $entry.FullName.Substring($toolsPrefix.Length);
                            $targetPath = [System.IO.Path]::Combine($destPath, $relativePath);
                            $targetDir = [System.IO.Path]::GetDirectoryName($targetPath);
                            
                            if(![System.IO.Directory]::Exists($targetDir)) {
                                [System.IO.Directory]::CreateDirectory($targetDir) | Out-Null;
                            }
                            
                            if(!$entry.FullName.EndsWith('/') -and !$entry.FullName.EndsWith('\\\\')) {
                                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $targetPath, $true);
                            }
                            
                            if($processed % 100 -eq 0) {
                                Write-Host "已解压: $processed / $totalEntries 文件";
                            }
                        }
                    }
                }
                
                $zip.Dispose();
                exit 0;
            } catch {
                Write-Error $_.Exception.Message;
                exit 1;
            }
            `;
            
            const childProcess = require('child_process');
            const psProcess = childProcess.spawn('powershell', ['-Command', psCommand]);
            
            let errorOutput = '';
            
            psProcess.stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });
            
            psProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`解压失败: ${errorOutput}`));
                }
            });
            
            psProcess.on('error', (err: any) => {
                reject(err);
            });
        });
    });
}

function isGnuTar(tarExe: string): boolean {
    const result = spawnSync(tarExe, ['--version'], { encoding: 'utf8' });
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    return /GNU tar/i.test(output);
}

// 修改解压函数，避免多余的目录层级
export async function extractTarFile(tarPath: string, destPath: string): Promise<void> {
    const fileName = getFileName(tarPath);
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `正在解压 ${fileName}`,
        cancellable: false,
    }, async () => {
        return new Promise<void>((resolve, reject) => {
            const childProcess = require('child_process');

            const tarExe = 'tar';
            // '\' are not treated as path separators in POSIX environment and thus may break path resolution. Normalization is necessary.
            const normalizedPath = destPath.replace(/\\/g, '/');
            const psProcess = isGnuTar(tarExe)
            ? childProcess.spawn('tar', ['--force-local', '-xzf', tarPath, '-C', normalizedPath], { windowsHide: true })
            : childProcess.spawn('tar', ['-xzf', tarPath, '-C', normalizedPath], { windowsHide: true });

            let errorOutput = '';
            psProcess.stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });

            psProcess.on('close', (code: number) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`解压失败: ${errorOutput}`));
                }
            });
            psProcess.on('error', (err: any) => {
                reject(err);
            });
        });
    });
}

/**
 * 获取当前用户环境变量的值
 */
function getEnvironmentVariable(name: string): string {
    const escapedName = name.replace(/'/g, "''");
    const command = `powershell -Command "[Environment]::GetEnvironmentVariable('${escapedName}', 'User')"`;
  
    try {
      const stdout = execSync(command, { encoding: 'utf8' });
      const value = stdout.trim();
      return value;
    } catch (error) {
      return '';
    }
  }

/**
 * 通过PowerShell设置用户环境变量
 */
function setEnvironmentVariable(name: string, value: string): { success: boolean; message: string } {
    // 转义PowerShell中的特殊字符
    const escapedName = name.replace(/'/g, "''");
    const escapedValue = value.replace(/'/g, "''");
  
    const command = `powershell -Command "[Environment]::SetEnvironmentVariable('${escapedName}', '${escapedValue}', 'User')"`;
  
    try {
      execSync(command);
      return { success: true, message: `环境变量设置成功: ${name} = ${value}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, message: `环境变量设置失败 ${name}: ${errorMessage}` };
    }
  }
  
  function getEnvKey(): string {
    const key = 'HISPARK_TOOL_PATH';
    return key;
  }
  
  export function getToolsPath(): string {
    const envKey = getEnvKey();
    const envPath = getEnvironmentVariable(envKey);
    return envPath;
  }
  
  export function setToolsPath(toolsPath: string): { success: boolean; message: string } {
    const envKey = getEnvKey();
    const ret = setEnvironmentVariable(envKey, toolsPath);
    return ret;
  }

  export function checkPythonDepsInstalledLater(pythonPath: string, dependencies: string[]): boolean {
    const downloadDir = path.join(pythonPath, '../../../downloads');
    const pippyzPath = path.join(downloadDir, 'pip.pyz');
    try {
      const output = execSync(`"${pythonPath}" ${pippyzPath} list`).toString();
      const lines = output.split('\n');
      const installedPackages = new Set<string>();
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length > 0) {
          installedPackages.add(parts[0].toLowerCase());
        }
      }
      const ret = dependencies.every((dependency) => installedPackages.has(dependency.toLowerCase()));
      return ret;
    } catch (error) {
      return false;
    }
  }