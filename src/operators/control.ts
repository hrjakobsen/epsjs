import { PSInterpreter } from '../interpreter'
import {
  ForLoopContext,
  InfiteLoopContext,
  RepeatLoopContext,
} from '../loop-context'
import { Executability, ObjectType, PSObject } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=596
export function exec(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  if (
    obj.type === ObjectType.Array &&
    obj.attributes.executability === Executability.Executable
  ) {
    ;(obj as unknown as PSObject<ObjectType.Array>).value.execute(interpreter)
  } else {
    interpreter.executionStack.push(obj)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=620
export function _if(interpreter: PSInterpreter) {
  const procedure = interpreter.pop(ObjectType.Array)
  const { value: bool } = interpreter.pop(ObjectType.Boolean)

  if (procedure.attributes.executability !== Executability.Executable) {
    throw new Error('Second argument to if is not a procedure')
  }
  if (bool) {
    procedure.value.execute(interpreter)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=621
export function ifelse(interpreter: PSInterpreter) {
  const procedureFalse = interpreter.pop(ObjectType.Array)
  const procedureTrue = interpreter.pop(ObjectType.Array)
  const { value: bool } = interpreter.pop(ObjectType.Boolean)
  if (
    procedureTrue.attributes.executability !== Executability.Executable ||
    procedureFalse.attributes.executability !== Executability.Executable
  ) {
    throw new Error('Second argument to if is not a procedure')
  }
  if (bool) {
    procedureTrue.value.execute(interpreter)
  } else {
    procedureFalse.value.execute(interpreter)
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=610
export function _for(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const limit = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const increment = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const initial = interpreter.pop(ObjectType.Integer | ObjectType.Real)

  interpreter.beginLoop(
    new ForLoopContext(
      interpreter,
      proc,
      interpreter.operandStack,
      initial,
      increment,
      limit
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=659
export function repeat(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const iterations = interpreter.pop(ObjectType.Integer)
  interpreter.beginLoop(new RepeatLoopContext(interpreter, proc, iterations))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=637
export function loop(interpreter: PSInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  interpreter.beginLoop(new InfiteLoopContext(interpreter, proc))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=599
export function exit(interpreter: PSInterpreter) {
  if (interpreter.activeLoop === undefined) {
    throw new Error('exit: No current loop')
  }
  interpreter.activeLoop.exit()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=711
export function stop(_interpreter: PSInterpreter) {
  throw new Error('stop: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=711
export function stopped(_interpreter: PSInterpreter) {
  throw new Error('stopped: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=565
export function countExecStack(interpreter: PSInterpreter) {
  interpreter.pushLiteralNumber(interpreter.executionStack.length)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=597
export function execStack(_interpreter: PSInterpreter) {
  throw new Error('execstack: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=651
export function quit(interpreter: PSInterpreter) {
  interpreter.stopped = true
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=707
export function start(interpreter: PSInterpreter) {
  const initFile = interpreter.fs.getFile('init.ps')
  interpreter.pushFileToExecutionStack(initFile)
}
