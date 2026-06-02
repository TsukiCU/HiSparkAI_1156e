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
class Drag {
  private disX: number;
  private disY: number;
  private box: HTMLElement;
  private dragArea: HTMLElement;
  private readonly m: OmitThisParameter<(ev: MouseEvent) => void>;
  private readonly u: OmitThisParameter<() => void>;

  /**
   * constructor
   * @param {string} boxClassName
   * @param {string} dragAreaClassName
   * @param {number} index
   */
  constructor(boxClassName: string, dragAreaClassName: string, index: number) {
    this.disX = 0;
    this.disY = 0;
    this.box = document.getElementsByClassName(boxClassName)[index] as HTMLElement;
    this.dragArea = document.getElementsByClassName(dragAreaClassName)[index] as HTMLElement;
    this.m = this.move.bind(this);
    this.u = this.up.bind(this);
  }

  /**
   * init
   * @return {string}
   */
  init(): string {
    this.box.style.position = 'absolute';
    this.box.style.left = `${(window.innerWidth - this.box.offsetWidth) / 2}px`;
    this.dragArea.addEventListener('mousedown', this.down.bind(this));
    return 'Bind successfully';
  }

  /**
   * when mouse down,get the position
   * @param {MouseEvent} ev mouse event
   */
  down(ev: MouseEvent): void {
    this.disX = ev.pageX - this.box.offsetLeft;
    this.disY = ev.pageY - this.box.offsetTop;
    this.box.style.cursor = 'move';
    document.addEventListener('mousemove', this.m);
    document.addEventListener('mouseup', this.u);
  }

  /**
   * change the position when mouse move
   * @param {MouseEvent} ev
   */
  move(ev: MouseEvent): void {
    this.box.style.left = `${ev.pageX - this.disX}px`;
    this.box.style.top = `${ev.pageY - this.disY}px`;
    if (this.box.offsetLeft <= 0) {
      this.box.style.left = '0px';
    }
    if (this.box.offsetLeft >= window.innerWidth - this.box.offsetWidth) {
      this.box.style.left = `${window.innerWidth - this.box.offsetWidth}px`;
    }
    if (this.box.offsetTop >= window.innerHeight - this.box.offsetHeight) {
      this.box.style.top = `${window.innerHeight - this.box.offsetHeight}px`;
    }
    if (this.box.offsetTop <= 0) {
      this.box.style.top = '0px';
    }

    // drag unselected text
    (window as any).getSelection().removeAllRanges();
  }

  /**
   * remove event listeners when mouse up
   */
  up(): void {
    this.box.style.cursor = 'default';
    document.removeEventListener('mousemove', this.m);
    document.removeEventListener('mouseup', this.u);
  }
}

export default Drag;
