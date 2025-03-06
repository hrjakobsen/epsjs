import { PSInterpreter } from '../interpreter'
import { CharStream, PSLexer } from '../lexer'
import { StringForAllLoopContext } from '../loop-context'
import { ObjectType, PSScanner } from '../scanner'
import { PSString } from '../string'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=713
export function string(interpreter: PSInterpreter) {
  const { value: length } = interpreter.pop(ObjectType.Integer)
  // TODO: Enforce max string length
  interpreter.pushLiteral(new PSString(length), ObjectType.String)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=635
export function length(interpreter: PSInterpreter) {
  const { value: string } = interpreter.pop(ObjectType.String)
  interpreter.pushLiteral(string.length, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: string } = interpreter.pop(ObjectType.String)
  interpreter.pushLiteral(string.get(index), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const { value: newValue } = interpreter.pop(ObjectType.Integer)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: string } = interpreter.pop(ObjectType.String)
  string.set(index, newValue)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=613
export function getInterval(interpreter: PSInterpreter) {
  const { value: count } = interpreter.pop(ObjectType.Integer)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: string } = interpreter.pop(ObjectType.String)
  if (index < 0 || count < 0 || index + count > string.length) {
    throw new Error(`Invalid substring with index ${index} and count ${count}`)
  }
  interpreter.pushLiteral(
    PSString.fromCharCode(...string.data.slice(index, index + count)),
    ObjectType.String
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=650
export function putInterval(interpreter: PSInterpreter) {
  const { value: source } = interpreter.pop(ObjectType.String)
  const { value: index } = interpreter.pop(ObjectType.Integer)
  const { value: target } = interpreter.pop(ObjectType.String)
  if (index < 0) {
    throw new Error('putinterval: index cannot be negative')
  }

  if (target.length < source.length + index) {
    throw new Error(
      `putinterval: Cannot fit string of length ${source.length} into string of length ${target.length} starting at index ${index}`
    )
  }

  target.data.splice(index, source.length, ...source.data)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=562
export function copy(interpreter: PSInterpreter) {
  const { value: source } = interpreter.pop(ObjectType.String)
  const { value: target } = interpreter.pop(ObjectType.String)
  if (!(target.length < source.length)) {
    throw new Error(
      `putinterval: Cannot fit string of length ${source.length} into string of length ${target.length}`
    )
  }

  const removed = target.data.splice(0, source.length, ...source.data)
  interpreter.pushLiteral(PSString.fromCharCode(...removed), ObjectType.String)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const string = interpreter.pop(ObjectType.String)
  interpreter.beginLoop(
    new StringForAllLoopContext(
      interpreter.executionStack,
      proc,
      interpreter.operandStack,
      string
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=543
export function anchorSearch(interpreter: PSInterpreter) {
  const { value: needle } = interpreter.pop(ObjectType.String)
  const haystack = interpreter.pop(ObjectType.String)
  const matches = haystack.value.anchorSearch(needle)
  if (!matches) {
    interpreter.operandStack.push(haystack)
    interpreter.pushLiteral(false, ObjectType.Boolean)
    return
  }
  const match = haystack.value.subString(0, needle.length)
  const post = haystack.value.subString(needle.length)
  interpreter.pushLiteral(post, ObjectType.String)
  interpreter.pushLiteral(match, ObjectType.String)
  interpreter.pushLiteral(true, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=669
export function search(interpreter: PSInterpreter) {
  const { value: needle } = interpreter.pop(ObjectType.String)
  const haystack = interpreter.pop(ObjectType.String)
  const matchIndex = haystack.value.search(needle)
  if (matchIndex === false) {
    interpreter.operandStack.push(haystack)
    interpreter.pushLiteral(false, ObjectType.Boolean)
    return
  }
  const pre = haystack.value.subString(0, matchIndex)
  const match = haystack.value.subString(matchIndex, needle.length)
  const post = haystack.value.subString(matchIndex + needle.length)
  interpreter.pushLiteral(post, ObjectType.String)
  interpreter.pushLiteral(match, ObjectType.String)
  interpreter.pushLiteral(pre, ObjectType.String)
  interpreter.pushLiteral(true, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=716
export function token(interpreter: PSInterpreter) {
  const string = interpreter.pop(ObjectType.String)
  const jsString = string.value.asString()
  const lexer = new PSLexer(new CharStream(jsString))
  const scanner = new PSScanner(lexer)
  const token = scanner.next
  if (token) {
    const post = string.value.subString(scanner.sourceOffset())
    interpreter.pushLiteral(post, ObjectType.String)
    interpreter.operandStack.push(token)
    interpreter.pushLiteral(true, ObjectType.Boolean)
  } else {
    interpreter.pushLiteral(false, ObjectType.Boolean)
  }
}
