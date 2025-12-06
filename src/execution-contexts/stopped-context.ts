import { ExecutionContext } from '.'
import { ObjectType } from '../scanner'

export class StoppedContext extends ExecutionContext {
  public override finished(): boolean {
    return true
  }

  public override execute(): void {}

  public override exit(): void {
    super.exit()
    this.interpreter.pushLiteral(false, ObjectType.Boolean)
  }
}
