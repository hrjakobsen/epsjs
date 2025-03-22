import { matrixFromPSArray } from '../coordinate'
import { LineCap, LineJoin } from '../graphics/context'
import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=617
export function gsave(interpreter: PSInterpreter) {
  interpreter.printer.save()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=617
export function grestore(interpreter: PSInterpreter) {
  interpreter.printer.restore()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=688
export function setLineWidth(interpreter: PSInterpreter) {
  const { value: lineWidth } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.printer.setLineWidth(lineWidth)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineWidth(interpreter: PSInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineWidth(), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=687
export function setLineCap(interpreter: PSInterpreter) {
  const { value: lineCap } = interpreter.pop(ObjectType.Integer)
  if (lineCap in LineCap) {
    interpreter.printer.setLineCap(lineCap)
  } else {
    throw new Error('Invalid line cap type')
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineCap(interpreter: PSInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineCap(), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=687
export function setLineJoin(interpreter: PSInterpreter) {
  const { value: lineJoin } = interpreter.pop(ObjectType.Integer)
  if (lineJoin in LineJoin) {
    interpreter.printer.setLineJoin(lineJoin)
  } else {
    throw new Error('Invalid line join type')
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineJoin(interpreter: PSInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineJoin(), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=689
export function setMiterLimit(interpreter: PSInterpreter) {
  const { value: miterLimit } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.printer.setMiterLimit(miterLimit)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=574
export function currentMiterLimit(interpreter: PSInterpreter) {
  interpreter.pushLiteral(
    interpreter.printer.getMiterLimit(),
    ObjectType.Integer
  )
}

// TODO: strokeadjust

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=679
export function setColorSpace(interpreter: PSInterpreter) {
  interpreter.pop(ObjectType.Name)
  interpreter.pop(ObjectType.Array)
  // FIXME: Support more than rgb
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=695
export function setRgbColor(interpreter: PSInterpreter) {
  const { value: bInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: gInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: rInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const r = clamp(0, 1, rInput)
  const g = clamp(0, 1, gInput)
  const b = clamp(0, 1, bInput)
  interpreter.printer.setRgbColor({ r, g, b })
}

export function currentRgbColor(interpreter: PSInterpreter) {
  const { r, g, b } = interpreter.printer.currentRgbColor()
  interpreter.pushLiteralNumber(r, ObjectType.Real)
  interpreter.pushLiteralNumber(g, ObjectType.Real)
  interpreter.pushLiteralNumber(b, ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=685
export function setGray(interpreter: PSInterpreter) {
  const { value: grayInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const gray = clamp(0, 1, grayInput)
  interpreter.printer.setRgbColor({ r: gray, g: gray, b: gray })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=571
export function currentGray(interpreter: PSInterpreter) {
  const { r, g, b } = interpreter.printer.currentRgbColor()
  const gray = 0.3 * r + 0.59 * g + 0.11 * b
  interpreter.pushLiteralNumber(gray, ObjectType.Real)
}

function clamp(min: number, max: number, value: number) {
  return Math.max(Math.min(max, value), min)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=686
export function setHsbColor(interpreter: PSInterpreter) {
  const { value: brightnessRaw } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: saturationRaw } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: hueRaw } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const hue = clamp(0, 1, hueRaw) * 360
  const saturation = clamp(0, 1, saturationRaw)
  const value = clamp(0, 1, brightnessRaw)

  // https://en.wikipedia.org/wiki/HSL_and_HSV#HSV_to_RGB_alternative
  const f = (n: number) => {
    const k = (n + hue / 60) % 6
    return value - saturation * clamp(0, 1, Math.min(k, 4 - k))
  }

  const r = f(5)
  const g = f(3)
  const b = f(1)

  interpreter.printer.setRgbColor({ r, g, b })
}

export function currentHsbColor(interpreter: PSInterpreter) {
  const { r, g, b } = interpreter.printer.currentRgbColor()

  // convert rgb to hsb
  // https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB
  const xMax = Math.max(r, g, b)
  const xMin = Math.min(r, g, b)
  const range = xMax - xMin
  const value = xMax

  const hue =
    range === 0
      ? 0
      : value === r
      ? 60 * (((g - b) / range) % 6)
      : value === g
      ? 60 * ((b - r) / range + 2)
      : 60 * ((r - g) / range + 4)
  const saturation = value === 0 ? 0 : range / value
  interpreter.pushLiteralNumber(hue / 360, ObjectType.Real)
  interpreter.pushLiteralNumber(saturation, ObjectType.Real)
  interpreter.pushLiteralNumber(value, ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=561
export function concat(interpreter: PSInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  const transformationMatrix = matrixFromPSArray(matrix)
  interpreter.printer.concat(transformationMatrix)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=680
export function setDash(interpreter: PSInterpreter) {
  const { value: offset } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const { value: array } = interpreter.pop(ObjectType.Array)

  for (const item of array.items) {
    if (item.type !== ObjectType.Integer && item.type !== ObjectType.Real) {
      throw new Error('Invalid dash array')
    }
  }
  interpreter.printer.setDash(
    array.map((x) => x.value as number),
    offset
  )
}
