import { PostScriptDictionary } from '../dictionary/dictionary'
import { PostScriptInterpreter } from '../interpreter'
import { DictionaryForAllLoopContext } from '../loop-context'
import { Access, Executability, ObjectType } from '../scanner'

const MAX_DICT_CAPACITY = 1024

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=586
export function dict(interpreter: PostScriptInterpreter) {
  const { value: capacity } = interpreter.pop(ObjectType.Integer)
  if (capacity > MAX_DICT_CAPACITY) {
    throw new Error(
      `${capacity} is higher than the max capacity of ${MAX_DICT_CAPACITY}`
    )
  }
  const dictionary = new PostScriptDictionary(false, capacity)
  interpreter.pushLiteral(dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function startDict(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(undefined, ObjectType.Mark)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function endDict(interpreter: PostScriptInterpreter) {
  const mark = interpreter.findIndexOfMark()
  if (mark === undefined) {
    throw new Error('>>: Missing mark on stack')
  }
  const elements = interpreter.operandStack.splice(mark + 1)
  interpreter.operandStack.pop() // pop mark
  if (elements.length % 2 !== 0) {
    throw new Error('Dictionary entries must be key-value pairs')
  }
  const dictionary = new PostScriptDictionary(false, elements.length / 2)
  for (let i = 0; i < elements.length; i += 2) {
    dictionary.set(elements[i]!, elements[i + 1]!)
  }
  interpreter.pushLiteral(dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=635
export function length(interpreter: PostScriptInterpreter) {
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.pushLiteral(dictionary.size, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=640
export function maxLength(interpreter: PostScriptInterpreter) {
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  // Language level 1: return capacity
  interpreter.pushLiteral(dictionary.capacity, ObjectType.Integer)
  // TODO: Language level 2 + 3: return current length
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=550
export function begin(interpreter: PostScriptInterpreter) {
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.dictionaryStack.push(dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=591
export function end(interpreter: PostScriptInterpreter) {
  if (interpreter.dictionaryStack.length === 0) {
    throw new Error('end: Popping empty dictionary stack')
  }
  interpreter.dictionaryStack.pop()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=582
export function def(interpreter: PostScriptInterpreter) {
  const procedure = interpreter.pop(ObjectType.Any)
  const name = interpreter.pop(ObjectType.Any)
  interpreter.dictionary.set(name, procedure)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function load(interpreter: PostScriptInterpreter) {
  const name = interpreter.pop(ObjectType.Any)
  const element = interpreter.dictionary.get(name)
  if (element === undefined) {
    throw new Error('Unknown get in dictionary load')
  }
  interpreter.operandStack.push(element)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=712
export function store(interpreter: PostScriptInterpreter) {
  const value = interpreter.pop(ObjectType.Any)
  const key = interpreter.pop(ObjectType.Any)
  interpreter.dictionary.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PostScriptInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.operandStack.push(dictionary.get(key)!)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PostScriptInterpreter) {
  const value = interpreter.pop(ObjectType.Any)
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  dictionary.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=722
export function undef(interpreter: PostScriptInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  dictionary.remove(key)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function known(interpreter: PostScriptInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.pushLiteral(dictionary.has(key), ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function where(interpreter: PostScriptInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  for (let i = interpreter.dictionaryStack.length - 1; i >= 0; --i) {
    const currentDictionary = interpreter.dictionaryStack[i]!
    if (currentDictionary.has(key)) {
      // TODO: Should we have a single object for a dictionary, in case
      // someone dups and changes access?
      interpreter.pushLiteral(currentDictionary, ObjectType.Dictionary)
      interpreter.pushLiteral(true, ObjectType.Boolean)
      return
    }
  }
  interpreter.pushLiteral(false, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const dictionary = interpreter.pop(ObjectType.Dictionary)
  interpreter.beginLoop(
    new DictionaryForAllLoopContext(
      interpreter.executionStack,
      proc,
      interpreter.operandStack,
      dictionary
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=569
export function currentDict(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(interpreter.dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=595
export function errorDict(_interpreter: PostScriptInterpreter) {
  throw new Error('errordict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=541
export function error(_interpreter: PostScriptInterpreter) {
  throw new Error('errordict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=716
export function systemDict(_interpreter: PostScriptInterpreter) {
  throw new Error('systemdict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=727
export function userDict(_interpreter: PostScriptInterpreter) {
  throw new Error('userdict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=615
export function globalDict() {
  throw new Error('globaldict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=710
export function statusDict(_interpreter: PostScriptInterpreter) {
  throw new Error('statusdict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=565
export function countDictStack(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteral(
    interpreter.dictionaryStack.length,
    ObjectType.Integer
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=587
export function dictStack(interpreter: PostScriptInterpreter) {
  const { value: array } = interpreter.pop(ObjectType.Array)
  if (array.length < interpreter.dictionaryStack.length) {
    // TODO: rangecheck error
    throw new Error('Not enough space in array')
  }
  const n = interpreter.dictionaryStack.length
  for (let i = 0; i < n; ++i) {
    array.set(i, {
      value: interpreter.dictionaryStack[i]!,
      type: ObjectType.Dictionary,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
  }
  // TODO: The pushed array should only contain n elements
  interpreter.pushLiteral(array, ObjectType.Array)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=555
export function cleardictstack(interpreter: PostScriptInterpreter) {
  // TODO: Can we do interpreter less magically?
  interpreter.dictionaryStack.slice(2)
}
