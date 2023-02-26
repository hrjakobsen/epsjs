import { Executability, ObjectType, PostScriptObject } from './scanner'
import { createLiteral } from './utils'

export abstract class LoopContext {
  private executionStackStartIndex: number

  constructor(
    protected executionStack: PostScriptObject[],
    protected procedure: PostScriptObject
  ) {
    if (
      procedure.type !== ObjectType.Array ||
      procedure.attributes.executability !== Executability.Executable
    ) {
      throw new Error('Invalid loop procedure body')
    }
    this.executionStackStartIndex = executionStack.length
  }

  abstract finished(): boolean

  public exit() {
    this.executionStack.splice(this.executionStackStartIndex + 1)
  }

  public shouldExecute() {
    return (
      !this.finished() &&
      this.executionStack.length === this.executionStackStartIndex
    )
  }

  public abstract execute(): void
}

export class ForLoopContext extends LoopContext {
  private controlVariable: number
  private controlVariableType: ObjectType
  private increment: number
  private limit: number

  constructor(
    executionStack: PostScriptObject[],
    procedure: PostScriptObject,
    private operandStack: PostScriptObject[],
    initial: PostScriptObject,
    increment: PostScriptObject,
    limit: PostScriptObject
  ) {
    super(executionStack, procedure)
    if (!(initial.type & (ObjectType.Real | ObjectType.Integer))) {
      throw new Error('Loop invalid initial type')
    }
    if (!(increment.type & (ObjectType.Real | ObjectType.Integer))) {
      throw new Error('Loop invalid increment type')
    }
    if (!(limit.type & (ObjectType.Real | ObjectType.Integer))) {
      throw new Error('Loop invalid limit type')
    }

    this.controlVariable = initial.value
    this.increment = increment.value
    this.limit = limit.value

    if (
      initial.type === ObjectType.Real ||
      increment.type === ObjectType.Real ||
      limit.type === ObjectType.Real
    ) {
      this.controlVariableType = ObjectType.Real
    } else {
      this.controlVariableType = ObjectType.Integer
    }
  }

  finished(): boolean {
    if (this.increment >= 0) {
      return this.controlVariable > this.limit
    }
    return this.controlVariable < this.limit
  }

  public execute(): void {
    const procedureBody = [...this.procedure.value]
    procedureBody.reverse()
    this.operandStack.push(
      createLiteral(this.controlVariable, this.controlVariableType)
    )
    this.executionStack.push(...procedureBody)
    this.controlVariable += this.increment
  }
}
