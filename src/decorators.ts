import { PostScriptInterpreter } from './interpreter.js'
import { ObjectType } from './scanner.js'

export function builtin(name?: string) {
  return function (
    _target: Object,
    methodName: string,
    _descriptor: PropertyDescriptor
  ) {
    if (!name) {
      name = methodName.toLowerCase()
    }
    if (!PostScriptInterpreter.BUILT_INS.has(name)) {
      PostScriptInterpreter.BUILT_INS.set(name, [])
    }
    PostScriptInterpreter.BUILT_INS.get(name)!.push(methodName)
  }
}

export function operands(...types: (ObjectType | -1)[]) {
  return function (
    _targetPrototype: Object,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    PostScriptInterpreter.OVERLOADS.set(methodName, types)
    const currentFunction: Function = descriptor.value
    descriptor.value = function (this: PostScriptInterpreter) {
      const args = []
      for (let i = types.length - 1; i >= 0; --i) {
        const type = types[i]!
        if (!this.operandStack.length) {
          throw new Error(
            `Not enough operands for ${methodName}. It requires ${
              types.length
            } but only ${types.length - 1 - i} was available`
          )
        }
        const arg = this.operandStack.pop()!
        if (!(arg.type & type)) {
          throw new Error(
            `Type error of argument ${i + 1} of  ${methodName} (${
              arg.type
            } !== ${type})`
          )
        }
        args.push(arg)
      }
      currentFunction.apply(this, args.reverse())
    }
  }
}
