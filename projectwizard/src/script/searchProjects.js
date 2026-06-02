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
const fs = require('fs');
const path = require('path');
import * as ini from 'ini';

class TraversalProjectThreads {
  static SUFFIX_PROJECT_LIST = '../../../projectlist.json';

  static ApiMethod = {
    CHANGE_THEME: 'changeTheme',
    SET_LANGUAGE: 'setLanguage',
    GET_INFO_CALLBAK: 'getInfoCallBack',
  };

  static traversedItems = 0;
  static result = [];
  static hiprojDupDirDict = {};
  static proListContent = [];
  static dict = {};
  static total = 0;

  static step(fatherPath) {
    let arr = [];
    try {
      arr = fs.readdirSync(fatherPath);
    } catch {
      // No access to folder, skipping.
    }
    arr.forEach(item => {
      let itemPath = path.join(fatherPath, item);

      // Send the current progress to the front end.
      if (this.dict[itemPath]) {
        this.dict[itemPath] = false;
        this.traversedItems++;
        this.sendProgress(itemPath);
      }

      try {
        let stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          this.handleDir(itemPath);
        }
      } catch (e) {
        // If an error occurs in checking a folder during the loop, skip it directly and do not block the program.
      }
    });
  }

  static handleDir(dirPath) {
    let itemArr = [];
    try {
      itemArr = fs.readdirSync(dirPath);
    } catch (e) {
      return;
    }
    // Importing a new IDE Project
    let hasHiproj = false;
    itemArr.forEach(ele => {
      const elePath = path.join(dirPath, ele);

      if (this.dict[elePath]) {
        this.dict[elePath] = false;
        this.traversedItems++;
        this.sendProgress(elePath);
      }
      if (this.pathIsHiproj(elePath)) {
        this.handleHiproj(dirPath, ele, elePath);
        hasHiproj = true;
      }
      if (this.pathIsHimpw(elePath)) {
        this.handleHimpw(ele, elePath, dirPath);
      }
    });
    // Importing a Harmony Project
    if (!hasHiproj) {
      this.handleDeveco(dirPath);
    }
  }

  static handleHimpw(ele, elePath, dirPath) {
    this.result.push({
      name: path.parse(ele).name,
      path: elePath,
      disabled: this.proListContent.length > 0 && this.proListContent.some(item => item.path === elePath),
      dir: dirPath,
    });
  }

  static handleHiproj(dirPath, ele, elePath) {
    if (this.hiprojDupDirDict[dirPath]) {
      this.hiprojDupDirDict[dirPath] += 1;
    } else {
      this.hiprojDupDirDict[dirPath] = 1;
    }
    const content = fs.readFileSync(elePath, 'utf-8');
    const parsedData = ini.parse(content);
    const projectType = parsedData?.information?.project_type;
    this.result.push({
      name: path.parse(ele).name,
      path: elePath,
      disabled: this.proListContent.length > 0 && this.proListContent.some(item => item.path === elePath),
      dir: dirPath,
      projectType: projectType,
    });
  }

  static handleDeveco(dirPath) {
    let iniPath = path.join(dirPath, '.deveco', 'deveco.ini');

    if (fs.existsSync(iniPath)) {
      this.result.push({
        name: path.parse(dirPath).base,
        path: dirPath,
        disabled: this.proListContent.length > 0 && this.proListContent.some(item => item.path === dirPath),
        dir: dirPath,
      });
    } else {
      this.step(dirPath);
    }
  }

  static iterationToObtain(importPath, globalStoragePath) {
    const obj = this.getTotalProgressDict(importPath);
    this.dict = obj.dict;
    this.total = obj.total;

    const proListPath = path.join(globalStoragePath, this.SUFFIX_PROJECT_LIST);

    if (fs.existsSync(proListPath)) {
      try {
        this.proListContent = JSON.parse(fs.readFileSync(proListPath).toString());
      } catch (e) {
        // If reading the project list data fails, the current content of proListContent is not changed.
      }
    }
    this.handleDir(importPath);
    this.checkAndAddProjectsFromCache(importPath, globalStoragePath);
    this.sendImportableItemsInfo(importPath);
  }

  static checkAndAddProjectsFromCache(importPath, globalStoragePath) {
    const cacheFilePath = path.join(path.dirname(globalStoragePath), 'projectdata.json');
    if (!fs.existsSync(cacheFilePath)) {
      return;
    }

    let projectData;
    try {
      projectData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    } catch (e) {
      return;
    }

    const existingPaths = new Set(this.result.map(item => item.path.toLowerCase()));

    projectData.forEach((item) => {
      if (item.SDK.toLowerCase() === importPath.toLowerCase()) {
        item.project.forEach((projectPath) => {
          const lowerCasePath = projectPath.toLowerCase();
          if (fs.existsSync(projectPath) && !existingPaths.has(lowerCasePath)) {
            this.result.push({
              name: path.parse(projectPath).name,
              path: projectPath,
              disabled: this.proListContent.length > 0 && this.proListContent.some((proj) => proj.path === projectPath),
              dir: path.dirname(projectPath),
            });
            existingPaths.add(lowerCasePath);
          }
        });
      }
    });
  }

  static sendImportableItemsInfo(importPath) {
    const callBackMessage = {
      method: this.ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: {
          importPath,
          importableItems: this.result,
          hiprojDupDirDict: this.hiprojDupDirDict,
        },
        key: 'importableItemsInfo',
      },
    };
    process?.send(callBackMessage);
  }

  static getTotalProgressDict(theImportPath, totalLen = 0, maxLen = 300) {
    let totalLength = totalLen;
    let progressResult = {};
    let firstLayerArr = [];
    try {
      firstLayerArr = fs.readdirSync(theImportPath);
    } catch (e) {
      firstLayerArr = [];
    }
    totalLength += firstLayerArr.length;

    getTotalProgressStep(theImportPath, maxLen, firstLayerArr);

    function getTotalProgressStep(importPath, maxLength = 300, totalCurrentLayerArr = []) {
      if (totalLength > maxLength) {
        totalCurrentLayerArr.forEach(item => {
          progressResult[path.join(importPath, item)] = true;
        });
        return;
      }
      let totalNextLayerArr = [];
      totalCurrentLayerArr.forEach(item => {
        let itemPath = path.join(importPath, item);
        progressResult[itemPath] = true;

        try {
          fs.statSync(itemPath);
        } catch (error) {
          return;
        }

        if (fs.statSync(itemPath).isDirectory()) {
          let nextLayerArr = [];
          try {
            nextLayerArr = fs.readdirSync(itemPath);
          } catch (error) {
            return;
          }

          nextLayerArr.forEach(ele => {
            totalNextLayerArr.push(path.join(item, ele));
          });
        }
      });
      if (totalNextLayerArr.length > 0) {
        totalLength += totalNextLayerArr.length;
        getTotalProgressStep(importPath, maxLength, totalNextLayerArr);
      }
    }

    return {
      dict: progressResult,
      total: totalLength,
    };
  }

  static sendProgress(currentPath) {
    const callBackMessage = {
      method: this.ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: {
          percent: Math.floor(this.traversedItems / this.total * 10000) / 100,
          currentPath,
        },
        key: 'progressPercent',
      },
    };
    process?.send(callBackMessage);
  }

  static pathIsHiproj(targetPath) {
    return this.pathTypeJudge(targetPath, '.hiproj');
  }

  static pathIsHimpw(targetPath) {
    return this.pathTypeJudge(targetPath, '.himpw');
  }

  static pathTypeJudge(targetPath, extName) {
    if (this.pathIsFile(targetPath)) {
      if (path.extname(targetPath) === extName) {
        return true;
      }
    }
    return false;
  }

  static pathIsFile(targetPath) {
    if (!targetPath) {
      return false;
    }
    let stat = null;
    try {
      stat = fs.statSync(targetPath);
    } catch {
      // No permission. Skip.
    }
    if (stat?.isFile()) {
      return true;
    } else {
      return false;
    }
  }
}

process?.on('message', (event) => {
  if (event?.type === 'iterationToObtain') {
    TraversalProjectThreads.iterationToObtain(event?.param?.importPath, event?.param?.globalStoragePath);
  }
});