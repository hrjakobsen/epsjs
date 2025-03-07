import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=552
export function bind(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  // TODO: implement recursive binding
  interpreter.operandStack.push(proc)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=644
export const NULL_OBJECT = createLiteral(null, ObjectType.Null)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=655
export function realtime(interpreter: PSInterpreter) {
  interpreter.operandStack.push(createLiteral(Date.now(), ObjectType.Integer))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=728
export function usertime(interpreter: PSInterpreter) {
  interpreter.operandStack.push(
    createLiteral(performance.now(), ObjectType.Integer)
  )
}
