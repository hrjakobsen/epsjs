import {
  Coordinate,
  offsetCoordinate,
  TransformationMatrix,
  transformCoordinate,
} from './coordinate'

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

export enum SegmentType {
  Straight,
  Arc,
  Bezier,
  TangentArc,
}

export enum Direction {
  Clockwise,
  CounterClockwise,
}

export type Segment = {
  type: SegmentType
  coordinates?: Coordinate[]
  radius?: number
  angles?: number[]
  direction?: Direction
}

type SubPath = Segment[]

type PathData = SubPath[]

export class Path {
  public subpaths: SubPath[]
  constructor(subpaths?: SubPath[]) {
    if (!subpaths?.length) {
      this.subpaths = [[]]
    } else {
      this.subpaths = subpaths
    }
  }
  private _currentPoint?: Coordinate = undefined

  public get currentSubpath() {
    if (!this.subpaths.length) {
      throw new Error('currentSubpath empty')
    }
    return this.subpaths[this.subpaths.length - 1]!
  }

  public get currentPoint() {
    if (!this._currentPoint) {
      throw new Error('currentPoint undefined')
    }
    return this._currentPoint!
  }

  public set currentPoint(coordinate: Coordinate) {
    this._currentPoint = coordinate
  }

  public addSegment(segment: Segment) {
    this.currentSubpath.push(segment)
  }

  public copy(): Path {
    // TODO: implement
    return this
  }
}

export class GraphicsState {
  public constructor(private canvasHeight: number) {
    this.currentTransformationMatrix = getDefaultCanvasTransformationMatrix(
      this.canvasHeight
    )
  }
  public currentTransformationMatrix: TransformationMatrix
  public position: { x: number; y: number } = { x: -1, y: -1 }
  public path = new Path([])
  public clippingPath = new Path([
    [
      {
        type: SegmentType.Straight,
        coordinates: [
          { x: 0, y: 0 },
          { x: Infinity, y: 0 },
        ],
      },
      {
        type: SegmentType.Straight,
        coordinates: [
          { x: Infinity, y: 0 },
          { x: Infinity, y: Infinity },
        ],
      },
      {
        type: SegmentType.Straight,
        coordinates: [
          { x: Infinity, y: Infinity },
          { x: 0, y: Infinity },
        ],
      },
      {
        type: SegmentType.Straight,
        coordinates: [
          { x: 0, y: Infinity },
          { x: 0, y: 0 },
        ],
      },
    ],
  ])
  public clippingPathStack: Path[] = []
  // TODO implement
  public colorSpace: ColorSpace = ColorSpace.DeviceRGB
  public color: number = 0x000
  // TODO: implement
  public font: undefined = undefined
  public lineWidth: number = 1.0
  public lineCap: LineCap = LineCap.Butt
  public lineJoin: LineJoin = LineJoin.Miter
  public miterLimit = 10.0
  public dashPattern: number[] = []
  public strokeAdjustment = false

  public toDeviceCoordinate(coordinate: Coordinate) {
    return transformCoordinate(coordinate, this.currentTransformationMatrix)
  }

  public toRelativeOffset(c: Coordinate) {
    const origin = this.toDeviceCoordinate({ x: 0, y: 0 })
    const offsetWithTranslation = this.toDeviceCoordinate(c)
    const offsetWithOutTranslation = offsetCoordinate(offsetWithTranslation, {
      x: -origin.x,
      y: -origin.y,
    })
    return offsetWithOutTranslation
  }

  public copy(): GraphicsState {
    const newState = new GraphicsState(this.canvasHeight)
    newState.currentTransformationMatrix = [...this.currentTransformationMatrix]
    newState.position = { x: this.position.x, y: this.position.y }
    newState.path = this.path.copy()
    newState.clippingPath = this.clippingPath.copy()
    newState.clippingPathStack = this.clippingPathStack.map((x) => x.copy())
    newState.colorSpace = this.colorSpace
    newState.color = this.color
    newState.font = this.font
    newState.lineJoin = this.lineWidth
    newState.lineCap = this.lineCap
    newState.lineJoin = this.lineJoin
    newState.miterLimit = this.miterLimit
    newState.dashPattern = [...this.dashPattern]
    newState.strokeAdjustment = this.strokeAdjustment
    return newState
  }
}

function getDefaultCanvasTransformationMatrix(
  canvasHeight: number
): TransformationMatrix {
  // This represents a 3x3 matrix:
  //  1  0  0
  //  0 -1  0
  //  0 -h  1
  return [1, 0, 0, -1, 0, canvasHeight]
}
