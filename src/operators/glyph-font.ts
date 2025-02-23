import { PostScriptArray } from '../array'
import {
  matrixFromPostScriptArray,
  matrixMultiply,
  scalingMatrix,
  TransformationMatrix,
} from '../coordinate'
import { PostScriptDictionary } from '../dictionary/dictionary'
import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=606
export function findFont(interpreter: PostScriptInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const font = interpreter.findFont(key)
  interpreter.pushLiteral(font, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=684
export function setFont(interpreter: PostScriptInterpreter) {
  const { value: font } = interpreter.pop(ObjectType.Dictionary)
  if (!font.isFontDictionary()) {
    throw new Error('setFont: Not a font dictionary')
  }
  interpreter.printer.setFont(font)
}

function _scaleFontMatrix(
  font: PostScriptDictionary,
  matrix: TransformationMatrix
) {
  if (!font.isFontDictionary()) {
    throw new Error('Not a font dictionary')
  }
  const fontMatrix = (
    font.searchByName('FontMatrix')!.value as PostScriptArray
  ).map((x) => x.value as number) as TransformationMatrix
  const newMatrix = matrixMultiply(matrix, fontMatrix)
  font.set(
    createLiteral('FontMatrix', ObjectType.Name),
    createLiteral(
      new PostScriptArray(newMatrix.map(createLiteral)),
      ObjectType.Array
    )
  )
}

function _scaleFont(font: PostScriptDictionary, scale: number) {
  if (!font.isFontDictionary()) {
    throw new Error('scalefont: Not a font dictionary')
  }
  const copy = font.copy()
  _scaleFontMatrix(copy, scalingMatrix(scale, scale))
  return copy
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=668
export function scaleFont(interpreter: PostScriptInterpreter) {
  const { value: scale } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: font } = interpreter.pop(ObjectType.Dictionary)
  const copy = _scaleFont(font, scale)
  interpreter.pushLiteral(copy, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=583
export function defineFont(interpreter: PostScriptInterpreter) {
  const font = interpreter.pop(ObjectType.Dictionary)
  const key = interpreter.pop(ObjectType.Any)
  if (!font.value.isFontDictionary()) {
    throw new Error('definefont: Not a font dictionary')
  }
  interpreter.fonts.set(key, font)
  interpreter.operandStack.push(font)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=670
export function selectFont(interpreter: PostScriptInterpreter) {
  const scaleOrMatrix = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.Array
  )
  const key = interpreter.pop(ObjectType.Any)
  const font = interpreter.findFont(key).copy()
  if (scaleOrMatrix.type === ObjectType.Array) {
    _scaleFontMatrix(font, matrixFromPostScriptArray(scaleOrMatrix))
    interpreter.printer.setFont(font)
  } else {
    const scale = scaleOrMatrix.value as number
    const scaledFont = _scaleFont(font, scale)
    interpreter.printer.setFont(scaledFont)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=638
export function makeFont(interpreter: PostScriptInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  const font = interpreter.pop(ObjectType.Dictionary)
  if (!font.value.isFontDictionary()) {
    throw new Error('makefont: Not a font dictionary')
  }
  const copy = font.value.copy()
  _scaleFontMatrix(copy, matrixFromPostScriptArray(matrix))
  interpreter.operandStack.push(createLiteral(copy, ObjectType.Dictionary))
}
