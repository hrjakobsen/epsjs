import { PSInterpreter } from '../interpreter'
import { ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=714
export function stroke(interpreter: PSInterpreter) {
  interpreter.printer.stroke()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=603
export function fill(interpreter: PSInterpreter) {
  interpreter.printer.fill()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=594
export function eofill(interpreter: PSInterpreter) {
  interpreter.printer.eofill()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=657
export function rectstroke(interpreter: PSInterpreter) {
  const [{ value: height }, { value: width }, { value: y }, { value: x }] =
    interpreter.operandStack.pop(
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real
    )
  interpreter.printer.strokeRect({ x, y }, width, height)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=656
export function rectfill(interpreter: PSInterpreter) {
  const [{ value: height }, { value: width }, { value: y }, { value: x }] =
    interpreter.operandStack.pop(
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real,
      ObjectType.Integer | ObjectType.Real
    )
  interpreter.printer.fillRect({ x, y }, width, height)
}
