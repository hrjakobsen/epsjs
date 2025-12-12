import { RangeCheckError, UndefinedResultError } from '../error'
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
  const [y, x] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  const nextCoordinate = {
    x: x.value,
    y: y.value,
  }
  interpreter.printer.moveTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function rMoveTo(interpreter: PSInterpreter) {
  const [y, x] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  const currentPoint = interpreter.printer.getCurrentPoint()
  const nextCoordinate = {
    x: currentPoint.x + x.value,
    y: currentPoint.y + y.value,
  }
  interpreter.printer.moveTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function lineTo(interpreter: PSInterpreter) {
  const [y, x] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  interpreter.printer.lineTo({ x: x.value, y: y.value })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function rLineTo(interpreter: PSInterpreter) {
  const [y, x] = interpreter.operandStack.pop(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  const currentPoint = interpreter.printer.getCurrentPoint()
  const nextCoordinate = {
    x: currentPoint.x + x.value,
    y: currentPoint.y + y.value,
  }
  interpreter.printer.lineTo(nextCoordinate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=544
export function arc(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([angle2, angle1, radius, y, x]) => {
      if (
        angle1.value < 0 ||
        angle1.value > 360 ||
        angle2.value < 0 ||
        angle2.value > 360
      ) {
        throw new RangeCheckError()
      }
      interpreter.printer.arc(
        { x: x.value, y: y.value },
        radius.value,
        angle1.value,
        angle2.value,
        true
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=545
export function arcn(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([angle2, angle1, radius, y, x]) => {
      if (
        angle1.value < 0 ||
        angle1.value > 360 ||
        angle2.value < 0 ||
        angle2.value > 360
      ) {
        throw new RangeCheckError()
      }
      interpreter.printer.arc(
        { x: x.value, y: y.value },
        radius.value,
        angle1.value,
        angle2.value,
        false
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=546
export function arct(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([
      { value: r },
      { value: y2 },
      { value: x2 },
      { value: y1 },
      { value: x1 },
    ]) => {
      interpreter.printer.arcTangents(x1, x2, y1, y2, r)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function arcto(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([r, y2, x2, y1, x1]) => {
      const result = interpreter.printer.arcTangents(
        x1.value,
        x2.value,
        y1.value,
        y2.value,
        r.value
      )
      if (!result) {
        throw new UndefinedResultError()
      }
      interpreter.pushLiteral(result.tangentPoint1.x, ObjectType.Real)
      interpreter.pushLiteral(result.tangentPoint1.y, ObjectType.Real)
      interpreter.pushLiteral(result.tangentPoint2.x, ObjectType.Real)
      interpreter.pushLiteral(result.tangentPoint2.y, ObjectType.Real)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=578
export function curveto(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([
      { value: y3 },
      { value: x3 },
      { value: y2 },
      { value: x2 },
      { value: y1 },
      { value: x1 },
    ]) => {
      interpreter.printer.bezierCurveTo(
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 }
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=652
export function rcurveto(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
      ObjectType.Real | ObjectType.Integer,
    ],
    ([
      { value: y3 },
      { value: x3 },
      { value: y2 },
      { value: x2 },
      { value: y1 },
      { value: x1 },
    ]) => {
      const currentPoint = interpreter.printer.getCurrentPoint()
      const cp1 = { x: currentPoint.x + x1, y: currentPoint.y + y1 }
      const cp2 = { x: currentPoint.x + x2, y: currentPoint.y + y2 }
      const endPoint = { x: currentPoint.x + x3, y: currentPoint.y + y3 }
      interpreter.printer.bezierCurveTo(cp1, cp2, endPoint)
    }
  )
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
  interpreter.operandStack.withPopped(
    [
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
    ],
    ([{ value: height }, { value: width }, { value: y }, { value: x }]) => {
      interpreter.printer.rectClip({ x, y }, width, height)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=593
export function eoClip(interpreter: PSInterpreter) {
  interpreter.printer.evenOddClip()
}
