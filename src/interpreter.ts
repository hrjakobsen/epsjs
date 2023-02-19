import { builtin, operands } from './decorators.js'
import { Dictionary } from './dictionary/Dictionary.js'
import { SystemDictionary } from './dictionary/SystemDictonary.js'
import { GraphicsState, Path, SegmentType } from './graphics-state.js'
import { CharStream, PostScriptLexer } from './lexer.js'
import {
  Access,
  Executability,
  ObjectType,
  PostScriptObject,
  PostScriptScanner,
} from './scanner.js'
import { degreeToRadians, radiansToDegrees } from './utils.js'

const ANY_TYPE = -1
const MAX_STEPS = 100_000
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

  private stopped = false
  private stepsLeft = MAX_STEPS

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
    if (this.stepsLeft-- < 0) {
      throw new Error('Too many steps executed')
    }

    return (
      this.stopped ||
      (this.executionStack.length === 0 && this.scanner.next === undefined)
    )
  }

  private resolveBuiltin(operatorName: string): string {
    const overloads = PostScriptInterpreter.BUILT_INS.get(operatorName)
    if (overloads === undefined) {
      throw new Error(`Unknown builtin ${operatorName}`)
    }
    if (overloads.length === 1) {
      return overloads[0]!
    }

    outer: for (const overloadName of overloads) {
      const overloadTypes = PostScriptInterpreter.OVERLOADS.get(overloadName)
      if (overloadTypes === undefined) {
        throw new Error(
          `${overloadName} has no declared operands, even though it is an overload`
        )
      }
      if (overloadTypes.length > this.operandStack.length) {
        continue
      }
      for (let i = 0; i < overloadTypes.length; ++i) {
        if (
          !(
            this.operandStack[this.operandStack.length - 1 - i]!.type &
            overloadTypes[overloadTypes.length - 1 - i]!
          )
        ) {
          continue outer
        }
      }
      return overloadName
    }
    throw new Error(`No matching overload found for ${operatorName}`)
  }

  private fetchAndExecute() {
    if (!this.executionStack.length) {
      this.executionStack.push(this.scanner.next!)
      this.scanner.advance()
    }
    const item = this.next!
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
      const operator = this.symbolLookup(item)!
      if (operator.type === ObjectType.Operator) {
        // TODO: Find a better way to express this
        const methodName = this.resolveBuiltin(operator.value)
        ;(this as any)[methodName]!()
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

  private pushLiteral(value: any, type: ObjectType) {
    this.operandStack.push({
      type,
      value,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
  }

  private pushLiteralNumber(
    num: number,
    type: ObjectType.Integer | ObjectType.Real = ObjectType.Integer
  ) {
    if (type === ObjectType.Integer) {
      num = Math.floor(num)
    }
    this.operandStack.push({
      type,
      value: num,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
  }

  public static BUILT_INS = new Map<string, string[]>()
  public static OVERLOADS = new Map<string, (ObjectType | -1)[]>()

  private findIndexOfMark() {
    for (let index = this.operandStack.length - 1; index > 0; --index) {
      const element = this.operandStack[index]
      if (element!.type === ObjectType.Mark) {
        return index
      }
    }
    return undefined
  }

  // ---------------------------------------------------------------------------
  //                          STACK OPERATIONS
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ANY_TYPE)
  private pop(_obj: PostScriptObject) {
    // arg has already been popped
  }

  @builtin()
  @operands(ANY_TYPE, ANY_TYPE)
  private exch(first: PostScriptObject, second: PostScriptObject) {
    this.operandStack.push(second, first)
  }

  @builtin()
  @operands(ANY_TYPE)
  private dup(obj: PostScriptObject) {
    this.operandStack.push(obj, obj)
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
  @operands(ObjectType.Integer)
  private index({ value: offset }: PostScriptObject) {
    if (this.operandStack.length <= offset) {
      throw new Error('Index too high')
    }
    this.operandStack.push(
      this.operandStack[this.operandStack.length - 1 - offset]!
    )
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private roll(
    { value: numElements }: PostScriptObject,
    { value: numRolls }: PostScriptObject
  ) {
    if (this.operandStack.length < numElements) {
      throw new Error('roll: Not enough elements')
    }
    const toDuplicate = this.operandStack.slice(
      this.operandStack.length - numElements
    )
    for (let i = 0; i < numRolls; ++i) {
      this.operandStack.push(...toDuplicate)
    }
  }

  @builtin()
  private clear() {
    this.operandStack = []
  }

  @builtin()
  private count() {
    this.pushLiteralNumber(this.operandStack.length)
  }

  @builtin()
  private mark() {
    this.operandStack.push({
      type: ObjectType.Mark,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
      value: undefined,
    })
  }

  @builtin()
  private clearToMark() {
    const markIndex = this.findIndexOfMark()
    if (markIndex === undefined) {
      throw new Error('No mark defined')
    }
    this.operandStack.splice(markIndex)
  }

  @builtin()
  private countToMark() {
    const markIndex = this.findIndexOfMark()
    if (markIndex === undefined) {
      throw new Error('No mark defined')
    }
    this.pushLiteralNumber(this.operandStack.length - 1 - markIndex)
  }

  // ---------------------------------------------------------------------------
  //                       Dictionary Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Name, ObjectType.Array)
  private def(name: PostScriptObject, procedure: PostScriptObject) {
    const dictionary = this.dictionaryStack[this.dictionaryStack.length - 1]!
    dictionary.set(name, procedure)
  }

  // ---------------------------------------------------------------------------
  //               Relational, Boolean, and Bitwise Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ANY_TYPE, ANY_TYPE)
  private eq(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 === v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(ANY_TYPE, ANY_TYPE)
  private ne(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 !== v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real | ObjectType.String,
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  private ge(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 >= v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real | ObjectType.String,
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  private gt(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 > v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real | ObjectType.String,
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  private le(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 <= v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real | ObjectType.String,
    ObjectType.Integer | ObjectType.Real | ObjectType.String
  )
  private lt(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    this.pushLiteral(
      compareTypeCompatible(t1, t2) && v1 < v2,
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Boolean,
    ObjectType.Integer | ObjectType.Boolean
  )
  private and(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    if (t1 !== t2) {
      throw new Error('and requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 && v2, ObjectType.Boolean)
    } else {
      this.pushLiteral(v1 & v2, ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Boolean,
    ObjectType.Integer | ObjectType.Boolean
  )
  private or(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    if (t1 !== t2) {
      throw new Error('or requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 || v2, ObjectType.Boolean)
    } else {
      this.pushLiteral(v1 | v2, ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Boolean,
    ObjectType.Integer | ObjectType.Boolean
  )
  private xor(
    { value: v1, type: t1 }: PostScriptObject,
    { value: v2, type: t2 }: PostScriptObject
  ) {
    if (t1 !== t2) {
      throw new Error('xor requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 || (v2 && (!v1 || !v2)), ObjectType.Boolean)
    } else {
      this.pushLiteral(v1 ^ v2, ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private bitshift(
    { value }: PostScriptObject,
    { value: shift }: PostScriptObject
  ) {
    this.pushLiteral(
      shift ? value << shift : value >> shift,
      ObjectType.Integer
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Boolean)
  private not({ value: v1, type: t1 }: PostScriptObject) {
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(!v1, ObjectType.Boolean)
    } else {
      this.pushLiteral(~v1, ObjectType.Boolean)
    }
  }

  @builtin('true')
  private _true() {
    this.operandStack.push({
      type: ObjectType.Boolean,
      value: true,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
  }

  @builtin('false')
  private _false() {
    this.operandStack.push({
      type: ObjectType.Boolean,
      value: false,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
  }

  // ---------------------------------------------------------------------------
  //                    Arithmetic and Math Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private add(
    { type: t1, value: v1 }: PostScriptObject,
    { type: t2, value: v2 }: PostScriptObject
  ) {
    const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
    this.pushLiteralNumber(
      v1 + v2,
      isReal ? ObjectType.Real : ObjectType.Integer
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private div(
    { value: v1 }: PostScriptObject,
    { value: v2 }: PostScriptObject
  ) {
    this.pushLiteralNumber(v1 / v2, ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private idiv(
    { value: v1 }: PostScriptObject,
    { value: v2 }: PostScriptObject
  ) {
    this.pushLiteralNumber(Math.floor(v1 / v2))
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private mod(
    { value: v1 }: PostScriptObject,
    { value: v2 }: PostScriptObject
  ) {
    this.pushLiteralNumber(v1 % v2)
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private mul(
    { type: t1, value: v1 }: PostScriptObject,
    { type: t2, value: v2 }: PostScriptObject
  ) {
    const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
    this.pushLiteralNumber(
      v1 * v2,
      isReal ? ObjectType.Real : ObjectType.Integer
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private sub(
    { type: t1, value: v1 }: PostScriptObject,
    { type: t2, value: v2 }: PostScriptObject
  ) {
    const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
    this.pushLiteralNumber(
      v1 - v2,
      isReal ? ObjectType.Real : ObjectType.Integer
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private abs({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      Math.abs(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private neg({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(-v1, t1 as ObjectType.Integer | ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private ceiling({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      Math.ceil(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private floor({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      Math.ceil(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private round({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      Math.round(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private truncate({ type: t1, value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      Math.trunc(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private sqrt({ value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(Math.sqrt(v1), ObjectType.Real)
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private atan(
    { value: v1 }: PostScriptObject,
    { value: v2 }: PostScriptObject
  ) {
    this.pushLiteralNumber(
      radiansToDegrees(Math.atan(v1 / v2)),
      ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private cos({ value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      radiansToDegrees(Math.cos(degreeToRadians(v1))),
      ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private sin({ value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(
      radiansToDegrees(Math.sin(degreeToRadians(v1))),
      ObjectType.Real
    )
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private exp(
    { value: v1 }: PostScriptObject,
    { value: v2 }: PostScriptObject
  ) {
    this.pushLiteralNumber(Math.pow(v1, v2), ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private ln({ value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(Math.log2(v1), ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private log({ value: v1 }: PostScriptObject) {
    this.pushLiteralNumber(Math.log10(v1), ObjectType.Real)
  }

  @builtin()
  private rand() {
    this.pushLiteralNumber(Math.floor(Math.random() * (Math.pow(2, 31) - 1)))
  }

  @builtin()
  @operands(ObjectType.Integer)
  private srand({ value }: PostScriptObject) {
    console.warn(
      `Trying to set random seed ${value}. Seeding the RNG is not supported`
    )
  }

  @builtin()
  private rrand() {
    console.warn(`Trying to read random seed. Seeding the RNG is not supported`)
    this.pushLiteralNumber(-1)
  }

  // ---------------------------------------------------------------------------
  //                       Path Construction Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private newPath() {
    this.graphicsState.path = new Path([])
    this.ctx.beginPath()
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

  // ---------------------------------------------------------------------------
  //                         Painting Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private stroke() {
    this.ctx.stroke()
  }

  // ---------------------------------------------------------------------------
  //                           Control Operators
  // ---------------------------------------------------------------------------

  @builtin('if')
  @operands(ObjectType.Boolean, ObjectType.Array)
  private _if({ value: bool }: PostScriptObject, procedure: PostScriptObject) {
    if (procedure.attributes.executability === Executability.Literal) {
      throw new Error('Second argument to if is not a procedure')
    }
    if (bool) {
      this.executionStack.push(...[...procedure.value].reverse())
    }
  }

  @builtin()
  @operands(ObjectType.Boolean, ObjectType.Array, ObjectType.Array)
  private ifelse(
    { value: bool }: PostScriptObject,
    procedureTrue: PostScriptObject,
    procedureFalse: PostScriptObject
  ) {
    if (
      procedureTrue.attributes.executability === Executability.Literal ||
      procedureFalse.attributes.executability === Executability.Literal
    ) {
      throw new Error('Second argument to if is not a procedure')
    }
    if (bool) {
      this.executionStack.push(...[...procedureTrue.value].reverse())
    } else {
      this.executionStack.push(...[...procedureFalse.value].reverse())
    }
  }

  @builtin()
  private quit(_obj: PostScriptObject) {
    this.stopped = true
  }

  // ---------------------------------------------------------------------------
  //                           File Operators
  // ---------------------------------------------------------------------------
  @builtin('=')
  @operands(ANY_TYPE)
  private debugPrint({ value }: PostScriptObject) {
    console.log(value)
  }

  @builtin('==')
  @operands(ANY_TYPE)
  private debugPrintObject(obj: PostScriptObject) {
    console.log(obj)
  }

  @builtin('stack')
  private stack() {
    console.log(this.operandStack.map((x) => x.value))
  }

  @builtin('pstack')
  private pstack() {
    console.log(this.operandStack)
  }
}

function compareTypeCompatible(type1: ObjectType, type2: ObjectType): boolean {
  if (type1 & (ObjectType.Integer | ObjectType.Real)) {
    return Boolean(type2 & (ObjectType.Integer | ObjectType.Real))
  }
  return type1 == type2
}
