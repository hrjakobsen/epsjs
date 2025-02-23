import { PostScriptInterpreter } from '../interpreter'
import {
  ForLoopContext,
  InfiteLoopContext,
  RepeatLoopContext,
} from '../loop-context'
import { Executability, ObjectType } from '../scanner'

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=596
export function exec(_interpreter: PostScriptInterpreter) {
  throw new Error('exec: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=620
export function _if(interpreter: PostScriptInterpreter) {
  const procedure = interpreter.pop(ObjectType.Array)
  const { value: bool } = interpreter.pop(ObjectType.Boolean)

  if (procedure.attributes.executability === Executability.Literal) {
    throw new Error('Second argument to if is not a procedure')
  }
  if (bool) {
    interpreter.executionStack.push({
      ...procedure,
      value: procedure.value.copy(),
    })
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=621
export function ifelse(interpreter: PostScriptInterpreter) {
  const procedureFalse = interpreter.pop(ObjectType.Array)
  const procedureTrue = interpreter.pop(ObjectType.Array)
  const { value: bool } = interpreter.pop(ObjectType.Boolean)
  if (
    procedureTrue.attributes.executability === Executability.Literal ||
    procedureFalse.attributes.executability === Executability.Literal
  ) {
    throw new Error('Second argument to if is not a procedure')
  }
  if (bool) {
    interpreter.executionStack.push({
      ...procedureTrue,
      value: procedureTrue.value.copy(),
    })
  } else {
    interpreter.executionStack.push({
      ...procedureFalse,
      value: procedureFalse.value.copy(),
    })
  }
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=610
export function _for(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const limit = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const increment = interpreter.pop(ObjectType.Integer | ObjectType.Real)
  const initial = interpreter.pop(ObjectType.Integer | ObjectType.Real)

  interpreter.beginLoop(
    new ForLoopContext(
      interpreter.executionStack,
      proc,
      interpreter.operandStack,
      initial,
      increment,
      limit
    )
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=659
export function repeat(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  const iterations = interpreter.pop(ObjectType.Integer)
  interpreter.beginLoop(
    new RepeatLoopContext(interpreter.executionStack, proc, iterations)
  )
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=637
export function loop(interpreter: PostScriptInterpreter) {
  const proc = interpreter.pop(ObjectType.Array)
  interpreter.beginLoop(new InfiteLoopContext(interpreter.executionStack, proc))
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=599
export function exit(interpreter: PostScriptInterpreter) {
  if (interpreter.activeLoop === undefined) {
    throw new Error('exit: No current loop')
  }
  interpreter.activeLoop.exit()
  interpreter.loopStack.pop()
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=711
export function stop(_interpreter: PostScriptInterpreter) {
  throw new Error('stop: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=711
export function stopped(_interpreter: PostScriptInterpreter) {
  throw new Error('stopped: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=565
export function countExecStack(interpreter: PostScriptInterpreter) {
  interpreter.pushLiteralNumber(interpreter.executionStack.length)
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=597
export function execStack(_interpreter: PostScriptInterpreter) {
  throw new Error('execstack: Not implemented')
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=651
export function quit(interpreter: PostScriptInterpreter) {
  interpreter.stopped = true
}

// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=707
export function start(_interpreter: PostScriptInterpreter) {}
