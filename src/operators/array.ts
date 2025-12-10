import { PSArray } from '../array'
import { PSInterpreter } from '../interpreter'
import { ArrayForAllLoopContext } from '../execution-contexts/loop-context'
import { ObjectType } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function array(interpreter: PSInterpreter) {
  const { value: length } = interpreter.pop(ObjectType.Integer)
  interpreter.pushLiteral(
    new PSArray(Array(length).fill(createLiteral(null, ObjectType.Null))),
    ObjectType.Array
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=538
// @builtin('[')
export function arrayStart(interpreter: PSInterpreter) {
  interpreter.pushLiteral(undefined, ObjectType.Mark)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=538
// @builtin(']')
export function arrayEnd(interpreter: PSInterpreter) {
  const list = interpreter.operandStack.popMarked()
  interpreter.pushLiteral(new PSArray(list), ObjectType.Array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=635
export function length(interpreter: PSInterpreter) {
  const { value: elements } = interpreter.pop(ObjectType.Array)
  interpreter.pushLiteral(elements.length, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: elements } = interpreter.pop(ObjectType.Array)
  if (elements.length <= index) {
    throw new Error(
      `Index ${index} out of range of array with length ${elements.length}`
    )
  }
  interpreter.operandStack.push(elements.get(index)!)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const item = interpreter.pop(ObjectType.Any)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: elements } = interpreter.pop(ObjectType.Array)
  if (elements.length <= index) {
    throw new Error(
      `Index ${index} out of range of array with length ${elements.length}`
    )
  }
  elements.set(index, item)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=613
export function getInterval(interpreter: PSInterpreter) {
  const { value: count } = interpreter.pop(ObjectType.Integer)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: elements } = interpreter.pop(ObjectType.Array)
  if (elements.length <= index) {
    throw new Error(
      `getinterval: index ${index} out of range of array with length ${elements.length}`
    )
  }
  if (elements.length <= index + count) {
    throw new Error(
      `getinterval: index ${index} with count ${count} is out of range of array with length ${elements.length}`
    )
  }
  interpreter.pushLiteral(
    elements.slice(index, index + count),
    ObjectType.Array
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=650
export function putInterval(interpreter: PSInterpreter) {
  const { value: source } = interpreter.pop(ObjectType.Array)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: target } = interpreter.pop(ObjectType.Array)

  if (target.length < index + source.length) {
    throw new Error(
      `putinterval: inserting source array with length ${source.length} in array with length ${target.length} starting at index ${index} is out of range`
    )
  }
  target.splice(index, source.length, source)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=549
export function aStore(interpreter: PSInterpreter) {
  const array = interpreter.pop(ObjectType.Array)
  const { value: elements } = array
  if (interpreter.operandStack.length < elements.length) {
    throw new Error(
      `astore: Not enough elements on stack. Required ${elements.length} found ${interpreter.operandStack.length}`
    )
  }
  // Move items from stack into array
  elements.splice(
    0,
    elements.length,
    new PSArray([
      ...interpreter.operandStack.splice(
        interpreter.operandStack.length - elements.length
      ),
    ])
  )
  interpreter.operandStack.push(array)
}
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=542
export function aLoad(interpreter: PSInterpreter) {
  const array = interpreter.pop(ObjectType.Array)
  interpreter.operandStack.push(...array.value.items, array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=562
export function copy(interpreter: PSInterpreter) {
  const { value: target } = interpreter.pop(ObjectType.Array)
  const { value: source } = interpreter.pop(ObjectType.Array)
  // Returns the removed elements of target
  if (target.length < source.length) {
    throw new Error(
      `copy: Cannot copy array of length ${source.length} into array of length ${target.length}`
    )
  }
  const returnedElements = target.splice(0, source.length, source)
  interpreter.pushLiteral(returnedElements, ObjectType.Array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const array = interpreter.pop(ObjectType.Array)
  interpreter.beginLoop(
    new ArrayForAllLoopContext(
      interpreter,
      proc,
      interpreter.operandStack,
      array
    )
  )
}
