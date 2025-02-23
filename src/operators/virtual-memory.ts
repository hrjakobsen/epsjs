import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=667
export function save(interpreter: PostScriptInterpreter) {
  // TODO: Implement
  interpreter.pushLiteral(1, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=662
export function restore(interpreter: PostScriptInterpreter) {
  interpreter.pop(ObjectType.Any)
  // TODO: Implement
}
