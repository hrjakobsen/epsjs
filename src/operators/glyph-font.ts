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
import { StringKShowLoopContext } from '../execution-contexts/loop-context'
import { Executability, ObjectType, PSObject } from '../scanner'
import { PSString } from '../string'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=606
export function findFont(interpreter: PSInterpreter) {
  const [key] = interpreter.operandStack.pop(ObjectType.Any)
  const font = interpreter.findFont(key)
  interpreter.pushLiteral(font, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=684
export function setFont(interpreter: PSInterpreter) {
  const [fontDict] = interpreter.operandStack.pop(ObjectType.Dictionary)
  const font = fontDict.value
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
  interpreter.operandStack.withPopped(
    [ObjectType.Real | ObjectType.Integer, ObjectType.Dictionary],
    ([scale, font]) => {
      const copy = _scaleFont(font.value, scale.value)
      interpreter.pushLiteral(copy, ObjectType.Dictionary)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=583
export async function defineFont(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Dictionary, ObjectType.Any],
    ([fontDict, key]) => {
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
          binaryData[cursor++] = buffer[i]
        }
      }
      const view = new DataView(binaryData.buffer, 0)
      const font = Font.parse(view)

      const fid = interpreter.parsedFonts.defineFont(font)
      fontDict.value.set(createLiteral('FID', ObjectType.Name), fid)

      interpreter.fonts.set(key, fontDict)
      interpreter.operandStack.push(fontDict)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=670
export function selectFont(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Integer | ObjectType.Real | ObjectType.Array, ObjectType.Any],
    ([scaleOrMatrix, key]) => {
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
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=638
export function makeFont(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Array, ObjectType.Dictionary],
    ([matrix, font]) => {
      if (!font.value.isFontDictionary()) {
        throw new Error('makefont: Not a font dictionary')
      }
      const copy = font.value.copy()
      _scaleFontMatrix(copy, matrixFromPSArray(matrix))
      interpreter.operandStack.push(createLiteral(copy, ObjectType.Dictionary))
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=713
export function stringWidth(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped([ObjectType.String], ([text]) => {
    const size = interpreter.printer.stringWidth(text.value.asString())
    interpreter.pushLiteral(size.width, ObjectType.Real)
    interpreter.pushLiteral(size.height, ObjectType.Real)
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=704
export function show(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped([ObjectType.String], ([string]) => {
    const currentPoint = interpreter.printer.getCurrentPoint()
    const content = string.value.asString()
    interpreter.printer.fillText(content, currentPoint)
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function ashow(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.String,
    ],
    ([dy, dx, string]) => {
      const characters = string.value.asString().split('')
      for (const char of characters) {
        const currentPoint = interpreter.printer.getCurrentPoint()
        interpreter.printer.fillText(char, currentPoint)
        const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
        interpreter.printer.moveTo({
          x: updatedGraphicsPoint.x + dx.value,
          y: updatedGraphicsPoint.y + dy.value,
        })
      }
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function kshow(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.Array],
    ([string, procedure]) => {
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
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function widthshow(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.String,
      ObjectType.Integer,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
    ],
    ([string, char, cy, cx]) => {
      const characters = string.value.asString().split('')
      for (const currentChar of characters) {
        const currentPoint = interpreter.printer.getCurrentPoint()
        interpreter.printer.fillText(currentChar, currentPoint)
        if (currentChar.charCodeAt(0) === char.value) {
          const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
          interpreter.printer.moveTo({
            x: updatedGraphicsPoint.x + cx.value,
            y: updatedGraphicsPoint.y + cy.value,
          })
        }
      }
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=550
export function awidthshow(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.String,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
    ],
    ([string, ay, ax, char, cy, cx]) => {
      const characters = string.value.asString().split('')
      for (const currentChar of characters) {
        const currentPoint = interpreter.printer.getCurrentPoint()
        interpreter.printer.fillText(currentChar, currentPoint)
        const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
        interpreter.printer.moveTo({
          x: updatedGraphicsPoint.x + ax.value,
          y: updatedGraphicsPoint.y + ay.value,
        })
        if (currentChar.charCodeAt(0) === char.value) {
          const updatedGraphicsPoint = interpreter.printer.getCurrentPoint()
          interpreter.printer.moveTo({
            x: updatedGraphicsPoint.x + cx.value,
            y: updatedGraphicsPoint.y + cy.value,
          })
        }
      }
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=554
export function charpath(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Boolean, ObjectType.String],
    ([bool, string]) => {
      const currentPoint = interpreter.printer.getCurrentPoint()
      const content = string.value.asString()
      if (bool.value === true) {
        throw new Error('Uninplemented')
      }
      interpreter.printer.charPath(content, currentPoint)
    }
  )
}
