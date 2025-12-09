import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=642
export function newPath(interpreter: PSInterpreter) {
  interpreter.printer.newPath()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=575
export function currentPoint(interpreter: PSInterpreter) {
  const currentPoint = interpreter.printer.getCurrentPoint()
  interpreter.pushLiteral(currentPoint.x, ObjectType.Real)
  interpreter.pushLiteral(currentPoint.y, ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=641
export function moveTo(interpreter: PSInterpreter) {
  const y = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const x = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const nextCoordinate = {
    x: x.value,
    y: y.value,
  }
  interpreter.printer.moveTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function rMoveTo(interpreter: PSInterpreter) {
  const y = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const x = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const currentPoint = interpreter.printer.getCurrentPoint()
  const nextCoordinate = {
    x: currentPoint.x + x.value,
    y: currentPoint.y + y.value,
  }
  interpreter.printer.moveTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function lineTo(interpreter: PSInterpreter) {
  const y = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const x = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  interpreter.printer.lineTo({ x: x.value, y: y.value })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function rLineTo(interpreter: PSInterpreter) {
  const y = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const x = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const currentPoint = interpreter.printer.getCurrentPoint()
  const nextCoordinate = {
    x: currentPoint.x + x.value,
    y: currentPoint.y + y.value,
  }
  interpreter.printer.lineTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=544
export function arc(interpreter: PSInterpreter) {
  const { value: angle2 } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: angle1 } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: radius } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: y } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
    throw new Error(`Invalid angles ${angle1} or ${angle2}`)
  }
  interpreter.printer.arc({ x, y }, radius, angle1, angle2, true)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=545
export function arcn(interpreter: PSInterpreter) {
  const { value: angle2 } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: angle1 } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: radius } = interpreter.pop(
    ObjectType.Real | ObjectType.Integer
  )
  const { value: y } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
    throw new Error(`Invalid angles ${angle1} or ${angle2}`)
  }
  interpreter.printer.arc({ x, y }, radius, angle1, angle2, false)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=546
export function arct(interpreter: PSInterpreter) {
  const { value: r } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  interpreter.printer.arcTangents(x1, x2, y1, y2, r)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function arcto(_interpreter: PSInterpreter) {
  throw new Error('arcto: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=578
export function curveto(interpreter: PSInterpreter) {
  const { value: y3 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x3 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  interpreter.printer.bezierCurveTo(
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=652
export function rcurveto(interpreter: PSInterpreter) {
  const { value: y3 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x3 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x2 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: y1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const { value: x1 } = interpreter.pop(ObjectType.Real | ObjectType.Integer)
  const currentPoint = interpreter.printer.getCurrentPoint()
  const cp1 = { x: currentPoint.x + x1, y: currentPoint.y + y1 }
  const cp2 = { x: currentPoint.x + x2, y: currentPoint.y + y2 }
  const endPoint = { x: currentPoint.x + x3, y: currentPoint.y + y3 }
  interpreter.printer.bezierCurveTo(cp1, cp2, endPoint)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=568
export function closePath(interpreter: PSInterpreter) {
  interpreter.printer.closePath()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=556
export function clip(interpreter: PSInterpreter) {
  interpreter.printer.clip()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=655
export function rectClip(interpreter: PSInterpreter) {
  const { value: height } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const { value: width } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: y } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: x } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.printer.rectClip({ x, y }, width, height)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=593
export function eoClip(interpreter: PSInterpreter) {
  interpreter.printer.evenOddClip()
}
