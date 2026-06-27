/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
class Drag {
  private disX = 0;
  private disY = 0;
  private box: HTMLElement;
  private dragArea: HTMLElement;
  private readonly m: OmitThisParameter<(ev: MouseEvent) => void>;
  private readonly u: OmitThisParameter<() => void>;

  constructor(boxClass: string, dragAreaClass: string, index: number) {
    this.box = document.getElementsByClassName(boxClass)[index] as HTMLElement;
    this.dragArea = document.getElementsByClassName(dragAreaClass)[index] as HTMLElement;
    this.m = this.move.bind(this);
    this.u = this.up.bind(this);
  }

  init(): string {
    this.box.style.position = 'absolute';
    this.box.style.left = `${(window.innerWidth - this.box.offsetWidth) / 2}px`;
    this.dragArea.addEventListener('mousedown', this.down.bind(this));
    return 'Bind successfully';
  }

  down(ev: MouseEvent): void {
    this.disX = ev.pageX - this.box.offsetLeft;
    this.disY = ev.pageY - this.box.offsetTop;
    this.box.style.cursor = 'move';
    document.addEventListener('mousemove', this.m);
    document.addEventListener('mouseup', this.u);
  }

  move(ev: MouseEvent): void {
    this.box.style.left = `${Math.max(0, Math.min(ev.pageX - this.disX, window.innerWidth - this.box.offsetWidth))}px`;
    this.box.style.top = `${Math.max(0, Math.min(ev.pageY - this.disY, window.innerHeight - this.box.offsetHeight))}px`;
    (window as any).getSelection().removeAllRanges();
  }

  up(): void {
    this.box.style.cursor = 'default';
    document.removeEventListener('mousemove', this.m);
    document.removeEventListener('mouseup', this.u);
  }
}

export default Drag;
