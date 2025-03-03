import { PSArray } from '../array'
import {
  matrixFromPSArray,
  matrixMultiply,
  scalingMatrix,
  TransformationMatrix,
} from '../coordinate'
import { PSDictionary } from '../dictionary/dictionary'
import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=606
export function findFont(interpreter: PSInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const font = interpreter.findFont(key)
  interpreter.pushLiteral(font, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=684
export function setFont(interpreter: PSInterpreter) {
  const { value: font } = interpreter.pop(ObjectType.Dictionary)
  if (!font.isFontDictionary()) {
    throw new Error('setFont: Not a font dictionary')
  }
  interpreter.printer.setFont(font)
}

function _scaleFontMatrix(font: PSDictionary, matrix: TransformationMatrix) {
  if (!font.isFontDictionary()) {
    throw new Error('Not a font dictionary')
  }
  const fontMatrix = (font.searchByName('FontMatrix')!.value as PSArray).map(
    (x) => x.value as number
  ) as TransformationMatrix
  const newMatrix = matrixMultiply(matrix, fontMatrix)
  font.set(
    createLiteral('FontMatrix', ObjectType.Name),
    createLiteral(new PSArray(newMatrix.map(createLiteral)), ObjectType.Array)
  )
}

function _scaleFont(font: PSDictionary, scale: number) {
  if (!font.isFontDictionary()) {
    throw new Error('scalefont: Not a font dictionary')
  }
  const copy = font.copy()
  _scaleFontMatrix(copy, scalingMatrix(scale, scale))
  return copy
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=668
export function scaleFont(interpreter: PSInterpreter) {
  const { value: scale } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: font } = interpreter.pop(ObjectType.Dictionary)
  const copy = _scaleFont(font, scale)
  interpreter.pushLiteral(copy, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=583
export function defineFont(interpreter: PSInterpreter) {
  const font = interpreter.pop(ObjectType.Dictionary)
  const key = interpreter.pop(ObjectType.Any)
  if (!font.value.isFontDictionary()) {
    throw new Error('definefont: Not a font dictionary')
  }
  interpreter.fonts.set(key, font)
  interpreter.operandStack.push(font)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=670
export function selectFont(interpreter: PSInterpreter) {
  const scaleOrMatrix = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.Array
  )
  const key = interpreter.pop(ObjectType.Any)
  const font = interpreter.findFont(key).copy()
  if (scaleOrMatrix.type === ObjectType.Array) {
    _scaleFontMatrix(font, matrixFromPSArray(scaleOrMatrix))
    interpreter.printer.setFont(font)
  } else {
    const scale = scaleOrMatrix.value as number
    const scaledFont = _scaleFont(font, scale)
    interpreter.printer.setFont(scaledFont)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=638
export function makeFont(interpreter: PSInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  const font = interpreter.pop(ObjectType.Dictionary)
  if (!font.value.isFontDictionary()) {
    throw new Error('makefont: Not a font dictionary')
  }
  const copy = font.value.copy()
  _scaleFontMatrix(copy, matrixFromPSArray(matrix))
  interpreter.operandStack.push(createLiteral(copy, ObjectType.Dictionary))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=713
export function stringWidth(interpreter: PSInterpreter) {
  const text = interpreter.pop(ObjectType.String)
  const size = interpreter.printer.stringWidth(text.value.asString())
  interpreter.pushLiteral(size.width, ObjectType.Real)
  interpreter.pushLiteral(size.height, ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=704
export function show(interpreter: PSInterpreter) {
  const { value: string } = interpreter.pop(ObjectType.String)
  interpreter.printer.fillText(
    string.asString(),
    interpreter.printer.getCurrentPoint()
  )
}

export function ashow(interpreter: PSInterpreter) {
  const { value: dy } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: dx } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: string } = interpreter.pop(ObjectType.String)
  const characters = string.asString().split('')
  const currentPoint = interpreter.printer.getCurrentPoint()
  let x = currentPoint.x
  let y = currentPoint.y
  for (const char of characters) {
    interpreter.printer.fillText(char, { x, y })
    x += interpreter.printer.stringWidth(char).width + dx
    y += dy
  }
}
