import { PostScriptInterpreter } from '../src'

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
