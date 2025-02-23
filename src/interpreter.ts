import { PostScriptDictionary } from './dictionary/dictionary'
import { SystemDictionary } from './dictionary/system-dictionary'
import { CharStreamBackedFile } from './file'
import { LoopContext } from './loop-context'
import {
  Access,
  EPSMetaData,
  Executability,
  ObjectType,
  PostScriptObject,
  PostScriptScanner,
} from './scanner'
import { PostScriptString } from './string'
import { createLiteral } from './utils'
import { CharStream, PostScriptLexer } from './lexer'
import { GraphicsContext } from './graphics/context'
import { CanvasBackedGraphicsContext } from './graphics/canvas'

const MAX_STEPS = 100_000
const MAX_LOOP_STACK_SIZE = 1024

export const BUILT_INS = new Map<string, string[]>()
export const OVERLOADS = new Map<string, (ObjectType | -1)[]>()

export class PostScriptInterpreter {
  private _printer?: GraphicsContext
  private constructor(
    file: CharStreamBackedFile,
    public readonly metaData: EPSMetaData
  ) {
    this.executionStack.push({
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Executable,
      },
      value: file,
      type: ObjectType.File,
    })
  }
  public fonts = new PostScriptDictionary(false, 1024)

  public dictionaryStack: PostScriptDictionary[] = [
    new SystemDictionary(),
    new PostScriptDictionary(false, 1024),
  ]
  public operandStack: PostScriptObject[] = []
  public executionStack: (
    | PostScriptObject<ObjectType.Array>
    | PostScriptObject<ObjectType.File>
  )[] = []
  public loopStack: LoopContext[] = []

  public beginLoop(loop: LoopContext) {
    if (this.loopStack.length >= MAX_LOOP_STACK_SIZE) {
      throw new Error('Too many nested loops')
    }
    this.loopStack.push(loop)
  }

  public get printer() {
    if (!this._printer) {
      throw new Error('No printer attached')
    }
    return this._printer
  }

  public stopped = false
  private stepsLeft = MAX_STEPS

  public get dictionary() {
    if (!this.dictionaryStack.length) {
      throw new Error('Empty dictionary stack')
    }
    return this.dictionaryStack[this.dictionaryStack.length - 1]!
  }

  public run(ctx: CanvasRenderingContext2D) {
    this._printer = new CanvasBackedGraphicsContext(this, ctx)
    while (!this.done()) {
      this.fetchAndExecute()
    }
  }

  private next() {
    while (this.executionStack.length) {
      const top = this.executionStack[this.executionStack.length - 1]!
      if (top.type === ObjectType.Array) {
        const procedure = (top as PostScriptObject<ObjectType.Array>).value
        const nextInstruction = procedure.get(procedure.procedureIndex)
        procedure.procedureIndex++
        if (nextInstruction === undefined) {
          this.executionStack.pop()
          continue
        }
        return nextInstruction
      } else {
        const file = (top as PostScriptObject<ObjectType.File>).value
        const nextInstruction = file.token()
        if (nextInstruction === undefined) {
          this.executionStack.pop()
          continue
        }
        return nextInstruction
      }
    }
    return undefined
  }

  public get activeLoop() {
    return this.loopStack[this.loopStack.length - 1]
  }

  private done() {
    if (this.stepsLeft-- < 0) {
      throw new Error('Too many steps executed')
    }

    return (
      this.stopped ||
      (this.loopStack.length === 0 && this.executionStack.length === 0)
    )
  }

  private fetchAndExecute(): void {
    if (this.activeLoop) {
      if (this.activeLoop.isReadyToExecute() && this.activeLoop.finished()) {
        this.activeLoop.exit()
        this.loopStack.pop()
        return
      }
      if (this.activeLoop.isReadyToExecute()) {
        this.activeLoop.execute()
        return
      }
    }
    const item = this.next()
    if (!item) {
      this.stopped = true
      return
    }
    if (
      item.attributes.executability === Executability.Literal ||
      (item.type === ObjectType.Array &&
        item.attributes.executability === Executability.Executable)
    ) {
      this.operandStack.push(item)
      return
    }
    if (
      item.type === ObjectType.Name &&
      item.attributes.executability === Executability.Executable
    ) {
      // Look up name and invoke procedure
      const definition = this.symbolLookup(item)!
      if (definition.type === ObjectType.Operator) {
        ;(definition as PostScriptObject<ObjectType.Operator>).value(this)
        return
      } else if (
        definition.type === ObjectType.Array &&
        definition.attributes.executability === Executability.Executable
      ) {
        // Push procedure to executionStack
        const procedureBody: PostScriptObject<ObjectType.Array> = {
          ...definition,
          value: (
            definition as PostScriptObject<ObjectType.Array>
          ).value.copy(),
        }
        this.executionStack.push(procedureBody)
        return
      } else if (
        definition.attributes.executability === Executability.Literal
      ) {
        this.operandStack.push(definition)
        return
      }
    }
    throw new Error(
      `Unhandled execution of object: type: ${item.type}, executability: ${item.attributes.executability}, access: ${item.attributes.access}`
    )
  }

  symbolLookup(key: PostScriptObject): PostScriptObject {
    for (let i = this.dictionaryStack.length - 1; i >= 0; --i) {
      if (this.dictionaryStack[i]!.get(key)) {
        return this.dictionaryStack[i]!.get(key)!
      }
    }
    throw new Error('Undefined symbol: ' + key.value)
  }

  public static load(program: string) {
    let metadata = {}
    try {
      metadata = new PostScriptScanner(
        new PostScriptLexer(new CharStream(program))
      ).getMetaData()
    } catch (error) {
      console.warn('error collecting metadata', { error })
    }
    const interpreter = new PostScriptInterpreter(
      CharStreamBackedFile.fromString(program),
      metadata
    )
    return interpreter
  }

  public pushLiteral(value: any, type: ObjectType) {
    this.operandStack.push(createLiteral(value, type))
  }

  public pushLiteralNumber(
    num: number,
    type: ObjectType.Integer | ObjectType.Real = ObjectType.Integer
  ) {
    if (type === ObjectType.Integer) {
      num = Math.floor(num)
    }
    this.pushLiteral(num, type)
  }

  public findIndexOfMark() {
    for (let index = this.operandStack.length - 1; index >= 0; --index) {
      const element = this.operandStack[index]
      if (element!.type === ObjectType.Mark) {
        return index
      }
    }
    return undefined
  }

  public pop<T extends ObjectType>(typ: T): PostScriptObject<T> {
    const top = this.operandStack.pop()
    if (!top) {
      throw new Error('Empty stack')
    }
    if (!(top.type & typ)) {
      throw new Error(`Expected ${typ}, got ${top.type}`)
    }
    return top
  }

  public findFont(key: PostScriptObject<ObjectType.Any>) {
    if (this.fonts.has(key)) {
      return this.fonts.get(key)!.value as PostScriptDictionary
    }
    if (key.type !== ObjectType.Name && key.type !== ObjectType.String) {
      throw new Error('findfont: invalid key type')
    }
    let fontName = key.value as string | PostScriptString
    if (typeof fontName !== 'string') {
      fontName = fontName.asString()
    }
    if (!document.fonts.check(`12px ${fontName}`)) {
      throw new Error(`Font ${fontName} not found`)
    }
    return PostScriptDictionary.newFont(fontName)
  }
}
