import { PostScriptArray } from '../array'
import {
  matrixFromPostScriptArray,
  matrixMultiply,
  rotationMatrix,
  scalingMatrix,
  TransformationMatrix,
  translationMatrix,
} from '../coordinate'
import { PostScriptInterpreter } from '../interpreter'
import { ObjectType, PostScriptObject } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=640
export function matrix(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(
    new PostScriptArray(
      [1, 0, 0, 1, 0, 0].map((x) => createLiteral(x, ObjectType.Real))
    ),
    ObjectType.Array
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentMatrix(interpreter: PostScriptInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  if (matrix.value.length !== 6) {
    throw new Error(
      `currentmatrix: Invalid matrix length ${matrix.value.length}`
    )
  }
  matrix.value = new PostScriptArray(
    interpreter.printer
      .getTransformationMatrix()
      .map((x) => createLiteral(x, ObjectType.Real))
  )
  interpreter.operandStack.push(matrix)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=689
export function setMatrix(interpreter: PostScriptInterpreter) {
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
export function translate(interpreter: PostScriptInterpreter) {
  const offsetYOrMatrix = interpreter.pop<
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  >(ObjectType.Real | ObjectType.Integer | ObjectType.Array)
  const offsetXOrY = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  let offsetX: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  let offsetY: PostScriptObject<ObjectType.Real | ObjectType.Integer>
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
    offsetYOrMatrix.value = new PostScriptArray(
      translation.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(offsetYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=668
export function scale(interpreter: PostScriptInterpreter) {
  const scaleYOrMatrix = interpreter.pop<
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  >(ObjectType.Real | ObjectType.Integer | ObjectType.Array)
  const scaleXOrY = interpreter.pop<ObjectType.Real | ObjectType.Integer>(
    ObjectType.Real | ObjectType.Integer
  )
  let scaleX: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  let scaleY: PostScriptObject<ObjectType.Real | ObjectType.Integer>
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
    scaleYOrMatrix.value = new PostScriptArray(
      scale.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(scaleYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=665
export function rotate(interpreter: PostScriptInterpreter) {
  const arg = interpreter.operandStack.pop()
  if (!arg) {
    throw new Error('rotate: Missing argument')
  }
  if (arg.type === ObjectType.Array) {
    const matrixArray = arg as PostScriptObject<ObjectType.Array>
    // There must be a angle argument as well
    const angle = interpreter.operandStack.pop()
    if (!angle) {
      throw new Error('rotate: Missing angle argument')
    }
    if (angle.type !== ObjectType.Real && angle.type !== ObjectType.Integer) {
      throw new Error('rotate: Invalid angle type. Must be a number')
    }
    const matrix = matrixFromPostScriptArray(matrixArray)
    const rotation = rotationMatrix(
      (angle as PostScriptObject<ObjectType.Integer | ObjectType.Real>).value
    )
    const res = matrixMultiply(matrix, rotation)
    matrixArray.value = new PostScriptArray(
      res.map((x) => createLiteral(x, ObjectType.Real))
    )
    interpreter.operandStack.push(matrixArray)
  } else if (arg.type === ObjectType.Real || arg.type === ObjectType.Integer) {
    const rotation = rotationMatrix(
      (arg as PostScriptObject<ObjectType.Integer | ObjectType.Real>).value
    )
    interpreter.printer.concat(rotation)
  }
}
