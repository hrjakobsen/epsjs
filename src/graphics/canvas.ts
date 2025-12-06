import {
  Coordinate,
  IDENTITY_MATRIX,
  matrixMultiply,
  TransformationMatrix,
  transformCoordinate,
} from '../coordinate'
import { PSInterpreter } from '../interpreter'
import { createLiteral, degreeToRadians } from '../utils'
import { GraphicsContext, LineCap, LineJoin, RGBColor } from './context'
import { BoundingBox, ObjectType, PSObject } from '../scanner'
import { PSArray } from '../array'
import { PSDictionary } from '../dictionary/dictionary'
import { Font, SimpleGlyph } from '../fonts/font'
import { createSimpleGlyphPath } from './canvas-font-renderer'

export class CanvasBackedGraphicsContext extends GraphicsContext {
  private fonts: PSDictionary[] = [PSDictionary.newFont('Helvetica', 10)]
  private transformationMatrix: TransformationMatrix
  private currentColor: RGBColor = { r: 0, g: 0, b: 0 }
  private defaultTransformationMatrix: TransformationMatrix
  private activeFont:
    | { name: string; matrix: TransformationMatrix | undefined }
    | undefined

  override setFont(font: PSDictionary): void {
    this.fonts[this.fonts.length - 1] = font
  }

  override clip(): void {
    this.canvasContext.clip()
  }

  override setDash(array: number[], offset: number): void {
    this.canvasContext.setLineDash(array)
    this.canvasContext.lineDashOffset = offset
  }

  override getDash(): { array: number[]; offset: number } {
    return {
      array: this.canvasContext.getLineDash(),
      offset: this.canvasContext.lineDashOffset,
    }
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
      matrix,
      this.transformationMatrix
    )
    this.canvasContext.setTransform(...this.transformationMatrix)
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

  override evenOddClip(): void {
    this.canvasContext.clip('evenodd')
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

  fillTextFromFont(
    fontDict: PSDictionary,
    font: Font,
    text: string,
    coordinate: Coordinate
  ) {
    this.canvasContext.beginPath()
    this.appendTextToPathFromFont(fontDict, font, text, coordinate)
    this.canvasContext.fill()
  }

  appendTextToPathFromFont(
    fontDict: PSDictionary,
    font: Font,
    text: string,
    coordinate: Coordinate
  ) {
    let nextCoordinate = coordinate

    const encodingDict = fontDict.get(
      createLiteral('Encoding', ObjectType.Name)
    ) as PSObject<ObjectType.Array>

    const charStringsDict = fontDict.get(
      createLiteral('CharStrings', ObjectType.Name)
    ) as PSObject<ObjectType.Dictionary>

    const matrix = (fontDict.searchByName('FontMatrix')?.value as PSArray).map(
      (x) => x.value
    ) as TransformationMatrix | undefined
    const fontMatrix = matrix ?? IDENTITY_MATRIX

    const scalingFactor = 1 / font.head.unitsPerEm

    for (let i = 0; i < text.length; ++i) {
      const charCode = text.charCodeAt(i)
      const encodingMapping = encodingDict.value.get(charCode)
      if (!encodingMapping) {
        throw new Error("Couldn't find encoding for charcode " + charCode)
      }

      const glyphIndex = charStringsDict.value.get(
        encodingMapping
      ) as PSObject<ObjectType.Integer>

      if (!glyphIndex) {
        throw new Error(
          "Couldn't find glyph index for name /" + encodingMapping.value
        )
      }

      const glyph = font.glyf.glyphs.at(glyphIndex.value)
      if (!(glyph instanceof SimpleGlyph)) {
        throw new Error('Cannot draw composite glyphs')
      }

      this.canvasContext.save()
      this.canvasContext.translate(nextCoordinate.x, nextCoordinate.y)
      this.canvasContext.transform(...fontMatrix)
      this.canvasContext.scale(scalingFactor, scalingFactor)
      createSimpleGlyphPath(this.canvasContext, glyph)
      this.canvasContext.restore()

      const advanceWidth = font.getAdvanceWidth(glyphIndex.value)
      const distance = transformCoordinate(
        { y: 0, x: advanceWidth * scalingFactor },
        fontMatrix
      )
      nextCoordinate = {
        x: nextCoordinate.x + distance.x,
        y: nextCoordinate.y,
      }
      this.moveTo(nextCoordinate)
    }
  }

  private getFont(fontDict: PSDictionary) {
    const fid = fontDict.get(createLiteral('FID', ObjectType.Name))

    if (fid) {
      return this.interpreter.parsedFonts.getFont(fid)
    }
    return null
  }

  override charPath(text: string, coordinate: Coordinate) {
    const fontDict = this.fonts[this.fonts.length - 1]
    if (!fontDict) {
      throw new Error('No font set')
    }

    const font = this.getFont(fontDict)
    if (!font) {
      console.error('No font details')
      return
    }

    this.appendTextToPathFromFont(fontDict, font, text, coordinate)
  }

  override fillText(text: string, coordinate: Coordinate): void {
    const fontDict = this.fonts[this.fonts.length - 1]
    if (!fontDict) {
      throw new Error('No font set')
    }

    const font = this.getFont(fontDict)
    if (font) {
      return this.fillTextFromFont(fontDict, font, text, coordinate)
    }

    const matrix = (fontDict.searchByName('FontMatrix')?.value as PSArray).map(
      (x) => x.value
    ) as TransformationMatrix | undefined
    const fontName = fontDict.searchByName('FontName')!.value as string

    const currentPoint = this.getCurrentPoint()

    this.canvasContext.save()

    // 1. Move to the text origin
    this.canvasContext.translate(coordinate.x, coordinate.y)

    // 2. Apply the FontMatrix

    const fontMatrix = matrix ?? IDENTITY_MATRIX
    this.canvasContext.transform(...fontMatrix)

    // 3. Set Font Size to 1
    // Since the FontMatrix (e.g., [12 0 0 12 0 0]) usually handles the scaling,
    // we must tell Canvas to draw at a "unit size" so we don't scale twice.
    this.canvasContext.font = `1pt ${fontName}`

    // 4. Flip the Y-axis so it points UP (matching PostScript expectations)
    this.canvasContext.scale(1, -1)

    // 5. Draw at (0,0)
    this.canvasContext.fillText(text, 0, 0)

    // 6. Calculate Width for cursor update
    const measure = this.canvasContext.measureText(text)
    const transformWidth = measure.width

    this.canvasContext.restore()

    // 7. Update Position
    const point = { x: transformWidth, y: 0 }
    const newPoint = transformCoordinate(point, fontMatrix)
    this.moveTo({ x: currentPoint.x + newPoint.x, y: currentPoint.y })
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
