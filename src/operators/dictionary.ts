import { PSDictionary } from '../dictionary/dictionary'
import { PSInterpreter } from '../interpreter'
import { DictionaryForAllLoopContext } from '../execution-contexts/loop-context'
import { Access, Executability, ObjectType } from '../scanner'

const MAX_DICT_CAPACITY = 1024

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=586
export function dict(interpreter: PSInterpreter) {
  const { value: capacity } = interpreter.pop(ObjectType.Integer)
  if (capacity > MAX_DICT_CAPACITY) {
    throw new Error(
      `${capacity} is higher than the max capacity of ${MAX_DICT_CAPACITY}`
    )
  }
  const dictionary = new PSDictionary(capacity)
  interpreter.pushLiteral(dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function startDict(interpreter: PSInterpreter) {
  interpreter.pushLiteral(undefined, ObjectType.Mark)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function endDict(interpreter: PSInterpreter) {
  const mark = interpreter.findIndexOfMark()
  if (mark === undefined) {
    throw new Error('>>: Missing mark on stack')
  }
  const elements = interpreter.operandStack.splice(mark + 1)
  interpreter.operandStack.pop() // pop mark
  if (elements.length % 2 !== 0) {
    throw new Error('Dictionary entries must be key-value pairs')
  }
  const dictionary = new PSDictionary(elements.length / 2)
  for (let i = 0; i < elements.length; i += 2) {
    dictionary.set(elements[i], elements[i + 1])
  }
  interpreter.pushLiteral(dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=635
export function length(interpreter: PSInterpreter) {
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.pushLiteral(dictionary.size, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=640
export function maxLength(interpreter: PSInterpreter) {
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  // Language level 1: return capacity
  interpreter.pushLiteral(dictionary.capacity, ObjectType.Integer)
  // TODO: Language level 2 + 3: return current length
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=550
export function begin(interpreter: PSInterpreter) {
  const dictionary = interpreter.pop(ObjectType.Dictionary)
  interpreter.dictionaryStack.push(dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=591
export function end(interpreter: PSInterpreter) {
  if (interpreter.dictionaryStack.length === 0) {
    throw new Error('end: Popping empty dictionary stack')
  }
  interpreter.dictionaryStack.pop()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=582
export function def(interpreter: PSInterpreter) {
  const procedure = interpreter.pop(ObjectType.Any)
  const name = interpreter.pop(ObjectType.Any)
  if (interpreter.dictionary.attributes.access !== Access.Unlimited) {
    throw new Error('Attempting to write to readonly dictionary')
  }
  interpreter.dictionary.value.set(name, procedure)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function load(interpreter: PSInterpreter) {
  const name = interpreter.pop(ObjectType.Any)
  const element = interpreter.dictionary.value.get(name)
  if (element === undefined) {
    throw new Error('Unknown get in dictionary load')
  }
  interpreter.operandStack.push(element)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=712
export function store(interpreter: PSInterpreter) {
  const value = interpreter.pop(ObjectType.Any)
  const key = interpreter.pop(ObjectType.Any)
  if (interpreter.dictionary.attributes.access !== Access.Unlimited) {
    throw new Error('Attempting to write to readonly dictionary')
  }
  interpreter.dictionary.value.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.operandStack.push(dictionary.get(key)!)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const value = interpreter.pop(ObjectType.Any)
  const key = interpreter.pop(ObjectType.Any)
  const dictionary = interpreter.pop(ObjectType.Dictionary)
  if (dictionary.attributes.access !== Access.Unlimited) {
    throw new Error('Attempting to write to readonly dictionary')
  }
  dictionary.value.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=722
export function undef(interpreter: PSInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const dictionary = interpreter.pop(ObjectType.Dictionary)
  if (dictionary.attributes.access !== Access.Unlimited) {
    throw new Error('Attempting to write to readonly dictionary')
  }
  dictionary.value.remove(key)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function known(interpreter: PSInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  const { value: dictionary } = interpreter.pop(ObjectType.Dictionary)
  interpreter.pushLiteral(dictionary.has(key), ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function where(interpreter: PSInterpreter) {
  const key = interpreter.pop(ObjectType.Any)
  for (let i = interpreter.dictionaryStack.length - 1; i >= 0; --i) {
    const currentDictionary = interpreter.dictionaryStack[i]
    if (currentDictionary.value.has(key)) {
      interpreter.operandStack.push(currentDictionary)
      interpreter.pushLiteral(true, ObjectType.Boolean)
      return
    }
  }
  interpreter.pushLiteral(false, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=611
export function forall(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const dictionary = interpreter.pop(ObjectType.Dictionary)
  interpreter.beginLoop(
    new DictionaryForAllLoopContext(
      interpreter,
      proc,
      interpreter.operandStack,
      dictionary
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=569
export function currentDict(interpreter: PSInterpreter) {
  interpreter.operandStack.push(interpreter.dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=727
export function userDict(interpreter: PSInterpreter) {
  const dict = interpreter.dictionaryStack[1]
  if (!dict) {
    throw new Error('Unable to find user dictionary')
  }
  interpreter.operandStack.push(dict)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=615
export function globalDict() {
  throw new Error('globaldict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=710
export function statusDict(_interpreter: PSInterpreter) {
  throw new Error('statusdict: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=565
export function countDictStack(interpreter: PSInterpreter) {
  interpreter.pushLiteral(
    interpreter.dictionaryStack.length,
    ObjectType.Integer
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=587
export function dictStack(interpreter: PSInterpreter) {
  const { value: array } = interpreter.pop(ObjectType.Array)
  if (array.length < interpreter.dictionaryStack.length) {
    // TODO: rangecheck error
    throw new Error('Not enough space in array')
  }
  const n = interpreter.dictionaryStack.length
  for (let i = 0; i < n; ++i) {
    array.set(i, {
      value: interpreter.dictionaryStack[i],
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
export function cleardictstack(interpreter: PSInterpreter) {
  // TODO: Can we do interpreter less magically?
  interpreter.dictionaryStack.slice(2)
}
