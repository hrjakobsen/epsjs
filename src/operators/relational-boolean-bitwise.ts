import { PostScriptInterpreter } from '../interpreter'
import { Access, Executability, ObjectType } from '../scanner'
import { compareTypeCompatible } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=594
export function eq(interpreter: PostScriptInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(ObjectType.Any)
  const { value: v1, type: t1 } = interpreter.pop(ObjectType.Any)

  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 === v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=642
export function ne(interpreter: PostScriptInterpreter) {
  const { value: v2, type: t2 } = interpreter.pop(ObjectType.Any)
  const { value: v1, type: t1 } = interpreter.pop(ObjectType.Any)
  interpreter.pushLiteral(
    compareTypeCompatible(t1, t2) && v1 !== v2,
    ObjectType.Boolean
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=704
export function ge(interpreter: PostScriptInterpreter) {
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
export function gt(interpreter: PostScriptInterpreter) {
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
export function le(interpreter: PostScriptInterpreter) {
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
export function lt(interpreter: PostScriptInterpreter) {
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
export function and(interpreter: PostScriptInterpreter) {
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
export function not(interpreter: PostScriptInterpreter) {
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
export function or(interpreter: PostScriptInterpreter) {
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
export function xor(interpreter: PostScriptInterpreter) {
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
    interpreter.pushLiteral(v1 || (v2 && (!v1 || !v2)), ObjectType.Boolean)
  } else {
    interpreter.pushLiteral((v1 as number) ^ (v2 as number), ObjectType.Boolean)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=718
// @builtin('true')
export function _true(interpreter: PostScriptInterpreter) {
  interpreter.operandStack.push({
    type: ObjectType.Boolean,
    value: true,
    attributes: {
      access: Access.Unlimited,
      executability: Executability.Literal,
    },
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=601
// @builtin('false')
export function _false(interpreter: PostScriptInterpreter) {
  interpreter.operandStack.push({
    type: ObjectType.Boolean,
    value: false,
    attributes: {
      access: Access.Unlimited,
      executability: Executability.Literal,
    },
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=553
export function bitshift(interpreter: PostScriptInterpreter) {
  const { value: shift } = interpreter.pop(ObjectType.Integer)
  const { value } = interpreter.pop(ObjectType.Integer)
  interpreter.pushLiteral(
    shift ? value << shift : value >> shift,
    ObjectType.Integer
  )
}
