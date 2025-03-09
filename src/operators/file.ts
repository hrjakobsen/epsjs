import { Ascii85DecodeFilter } from '../file'
import { PSInterpreter } from '../interpreter'
import { LoopContext } from '../loop-context'
import { Executability, ObjectType, PSObject } from '../scanner'
import { createLiteral } from '../utils'
import { convertToString } from './type-attribute-conversion'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrint(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  // eslint-disable-next-line no-console
  console.log(convertToString(obj))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrintObject(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  // eslint-disable-next-line no-console
  console.log(deepPrint(obj, interpreter))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=706
export function stack(interpreter: PSInterpreter) {
  // eslint-disable-next-line no-console
  console.log(interpreter.operandStack.map((op) => deepPrint(op, interpreter)))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function pstack(interpreter: PSInterpreter) {
  // eslint-disable-next-line no-console
  console.log(interpreter.operandStack)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=655
export function readString(interpreter: PSInterpreter) {
  const { value: target } = interpreter.pop(ObjectType.String)
  const { value: file } = interpreter.pop(ObjectType.File)

  const result = file.readString(target)
  interpreter.operandStack.push(
    createLiteral(result.substring, ObjectType.String),
    createLiteral(result.success, ObjectType.Boolean)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=603
export function filter(interpreter: PSInterpreter) {
  const name = interpreter.pop(ObjectType.Name)
  const { value: inputFile } = interpreter.pop(ObjectType.File)
  if (name.attributes.executability !== Executability.Literal) {
    throw new Error('filter: Must be a literal name')
  }
  if (name.value !== 'ASCII85Decode') {
    throw new Error(`Unsupported filter: ${name.value}`)
  }
  interpreter.operandStack.push(
    createLiteral(new Ascii85DecodeFilter(inputFile), ObjectType.File)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=570
export function currentFile(interpreter: PSInterpreter) {
  const files = interpreter.executionStack.filter(
    (x) => !(x instanceof LoopContext) && x.type === ObjectType.File
  ) as PSObject[]
  if (files.length === 0) {
    throw new Error('No current file')
  }
  const currentFile = files[files.length - 1]
  if (currentFile?.type !== ObjectType.File) {
    throw new Error('No current file')
  }
  interpreter.operandStack.push(
    createLiteral(
      (currentFile as PSObject<ObjectType.File>).value,
      ObjectType.File
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=667
export function run(interpreter: PSInterpreter) {
  const path = interpreter.pop(ObjectType.String).value.asString()
  if (!interpreter.fs.exists(path)) {
    throw new Error(`${path} does not exist`)
  }
  const file = interpreter.fs.getFile(path)
  interpreter.pushFileToExecutionStack(file)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=601
// 'file'
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=734
// write
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=558
// closefile
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=608
// flush
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=608
// flushfile
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=659
// resetfile

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=586
// deletefile
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=658
// renamefile
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=602
// filenameforall
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=647
// print
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=648
// printobject
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=735
// writeobject
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=691
// setobjectformat
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=574
// currentobjectformat

function deepPrint(obj: PSObject<unknown>, interpreter: PSInterpreter): string {
  if (
    obj.type === ObjectType.Name &&
    obj.attributes.executability === Executability.Executable
  ) {
    const sub = interpreter.symbolLookup(obj)
    obj = sub ?? obj
  }

  const mapper = (mappee: PSObject<unknown>) => deepPrint(mappee, interpreter)
  const executable = obj.attributes.executability === Executability.Executable

  switch (obj.type) {
    case ObjectType.FontID:
      return '-font-'
    case ObjectType.Mark:
      return '-mark-'
    case ObjectType.Operator:
      return `--${(obj as PSObject<ObjectType.Operator>).value.name}--`
    case ObjectType.Array:
      return (
        (executable ? '{' : '[') +
        ` ${(obj as PSObject<ObjectType.Array>).value
          .map(mapper)
          .join(', ')} ` +
        (executable ? '}' : ']')
      )
    case ObjectType.Dictionary:
      return '--dict--'
    case ObjectType.File:
      return '-file-'
    case ObjectType.GState:
      return '-gstate-'
    case ObjectType.PackedArray:
      return '-packedarray-'
    case ObjectType.Save:
      return '-save-'
    case ObjectType.String:
      return '(' + (obj as PSObject<ObjectType.String>).value.asString() + ')'
    case ObjectType.Null:
      return 'null'
    case ObjectType.Real:
    case ObjectType.Integer:
      return String(obj.value)
    case ObjectType.Name:
      return '/' + String(obj.value)
    case ObjectType.Boolean:
      return (obj as PSObject<ObjectType.Boolean>).value ? 'true' : 'false'
  }
  return ''
}
