import { PSInterpreter } from '../interpreter'
import {
  ForLoopContext,
  InfiteLoopContext,
  RepeatLoopContext,
} from '../execution-contexts/loop-context'
import { Executability, ObjectType, PSObject } from '../scanner'
import { ProcedureContext } from '../execution-contexts/procedure-context'
import { StoppedContext } from '../execution-contexts/stopped-context'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=596
export function exec(interpreter: PSInterpreter) {
  const obj = interpreter.pop(ObjectType.Any)
  if (
    obj.type === ObjectType.Array &&
    obj.attributes.executability === Executability.Executable
  ) {
    interpreter.executionStack.push(
      new ProcedureContext(
        interpreter,
        obj as unknown as PSObject<ObjectType.Array>
      )
    )
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
    interpreter.executionStack.push(
      new ProcedureContext(interpreter, procedure)
    )
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
    throw new Error('Second or third argument to if is not a procedure')
  }
  if (bool) {
    interpreter.executionStack.push(
      new ProcedureContext(interpreter, procedureTrue)
    )
  } else {
    interpreter.executionStack.push(
      new ProcedureContext(interpreter, procedureFalse)
    )
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
export function stop(interpreter: PSInterpreter) {
  let index = 0
  for (let i = interpreter.executionStack.length - 1; i >= 0; --i) {
    if (interpreter.executionStack[i] instanceof StoppedContext) {
      index = i
      break
    }
  }
  interpreter.executionStack.splice(index)
  interpreter.pushLiteral(true, ObjectType.Boolean)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=711
export function stopped(interpreter: PSInterpreter) {
  interpreter.executionStack.push(new StoppedContext(interpreter))
  exec(interpreter)
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
