import { PSDictionary } from './dictionary/dictionary'
import { SystemDictionary } from './dictionary/system-dictionary'
import { CharStreamBackedFile } from './file'
import { LoopContext } from './loop-context'
import {
  Access,
  EPSMetaData,
  Executability,
  getObjectTypeName,
  ObjectType,
  PSObject,
  PSScanner,
} from './scanner'
import { PSString } from './string'
import { createLiteral } from './utils'
import { CharStream, PSLexer } from './lexer'
import { GraphicsContext } from './graphics/context'
import { CanvasBackedGraphicsContext } from './graphics/canvas'
import { PseudoRandomNumberGenerator } from './random'
import { start } from './operators/control'
import { FileSystem } from './fs/file-system'

const MAX_STEPS = 100_000
const MAX_EXECUTION_STACK_SIZE = 1024

export class PSInterpreter {
  private _printer?: GraphicsContext
  public random: PseudoRandomNumberGenerator
  private constructor(
    file: CharStreamBackedFile,
    public readonly metaData: EPSMetaData
  ) {
    this.fs = FileSystem.stdFs(this)
    this.random = new PseudoRandomNumberGenerator()
    this.pushFileToExecutionStack(file.withInterpreter(this))
  }

  public pushFileToExecutionStack(file: CharStreamBackedFile) {
    this.executionStack.push({
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Executable,
      },
      value: file,
      type: ObjectType.File,
    })
  }
  public fonts = new PSDictionary(1024)

  public fs: FileSystem

  public dictionaryStack: PSObject<ObjectType.Dictionary>[] = [
    new SystemDictionary().asPSDictionary(),
    {
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
      type: ObjectType.Dictionary,
      value: new PSDictionary(1024),
    },
  ]
  public operandStack: PSObject[] = []
  public executionStack: (PSObject | LoopContext)[] = []

  public beginLoop(loop: LoopContext) {
    if (this.executionStack.length >= MAX_EXECUTION_STACK_SIZE) {
      throw new Error('Too many nested loops')
    }
    this.executionStack.push(loop)
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
    start(this)
    while (!this.done()) {
      this.fetchAndExecute()
    }
  }

  private next(): (typeof this.executionStack)[number] | undefined {
    while (this.executionStack.length) {
      const top = this.executionStack[this.executionStack.length - 1]!
      if (top instanceof LoopContext) {
        return top
      }
      if (top.type === ObjectType.File) {
        const file = (top as PSObject<ObjectType.File>).value
        const nextInstruction = file.token()
        if (nextInstruction === undefined) {
          this.executionStack.pop()
          continue
        }
        return nextInstruction
      } else if (
        top.type === ObjectType.String &&
        top.attributes.executability === Executability.Executable
      ) {
        const data = (top as PSObject<ObjectType.String>).value.asString()
        const file = CharStreamBackedFile.fromString(data).withInterpreter(this)
        this.executionStack.pop()
        this.pushFileToExecutionStack(file)
        continue
      } else {
        this.executionStack.pop()
        return top
      }
    }
    return undefined
  }

  public get activeLoop(): LoopContext {
    for (let i = this.executionStack.length - 1; i >= 0; --i) {
      const item = this.executionStack[i]
      if (item instanceof LoopContext) {
        return item
      }
    }
    throw new Error('No active loop')
  }

  private done() {
    if (this.stepsLeft-- < 0) {
      throw new Error('Too many steps executed')
    }

    return this.stopped || this.executionStack.length === 0
  }

  private fetchAndExecute(): void {
    const itemOrLoopContext = this.next()
    if (!itemOrLoopContext) {
      this.stopped = true
      return
    }
    if (itemOrLoopContext instanceof LoopContext) {
      const loopCtx = itemOrLoopContext
      if (loopCtx.finished()) {
        loopCtx.exit()
      } else {
        loopCtx.execute()
      }
      return
    }
    const item = itemOrLoopContext
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
        ;(definition as PSObject<ObjectType.Operator>).value(this)
        return
      } else if (
        definition.type === ObjectType.Array &&
        definition.attributes.executability === Executability.Executable
      ) {
        ;(definition as PSObject<ObjectType.Array>).value.execute(this)
        return
      } else if (
        definition.attributes.executability === Executability.Literal
      ) {
        this.operandStack.push(definition)
        return
      }
    }
    throw new Error(
      `Unhandled execution of object: type: ${getObjectTypeName(
        item.type
      )}, executability: ${item.attributes.executability}, access: ${
        item.attributes.access
      }`
    )
  }

  symbolLookup(key: PSObject): PSObject {
    for (let i = this.dictionaryStack.length - 1; i >= 0; --i) {
      if (this.dictionaryStack[i]!.value.get(key)) {
        return this.dictionaryStack[i]!.value.get(key)!
      }
    }
    throw new Error('Undefined symbol: ' + key.value)
  }

  public static load(program: string) {
    let metadata = {}
    try {
      metadata = new PSScanner(
        new PSLexer(new CharStream(program))
      ).getMetaData()
    } catch (error) {
      console.warn('error collecting metadata', { error })
    }
    const interpreter = new PSInterpreter(
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

  public pop<T extends ObjectType>(typ: T): PSObject<T> {
    const top = this.operandStack.pop()
    if (!top) {
      throw new Error('Empty stack')
    }
    if (!(top.type & typ)) {
      throw new Error(
        `Expected "${getObjectTypeName(typ)}", got "${getObjectTypeName(
          top.type
        )}"`
      )
    }
    return top
  }

  public findFont(key: PSObject<ObjectType.Any>) {
    if (this.fonts.has(key)) {
      return this.fonts.get(key)!.value as PSDictionary
    }
    if (key.type !== ObjectType.Name && key.type !== ObjectType.String) {
      throw new Error('findfont: invalid key type')
    }
    let fontName = key.value as string | PSString
    if (typeof fontName !== 'string') {
      fontName = fontName.asString()
    }
    if (!document.fonts.check(`12px ${fontName}`)) {
      throw new Error(`Font ${fontName} not found`)
    }
    return PSDictionary.newFont(fontName)
  }
}
