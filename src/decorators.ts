/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { BUILT_INS, OVERLOADS, PostScriptInterpreter } from './interpreter'
import { ObjectType } from './scanner'

export function builtin(name?: string) {
  return function decorator(
    originalMethod: Function,
    context: ClassMethodDecoratorContext
  ) {
    const methodName = String(context.name)
    name = name ?? String(context.name).toLowerCase()
    if (!BUILT_INS.has(name)) {
      BUILT_INS.set(name, [])
    }
    BUILT_INS.get(name)!.push(methodName)
    return function replacementMethod(this: any, ...args: any[]) {
      return originalMethod.apply(this, ...args)
    }
  }
}

export function operands(...types: (ObjectType | -1)[]) {
  return function decorator(
    originalMethod: Function,
    context: ClassMethodDecoratorContext
  ) {
    const methodName = String(context.name)
    OVERLOADS.set(methodName, types)
    return function replacementMethod(this: PostScriptInterpreter) {
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
      originalMethod.apply(this, args.reverse())
    }
  }
}
