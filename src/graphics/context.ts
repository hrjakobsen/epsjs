import { Coordinate, TransformationMatrix } from '../coordinate'
import { PSDictionary } from '../dictionary/dictionary'

export enum LineCap {
  Butt = 0,
  Round = 1,
  Square = 2,
}

export enum LineJoin {
  Miter,
  Round,
  Bevel,
}

// FIXME: Only RGB is implemented
export enum ColorSpace {
  DeviceRGB,
  DeviceCMYK,
  DeviceGray,
  Pattern,
}

export enum Direction {
  Clockwise,
  CounterClockwise,
}

export type RGBColor = {
  r: number
  g: number
  b: number
}

export abstract class GraphicsContext {
  abstract setFont(font: PSDictionary): void
  abstract clip(): void
  abstract setDash(array: number[], offset: number): void
  abstract getDash(): { array: number[]; offset: number }
  abstract getCurrentPoint(): Coordinate
  abstract newPath(): void
  abstract save(): void
  abstract restore(): void
  abstract setLineWidth(width: number): void
  abstract getLineWidth(): number
  abstract setLineCap(lineCap: LineCap): void
  abstract getLineCap(): LineCap
  abstract setLineJoin(lineJoin: LineJoin): void
  abstract getLineJoin(): LineJoin
  abstract setMiterLimit(miterLimit: number): void
  abstract getMiterLimit(): number
  abstract setRgbColor(color: RGBColor): void
  abstract currentRgbColor(): RGBColor
  abstract moveTo(coordinate: Coordinate): void
  abstract lineTo(coordinate: Coordinate): void
  abstract arc(
    coordinate: Coordinate,
    radius: number,
    degreeStart: number,
    degreeEnd: number,
    counterClockWise: boolean
  ): void
  abstract arcTangents(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number
  ): void
  abstract bezierCurveTo(
    controlPoint1: Coordinate,
    controlPoint2: Coordinate,
    endPoint: Coordinate
  ): void
  abstract rectClip(coordinate: Coordinate, width: number, height: number): void
  abstract evenOddClip(): void
  abstract stroke(): void
  abstract fill(): void
  abstract eofill(): void
  abstract strokeRect(
    coordinate: Coordinate,
    width: number,
    height: number
  ): void
  abstract fillRect(coordinate: Coordinate, width: number, height: number): void
  abstract closePath(): void
  abstract fillText(text: string, coordinate: Coordinate): void
  abstract charPath(text: string, coordinate: Coordinate): void
  abstract concat(matrix: TransformationMatrix): void
  abstract getTransformationMatrix(): TransformationMatrix
  abstract setTransformationMatrix(matrix: TransformationMatrix): void
  abstract stringWidth(text: string): { width: number; height: number }
  abstract getDefaultTransformationMatrix(): TransformationMatrix
}
