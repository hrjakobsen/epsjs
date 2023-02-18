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
    PostScriptInterpreter.BUILT_INS.set(name, methodName)
  }
}

export function operands(...types: (ObjectType | -1)[]) {
  return function (
    _targetPrototype: Object,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    const currentFunction: Function = descriptor.value
    descriptor.value = function (this: PostScriptInterpreter) {
      const args = []
      for (let i = types.length - 1; i >= 0; --i) {
        const type = types[i]!
        if (!this.operandStack.length) {
          throw new Error('Unexpected end of operand stack')
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
