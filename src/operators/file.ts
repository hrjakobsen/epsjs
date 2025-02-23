import { Ascii85DecodeFilter } from '../file'
import { PostScriptInterpreter } from '../interpreter'
import { Executability, ObjectType } from '../scanner'
import { createLiteral, prettyPrint } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrint(interpreter: PostScriptInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  // eslint-disable-next-line no-console
  console.log(prettyPrint(obj))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
export function debugPrintObject(interpreter: PostScriptInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  // eslint-disable-next-line no-console
  console.log(obj)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=706
export function stack(interpreter: PostScriptInterpreter) {
  // eslint-disable-next-line no-console
  console.log(interpreter.operandStack.map(prettyPrint))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=649
export function pstack(interpreter: PostScriptInterpreter) {
  // eslint-disable-next-line no-console
  console.log(interpreter.operandStack)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=655
export function readString(interpreter: PostScriptInterpreter) {
  const { value: target } = interpreter.pop(ObjectType.String)
  const { value: file } = interpreter.pop(ObjectType.File)

  const result = file.readString(target)
  interpreter.operandStack.push(
    createLiteral(result.substring, ObjectType.String),
    createLiteral(result.success, ObjectType.Boolean)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=603
export function filter(interpreter: PostScriptInterpreter) {
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
export function currentFile(interpreter: PostScriptInterpreter) {
  const files = interpreter.executionStack.filter(
    (x) => x.type === ObjectType.File
  )
  if (files.length === 0) {
    throw new Error('No current file')
  }
  interpreter.operandStack.push(
    createLiteral(files[files.length - 1]!.value, ObjectType.File)
  )
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
// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=667
// run
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

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=704
export function show(interpreter: PostScriptInterpreter) {
  const { value: string } = interpreter.pop(ObjectType.String)
  interpreter.printer.fillText(
    string.asString(),
    interpreter.printer.getCurrentPoint()
  )
}
