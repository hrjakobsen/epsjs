import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'
import { PSString } from '../string'
import { createLiteral } from '../utils'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=552
export function bind(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  // TODO: implement recursive binding
  interpreter.operandStack.push(proc)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=644
export const NULL_OBJECT = createLiteral(null, ObjectType.Null)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=730
export const VERSION_OBJECT = createLiteral(
  PSString.fromString('0.0.1'),
  ObjectType.String
)

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

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=634
export const LANGUAGE_LEVEL_OBJECT = createLiteral(3, ObjectType.Integer)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=648
export const PRODUCT_NAME_OBJECT = createLiteral(
  PSString.fromString('epsjs'),
  ObjectType.String
)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=663
export const REVISION_OBJECT = createLiteral(1, ObjectType.Integer)

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=671
export const SERIAL_NUMBER_OBJECT = createLiteral(-1, ObjectType.Integer)
