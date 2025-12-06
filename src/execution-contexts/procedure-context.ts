import { ProcedureBackedExecutionContext } from '.'
import { PSInterpreter } from '../interpreter'
import { ObjectType, PSObject } from '../scanner'

export class ProcedureContext extends ProcedureBackedExecutionContext {
  private index = 0
  constructor(
    interpreter: PSInterpreter,
    procedure: PSObject<ObjectType.Array>
  ) {
    super(interpreter, procedure)
    this.index = 0
  }

  public override finished(): boolean {
    return this.index >= this.procedure.value.length
  }

  public override execute(): void {
    const item = this.procedure.value.get(this.index++)
    this.interpreter.executionStack.push(item)
  }
}
