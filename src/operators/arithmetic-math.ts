import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { degreeToRadians, radiansToDegrees } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=541
export function add(interpreter: PostScriptInterpreter) {
  const { type: t2, value: v2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const { type: t1, value: v1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
  interpreter.pushLiteralNumber(
    v1 + v2,
    isReal ? ObjectType.Real : ObjectType.Integer
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=588
export function div(interpreter: PostScriptInterpreter) {
  const { value: v2 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)

  interpreter.pushLiteralNumber(v1 / v2, ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=619
export function idiv(interpreter: PostScriptInterpreter) {
  const { value: v2 } = interpreter.pop(ObjectType.Integer)
  const { value: v1 } = interpreter.pop(ObjectType.Integer)
  interpreter.pushLiteralNumber(Math.floor(v1 / v2))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=641
export function mod(interpreter: PostScriptInterpreter) {
  const { value: v2 } = interpreter.pop(ObjectType.Integer)
  const { value: v1 } = interpreter.pop(ObjectType.Integer)
  interpreter.pushLiteralNumber(v1 % v2)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=641
export function mul(interpreter: PostScriptInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
  interpreter.pushLiteralNumber(
    v1 * v2,
    isReal ? ObjectType.Real : ObjectType.Integer
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=715
export function sub(interpreter: PostScriptInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
  interpreter.pushLiteralNumber(
    v1 - v2,
    isReal ? ObjectType.Real : ObjectType.Integer
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=541
export function abs(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.pushLiteralNumber(
    Math.abs(v1),
    t1 as ObjectType.Integer | ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=642
export function neg(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.pushLiteralNumber(-v1, t1 as ObjectType.Integer | ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=554
export function ceiling(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.pushLiteralNumber(
    Math.ceil(v1),
    t1 as ObjectType.Integer | ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=610
export function floor(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.pushLiteralNumber(
    Math.ceil(v1),
    t1 as ObjectType.Integer | ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=666
export function round(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )
  interpreter.pushLiteralNumber(
    Math.round(v1),
    t1 as ObjectType.Integer | ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=719
export function truncate(interpreter: PostScriptInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real
  )

  interpreter.pushLiteralNumber(
    Math.trunc(v1),
    t1 as ObjectType.Integer | ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=706
export function sqrt(interpreter: PostScriptInterpreter) {
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(Math.sqrt(v1), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=549
export function atan(interpreter: PostScriptInterpreter) {
  const { value: v2 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(
    radiansToDegrees(Math.atan(v1 / v2)),
    ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=564
export function cos(interpreter: PostScriptInterpreter) {
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(
    radiansToDegrees(Math.cos(degreeToRadians(v1))),
    ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=706
export function sin(interpreter: PostScriptInterpreter) {
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(
    radiansToDegrees(Math.sin(degreeToRadians(v1))),
    ObjectType.Real
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=600
export function exp(interpreter: PostScriptInterpreter) {
  const { value: v2 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(Math.pow(v1, v2), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function ln(interpreter: PostScriptInterpreter) {
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(Math.log2(v1), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=637
export function log(interpreter: PostScriptInterpreter) {
  const { value: v1 } = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  interpreter.pushLiteralNumber(Math.log10(v1), ObjectType.Real)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=651
export function rand(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteralNumber(
    Math.floor(Math.random() * (Math.pow(2, 31) - 1))
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=706
export function srand(interpreter: PostScriptInterpreter) {
  const { value } = interpreter.pop(ObjectType.Integer)
  console.warn(
    `Trying to set random seed ${value}. Seeding the RNG is not supported`
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=666
export function rrand(interpreter: PostScriptInterpreter) {
  console.warn(`Trying to read random seed. Seeding the RNG is not supported`)
  interpreter.pushLiteralNumber(-1)
}
