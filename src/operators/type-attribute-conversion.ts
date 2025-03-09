import { PSInterpreter } from '../interpreter'
import {
  Access,
  Executability,
  ObjectType,
  ObjectValue,
  parseNumber,
  PSObject,
} from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=719
export function type(interpreter: PSInterpreter) {
  const { type } = interpreter.pop(ObjectType.Any)
  let name
  switch (type) {
    case ObjectType.Boolean:
      name = 'booleantype'
      break
    case ObjectType.FontID:
      name = 'fonttype'
      break
    case ObjectType.Integer:
      name = 'integertype'
      break
    case ObjectType.Mark:
      name = 'marktype'
      break
    case ObjectType.Name:
      name = 'nametype'
      break
    case ObjectType.Null:
      name = 'nulltype'
      break
    case ObjectType.Operator:
      name = 'operatortype'
      break
    case ObjectType.Real:
      name = 'realtype'
      break
    case ObjectType.Array:
      name = 'arraytype'
      break
    case ObjectType.Dictionary:
      name = 'dicttype'
      break
    case ObjectType.File:
      name = 'filetype'
      break
    case ObjectType.GState:
      name = 'gstatetype'
      break
    case ObjectType.PackedArray:
      name = 'packedarraytype'
      break
    case ObjectType.Save:
      name = 'savetype'
      break
    case ObjectType.String:
      name = 'stringtype'
      break
    default:
      throw new Error('Invalid type')
  }
  interpreter.operandStack.push({
    type: ObjectType.Name,
    attributes: {
      executability: Executability.Executable,
      access: Access.Unlimited,
    },
    value: name,
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=580
export function cvlit(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  obj.attributes.executability = Executability.Literal
  interpreter.operandStack.push(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=582
export function cvx(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  obj.attributes.executability = Executability.Executable
  interpreter.operandStack.push(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=735
export function xcheck(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  interpreter.operandStack.push(
    createLiteral(
      obj.attributes.executability === Executability.Executable,
      ObjectType.Boolean
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=598
export function executeonly(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.String
  )
  obj.attributes.access = Access.ExecuteOnly
  interpreter.operandStack.push(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=642
export function noaccess(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  obj.attributes.access = Access.None
  interpreter.operandStack.push(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=654
export function readonly(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  obj.attributes.access = Access.ReadOnly
  interpreter.operandStack.push(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=652
export function rcheck(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  interpreter.operandStack.push(
    createLiteral(
      Boolean(obj.attributes.access | (Access.ReadOnly | Access.Unlimited)),
      ObjectType.Boolean
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function wcheck(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  interpreter.operandStack.push(
    createLiteral(
      Boolean(obj.attributes.access | Access.Unlimited),
      ObjectType.Boolean
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=580
export function cvi(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.String | ObjectType.Real | ObjectType.Integer
  )
  // Convert to integer
  let res: number
  if (obj.type === ObjectType.String) {
    res = parseNumber(obj.value.toString()).value
  } else {
    res = (obj as PSObject<ObjectType.Integer | ObjectType.Real>).value
  }
  interpreter.operandStack.push(
    createLiteral(Math.trunc(res), ObjectType.Integer)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=580
export function cvn(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.String)
  // Convert to name
  interpreter.operandStack.push({
    attributes: {
      executability: obj.attributes.executability,
      access: obj.attributes.access,
    },
    type: ObjectType.Name,
    value: obj.value.asString(),
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=581
export function cvr(interpreter: PSInterpreter) {
  const obj = interpreter.pop(
    ObjectType.String | ObjectType.Real | ObjectType.Integer
  )
  // Convert to real
  let res: number
  if (obj.type === ObjectType.String) {
    res = parseNumber(obj.value.toString()).value
  } else {
    res = (obj as PSObject<ObjectType.Integer | ObjectType.Real>).value
  }
  interpreter.operandStack.push(createLiteral(res, ObjectType.Real))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=581
export function cvrs(interpreter: PSInterpreter) {
  const str = interpreter.pop(ObjectType.String)
  const radix = interpreter.pop(ObjectType.Integer)
  const num = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const truncatedValueIfNeeded =
    radix.value === 10 ? num.value : Math.trunc(num.value)
  const strValue = truncatedValueIfNeeded.toString(radix.value)
  const newStrLength = strValue.length
  str.value.setSubString(0, strValue)
  interpreter.pushLiteral(
    str.value.subString(0, newStrLength),
    ObjectType.String
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=582
export function cvs(interpreter: PSInterpreter) {
  const str = interpreter.pop(ObjectType.String)
  const obj = interpreter.pop(ObjectType.Any)
  const strValue = convertToString(obj)
  const newStrLength = strValue.length
  str.value.setSubString(0, strValue)
  interpreter.pushLiteral(
    str.value.subString(0, newStrLength),
    ObjectType.String
  )
}

function convertToString(obj: PSObject): string {
  switch (obj.type) {
    case ObjectType.Boolean:
      return obj.value ? 'true' : 'false'
    case ObjectType.Integer:
      return (obj.value as ObjectValue<ObjectType.Integer>).toString()
    case ObjectType.Real:
      return (obj.value as ObjectValue<ObjectType.Integer>).toPrecision(5)
    case ObjectType.String:
      return (obj.value as ObjectValue<ObjectType.String>).asString()
    case ObjectType.Name:
      return obj.value as ObjectValue<ObjectType.Name>
    default:
      return '--nostringval--'
  }
}
