import { Coordinate, matrixMultiply, TransformationMatrix } from '../coordinate'
import { PSInterpreter } from '../interpreter'
import { degreeToRadians } from '../utils'
import { GraphicsContext, LineCap, LineJoin, RGBColor } from './context'
import { BoundingBox } from '../scanner'
import { PSArray } from '../array'
import { PSDictionary } from '../dictionary/dictionary'

export class CanvasBackedGraphicsContext extends GraphicsContext {
  private fonts: PSDictionary[] = [PSDictionary.newFont('Helvetica', 10)]
  private transformationMatrix: TransformationMatrix
  private currentColor: RGBColor = { r: 0, g: 0, b: 0 }
  private defaultTransformationMatrix: TransformationMatrix

  override setFont(font: PSDictionary): void {
    this.fonts[this.fonts.length - 1] = font
    this.applyTopFont()
  }

  override clip(): void {
    this.canvasContext.clip()
  }

  override setDash(array: number[], _offset: number): void {
    // TODO: Handle offset
    this.canvasContext.setLineDash(array)
  }

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
    return this.transformationMatrix
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
    this.transformationMatrix = matrixMultiply(
      this.transformationMatrix,
      matrix
    )
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
    const currentPoint = this.getCurrentPoint()
    const stringWidth = this.canvasContext.measureText(text).width
    this.canvasContext.save()
    this.canvasContext.translate(coordinate.x, coordinate.y)
    this.canvasContext.scale(1, -1) // Flip to draw the text
    this.canvasContext.fillText(text, 0, 0)
    this.canvasContext.restore()
    this.moveTo({ x: currentPoint.x + stringWidth, y: currentPoint.y })
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
    this.canvasContext.lineTo(coordinate.x, coordinate.y)
    this.setCurrentPoint(coordinate)
  }

  override moveTo(coordinate: Coordinate): void {
    this.canvasContext.moveTo(coordinate.x, coordinate.y)
    this.setCurrentPoint(coordinate)
  }

  override newPath(): void {
    this.canvasContext.beginPath()
    this.setCurrentPoint(undefined)
  }
  override setRgbColor(color: RGBColor): void {
    const { r, g, b } = color
    const newColor: number =
      (Math.floor(r * 255) << 16) +
      (Math.floor(g * 255) << 8) +
      Math.floor(b * 255)
    const hexColor = `#${newColor.toString(16).padStart(6, '0')}`
    this.currentColor = color
    this.canvasContext.strokeStyle = hexColor
    this.canvasContext.fillStyle = hexColor
  }

  override currentRgbColor(): RGBColor {
    return this.currentColor
  }

  override setMiterLimit(miterLimit: number): void {
    this.canvasContext.miterLimit = miterLimit
  }
  override save(): void {
    this.canvasContext.save()
    this.currentPoints.push(this.currentPoints[this.currentPoints.length - 1])
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

  override setTransformationMatrix(matrix: TransformationMatrix): void {
    this.transformationMatrix = matrix
    this.canvasContext.setTransform(...matrix)
  }

  override stringWidth(text: string): { width: number; height: number } {
    const measure = this.canvasContext.measureText(text)
    return {
      width: measure.width,
      height: measure.actualBoundingBoxAscent,
    }
  }

  applyTopFont() {
    const font = this.fonts[this.fonts.length - 1]!
    const matrix = (font.searchByName('FontMatrix')?.value as PSArray).map(
      (x) => x.value
    ) as TransformationMatrix
    const fontName = font.searchByName('FontName')!.value as string
    const fontsize = matrix[3] * 1000
    this.canvasContext.font = `${fontsize}px ${fontName}`
  }

  override getDefaultTransformationMatrix(): TransformationMatrix {
    return this.defaultTransformationMatrix
  }

  constructor(
    private interpreter: PSInterpreter,
    private canvasContext: CanvasRenderingContext2D
  ) {
    super()
    this.defaultTransformationMatrix = getTransformationMatrix(
      this.canvasContext.canvas.height,
      interpreter.metaData.boundingBox
    )
    this.transformationMatrix = this.defaultTransformationMatrix
    this.canvasContext.setTransform(...this.defaultTransformationMatrix)
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
