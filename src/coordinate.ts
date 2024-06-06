import { ObjectType, PostScriptObject } from './scanner'

export type Coordinate = {
  x: number
  y: number
}

/**
 * Represents a 3x3 matrix
 * [a  b  0
 * c  d  0
 * tx ty  1]
 * as [a, b, c, d, tx, ty]
 */
export type TransformationMatrix = [
  number,
  number,
  number,
  number,
  number,
  number
]

/**
 * Multiplies to 3x3 matrices each represented by an array with length 6
 * (Transformation matrices)
 */
export function matrixMultiply(
  a: TransformationMatrix,
  b: TransformationMatrix
): TransformationMatrix {
  //Row 1
  // C11 = (A11 * B11) + (A12 * B21) + (A13 * B31)
  const c11 = a[0] * b[0] + a[1] * b[2]
  // C12 = (A11 * B12) + (A12 * B22) + (A13 * B32)
  const c12 = a[0] * b[1] + a[1] * b[3]

  //Row 2
  // C21 = (A21 * B11) + (A22 * B21) + (A23 * B31)
  const c21 = a[2] * b[0] + a[3] * b[2]
  // C22 = (A21 * B12) + (A22 * B22) + (A23 * B32)
  const c22 = a[2] * b[1] + a[3] * b[3]

  // Row 3
  // C31 = (A31 * B11) + (A32 * B21) + (A33 * B31)
  const c31 = a[4] * b[0] + a[5] * b[2] + b[4]
  // C32 = (A31 * B12) + (A32 * B22) + (A33 * B32)
  const c32 = a[4] * b[1] + a[5] * b[3] + b[5]

  return [c11, c12, c21, c22, c31, c32]
}

export function transformCoordinate(
  coord: Coordinate,
  matrix: TransformationMatrix
): Coordinate {
  const [a, b, c, d, tx, ty] = matrix
  return {
    x: a * coord.x + c * coord.y + tx,
    y: b * coord.x + d * coord.y + ty,
  }
}

export function offsetCoordinate(c1: Coordinate, c2: Coordinate): Coordinate {
  return {
    x: c1.x + c2.x,
    y: c1.y + c2.y,
  }
}

export function matrixFromPostScriptArray(
  array: PostScriptObject<ObjectType.Array>
): TransformationMatrix {
  if (array.value.length !== 6) {
    throw new Error(
      `Expected matrix with length 6, but has ${array.value.length}`
    )
  }
  if (
    array.value.items.some(
      (val) => (val.type & (ObjectType.Integer | ObjectType.Real)) === 0
    )
  ) {
    throw new Error('None-number array value')
  }

  return [
    array.value.get(0)!.value as number,
    array.value.get(1)!.value as number,
    array.value.get(2)!.value as number,
    array.value.get(3)!.value as number,
    array.value.get(4)!.value as number,
    array.value.get(5)!.value as number,
  ]
}

export function translationMatrix(offsetX: number, offsetY: number) {
  return [1, 0, 0, 1, offsetX, offsetY] as TransformationMatrix
}

export function scalingMatrix(scaleX: number, scaleY: number) {
  return [scaleX, 0, 0, scaleY, 0, 0] as TransformationMatrix
}

export const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0] as TransformationMatrix

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

export function rotationMatrix(angle_degrees: number): TransformationMatrix {
  return [
    Math.cos(degreesToRadians(angle_degrees)),
    Math.sin(degreesToRadians(angle_degrees)),
    -Math.sin(degreesToRadians(angle_degrees)),
    Math.cos(degreesToRadians(angle_degrees)),
    0,
    0,
  ]
}
