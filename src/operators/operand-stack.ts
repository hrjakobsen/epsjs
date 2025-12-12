import { RangeCheckError, StackUnderflowError } from '../error'
import { PSInterpreter } from '../interpreter'
import { OperandStack } from '../operand-stack'
import { Access, Executability, ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=647
export function pop(interpreter: PSInterpreter) {
  interpreter.operandStack.pop(ObjectType.Any)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=595
export function exch(interpreter: PSInterpreter) {
  const [top, next] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Any
  )
  interpreter.operandStack.push(top, next)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=589
export function dup(interpreter: PSInterpreter) {
  const [obj] = interpreter.operandStack.pop(ObjectType.Any)
  interpreter.operandStack.push(obj, obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=563
export function copy(interpreter: PSInterpreter) {
  const [numberOfElements] = interpreter.operandStack.pop(ObjectType.Integer)

  if (interpreter.operandStack.length < numberOfElements.value) {
    interpreter.operandStack.push(numberOfElements)
    throw new RangeCheckError()
  }
  interpreter.operandStack.copy(numberOfElements.value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=624
export function index(interpreter: PSInterpreter) {
  const [offset] = interpreter.operandStack.pop(ObjectType.Integer)
  if (interpreter.operandStack.length <= offset.value) {
    interpreter.operandStack.push(offset)
    throw new RangeCheckError()
  }
  interpreter.operandStack.push(
    interpreter.operandStack.at(
      interpreter.operandStack.length - 1 - offset.value
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=664
export function roll(interpreter: PSInterpreter) {
  const [numRolls, numElements] = interpreter.operandStack.pop(
    ObjectType.Integer,
    ObjectType.Integer
  )
  if (interpreter.operandStack.length < numElements.value) {
    interpreter.operandStack.push(numRolls, numElements)
    throw new RangeCheckError()
  }
  const toRotate = interpreter.operandStack.splice(
    interpreter.operandStack.length - numElements.value,
    numElements.value
  )
  for (let i = 0; i < Math.abs(numRolls.value); ++i) {
    const upwards = numRolls.value > 0
    if (upwards) {
      toRotate.unshift(toRotate.pop()!)
    } else {
      toRotate.push(toRotate.shift()!)
    }
  }
  interpreter.operandStack.push(...toRotate)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=555
export function clear(interpreter: PSInterpreter) {
  interpreter.operandStack = new OperandStack()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=564
export function count(interpreter: PSInterpreter) {
  interpreter.pushLiteralNumber(interpreter.operandStack.length)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=639
export function mark(interpreter: PSInterpreter) {
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
export function clearToMark(interpreter: PSInterpreter) {
  interpreter.operandStack.popMarked()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=564
export function countToMark(interpreter: PSInterpreter) {
  const markIndex = interpreter.operandStack.findIndexOfMark()
  if (markIndex === undefined) {
    throw new StackUnderflowError()
  }
  interpreter.pushLiteralNumber(interpreter.operandStack.length - 1 - markIndex)
}
