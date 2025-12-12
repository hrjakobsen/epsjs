import { PSInterpreter } from '../interpreter'
import { CharStream, PSLexer } from '../lexer'
import { StringForAllLoopContext } from '../execution-contexts/loop-context'
import { ObjectType, PSScanner } from '../scanner'
import { PSString } from '../string'
import { RangeCheckError } from '../error'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=713
export function string(interpreter: PSInterpreter) {
  const [{ value: length }] = interpreter.operandStack.pop(ObjectType.Integer)
  // TODO: Enforce max string length
  interpreter.pushLiteral(new PSString(length), ObjectType.String)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=635
export function length(interpreter: PSInterpreter) {
  const [{ value: string }] = interpreter.operandStack.pop(ObjectType.String)
  interpreter.pushLiteral(string.length, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const [{ value: index }, { value: string }] = interpreter.operandStack.pop(
    ObjectType.Integer,
    ObjectType.String
  )
  interpreter.pushLiteral(string.get(index), ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const [{ value: newValue }, { value: index }, { value: string }] =
    interpreter.operandStack.pop(
      ObjectType.Integer,
      ObjectType.Integer,
      ObjectType.String
    )
  string.set(index, newValue)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=613
export function getInterval(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Integer, ObjectType.Integer, ObjectType.String],
    ([count, index, string]) => {
      if (
        index.value < 0 ||
        count.value < 0 ||
        index.value + count.value > string.value.length
      ) {
        throw new RangeCheckError()
      }
      interpreter.pushLiteral(
        PSString.fromCharCode(
          ...string.value.data.slice(index.value, index.value + count.value)
        ),
        ObjectType.String
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=650
export function putInterval(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.Integer, ObjectType.String],
    ([source, index, target]) => {
      if (index.value < 0) {
        throw new RangeCheckError()
      }

      if (target.value.length < source.value.length + index.value) {
        throw new RangeCheckError()
      }

      target.value.data.splice(
        index.value,
        source.value.length,
        ...source.value.data
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=562
export function copy(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.String],
    ([source, target]) => {
      if (!(target.value.length < source.value.length)) {
        throw new RangeCheckError()
      }

      const removed = target.value.data.splice(
        0,
        source.value.length,
        ...source.value.data
      )
      interpreter.pushLiteral(
        PSString.fromCharCode(...removed),
        ObjectType.String
      )
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PSInterpreter) {
  const [proc, string] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.String
  )
  interpreter.beginLoop(
    new StringForAllLoopContext(
      interpreter,
      proc,
      interpreter.operandStack,
      string
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=543
export function anchorSearch(interpreter: PSInterpreter) {
  const [needle, haystack] = interpreter.operandStack.pop(
    ObjectType.String,
    ObjectType.String
  )
  const matches = haystack.value.anchorSearch(needle.value)
  if (!matches) {
    interpreter.operandStack.push(haystack)
    interpreter.pushLiteral(false, ObjectType.Boolean)
    return
  }
  const match = haystack.value.subString(0, needle.value.length)
  const post = haystack.value.subString(needle.value.length)
  interpreter.pushLiteral(post, ObjectType.String)
  interpreter.pushLiteral(match, ObjectType.String)
  interpreter.pushLiteral(true, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=669
export function search(interpreter: PSInterpreter) {
  const [needle, haystack] = interpreter.operandStack.pop(
    ObjectType.String,
    ObjectType.String
  )
  const matchIndex = haystack.value.search(needle.value)
  if (matchIndex === false) {
    interpreter.operandStack.push(haystack)
    interpreter.pushLiteral(false, ObjectType.Boolean)
    return
  }
  const pre = haystack.value.subString(0, matchIndex)
  const match = haystack.value.subString(matchIndex, needle.value.length)
  const post = haystack.value.subString(matchIndex + needle.value.length)
  interpreter.pushLiteral(post, ObjectType.String)
  interpreter.pushLiteral(match, ObjectType.String)
  interpreter.pushLiteral(pre, ObjectType.String)
  interpreter.pushLiteral(true, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=716
export function token(interpreter: PSInterpreter) {
  const [string] = interpreter.operandStack.pop(ObjectType.String)
  const jsString = string.value.asString()
  const lexer = new PSLexer(new CharStream(jsString))
  const scanner = new PSScanner(lexer)
  scanner.interpreter = interpreter
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
