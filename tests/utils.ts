import { PostScriptInterpreter } from '../src'
import { ObjectType } from '../src/scanner'
import { PostScriptString } from '../src/string'

export function testProgram(programText: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No 2d context')
  }
  const interpreter = PostScriptInterpreter.load(programText)
  interpreter.run(ctx)
  return interpreter
}

export function checkStackValues(
  interpreter: PostScriptInterpreter,
  ...expected: any[]
) {
  expect(interpreter.operandStack.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    const expectedValue = expected[i]
    const { type: actualType, value: actualValue } = interpreter.pop(
      ObjectType.Any
    )
    if (actualType === ObjectType.String) {
      expect((actualValue as PostScriptString).asString()).toBe(expectedValue)
      continue
    }
    expect(actualValue).toBe(expectedValue)
  }
}
