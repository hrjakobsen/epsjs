import { Dictionary } from './dictionary/Dictionary.js'
import { SystemDictionary } from './dictionary/SystemDictonary.js'
import { GraphicsState, Path, SegmentType } from './graphics-state.js'
import { CharStream, PostScriptLexer } from './lexer.js'
import {
  Executability,
  ObjectType,
  PostScriptObject,
  PostScriptScanner,
} from './scanner.js'

const ANY_TYPE = -1

export class PostScriptInterpreter {
  private constructor(
    private scanner: PostScriptScanner,
    private ctx: CanvasRenderingContext2D
  ) {
    this.ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  private dictionaryStack: Dictionary[] = [
    new SystemDictionary(),
    new Dictionary(false),
  ]
  public operandStack: PostScriptObject[] = []
  private executionStack: PostScriptObject[] = []
  private graphicsStack: GraphicsState[] = [
    new GraphicsState(this.ctx.canvas.height),
  ]

  private get graphicsState() {
    if (!this.graphicsStack) {
      throw new Error('Missing GraphicState')
    }
    return this.graphicsStack[this.graphicsStack.length - 1]!
  }

  private run() {
    while (!this.done()) {
      this.fetchAndExecute()
    }
  }

  private get next() {
    return this.executionStack.pop()
  }

  private done() {
    return this.executionStack.length === 0 && this.scanner.next === undefined
  }

  private fetchAndExecute() {
    let forceArrayToOperandStack = false
    if (!this.executionStack.length) {
      forceArrayToOperandStack = true
      this.executionStack.push(this.scanner.next!)
      this.scanner.advance()
    }
    const item = this.next!
    if (
      item.attributes.executability === Executability.Literal ||
      (item.type === ObjectType.Array && forceArrayToOperandStack)
    ) {
      this.operandStack.push(item)
      return
    }
    if (
      item.type === ObjectType.Name &&
      item.attributes.executability === Executability.Executable
    ) {
      // Look up name and invoke procedure
      const operator = this.symbolLookup(item)!
      if (operator.type === ObjectType.Operator) {
        // TODO: Find a better way to express this
        const methodName = PostScriptInterpreter.BUILT_INS.get(operator.value)!
        ;(this as any)[methodName]()
        return
      }
      if (
        operator.type === ObjectType.Array &&
        operator.attributes.executability === Executability.Executable
      ) {
        // Push procedure to executionStack
        const procedureBody = [...operator.value]
        procedureBody.reverse()
        this.executionStack.push(...procedureBody)
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

  public static evaluateString(program: string, ctx: CanvasRenderingContext2D) {
    const interpreter = new PostScriptInterpreter(
      new PostScriptScanner(new PostScriptLexer(new CharStream(program))),
      ctx
    )
    interpreter.run()
  }

  public static BUILT_INS = new Map<string, string>()

  @builtin()
  private debug() {
    console.log({
      operands: this.operandStack,
      execution: this.executionStack,
      dictionaries: this.dictionaryStack,
    })
    throw new Error('Debug stopped')
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private moveTo(x: PostScriptObject, y: PostScriptObject) {
    const nextCoordinate = this.graphicsState.toDeviceCoordinate({
      x: x.value,
      y: y.value,
    })
    this.graphicsState.path.currentPoint = nextCoordinate
    this.ctx.moveTo(nextCoordinate.x, nextCoordinate.y)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private lineTo(x: PostScriptObject, y: PostScriptObject) {
    const nextCoordinate = this.graphicsState.toDeviceCoordinate({
      x: x.value,
      y: y.value,
    })
    this.graphicsState.path.addSegment({
      type: SegmentType.Straight,
      coordinates: [this.graphicsState.path.currentPoint, nextCoordinate],
    })
    this.ctx.lineTo(nextCoordinate.x, nextCoordinate.y)
  }

  @builtin()
  private stroke() {
    this.ctx.stroke()
  }

  @builtin()
  private newPath() {
    this.graphicsState.path = new Path([])
    this.ctx.beginPath()
  }

  @builtin()
  @operands(ANY_TYPE)
  private dup(obj: PostScriptObject) {
    this.operandStack.push(obj, obj)
  }

  @builtin()
  @operands(ANY_TYPE)
  private pop(_obj: PostScriptObject) {
    // arg has already been popped
  }

  @builtin()
  @operands(ObjectType.Integer)
  private copy({ value: numberOfElements }: PostScriptObject) {
    const slice = this.operandStack.slice(
      this.operandStack.length - numberOfElements
    )
    this.operandStack.push(...slice)
  }

  @builtin()
  @operands(ANY_TYPE, ANY_TYPE)
  private exch(first: PostScriptObject, second: PostScriptObject) {
    this.operandStack.push(first, second)
  }

  @builtin()
  @operands(ObjectType.Name, ObjectType.Array)
  private def(
    { value: name }: PostScriptObject,
    { value: procedure }: PostScriptObject
  ) {
    const dictionary = this.dictionaryStack[this.dictionaryStack.length - 1]!
    dictionary.set(name, procedure)
  }
}

function builtin(name?: string) {
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

function operands(...types: (ObjectType | -1)[]) {
  return function (
    _targetPrototype: Object,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    const currentFunction: Function = descriptor.value
    descriptor.value = function (this: PostScriptInterpreter) {
      const args = []
      for (const type of types) {
        if (!this.operandStack.length) {
          throw new Error('Unexpected end of operand stack')
        }
        const arg = this.operandStack.pop()!
        if (!(arg.type & type)) {
          throw new Error(`Type error while evaluating ${methodName}`)
        }
        args.push(arg)
      }
      currentFunction.apply(this, args)
    }
  }
}
