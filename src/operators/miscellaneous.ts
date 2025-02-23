import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=552
export function bind(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  // TODO: implement recursive binding
  interpreter.operandStack.push(proc)
}
