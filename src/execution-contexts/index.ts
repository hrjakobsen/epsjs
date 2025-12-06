import { PSInterpreter } from '../interpreter'
import { Executability, ObjectType, PSObject } from '../scanner'

export abstract class ExecutionContext {
  constructor(
    protected interpreter: PSInterpreter,
    protected procedure: PSObject<ObjectType.Array>
  ) {
    if (
      procedure.type !== ObjectType.Array ||
      procedure.attributes.executability !== Executability.Executable
    ) {
      throw new Error('Invalid loop procedure body')
    }
  }

  public abstract finished(): boolean

  public exit() {
    const selfIndex = this.interpreter.executionStack.indexOf(this)
    this.interpreter.executionStack.splice(selfIndex)
  }

  public abstract execute(): void
}
