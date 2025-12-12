import { PSArray } from '../array'
import { PSInterpreter } from '../interpreter'
import { ArrayForAllLoopContext } from '../execution-contexts/loop-context'
import { ObjectType } from '../scanner'
import { createLiteral } from '../utils'
import { RangeCheckError, StackUnderflowError } from '../error'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=548
export function array(interpreter: PSInterpreter) {
  const [{ value: length }] = interpreter.operandStack.pop(ObjectType.Integer)
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
  const [{ value: elements }] = interpreter.operandStack.pop(ObjectType.Array)
  interpreter.pushLiteral(elements.length, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const [index, elements] = interpreter.operandStack.pop(
    ObjectType.Integer,
    ObjectType.Array
  )
  if (elements.value.length <= index.value) {
    // restore stack
    interpreter.operandStack.push(elements, index)
    throw new RangeCheckError()
  }
  interpreter.operandStack.push(elements.value.get(index.value)!)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const [item, index, elements] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Integer,
    ObjectType.Array
  )

  if (elements.value.length <= index.value) {
    // restore stack
    interpreter.operandStack.push(elements, index, item)
    throw new RangeCheckError()
  }
  elements.value.set(index.value, item)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=613
export function getInterval(interpreter: PSInterpreter) {
  const [count, index, elements] = interpreter.operandStack.pop(
    ObjectType.Integer,
    ObjectType.Integer,
    ObjectType.Array
  )
  if (
    elements.value.length <= index.value ||
    elements.value.length <= index.value + count.value
  ) {
    // restore stack
    interpreter.operandStack.push(elements, index, count)
    throw new RangeCheckError()
  }
  interpreter.pushLiteral(
    elements.value.slice(index.value, index.value + count.value),
    ObjectType.Array
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=650
export function putInterval(interpreter: PSInterpreter) {
  const [source, index, target] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Integer,
    ObjectType.Array
  )

  if (target.value.length < index.value + source.value.length) {
    // restore stack
    interpreter.operandStack.push(target, index, source)
    throw new RangeCheckError()
  }
  target.value.splice(index.value, source.value.length, source.value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=549
export function aStore(interpreter: PSInterpreter) {
  const [array] = interpreter.operandStack.pop(ObjectType.Array)
  const { value: elements } = array
  if (interpreter.operandStack.length < elements.length) {
    // restore stack
    interpreter.operandStack.push(array)
    throw new StackUnderflowError()
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
  const [array] = interpreter.operandStack.pop(ObjectType.Array)
  interpreter.operandStack.push(...array.value.items, array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=562
export function copy(interpreter: PSInterpreter) {
  const [target, source] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Array
  )
  // Returns the removed elements of target
  if (target.value.length < source.value.length) {
    // restore stack
    interpreter.operandStack.push(source, target)
    throw new RangeCheckError()
  }
  const returnedElements = target.value.splice(
    0,
    source.value.length,
    source.value
  )
  interpreter.pushLiteral(returnedElements, ObjectType.Array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PSInterpreter) {
  const [proc, array] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Array
  )
  interpreter.beginLoop(
    new ArrayForAllLoopContext(
      interpreter,
      proc,
      interpreter.operandStack,
      array
    )
  )
}
