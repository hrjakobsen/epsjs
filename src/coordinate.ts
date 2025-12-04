import { ObjectType, PSObject } from './scanner'

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

type Matrix3x3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
]

type Matrix2x2 = [number, number, number, number]

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

function transformationTo3x3(transform: TransformationMatrix): Matrix3x3 {
  return [
    transform[0],
    transform[1],
    0,
    transform[2],
    transform[3],
    0,
    transform[4],
    transform[5],
    1,
  ]
}

function transpose3x3(matrix: Matrix3x3): Matrix3x3 {
  const [a, b, c, d, e, f, g, h, i] = matrix
  return [a, d, g, b, e, h, c, f, i]
}

function matrix3x3ToTransformation(matrix: Matrix3x3): TransformationMatrix {
  if (matrix[2] !== 0 || matrix[5] !== 0 || matrix[8] !== 1) {
    throw new Error('Invalid transformation matrix')
  }
  return [matrix[0], matrix[1], matrix[3], matrix[4], matrix[6], matrix[7]]
}

function determinant3x3(matrix: Matrix3x3): number {
  // a b c
  // d e f
  // g h i
  const [a, b, c, d, e, f, g, h, i] = transpose3x3(matrix)

  // removing row 1 col1
  const r1c1_2x2: Matrix2x2 = [e, f, h, i]
  const r1c1_det = determinant2x2(r1c1_2x2)
  const r1c1_r = a * r1c1_det * 1

  // removing row 1 col2
  const r1c2_2x2: Matrix2x2 = [d, f, g, i]
  const r1c2_det = determinant2x2(r1c2_2x2)
  const r1c2_r = b * r1c2_det * -1

  // removing row 1 col3
  const r1c3_2x2: Matrix2x2 = [d, e, g, h]
  const r1c3_det = determinant2x2(r1c3_2x2)
  const r1c3_r = c * r1c3_det * 1

  return r1c1_r + r1c2_r + r1c3_r
}

function determinant2x2(matrix: Matrix2x2): number {
  const [a, b, c, d] = matrix
  return a * d - b * c
}

function scale3x3Matrix(matrix: Matrix3x3, scalar: number): Matrix3x3 {
  const [a, b, c, d, e, f, g, h, i] = matrix
  return [
    a * scalar,
    b * scalar,
    c * scalar,
    d * scalar,
    e * scalar,
    f * scalar,
    g * scalar,
    h * scalar,
    i * scalar,
  ]
}

export function invertTransformationMatrix(
  transform: TransformationMatrix
): TransformationMatrix {
  const matrix = transformationTo3x3(transform)
  const determinant = determinant3x3(matrix)
  if (determinant === 0) {
    throw new Error('Matrix is not invertible')
  }

  // find determinant of 2x2 submatrices
  // a b c
  // d e f
  // g h i
  const [a, b, c, d, e, f, g, h, i] = matrix
  const a_det = determinant2x2([e, f, h, i])
  const b_det = determinant2x2([d, f, g, i])
  const c_det = determinant2x2([d, e, g, h])
  const d_det = determinant2x2([b, c, h, i])
  const e_det = determinant2x2([a, c, g, i])
  const f_det = determinant2x2([a, b, g, h])
  const g_det = determinant2x2([b, c, e, f])
  const h_det = determinant2x2([a, c, d, f])
  const i_det = determinant2x2([a, b, d, e])

  const adjugate: Matrix3x3 = [
    a_det,
    -b_det,
    c_det,
    -d_det,
    e_det,
    -f_det,
    g_det,
    -h_det,
    i_det,
  ]

  const inverse = scale3x3Matrix(adjugate, 1 / determinant)
  return matrix3x3ToTransformation(inverse)
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

export function matrixFromPSArray(
  array: PSObject<ObjectType.Array>
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

export function midpoint(c1: Coordinate, c2: Coordinate): Coordinate {
  return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 }
}
