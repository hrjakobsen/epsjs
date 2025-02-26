import { PostScriptInterpreter } from '../interpreter'
import { Access, Executability, ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=647
export function pop(interpreter: PostScriptInterpreter) {
  interpreter.pop(ObjectType.Any)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=595
export function exch(interpreter: PostScriptInterpreter) {
  const top = interpreter.pop(ObjectType.Any)
  const next = interpreter.pop(ObjectType.Any)
  interpreter.operandStack.push(top, next)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=589
export function dup(interpreter: PostScriptInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  interpreter.operandStack.push(obj, obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=563
export function copy(interpreter: PostScriptInterpreter) {
  const { value: numberOfElements } = interpreter.pop(ObjectType.Integer)

  if (interpreter.operandStack.length < numberOfElements) {
    throw new Error('Not enough elements on stack to copy')
  }
  const slice = interpreter.operandStack.slice(
    interpreter.operandStack.length - numberOfElements
  )
  interpreter.operandStack.push(...slice)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=624
export function index(interpreter: PostScriptInterpreter) {
  const { value: offset } = interpreter.pop(ObjectType.Integer)
  if (interpreter.operandStack.length <= offset) {
    throw new Error('Index too high')
  }
  interpreter.operandStack.push(
    interpreter.operandStack[interpreter.operandStack.length - 1 - offset]!
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function roll(interpreter: PostScriptInterpreter) {
  const { value: numRolls } = interpreter.pop(ObjectType.Integer)
  const { value: numElements } = interpreter.pop(ObjectType.Integer)
  if (interpreter.operandStack.length < numElements) {
    throw new Error('roll: Not enough elements')
  }
  const toRotate = interpreter.operandStack.splice(
    interpreter.operandStack.length - numElements,
    numElements
  )
  for (let i = 0; i < Math.abs(numRolls); ++i) {
    const upwards = numRolls > 0
    if (upwards) {
      toRotate.unshift(toRotate.pop()!)
    } else {
      toRotate.push(toRotate.shift()!)
    }
  }
  interpreter.operandStack.push(...toRotate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=555
export function clear(interpreter: PostScriptInterpreter) {
  interpreter.operandStack = []
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=564
export function count(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteralNumber(interpreter.operandStack.length)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=639
export function mark(interpreter: PostScriptInterpreter) {
  interpreter.operandStack.push({
    type: ObjectType.Mark,
    attributes: {
      access: Access.Unlimited,
      executability: Executability.Literal,
    },
    value: undefined,
  })
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=555
export function clearToMark(interpreter: PostScriptInterpreter) {
  const markIndex = interpreter.findIndexOfMark()
  if (markIndex === undefined) {
    throw new Error('No mark defined')
  }
  interpreter.operandStack.splice(markIndex)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=564
export function countToMark(interpreter: PostScriptInterpreter) {
  const markIndex = interpreter.findIndexOfMark()
  if (markIndex === undefined) {
    throw new Error('No mark defined')
  }
  interpreter.pushLiteralNumber(interpreter.operandStack.length - 1 - markIndex)
}
