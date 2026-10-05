import { IText2dComponent, Text2dStyle } from '@gg-web-engine/core';
import { Text, TextStyleOptions } from 'pixi.js';
import { PixiDisplayObjectComponent } from './pixi-display-object.component';
import { PixiVisualTypeDocRepo2D } from '../types';

/** pixi.js implementation of `IText2dComponent`: a pixi `Text`. Built by `PixiFactory.createText`. */
export class PixiTextComponent extends PixiDisplayObjectComponent implements IText2dComponent<PixiVisualTypeDocRepo2D> {
  public readonly nativeSprite!: Text;
  private _style: Text2dStyle = {};

  constructor(text: string, style: Text2dStyle = {}) {
    super(new Text({ text }));
    this.setStyle(style);
  }

  public get text(): string {
    return this.nativeSprite.text;
  }

  public set text(value: string) {
    this.nativeSprite.text = value;
  }

  public get style(): Text2dStyle {
    return { ...this._style };
  }

  public setStyle(style: Text2dStyle): void {
    this._style = { ...this._style, ...style };
    const native: TextStyleOptions = {};
    const { fontFamily, fontSize, fontWeight, fontStyle, color, stroke, align, anchor } = this._style;
    if (fontFamily !== undefined) native.fontFamily = fontFamily;
    if (fontSize !== undefined) native.fontSize = fontSize;
    if (fontWeight !== undefined) native.fontWeight = fontWeight;
    if (fontStyle !== undefined) native.fontStyle = fontStyle;
    if (color !== undefined) native.fill = color;
    if (stroke !== undefined) native.stroke = { color: stroke.color, width: stroke.width };
    if (align !== undefined) native.align = align;
    this.nativeSprite.style = native;
    if (anchor !== undefined) {
      this.nativeSprite.anchor.set(anchor.x, anchor.y);
    }
  }
}
