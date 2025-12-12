import { PSDictionary } from '../dictionary/dictionary'
import { PSInterpreter } from '../interpreter'
import { DictionaryForAllLoopContext } from '../execution-contexts/loop-context'
import { Access, Executability, ObjectType } from '../scanner'
import { InvalidAccessError, RangeCheckError } from '../error'

const MAX_DICT_CAPACITY = 1024

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=586
export function dict(interpreter: PSInterpreter) {
  const [capacity] = interpreter.operandStack.pop(ObjectType.Integer)
  if (capacity.value > MAX_DICT_CAPACITY) {
    interpreter.operandStack.push(capacity)
    throw new Error(
      `${capacity} is higher than the max capacity of ${MAX_DICT_CAPACITY}`
    )
  }
  const dictionary = new PSDictionary(capacity.value)
  interpreter.pushLiteral(dictionary, ObjectType.Dictionary)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function startDict(interpreter: PSInterpreter) {
  interpreter.pushLiteral(undefined, ObjectType.Mark)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
export function endDict(interpreter: PSInterpreter) {
  const elements = interpreter.operandStack.popMarked()
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
  const [dictionary] = interpreter.operandStack.pop(ObjectType.Dictionary)
  interpreter.pushLiteral(dictionary.value.size, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=640
export function maxLength(interpreter: PSInterpreter) {
  const [dictionary] = interpreter.operandStack.pop(ObjectType.Dictionary)
  // Language level 1: return capacity
  interpreter.pushLiteral(dictionary.value.capacity, ObjectType.Integer)
  // TODO: Language level 2 + 3: return current length
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=550
export function begin(interpreter: PSInterpreter) {
  const [dictionary] = interpreter.operandStack.pop(ObjectType.Dictionary)
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
  const [procedure, name] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Any
  )
  if (interpreter.dictionary.attributes.access !== Access.Unlimited) {
    interpreter.operandStack.push(name, procedure)
    throw new Error('Attempting to write to readonly dictionary')
  }
  interpreter.dictionary.value.set(name, procedure)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=636
export function load(interpreter: PSInterpreter) {
  const [name] = interpreter.operandStack.pop(ObjectType.Any)
  const element = interpreter.dictionary.value.get(name)
  if (element === undefined) {
    interpreter.operandStack.push(name)
    throw new InvalidAccessError()
  }
  interpreter.operandStack.push(element)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=712
export function store(interpreter: PSInterpreter) {
  const [value, key] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Any
  )
  if (interpreter.dictionary.attributes.access !== Access.Unlimited) {
    interpreter.operandStack.push(key, value)
    throw new Error('Attempting to write to readonly dictionary')
  }
  interpreter.dictionary.value.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=612
export function get(interpreter: PSInterpreter) {
  const [key, dictionary] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Dictionary
  )
  const value = dictionary.value.get(key)
  if (value === undefined) {
    interpreter.operandStack.push(dictionary, key)
    throw new InvalidAccessError()
  }
  interpreter.operandStack.push(value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function put(interpreter: PSInterpreter) {
  const [value, key, dictionary] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Any,
    ObjectType.Dictionary
  )
  if (dictionary.attributes.access !== Access.Unlimited) {
    interpreter.operandStack.push(dictionary, key, value)
    throw new Error('Attempting to write to readonly dictionary')
  }
  dictionary.value.set(key, value)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=722
export function undef(interpreter: PSInterpreter) {
  const [key, dictionary] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Dictionary
  )
  if (dictionary.attributes.access !== Access.Unlimited) {
    interpreter.operandStack.push(dictionary, key)
    throw new Error('Attempting to write to readonly dictionary')
  }
  dictionary.value.remove(key)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=633
export function known(interpreter: PSInterpreter) {
  const [key, dictionary] = interpreter.operandStack.pop(
    ObjectType.Any,
    ObjectType.Dictionary
  )
  interpreter.pushLiteral(dictionary.value.has(key), ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=732
export function where(interpreter: PSInterpreter) {
  const [key] = interpreter.operandStack.pop(ObjectType.Any)
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
  const [proc, dictionary] = interpreter.operandStack.pop(
    ObjectType.Array,
    ObjectType.Dictionary
  )
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
  const [array] = interpreter.operandStack.pop(ObjectType.Array)
  if (array.value.length < interpreter.dictionaryStack.length) {
    interpreter.operandStack.push(array)
    throw new RangeCheckError()
  }
  const n = interpreter.dictionaryStack.length
  for (let i = 0; i < n; ++i) {
    array.value.set(i, {
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
