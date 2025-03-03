import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { PSString } from '../string'
import { compareTypeCompatible, createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=594
export function eq(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(ObjectType.Any)
  const { value: v1, type: t1 } = interpreter.pop(ObjectType.Any)
  if (t1 === ObjectType.String && t2 === ObjectType.String) {
    interpreter.pushLiteral(
      (v1 as PSString).asString() === (v2 as PSString).asString(),
      ObjectType.Boolean
    )
    return
  }
  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 === v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=642
export function ne(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(ObjectType.Any)
  const { value: v1, type: t1 } = interpreter.pop(ObjectType.Any)
  if (t1 === ObjectType.String && t2 === ObjectType.String) {
    interpreter.pushLiteral(
      (v1 as PSString).asString() !== (v2 as PSString).asString(),
      ObjectType.Boolean
    )
    return
  }
  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 !== v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=704
export function ge(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 >= v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=618
export function gt(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )

  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 > v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=634
export function le(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )

  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 <= v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=637
export function lt(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )

  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 < v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=543
export function and(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )

  if (t1 !== t2) {
    throw new Error('and requires same type of params')
  }
  if (t1 === ObjectType.Boolean) {
    interpreter.pushLiteral(v1 && v2, ObjectType.Boolean)
  } else {
    interpreter.pushLiteral((v1 as number) & (v2 as number), ObjectType.Boolean)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=643
export function not(interpreter: PSInterpreter) {
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Integer | ObjectType.Boolean
  )
  if (t1 === ObjectType.Boolean) {
    interpreter.pushLiteral(!v1, ObjectType.Boolean)
  } else {
    interpreter.pushLiteral(~v1, ObjectType.Integer)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=645
export function or(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )

  if (t1 !== t2) {
    throw new Error('or requires same type of params')
  }
  if (t1 === ObjectType.Boolean) {
    interpreter.pushLiteral(v1 || v2, ObjectType.Boolean)
  } else {
    interpreter.pushLiteral((v1 as number) | (v2 as number), ObjectType.Boolean)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=736
export function xor(interpreter: PSInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )
  const { value: v1, type: t1 } = interpreter.pop(
    ObjectType.Boolean | ObjectType.Integer
  )

  if (t1 !== t2) {
    throw new Error('xor requires same type of params')
  }
  if (t1 === ObjectType.Boolean) {
    interpreter.pushLiteral((v1 && !v2) || (!v1 && v2), ObjectType.Boolean)
  } else {
    interpreter.pushLiteral((v1 as number) ^ (v2 as number), ObjectType.Boolean)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=601
export const FALSE_OBJECT = createLiteral(false, ObjectType.Boolean)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=718
export const TRUE_OBJECT = createLiteral(true, ObjectType.Boolean)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=553
export function bitshift(interpreter: PSInterpreter) {
  const { value: shift } = interpreter.pop(ObjectType.Integer)
  const { value } = interpreter.pop(ObjectType.Integer)
  interpreter.pushLiteral(
    shift > 0 ? value << shift : value >> -shift,
    ObjectType.Integer
  )
}
