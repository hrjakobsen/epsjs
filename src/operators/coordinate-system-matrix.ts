import { PSArray } from '../array'
import {
  matrixFromPSArray,
  matrixMultiply,
  rotationMatrix,
  scalingMatrix,
  TransformationMatrix,
  translationMatrix,
} from '../coordinate'
import { PSInterpreter } from '../interpreter'
import { ObjectType, PSObject } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=640
export function matrix(interpreter: PSInterpreter) {
  interpreter.pushLiteral(
    new PSArray(
      [1, 0, 0, 1, 0, 0].map((x) => createLiteral(x, ObjectType.Real))
    ),
    ObjectType.Array
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentMatrix(interpreter: PSInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  if (matrix.value.length !== 6) {
    throw new Error(
      `currentmatrix: Invalid matrix length ${matrix.value.length}`
    )
  }
  matrix.value = new PSArray(
    interpreter.printer
      .getTransformationMatrix()
      .map((x) => createLiteral(x, ObjectType.Real))
  )
  interpreter.operandStack.push(matrix)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=689
export function setMatrix(interpreter: PSInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)

  if (matrix.value.length !== 6) {
    throw new Error(
      `currentmatrix: Invalid matrix length ${matrix.value.length}`
    )
  }

  interpreter.printer.setTransformationMatrix(
    matrix.value.items.map((x) => x.value as number) as TransformationMatrix
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=718
export function translate(interpreter: PSInterpreter) {
  const offsetYOrMatrix = interpreter.pop<
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  >(ObjectType.Real | ObjectType.Integer | ObjectType.Array)
  const offsetXOrY = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  let offsetX: PSObject<ObjectType.Real | ObjectType.Integer>
  let offsetY: PSObject<ObjectType.Real | ObjectType.Integer>
  const modifyCTM = offsetYOrMatrix.type !== ObjectType.Array
  if (!modifyCTM) {
    offsetY = offsetXOrY
    const topOfStack = interpreter.operandStack.pop()
    if (
      topOfStack?.type !== ObjectType.Real &&
      topOfStack?.type !== ObjectType.Integer
    ) {
      throw new Error('translate: Invalid x offset')
    }
    offsetX = topOfStack
  } else {
    offsetX = offsetXOrY
    offsetY = offsetYOrMatrix
  }
  const translation = translationMatrix(offsetX.value, offsetY.value)
  if (modifyCTM) {
    interpreter.printer.concat(translation)
  } else {
    offsetYOrMatrix.value = new PSArray(
      translation.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(offsetYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=668
export function scale(interpreter: PSInterpreter) {
  const scaleYOrMatrix = interpreter.pop<
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  >(ObjectType.Real | ObjectType.Integer | ObjectType.Array)
  const scaleXOrY = interpreter.pop<ObjectType.Real | ObjectType.Integer>(
    ObjectType.Real | ObjectType.Integer
  )
  let scaleX: PSObject<ObjectType.Real | ObjectType.Integer>
  let scaleY: PSObject<ObjectType.Real | ObjectType.Integer>
  const modifyCTM = scaleYOrMatrix.type !== ObjectType.Array
  if (!modifyCTM) {
    scaleY = scaleXOrY
    const topOfStack = interpreter.operandStack.pop()
    if (
      topOfStack?.type !== ObjectType.Real &&
      topOfStack?.type !== ObjectType.Integer
    ) {
      throw new Error('scale: Invalid x scale')
    }
    scaleX = topOfStack
  } else {
    scaleX = scaleXOrY
    scaleY = scaleYOrMatrix
  }
  const scale = scalingMatrix(scaleX.value, scaleY.value)
  if (modifyCTM) {
    interpreter.printer.concat(scale)
  } else {
    scaleYOrMatrix.value = new PSArray(
      scale.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(scaleYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=665
export function rotate(interpreter: PSInterpreter) {
  const arg = interpreter.operandStack.pop()
  if (!arg) {
    throw new Error('rotate: Missing argument')
  }
  if (arg.type === ObjectType.Array) {
    const matrixArray = arg as PSObject<ObjectType.Array>
    // There must be a angle argument as well
    const angle = interpreter.operandStack.pop()
    if (!angle) {
      throw new Error('rotate: Missing angle argument')
    }
    if (angle.type !== ObjectType.Real && angle.type !== ObjectType.Integer) {
      throw new Error('rotate: Invalid angle type. Must be a number')
    }
    const matrix = matrixFromPSArray(matrixArray)
    const rotation = rotationMatrix(
      (angle as PSObject<ObjectType.Integer | ObjectType.Real>).value
    )
    const res = matrixMultiply(matrix, rotation)
    matrixArray.value = new PSArray(
      res.map((x) => createLiteral(x, ObjectType.Real))
    )
    interpreter.operandStack.push(matrixArray)
  } else if (arg.type === ObjectType.Real || arg.type === ObjectType.Integer) {
    const rotation = rotationMatrix(
      (arg as PSObject<ObjectType.Integer | ObjectType.Real>).value
    )
    interpreter.printer.concat(rotation)
  }
}
