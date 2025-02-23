import { matrixFromPostScriptArray } from '../coordinate'
import { LineCap, LineJoin } from '../graphics/context'
import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=617
export function gsave(interpreter: PostScriptInterpreter) {
  interpreter.printer.save()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=617
export function grestore(interpreter: PostScriptInterpreter) {
  interpreter.printer.restore()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=688
export function setLineWidth(interpreter: PostScriptInterpreter) {
  const { value: lineWidth } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.printer.setLineWidth(lineWidth)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineWidth(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineWidth(), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=687
export function setLineCap(interpreter: PostScriptInterpreter) {
  const { value: lineCap } = interpreter.pop(ObjectType.Integer)
  if (lineCap in LineCap) {
    interpreter.printer.setLineCap(lineCap)
  } else {
    throw new Error('Invalid line cap type')
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineCap(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineCap(), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=687
export function setLineJoin(interpreter: PostScriptInterpreter) {
  const { value: lineJoin } = interpreter.pop(ObjectType.Integer)
  if (lineJoin in LineJoin) {
    interpreter.printer.setLineJoin(lineJoin)
  } else {
    throw new Error('Invalid line join type')
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=573
export function currentLineJoin(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(interpreter.printer.getLineJoin(), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=689
export function setMiterLimit(interpreter: PostScriptInterpreter) {
  const { value: miterLimit } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.printer.setMiterLimit(miterLimit)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=574
export function currentMiterLimit(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(
    interpreter.printer.getMiterLimit(),
    ObjectType.Integer
  )
}

// TODO: strokeadjust

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=679
export function setColorSpace(interpreter: PostScriptInterpreter) {
  interpreter.pop(ObjectType.Name)
  interpreter.pop(ObjectType.Array)
  // FIXME: Support more than rgb
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=695
// @builtin('setrgbcolor')
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=676
export function setColor(interpreter: PostScriptInterpreter) {
  const { value: bInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: gInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: rInput } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  //FIXME: Support other colour definitions
  const fitToRgbRange = (number: number) =>
    Math.round(Math.min(Math.max(0, number), 1) * 255)

  const r = fitToRgbRange(rInput)
  const g = fitToRgbRange(gInput)
  const b = fitToRgbRange(bInput)
  interpreter.printer.setRgbColor(r, g, b)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=685
export function setGray(interpreter: PostScriptInterpreter) {
  const { value: gray } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  if (gray < 0 || gray > 1) {
    throw new Error('Invalid gray value')
  }
  interpreter.printer.setRgbColor(gray * 255, gray * 255, gray * 255)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=561
export function concat(interpreter: PostScriptInterpreter) {
  const matrix = interpreter.pop(ObjectType.Array)
  const transformationMatrix = matrixFromPostScriptArray(matrix)
  interpreter.printer.concat(transformationMatrix)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=680
export function setDash(interpreter: PostScriptInterpreter) {
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
