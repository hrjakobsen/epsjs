import { PostScriptInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { PostScriptString } from '../string'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=552
export function bind(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  // TODO: implement recursive binding
  interpreter.operandStack.push(proc)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=644
export const NULL_OBJECT = createLiteral(null, ObjectType.Null)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=730
export const VERSION_OBJECT = createLiteral(
  PostScriptString.fromString('0.0.1'),
  ObjectType.String
)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=655
export function realtime(interpreter: PostScriptInterpreter) {
  interpreter.operandStack.push(createLiteral(Date.now(), ObjectType.Integer))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=728
export function usertime(interpreter: PostScriptInterpreter) {
  interpreter.operandStack.push(
    createLiteral(performance.now(), ObjectType.Integer)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=634
export const LANGUAGE_LEVEL_OBJECT = createLiteral(3, ObjectType.Integer)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=648
export const PRODUCT_NAME_OBJECT = createLiteral(
  PostScriptString.fromString('epsjs'),
  ObjectType.String
)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=663
export const REVISION_OBJECT = createLiteral(1, ObjectType.Integer)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=671
export const SERIAL_NUMBER_OBJECT = createLiteral(-1, ObjectType.Integer)
