import { matrixMultiply, TransformationMatrix } from '../src/coordinate'

describe('matrixes', function () {
  it('can multiple matrices', function () {
    const a: TransformationMatrix = [2, 3 /* 0 */, 4, 5 /* 0 */, 6, 7 /* 1 */]
    const b: TransformationMatrix = [
      8, 9, /* 0 */ 10, 11, /* 0 */ 12, 13 /* 1 */,
    ]
    const expected = [46, 51, /* 0 */ 82, 91, /* 0 */ 130, 144 /* 1 */]
    expect(matrixMultiply(a, b)).toEqual(expected)
  })
})
