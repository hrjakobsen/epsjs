import { PostScriptInterpreter } from '../interpreter'
import { Access, Executability, ObjectType } from '../scanner'
import { PostScriptDictionary } from './dictionary'

export class SystemDictionary extends PostScriptDictionary {
  constructor() {
    super(true, PostScriptInterpreter.BUILT_INS.size)
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
