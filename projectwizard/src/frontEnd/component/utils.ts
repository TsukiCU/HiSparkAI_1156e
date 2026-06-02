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
 * clone an object
 * @param {any} target target object
 * @return {object} a copy of target
 */
export function clone(target: any): any {
    if (typeof target === 'object' && target != null) {
        const cloneTarget: any = Array.isArray(target) ? [] : {};
        for (const key in target) {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                cloneTarget[key] = clone(target[key]);
            }
        }
        return cloneTarget;
    } else {
        return target;
    }
}