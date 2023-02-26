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

  public abstract finished(): boolean

  public exit() {
    this.executionStack.splice(this.executionStackStartIndex + 1)
  }

  public isReadyToExecute() {
    return this.executionStack.length === this.executionStackStartIndex
  }

  public abstract execute(): void

  protected executeProcedure() {
    const procedureBody = [...this.procedure.value]
    procedureBody.reverse()
    this.executionStack.push(...procedureBody)
  }
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

  public override finished(): boolean {
    if (this.increment >= 0) {
      return this.controlVariable > this.limit
    }
    return this.controlVariable < this.limit
  }

  public override execute(): void {
    this.operandStack.push(
      createLiteral(this.controlVariable, this.controlVariableType)
    )
    this.executeProcedure()
    this.controlVariable += this.increment
  }
}

export class InfiteLoopContext extends LoopContext {
  public override finished(): boolean {
    return false
  }

  public override execute(): void {
    this.executeProcedure()
  }
}

export class RepeatLoopContext extends LoopContext {
  private target: number
  private current = 0

  constructor(
    executionStack: PostScriptObject[],
    procedure: PostScriptObject,
    iterations: PostScriptObject
  ) {
    super(executionStack, procedure)
    if (iterations.type !== ObjectType.Integer) {
      throw new Error('Repeat invalid iterations type')
    }
    this.target = iterations.value
  }

  public override finished(): boolean {
    return this.current >= this.target
  }

  public override execute(): void {
    this.executeProcedure()
    this.current++
  }
}
