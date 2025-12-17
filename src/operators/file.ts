import { InvalidAccessError, IoError, PSError } from '../error'
import { ExecutionContext } from '../execution-contexts'
import { Ascii85DecodeFilter, FileAccess, fileAccessFromString } from '../file'
import { PSInterpreter } from '../interpreter'
import { Executability, ObjectType, PSObject } from '../scanner'
import { createLiteral } from '../utils'
import { convertToString } from './type-attribute-conversion'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrint(interpreter: PSInterpreter) {
  const [obj] = interpreter.operandStack.pop(ObjectType.Any)
  // eslint-disable-next-line no-console
  console.log(convertToString(obj))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrintObject(interpreter: PSInterpreter) {
  const [obj] = interpreter.operandStack.pop(ObjectType.Any)
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
export function readstring(interpreter: PSInterpreter) {
  const [{ value: target }, { value: file }] = interpreter.operandStack.pop(
    ObjectType.String,
    ObjectType.File
  )
  const result = file.readString(target)
  interpreter.operandStack.push(
    createLiteral(result.substring, ObjectType.String),
    createLiteral(result.success, ObjectType.Boolean)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=653
export function read(interpreter: PSInterpreter) {
  const [{ value: file }] = interpreter.operandStack.pop(ObjectType.File)
  if (file.isAtEndOfFile()) {
    interpreter.operandStack.push(createLiteral(false, ObjectType.Boolean))
    // TODO: Close file?
  } else {
    const result = file.read()!
    interpreter.operandStack.push(createLiteral(true, ObjectType.Boolean))
    interpreter.operandStack.push(createLiteral(result, ObjectType.Integer))
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=653
export function readhexstring(interpreter: PSInterpreter) {
  const [{ value: target }, { value: file }] = interpreter.operandStack.pop(
    ObjectType.String,
    ObjectType.File
  )
  const result = file.readHexString(target)
  interpreter.operandStack.push(
    createLiteral(result.substring, ObjectType.String),
    createLiteral(result.success, ObjectType.Boolean)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=603
export function filter(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Name, ObjectType.File],
    ([name, input]) => {
      const { value: inputFile } = input
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
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=570
export function currentFile(interpreter: PSInterpreter) {
  const files = interpreter.executionStack.filter(
    (x) => !(x instanceof ExecutionContext) && x.type === ObjectType.File
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
export async function run(interpreter: PSInterpreter) {
  const [pathObj] = interpreter.operandStack.pop(ObjectType.String)
  try {
    const path = pathObj.value.asString()
    if (!interpreter.fs.exists(path)) {
      throw new IoError()
    }
    const file = await interpreter.fs.getFile(path)
    interpreter.pushFileToExecutionStack(file)
  } catch (error) {
    if (error instanceof PSError) {
      interpreter.operandStack.push(pathObj)
    }
    throw error
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=601
export function file(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.String],
    ([access, filename]) => {
      const accessModifier = fileAccessFromString(access.value.asString())
      if (filename.value.asString() === '%stdin') {
        if (accessModifier !== FileAccess.Read) {
          throw new InvalidAccessError()
        }
        interpreter.operandStack.push(
          createLiteral(interpreter.stdin, ObjectType.File)
        )
        return
      }

      if (filename.value.asString() === '%stdout') {
        if (accessModifier !== FileAccess.Write) {
          throw new InvalidAccessError()
        }
        interpreter.operandStack.push(
          createLiteral(interpreter.stdout, ObjectType.File)
        )
        return
      }

      return new Error('Unimplemented creation of new files')
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=734
export function write(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.Integer, ObjectType.File],
    ([character, file]) => {
      file.value.write(character.value)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=734
export function writehexstring(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.File],
    ([character, file]) => {
      file.value.writeHexString(character.value)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=735
export function writestring(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped(
    [ObjectType.String, ObjectType.File],
    ([character, file]) => {
      file.value.writeString(character.value)
    }
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=647
export function print(interpreter: PSInterpreter) {
  interpreter.operandStack.withPopped([ObjectType.String], ([string]) => {
    interpreter.stdout.writeString(string.value)
  })
}

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
