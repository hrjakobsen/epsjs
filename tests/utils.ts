import { PSInterpreter } from '../src'
import { ObjectType } from '../src/scanner'
import { PSString } from '../src/string'

export async function testProgram(programText: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No 2d context')
  }
  const interpreter = PSInterpreter.load(programText)
  await interpreter.run(ctx)
  return interpreter
}

export function checkStackValues(
  interpreter: PSInterpreter,
  ...expected: any[]
) {
  expect(interpreter.operandStack.length).toBe(expected.length)
  for (let i = expected.length - 1; i >= 0; --i) {
    const expectedValue = expected[i]
    const { type: actualType, value: actualValue } = interpreter.pop(
      ObjectType.Any
    )
    if (actualType === ObjectType.String) {
      expect((actualValue as PSString).asString()).toBe(expectedValue)
      continue
    }
    if (actualType === ObjectType.Mark) {
      expect('*mark').toBe(expectedValue)
      continue
    }
    expect(actualValue).toBe(expectedValue)
  }
}
