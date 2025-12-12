import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=667
export function save(interpreter: PSInterpreter) {
  // TODO: Implement
  interpreter.pushLiteral(1, ObjectType.Integer)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=662
export function restore(interpreter: PSInterpreter) {
  interpreter.operandStack.pop(ObjectType.Any)
  // TODO: Implement
}
