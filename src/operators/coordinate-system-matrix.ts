import { PSArray } from '../array'
import {
  IDENTITY_MATRIX,
  invertTransformationMatrix,
  matrixFromPSArray,
  matrixMultiply,
  rotationMatrix,
  scalingMatrix,
  TransformationMatrix,
  transformCoordinate,
  translationMatrix,
} from '../coordinate'
import { RangeCheckError } from '../error'
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
  const [matrix] = interpreter.operandStack.pop(ObjectType.Array)
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

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=583
export function defaultMatrix(interpreter: PSInterpreter) {
  const [matrix] = interpreter.operandStack.pop(ObjectType.Array)
  if (matrix.value.length !== 6) {
    throw new Error(
      `defaultDeviceMatrix: Invalid matrix length ${matrix.value.length}`
    )
  }
  const defaultDeviceMatrix =
    interpreter.printer.getDefaultTransformationMatrix()

  for (let i = 0; i < defaultDeviceMatrix.length; ++i) {
    matrix.value.set(i, createLiteral(defaultDeviceMatrix[i], ObjectType.Real))
  }
  interpreter.operandStack.push(matrix)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=689
export function setMatrix(interpreter: PSInterpreter) {
  const [matrix] = interpreter.operandStack.pop(ObjectType.Array)

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
  const [offsetYOrMatrix, offsetXOrY] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array,
    ObjectType.Real | ObjectType.Integer
  )
  let offsetX: PSObject<ObjectType.Real | ObjectType.Integer>
  let offsetY: PSObject<ObjectType.Real | ObjectType.Integer>
  const modifyCTM = offsetYOrMatrix.type !== ObjectType.Array
  if (!modifyCTM) {
    offsetY = offsetXOrY
    try {
      ;[offsetX] = interpreter.operandStack.pop(
        ObjectType.Integer,
        ObjectType.Real
      )
    } catch (e) {
      // Restore aleady popped elements
      interpreter.operandStack.push(offsetXOrY, offsetYOrMatrix)
      throw e
    }
  } else {
    offsetX = offsetXOrY
    offsetY = offsetYOrMatrix
  }
  const translation = translationMatrix(offsetX.value, offsetY.value)
  if (modifyCTM) {
    interpreter.printer.concat(translation)
  } else {
    ;(offsetYOrMatrix as PSObject<ObjectType.Array>).value = new PSArray(
      translation.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(offsetYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=668
export function scale(interpreter: PSInterpreter) {
  const [scaleYOrMatrix, scaleXOrY] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array,
    ObjectType.Real | ObjectType.Integer
  )
  let scaleX: PSObject<ObjectType.Real | ObjectType.Integer>
  let scaleY: PSObject<ObjectType.Real | ObjectType.Integer>
  const modifyCTM = scaleYOrMatrix.type !== ObjectType.Array
  if (!modifyCTM) {
    scaleY = scaleXOrY
    try {
      ;[scaleX] = interpreter.operandStack.pop(
        ObjectType.Real,
        ObjectType.Integer
      )
    } catch (e) {
      // Restore the already popped elements
      interpreter.operandStack.push(scaleXOrY, scaleYOrMatrix)
      throw e
    }
  } else {
    scaleX = scaleXOrY
    scaleY = scaleYOrMatrix
  }
  const scale = scalingMatrix(scaleX.value, scaleY.value)
  if (modifyCTM) {
    interpreter.printer.concat(scale)
  } else {
    ;(scaleYOrMatrix as PSObject<ObjectType.Array>).value = new PSArray(
      scale.map((number) => createLiteral(number, ObjectType.Real))
    )
    interpreter.operandStack.push(scaleYOrMatrix)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=665
export function rotate(interpreter: PSInterpreter) {
  const [arg] = interpreter.operandStack.pop(
    ObjectType.Array | ObjectType.Real | ObjectType.Integer
  )
  if (!arg) {
    throw new Error('rotate: Missing argument')
  }
  if (arg.type === ObjectType.Array) {
    const matrixArray = arg as PSObject<ObjectType.Array>
    // There must be a angle argument as well
    const [angle] = interpreter.operandStack.pop(
      ObjectType.Integer | ObjectType.Real
    )
    const matrix = matrixFromPSArray(matrixArray)
    const rotation = rotationMatrix(
      (angle as PSObject<ObjectType.Integer | ObjectType.Real>).value
    )
    const res = matrixMultiply(rotation, matrix)
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

export function invertMatrix(interpreter: PSInterpreter) {
  const [targetArray, sourceArray] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Array
  )
  if (targetArray.value.length !== 6) {
    interpreter.operandStack.push(sourceArray, targetArray)
    throw new RangeCheckError()
  }
  const sourceMatrix = matrixFromPSArray(sourceArray)
  const inverted = invertTransformationMatrix(sourceMatrix)
  for (let i = 0; i < 6; i++) {
    targetArray.value.set(i, createLiteral(inverted[i], ObjectType.Real))
  }
  interpreter.operandStack.push(targetArray)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=717
export function transform(interpreter: PSInterpreter) {
  let x: number
  let y: number
  let matrix: TransformationMatrix
  const [matrixOrNumber] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  if (matrixOrNumber.type === ObjectType.Array) {
    matrix = matrixFromPSArray(matrixOrNumber)
    try {
      const [yObj, xObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer,
        ObjectType.Real | ObjectType.Integer
      )
      y = yObj.value
      x = xObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  } else {
    matrix = interpreter.printer.getTransformationMatrix()
    y = matrixOrNumber.value
    try {
      const [xObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer
      )
      x = xObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  }
  const { x: xPrime, y: yPrime } = transformCoordinate({ x, y }, matrix)
  interpreter.pushLiteralNumber(xPrime)
  interpreter.pushLiteralNumber(yPrime)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function itransform(interpreter: PSInterpreter) {
  let xPrime: number
  let yPrime: number
  let matrix: TransformationMatrix
  const [matrixOrNumber] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  if (matrixOrNumber.type === ObjectType.Array) {
    matrix = matrixFromPSArray(matrixOrNumber)
    try {
      const [yPrimeObj, xPrimeObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer,
        ObjectType.Real | ObjectType.Integer
      )
      yPrime = yPrimeObj.value
      xPrime = xPrimeObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  } else {
    matrix = interpreter.printer.getTransformationMatrix()
    yPrime = matrixOrNumber.value
    try {
      const [xPrimeObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer
      )
      xPrime = xPrimeObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  }
  const inverseTransform = invertTransformationMatrix(matrix)
  const { x, y } = transformCoordinate(
    { x: xPrime, y: yPrime },
    inverseTransform
  )
  interpreter.pushLiteralNumber(x)
  interpreter.pushLiteralNumber(y)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=588
export function dtransform(interpreter: PSInterpreter) {
  let x: number
  let y: number
  let matrix: TransformationMatrix
  const [matrixOrNumber] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  if (matrixOrNumber.type === ObjectType.Array) {
    matrix = matrixFromPSArray(matrixOrNumber)
    try {
      const [yObj, xObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer,
        ObjectType.Real | ObjectType.Integer
      )
      y = yObj.value
      x = xObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  } else {
    matrix = interpreter.printer.getTransformationMatrix()
    y = matrixOrNumber.value
    try {
      const [xObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer
      )
      x = xObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  }
  matrix = [matrix[0], matrix[1], matrix[2], matrix[3], 0, 0]
  const { x: xPrime, y: yPrime } = transformCoordinate({ x, y }, matrix)
  interpreter.pushLiteralNumber(xPrime)
  interpreter.pushLiteralNumber(yPrime)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=620
export function idtransform(interpreter: PSInterpreter) {
  let xPrime: number
  let yPrime: number
  let matrix: TransformationMatrix
  const [matrixOrNumber] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  if (matrixOrNumber.type === ObjectType.Array) {
    matrix = matrixFromPSArray(matrixOrNumber)
    try {
      const [yPrimeObj, xPrimeObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer,
        ObjectType.Real | ObjectType.Integer
      )
      yPrime = yPrimeObj.value
      xPrime = xPrimeObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  } else {
    matrix = interpreter.printer.getTransformationMatrix()
    yPrime = matrixOrNumber.value
    try {
      const [xPrimeObj] = interpreter.operandStack.pop(
        ObjectType.Real | ObjectType.Integer
      )
      xPrime = xPrimeObj.value
    } catch (e) {
      interpreter.operandStack.push(matrixOrNumber)
      throw e
    }
  }
  let inverseTransform = invertTransformationMatrix(matrix)
  inverseTransform = [
    inverseTransform[0],
    inverseTransform[1],
    inverseTransform[2],
    inverseTransform[3],
    0,
    0,
  ]
  const { x, y } = transformCoordinate(
    { x: xPrime, y: yPrime },
    inverseTransform
  )
  interpreter.pushLiteralNumber(x)
  interpreter.pushLiteralNumber(y)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=619
export function identMatrix(interpreter: PSInterpreter) {
  const [matrixObj] = interpreter.operandStack.pop(ObjectType.Array)
  if (matrixObj.value.length !== 6) {
    interpreter.operandStack.push(matrixObj)
    throw new RangeCheckError()
  }
  const matrix = matrixFromPSArray(matrixObj)
  for (let i = 0; i < matrix.length; ++i) {
    matrixObj.value.set(
      i,
      createLiteral(IDENTITY_MATRIX[i], ObjectType.Integer)
    )
  }
  interpreter.operandStack.push(matrixObj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=561
export function concatMatrix(interpreter: PSInterpreter) {
  const [matrix3Obj, matrix2Obj, matrix1Obj] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Array,
    ObjectType.Array
  )
  if (matrix3Obj.value.length !== 6) {
    throw new RangeCheckError()
  }
  const matrix2 = matrixFromPSArray(matrix2Obj)
  const matrix1 = matrixFromPSArray(matrix1Obj)
  const matrixResult = matrixMultiply(matrix1, matrix2)
  for (let i = 0; i < matrixResult.length; ++i) {
    matrix3Obj.value.set(i, createLiteral(matrixResult[i], ObjectType.Real))
  }
  interpreter.operandStack.push(matrix3Obj)
}
