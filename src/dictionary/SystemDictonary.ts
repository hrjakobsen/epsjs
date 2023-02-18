import { PostScriptInterpreter } from '../interpreter.js'
import { Access, Executability, ObjectType } from '../scanner.js'
import { Dictionary } from './Dictionary.js'

export class SystemDictionary extends Dictionary {
  constructor() {
    super(true)
    for (const builtin of PostScriptInterpreter.BUILT_INS.keys()) {
      this.addBuiltinOperator(builtin)
    }
  }

  private addBuiltinOperator(name: string) {
    this.forceSet(
      {
        attributes: {
          access: Access.ExecuteOnly,
          executability: Executability.Executable,
        },
        type: ObjectType.Name,
        value: name,
      },
      {
        attributes: {
          access: Access.ExecuteOnly,
          executability: Executability.Executable,
        },
        type: ObjectType.Operator,
        value: name,
      }
    )
  }
}
