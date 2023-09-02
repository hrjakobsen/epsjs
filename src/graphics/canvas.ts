import { Coordinate, TransformationMatrix } from '../coordinate'
import { PostScriptInterpreter } from '../interpreter'
import { degreeToRadians } from '../utils'
import { GraphicsContext, LineCap, LineJoin } from './context'
import { BoundingBox } from '../scanner'

export class CanvasBackedGraphicsContext extends GraphicsContext {
  private currentPoints: (Coordinate | undefined)[] = [undefined]
  override getCurrentPoint(): Coordinate {
    const point = this.currentPoints[this.currentPoints.length - 1]
    if (!point) {
      throw new Error('currentPoint empty')
    }
    return point
  }
  private setCurrentPoint(point: Coordinate | undefined) {
    this.currentPoints[this.currentPoints.length - 1] = point
  }

  override getTransformationMatrix(): TransformationMatrix {
    const { a, b, c, d, e, f } = this.canvasContext.getTransform()
    return [a, b, c, d, e, f]
  }

  override getLineWidth(): number {
    return this.canvasContext.lineWidth
  }
  override getLineCap(): LineCap {
    const lineCap = this.canvasContext.lineCap
    switch (lineCap) {
      case 'butt':
        return LineCap.Butt
      case 'round':
        return LineCap.Round
      case 'square':
        return LineCap.Square
    }
  }
  override getLineJoin(): LineJoin {
    const lineJoin = this.canvasContext.lineJoin
    switch (lineJoin) {
      case 'miter':
        return LineJoin.Miter
      case 'round':
        return LineJoin.Round
      case 'bevel':
        return LineJoin.Bevel
    }
  }
  override getMiterLimit(): number {
    return this.canvasContext.miterLimit
  }

  override concat(matrix: TransformationMatrix): void {
    this.canvasContext.transform(...matrix)
  }

  override bezierCurveTo(
    controlPoint1: Coordinate,
    controlPoint2: Coordinate,
    endPoint: Coordinate
  ): void {
    this.canvasContext.bezierCurveTo(
      controlPoint1.x,
      controlPoint1.y,
      controlPoint2.x,
      controlPoint2.y,
      endPoint.x,
      endPoint.y
    )
    this.setCurrentPoint(endPoint)
  }
  override rectClip(
    coordinate: Coordinate,
    width: number,
    height: number
  ): void {
    const path = new Path2D()
    path.rect(coordinate.x, coordinate.y, width, height)
    this.setCurrentPoint(undefined)
    this.canvasContext.clip(path)
  }
  override stroke(): void {
    this.canvasContext.stroke()
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override fill(): void {
    this.canvasContext.fill()
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override eofill(): void {
    this.canvasContext.fill('evenodd')
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override strokeRect(
    coordinate: Coordinate,
    width: number,
    height: number
  ): void {
    this.canvasContext.strokeRect(coordinate.x, coordinate.y, width, height)
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override fillRect(
    coordinate: Coordinate,
    width: number,
    height: number
  ): void {
    this.canvasContext.fillRect(coordinate.x, coordinate.y, width, height)
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override closePath(): void {
    this.canvasContext.closePath()
    this.setCurrentPoint(undefined)
  }
  override fillText(text: string, coordinate: Coordinate): void {
    // Postscript has inverted y axis, so we temporarily flip the canvas to
    // draw the text
    this.canvasContext.save()
    this.canvasContext.scale(1, -1) // Flip to draw the text
    this.canvasContext.fillText(text, coordinate.x, -coordinate.y)
    this.canvasContext.restore()
  }
  override arc(
    coordinate: Coordinate,
    radius: number,
    degreeStart: number,
    degreeEnd: number,
    counterClockWise: boolean
  ): void {
    this.canvasContext.arc(
      coordinate.x,
      coordinate.y,
      radius,
      degreeToRadians(degreeStart),
      degreeToRadians(degreeEnd),
      !counterClockWise
    )
    this.setCurrentPoint(coordinate)
  }

  override lineTo(coordinate: Coordinate): void {
    console.log('lineTo', coordinate)
    this.canvasContext.lineTo(coordinate.x, coordinate.y)
    this.setCurrentPoint(coordinate)
  }

  override moveTo(coordinate: Coordinate): void {
    console.log('moveTo', coordinate)
    this.canvasContext.moveTo(coordinate.x, coordinate.y)
    this.setCurrentPoint(coordinate)
  }

  override newPath(): void {
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override setRgbColor(r: number, g: number, b: number): void {
    const newColor: number = (r << 16) + (g << 8) + b
    this.canvasContext.strokeStyle = `#${newColor
      .toString(16)
      .padStart(6, '0')}`
    this.canvasContext.fillStyle = `#${newColor.toString(16).padStart(6, '0')}`
  }

  override setMiterLimit(miterLimit: number): void {
    this.canvasContext.miterLimit = miterLimit
  }
  override save(): void {
    this.canvasContext.save()
    this.currentPoints.push(undefined)
  }
  override restore(): void {
    this.canvasContext.restore()
    this.currentPoints.pop()
  }
  override setLineWidth(width: number): void {
    this.canvasContext.lineWidth = width
  }
  override setLineCap(lineCap: LineCap): void {
    switch (lineCap) {
      case LineCap.Butt:
        this.canvasContext.lineCap = 'butt'
        return
      case LineCap.Round:
        this.canvasContext.lineCap = 'round'
        return
      case LineCap.Square:
        this.canvasContext.lineCap = 'square'
        return
    }
  }

  override setLineJoin(lineJoin: LineJoin): void {
    switch (lineJoin) {
      case LineJoin.Miter:
        this.canvasContext.lineJoin = 'miter'
        return
      case LineJoin.Round:
        this.canvasContext.lineJoin = 'round'
        return
      case LineJoin.Bevel:
        this.canvasContext.lineJoin = 'bevel'
        return
    }
  }

  constructor(
    private interpreter: PostScriptInterpreter,
    private canvasContext: CanvasRenderingContext2D
  ) {
    super()
    const boundingBox = interpreter.metaData.boundingBox
    this.canvasContext.setTransform(
      ...getTransformationMatrix(
        this.canvasContext.canvas.height,
        interpreter.metaData.boundingBox
      )
    )
  }
}

function getTransformationMatrix(
  height: number,
  boundingBox?: BoundingBox
): TransformationMatrix {
  if (!boundingBox) {
    return [1, 0, 0, -1, 0, height]
  }
  return [1, 0, 0, -1, -boundingBox.lowerLeftX, height + boundingBox.lowerLeftY]
}
