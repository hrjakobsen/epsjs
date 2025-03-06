import { GraphicsContext } from './graphics/context'
import { Executability, ObjectType, PSObject } from './scanner'
import { createLiteral } from './utils'

export abstract class LoopContext {
  private executionStackStartIndex: number

  constructor(
    protected executionStack: PSObject[],
    protected procedure: PSObject<ObjectType.Array>
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

  private isDepletedOnStack() {
    return (
      this.executionStack.length === this.executionStackStartIndex + 1 &&
      this.procedure.value.procedureIndex >= this.procedure.value.length
    )
  }

  public isReadyToExecute() {
    return (
      this.executionStack.length === this.executionStackStartIndex ||
      this.isDepletedOnStack()
    )
  }

  public abstract execute(): void

  protected executeProcedure() {
    if (this.isDepletedOnStack()) {
      this.executionStack.pop()
    }
    this.procedure.value.procedureIndex = 0
    this.executionStack.push(this.procedure)
  }
}

export class ForLoopContext extends LoopContext {
  private controlVariable: number
  private controlVariableType: ObjectType
  private increment: number
  private limit: number

  constructor(
    executionStack: PSObject[],
    procedure: PSObject,
    private operandStack: PSObject[],
    initial: PSObject<ObjectType.Integer | ObjectType.Real>,
    increment: PSObject<ObjectType.Integer | ObjectType.Real>,
    limit: PSObject<ObjectType.Integer | ObjectType.Real>
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
    executionStack: PSObject[],
    procedure: PSObject,
    iterations: PSObject<ObjectType.Integer>
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

export class ArrayForAllLoopContext extends LoopContext {
  private index = 0
  constructor(
    executionStack: PSObject[],
    procedure: PSObject,
    private operandStack: PSObject[],
    private array: PSObject<ObjectType.Array>
  ) {
    super(executionStack, procedure)
    if (this.array.type !== ObjectType.Array) {
      throw new Error('Type error in array forall')
    }
  }
  public finished(): boolean {
    return this.index >= this.array.value.length
  }

  public execute(): void {
    this.executeProcedure()
    this.operandStack.push(this.array.value.get(this.index)!)
    ++this.index
  }
}

export class DictionaryForAllLoopContext extends LoopContext {
  private index = 0
  private keys: PSObject[]
  constructor(
    executionStack: PSObject[],
    procedure: PSObject,
    private operandStack: PSObject[],
    private dictionary: PSObject<ObjectType.Dictionary>
  ) {
    super(executionStack, procedure)
    this.keys = this.dictionary.value.keys()
  }

  public finished(): boolean {
    return this.index >= this.keys.length
  }

  public execute(): void {
    while (this.index < this.keys.length) {
      const key = this.keys[this.index]!
      const item = this.dictionary.value.get(key)
      if (item !== undefined) {
        this.operandStack.push(key, item)
        this.executeProcedure()
        this.index++
        return
      }
      this.index++
    }
  }
}

export class StringForAllLoopContext extends LoopContext {
  private index = 0
  constructor(
    executionStack: PSObject[],
    procedure: PSObject,
    private operandStack: PSObject[],
    private string: PSObject<ObjectType.String>
  ) {
    super(executionStack, procedure)
  }
  public finished(): boolean {
    return this.index >= this.string.value.length
  }

  public execute(): void {
    this.executeProcedure()
    this.operandStack.push(
      createLiteral(this.string.value.get(this.index), ObjectType.Integer)
    )
    ++this.index
  }
}

export class StringKShowLoopContext extends LoopContext {
  private index = 0
  constructor(
    executionStack: PSObject[],
    procedure: PSObject,
    private printer: GraphicsContext,
    private string: PSObject<ObjectType.String>
  ) {
    super(executionStack, procedure)
  }

  public override finished(): boolean {
    return this.index >= this.string.value.length
  }

  public override execute(): void {
    const char = this.string.value.get(this.index)
    const currentPoint = this.printer.getCurrentPoint()
    this.printer.fillText(String.fromCharCode(char), currentPoint)
    this.executeProcedure()
    ++this.index
  }
}
