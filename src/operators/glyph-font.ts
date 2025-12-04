import { PSArray } from '../array'
import {
  matrixFromPSArray,
  matrixMultiply,
  scalingMatrix,
  TransformationMatrix,
} from '../coordinate'
import { PSDictionary } from '../dictionary/dictionary'
import { Font } from '../fonts/font'
import { PSInterpreter } from '../interpreter'
import { StringKShowLoopContext } from '../loop-context'
import { Executability, ObjectType, PSObject } from '../scanner'
import { PSString } from '../string'
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
export async function defineFont(interpreter: PSInterpreter) {
  const fontDict = interpreter.pop(ObjectType.Dictionary)
  const key = interpreter.pop(ObjectType.Any)
  if (!fontDict.value.isFontDictionary()) {
    throw new Error('definefont: Not a font dictionary')
  }
  // const name = fontDict.value.searchByName('FontName')!
  const data = fontDict.value.searchByName('sfnts')!.value as PSArray
  let totalLength = 0
  for (const str of data.items) {
    if (str.type !== ObjectType.String) {
      throw new Error('Invalid data type, expected string got ' + str.type)
    }
    totalLength += (str as PSObject<ObjectType.String>).value.length
  }
  const binaryData = new Uint8Array(totalLength)
  let cursor = 0
  for (const str of data.items) {
    const buffer = (str.value as PSString).asBuffer()
    for (let i = 0; i <= buffer.length; ++i) {
      binaryData[cursor++] = buffer[i]!
    }
  }
  const view = new DataView(binaryData.buffer, 0)
  const font = Font.parse(view)

  const fid = interpreter.parsedFonts.defineFont(font)
  fontDict.value.set(createLiteral('FID', ObjectType.Name), fid)

  interpreter.fonts.set(key, fontDict)
  interpreter.operandStack.push(fontDict)
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
  const currentPoint = interpreter.printer.getCurrentPoint()
  const content = string.asString()
  interpreter.printer.fillText(content, currentPoint)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function ashow(interpreter: PSInterpreter) {
  const { value: dy } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: dx } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: string } = interpreter.pop(ObjectType.String)
  const characters = string.asString().split('')
  for (const char of characters) {
    const currentPoint = interpreter.printer.getCurrentPoint()
    interpreter.printer.fillText(char, currentPoint)
    const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
    interpreter.printer.moveTo({
      x: updatedGraphicsPoint.x + dx,
      y: updatedGraphicsPoint.y + dy,
    })
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function kshow(interpreter: PSInterpreter) {
  const string = interpreter.pop(ObjectType.String)
  const procedure = interpreter.pop(ObjectType.Array)

  if (procedure.attributes.executability !== Executability.Executable) {
    throw new Error('Second argument to if is not a procedure')
  }

  interpreter.beginLoop(
    new StringKShowLoopContext(
      interpreter,
      procedure,
      interpreter.printer,
      string
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function widthshow(interpreter: PSInterpreter) {
  const string = interpreter.pop(ObjectType.String).value
  const { value: char } = interpreter.pop(ObjectType.Integer)
  const { value: cy } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: cx } = interpreter.pop(ObjectType.Integer | ObjectType.Real)

  const characters = string.asString().split('')
  for (const currentChar of characters) {
    const currentPoint = interpreter.printer.getCurrentPoint()
    interpreter.printer.fillText(currentChar, currentPoint)
    if (currentChar.charCodeAt(0) === char) {
      const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
      interpreter.printer.moveTo({
        x: updatedGraphicsPoint.x + cx,
        y: updatedGraphicsPoint.y + cy,
      })
    }
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=550
export function awidthshow(interpreter: PSInterpreter) {
  const string = interpreter.pop(ObjectType.String).value
  const { value: ay } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: ax } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: char } = interpreter.pop(ObjectType.Integer)
  const { value: cy } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: cx } = interpreter.pop(ObjectType.Integer | ObjectType.Real)

  const characters = string.asString().split('')
  for (const currentChar of characters) {
    const currentPoint = interpreter.printer.getCurrentPoint()
    interpreter.printer.fillText(currentChar, currentPoint)
    const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
    interpreter.printer.moveTo({
      x: updatedGraphicsPoint.x + ax,
      y: updatedGraphicsPoint.y + ay,
    })
    if (currentChar.charCodeAt(0) === char) {
      const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
      interpreter.printer.moveTo({
        x: updatedGraphicsPoint.x + cx,
        y: updatedGraphicsPoint.y + cy,
      })
    }
  }
}
