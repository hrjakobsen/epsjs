import { builtin, operands } from './decorators'
import { PostScriptDictionary } from './dictionary/dictionary'
import { SystemDictionary } from './dictionary/system-dictionary'
import {
  ColorSpace,
  Direction,
  GraphicsState,
  LineCap,
  LineJoin,
  offsetCoordinate,
  Path,
  SegmentType,
  toRelativeOffset,
} from './graphics-state'
import { CharStream, PostScriptLexer } from './lexer'
import { ForLoopContext, LoopContext } from './loop-context'
import {
  Access,
  EPSMetaData,
  Executability,
  ObjectType,
  PostScriptObject,
  PostScriptScanner,
} from './scanner'
import { PostScriptString } from './string'
import {
  compareTypeCompatible,
  createLiteral,
  degreeToRadians,
  prettyPrint,
  radiansToDegrees,
} from './utils'

const MAX_STEPS = 100_000
const MAX_DICT_CAPACITY = 1024
const MAX_LOOP_STACK_SIZE = 1024

export class PostScriptInterpreter {
  public readonly metaData: EPSMetaData = {}
  private _ctx?: CanvasRenderingContext2D
  private constructor(private scanner: PostScriptScanner) {
    this.metaData = this.scanner.getMetaData()
  }
  private dictionaryStack: PostScriptDictionary[] = [
    new SystemDictionary(),
    new PostScriptDictionary(false, 1024),
  ]
  public operandStack: PostScriptObject[] = []
  private executionStack: PostScriptObject[] = []
  private graphicsStack: GraphicsState[] = []
  private loopStack: LoopContext[] = []

  private beginLoop(loop: LoopContext) {
    if (this.loopStack.length >= MAX_LOOP_STACK_SIZE) {
      throw new Error('Too many nested loops')
    }
    this.loopStack.push(loop)
  }

  private get ctx() {
    if (!this._ctx) {
      throw new Error('No canvas rendering ctx')
    }
    return this._ctx
  }

  private stopped = false
  private stepsLeft = MAX_STEPS

  private get graphicsState() {
    if (!this.graphicsStack) {
      throw new Error('Missing GraphicState')
    }
    return this.graphicsStack[this.graphicsStack.length - 1]!
  }

  private get dictionary() {
    if (!this.dictionaryStack.length) {
      throw new Error('Empty dictionary stack')
    }
    return this.dictionaryStack[this.dictionaryStack.length - 1]!
  }

  public run(ctx: CanvasRenderingContext2D) {
    this._ctx = ctx
    this.graphicsStack.push(new GraphicsState(this.ctx.canvas.height))
    while (!this.done()) {
      this.fetchAndExecute()
    }
  }

  private get next() {
    return this.executionStack.pop()
  }

  private get activeLoop() {
    return this.loopStack[this.loopStack.length - 1]
  }

  private done() {
    if (this.stepsLeft-- < 0) {
      throw new Error('Too many steps executed')
    }

    return (
      this.stopped ||
      (this.loopStack.length === 0 &&
        this.executionStack.length === 0 &&
        this.scanner.next === undefined)
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

  private fetchAndExecute(): void {
    if (this.activeLoop) {
      if (this.activeLoop.finished()) {
        this.activeLoop.exit()
        this.loopStack.pop()
        return
      }
      if (this.activeLoop.shouldExecute()) {
        this.activeLoop.execute()
        return
      }
    }
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
      const value = this.symbolLookup(item)!
      if (value.type === ObjectType.Operator) {
        // TODO: Find a better way to express this
        const methodName = this.resolveBuiltin(value.value)
        ;(this as any)[methodName]!()
        return
      } else if (
        value.type === ObjectType.Array &&
        value.attributes.executability === Executability.Executable
      ) {
        // Push procedure to executionStack
        const procedureBody = [...value.value]
        procedureBody.reverse()
        this.executionStack.push(...procedureBody)
        return
      } else if (value.attributes.executability === Executability.Literal) {
        this.operandStack.push(value)
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
    const interpreter = new PostScriptInterpreter(
      new PostScriptScanner(new PostScriptLexer(new CharStream(program)))
    )
    return interpreter
  }

  private pushLiteral(value: any, type: ObjectType) {
    this.operandStack.push(createLiteral(value, type))
  }

  private pushLiteralNumber(
    num: number,
    type: ObjectType.Integer | ObjectType.Real = ObjectType.Integer
  ) {
    if (type === ObjectType.Integer) {
      num = Math.floor(num)
    }
    this.pushLiteral(num, type)
  }

  public static BUILT_INS = new Map<string, string[]>()
  public static OVERLOADS = new Map<string, (ObjectType | -1)[]>()

  private findIndexOfMark() {
    for (let index = this.operandStack.length - 1; index >= 0; --index) {
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
  @operands(ObjectType.Any)
  private pop(_obj: PostScriptObject) {
    // arg has already been popped
  }

  @builtin()
  @operands(ObjectType.Any, ObjectType.Any)
  private exch(first: PostScriptObject, second: PostScriptObject) {
    this.operandStack.push(second, first)
  }

  @builtin()
  @operands(ObjectType.Any)
  private dup(obj: PostScriptObject) {
    this.operandStack.push(obj, obj)
  }

  @builtin('copy')
  @operands(ObjectType.Integer)
  private copyStack({ value: numberOfElements }: PostScriptObject) {
    if (this.operandStack.length < numberOfElements) {
      throw new Error('Not enough elements on stack to copy')
    }
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
  @operands(ObjectType.Integer)
  private dict({ value: capacity }: PostScriptObject) {
    if (capacity > MAX_DICT_CAPACITY) {
      throw new Error(
        `${capacity} is higher than the max capacity of ${MAX_DICT_CAPACITY}`
      )
    }
    const dictionary = new PostScriptDictionary(false, capacity)
    this.pushLiteral(dictionary, ObjectType.Dictionary)
  }

  @builtin('<<')
  private startDict() {
    this.pushLiteral(undefined, ObjectType.Mark)
  }

  @builtin('>>')
  private endDict() {
    const mark = this.findIndexOfMark()
    if (mark === undefined) {
      throw new Error('>>: Missing mark on stack')
    }
    const elements = this.operandStack.splice(mark + 1)
    if (elements.length % 2 !== 0) {
      throw new Error('Dictionary entries must be key-value pairs')
    }
    const dictionary = new PostScriptDictionary(false, elements.length / 2)
    for (let i = 0; i < elements.length; i += 2) {
      dictionary.set(elements[i]!, elements[i + 1]!)
    }
    this.pushLiteral(dictionary, ObjectType.Dictionary)
  }

  @builtin()
  @operands(ObjectType.Dictionary)
  private begin({ value: dictionary }: PostScriptObject) {
    this.dictionaryStack.push(dictionary)
  }

  @builtin()
  private end() {
    if (this.dictionaryStack.length === 0) {
      throw new Error('end: Popping empty dictionary stack')
    }
    this.dictionaryStack.pop()
  }

  @builtin()
  @operands(ObjectType.Any, ObjectType.Any)
  private def(name: PostScriptObject, procedure: PostScriptObject) {
    this.dictionary.set(name, procedure)
  }

  @builtin()
  @operands(ObjectType.Any)
  private load(name: PostScriptObject) {
    const element = this.dictionary.get(name)
    if (element === undefined) {
      throw new Error('Unknown get in dictionary load')
    }
    this.operandStack.push(element)
  }

  @builtin()
  @operands(ObjectType.Any, ObjectType.Any)
  private store(key: PostScriptObject, value: PostScriptObject) {
    this.dictionary.set(key, value)
  }

  @builtin('get')
  @operands(ObjectType.Dictionary, ObjectType.Any)
  private getDict(
    { value: dictionary }: PostScriptObject,
    key: PostScriptObject
  ) {
    this.operandStack.push((dictionary as PostScriptDictionary).get(key)!)
  }

  @builtin('put')
  @operands(ObjectType.Dictionary, ObjectType.Any, ObjectType.Any)
  private putDict(
    { value: dictionary }: PostScriptObject,
    key: PostScriptObject,
    value: PostScriptObject
  ) {
    ;(dictionary as PostScriptDictionary).set(key, value)
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Any)
  private undef(
    { value: dictionary }: PostScriptObject,
    key: PostScriptObject
  ) {
    ;(dictionary as PostScriptDictionary).remove(key)
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Any)
  private known(
    { value: dictionary }: PostScriptObject,
    key: PostScriptObject
  ) {
    this.pushLiteral(
      (dictionary as PostScriptDictionary).has(key),
      ObjectType.Boolean
    )
  }

  @builtin()
  @operands(ObjectType.Any)
  private where(key: PostScriptObject) {
    for (let i = this.dictionaryStack.length - 1; i >= 0; --i) {
      const currentDictionary = this.dictionaryStack[i]!
      if (currentDictionary.has(key)) {
        // TODO: Should we have a single object for a dictionary, in case
        // someone dups and changes access?
        this.pushLiteral(currentDictionary, ObjectType.Dictionary)
        return
      }
    }
    this.pushLiteral(false, ObjectType.Boolean)
  }

  @builtin()
  private currentDict() {
    this.pushLiteral(this.currentDict, ObjectType.Dictionary)
  }

  @builtin()
  private countDictStack() {
    this.pushLiteral(this.dictionaryStack.length, ObjectType.Integer)
  }

  // TODO: cleardictstack, dictstack, forall, default dictionaries

  // ---------------------------------------------------------------------------
  //                          String Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Integer)
  private string({ value: length }: PostScriptObject) {
    // TODO: Enforce max string length
    this.pushLiteral(new PostScriptString(length), ObjectType.String)
  }

  @builtin('length')
  @operands(ObjectType.String)
  private stringLength({ value: string }: PostScriptObject) {
    this.pushLiteral(string.length, ObjectType.Integer)
  }

  @builtin('get')
  @operands(ObjectType.String, ObjectType.Integer)
  private stringGet(
    { value: string }: PostScriptObject,
    { value: index }: PostScriptObject
  ) {
    this.pushLiteral(
      (string as PostScriptString).get(index),
      ObjectType.Integer
    )
  }

  @builtin('put')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private stringPut(
    { value: string }: PostScriptObject,
    { value: index }: PostScriptObject,
    { value: newValue }: PostScriptObject
  ) {
    ;(string as PostScriptString).set(index, newValue)
  }

  @builtin('getinterval')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private stringGetInterval(
    { value: string }: PostScriptObject,
    { value: index }: PostScriptObject,
    { value: count }: PostScriptObject
  ) {
    const stringObj = string as PostScriptString
    if (index < 0 || count < 0 || index + count > stringObj.length) {
      throw new Error(
        `Invalid substring with index ${index} and count ${count}`
      )
    }
    this.pushLiteral(
      PostScriptString.fromCharCode(
        ...stringObj.data.slice(index, index + count)
      ),
      ObjectType.String
    )
  }

  @builtin('putinterval')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private stringPutInterval(
    { value: target }: PostScriptObject,
    { value: index }: PostScriptObject,
    { value: source }: PostScriptObject
  ) {
    const stringSource = source as PostScriptString
    const stringTarget = target as PostScriptString
    if (index < 0) {
      throw new Error('putinterval: index cannot be negative')
    }

    if (!(stringTarget.length < stringSource.length + index)) {
      throw new Error(
        `putinterval: Cannot fit string of length ${stringSource.length} into string of length ${stringTarget.length} starting at index ${index}`
      )
    }

    stringTarget.data.splice(index, stringSource.length, ...stringSource.data)
  }

  @builtin('copy')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private copyString(
    { value: source }: PostScriptObject,
    { value: target }: PostScriptObject
  ) {
    const stringSource = source as PostScriptString
    const stringTarget = target as PostScriptString

    if (!(stringTarget.length < stringSource.length)) {
      throw new Error(
        `putinterval: Cannot fit string of length ${stringSource.length} into string of length ${stringTarget.length}`
      )
    }

    const removed = stringTarget.data.splice(
      0,
      stringSource.length,
      ...stringSource.data
    )
    this.pushLiteral(
      PostScriptString.fromCharCode(...removed),
      ObjectType.String
    )
  }

  // TODO: forall

  @builtin()
  @operands(ObjectType.String, ObjectType.String)
  private anchorSearch(
    haystackObj: PostScriptObject,
    { value: needleArg }: PostScriptObject
  ) {
    const haystack = haystackObj.value as PostScriptString
    const needle = needleArg as PostScriptString

    const matches = haystack.anchorSearch(needle)
    if (!matches) {
      this.operandStack.push(haystackObj)
      this.pushLiteral(false, ObjectType.Boolean)
      return
    }
    const match = haystack.subString(0, needle.length)
    const post = haystack.subString(needle.length)
    this.pushLiteral(post, ObjectType.String)
    this.pushLiteral(match, ObjectType.String)
    this.pushLiteral(true, ObjectType.Boolean)
  }

  @builtin()
  @operands(ObjectType.String, ObjectType.String)
  private seek(
    haystackObj: PostScriptObject,
    { value: needleArg }: PostScriptObject
  ) {
    const haystack = haystackObj.value as PostScriptString
    const needle = needleArg as PostScriptString

    const matchIndex = haystack.search(needle)
    if (matchIndex === false) {
      this.operandStack.push(haystackObj)
      this.pushLiteral(false, ObjectType.Boolean)
      return
    }
    const pre = haystack.subString(0, matchIndex)
    const match = haystack.subString(matchIndex, needle.length)
    const post = haystack.subString(matchIndex + needle.length)
    this.pushLiteral(post, ObjectType.String)
    this.pushLiteral(match, ObjectType.String)
    this.pushLiteral(pre, ObjectType.String)
    this.pushLiteral(true, ObjectType.Boolean)
  }

  // ---------------------------------------------------------------------------
  //               Relational, Boolean, and Bitwise Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Any, ObjectType.Any)
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
  @operands(ObjectType.Any, ObjectType.Any)
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
  //                             Array Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Integer)
  private array({ value: length }: PostScriptObject) {
    this.pushLiteral(
      Array(length).fill(createLiteral(null, ObjectType.Null)),
      ObjectType.Array
    )
  }

  @builtin('[')
  private arrayStart() {
    this.pushLiteral(undefined, ObjectType.Mark)
  }

  @builtin(']')
  private arrayEnd() {
    const markIndex = this.findIndexOfMark()
    if (markIndex === undefined) {
      throw new Error("]: Can't find mark")
    }
    const list = this.operandStack.splice(markIndex + 1)
    this.operandStack.pop() // Remove mark
    this.pushLiteral(list, ObjectType.Array)
  }

  @builtin('length')
  @operands(ObjectType.Array)
  private arrayLength({ value: elements }: PostScriptObject) {
    return elements.length
  }

  @builtin('get')
  @operands(ObjectType.Array, ObjectType.Integer)
  private getArray(
    { value: elements }: PostScriptObject,
    { value: index }: PostScriptObject
  ) {
    if (elements.length <= index) {
      throw new Error(
        `Index ${index} out of range of array with length ${elements.length}`
      )
    }
    this.operandStack.push(elements[index])
  }

  @builtin('put')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Any)
  private putArray(
    { value: elements }: PostScriptObject,
    { value: index }: PostScriptObject,
    item: PostScriptObject
  ) {
    if (elements.length <= index) {
      throw new Error(
        `Index ${index} out of range of array with length ${elements.length}`
      )
    }
    elements[index] = item
  }

  @builtin('getinterval')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Integer)
  private arrayGetInterval(
    { value: elements }: PostScriptObject,
    { value: index }: PostScriptObject,
    { value: count }: PostScriptObject
  ) {
    if (elements.length <= index) {
      throw new Error(
        `getinterval: index ${index} out of range of array with length ${elements.length}`
      )
    }
    if (elements.length <= index + count) {
      throw new Error(
        `getinterval: index ${index} with count ${count} is out of range of array with length ${elements.length}`
      )
    }
    this.pushLiteral(
      (elements as PostScriptObject[]).slice(index, index + count),
      ObjectType.Array
    )
  }

  @builtin('putinterval')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Array)
  private arrayPutInterval(
    { value: target }: PostScriptObject,
    { value: index }: PostScriptObject,
    { value: source }: PostScriptObject
  ) {
    if (target.length < index + source.length) {
      throw new Error(
        `putinterval: inserting source array with length ${source.length} in array with length ${target.length} starting at index ${index} is out of range`
      )
    }
    ;(target as PostScriptObject[]).splice(index, source.length, ...source)
  }

  @builtin()
  @operands(ObjectType.Array)
  private astore(array: PostScriptObject) {
    const { value: elements } = <{ value: PostScriptObject[] }>array
    if (this.operandStack.length < elements.length) {
      throw new Error(
        `astore: Not enough elements on stack. Required ${elements.length} found ${this.operandStack.length}`
      )
    }
    // Move items from stack into array
    elements.splice(
      0,
      elements.length,
      ...this.operandStack.splice(this.operandStack.length - elements.length)
    )
    this.operandStack.push(array)
  }

  @builtin()
  @operands(ObjectType.Array)
  private aload(array: PostScriptObject) {
    const { value: elements } = <{ value: PostScriptObject[] }>array
    this.operandStack.push(...elements, array)
  }

  @builtin('copy')
  @operands(ObjectType.Array, ObjectType.Array)
  private copyArray(
    { value: source }: PostScriptObject,
    { value: target }: PostScriptObject
  ) {
    // Returns the removed elements of target
    if (target.length < source.length) {
      throw new Error(
        `copy: Cannot copy array of length ${source.length} into array of length ${target.length}`
      )
    }
    const returnedElements = (target as PostScriptObject[]).splice(
      0,
      source.length,
      ...source
    )
    this.pushLiteral(returnedElements, ObjectType.Array)
  }

  // ---------------------------------------------------------------------------
  //                      Graphics State Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private setLineWidth({ value: lineWidth }: PostScriptObject) {
    this.graphicsState.lineWidth = lineWidth
    this.ctx.lineWidth = lineWidth
  }

  @builtin()
  @operands()
  private currentLineWidth() {
    this.pushLiteral(this.graphicsState.lineWidth, ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer)
  private setLineCap({ value: lineCap }: PostScriptObject) {
    switch (lineCap) {
      case LineCap.Butt:
        this.ctx.lineCap = 'butt'
        this.graphicsState.lineCap = LineCap.Butt
        return
      case LineCap.Round:
        this.ctx.lineCap = 'round'
        this.graphicsState.lineCap = LineCap.Round
        return
      case LineCap.Square:
        this.ctx.lineCap = 'square'
        this.graphicsState.lineCap = LineCap.Square
        return
      default:
        throw new Error(`Invalid line cap type ${lineCap}`)
    }
  }

  @builtin()
  private currentLineCap() {
    this.pushLiteral(this.graphicsState.lineCap, ObjectType.Integer)
  }

  @builtin()
  @operands(ObjectType.Integer)
  private setLineJoin({ value: lineJoin }: PostScriptObject) {
    switch (lineJoin) {
      case LineJoin.Miter:
        this.ctx.lineJoin = 'miter'
        this.graphicsState.lineJoin = LineJoin.Miter
        return
      case LineJoin.Round:
        this.ctx.lineJoin = 'round'
        this.graphicsState.lineJoin = LineJoin.Round
        return
      case LineJoin.Bevel:
        this.ctx.lineJoin = 'bevel'
        this.graphicsState.lineJoin = LineJoin.Bevel
        return
      default:
        throw new Error(`Invalid line join type ${lineJoin}`)
    }
  }

  @builtin()
  private currentLineJoin() {
    this.pushLiteral(this.graphicsState.lineJoin, ObjectType.Integer)
  }

  @builtin()
  @operands(ObjectType.Integer)
  private setMiterLimit({ value: miterLimit }: PostScriptObject) {
    this.graphicsState.miterLimit = miterLimit
    this.ctx.miterLimit = miterLimit
  }

  @builtin()
  private currentMiterLimit() {
    this.pushLiteral(this.graphicsState.miterLimit, ObjectType.Integer)
  }

  // TODO: strokeadjust

  @builtin()
  @operands(ObjectType.Array, ObjectType.Name)
  private setColorSpace() {
    // FIXME: Support more than rgb
    this.graphicsState.colorSpace = ColorSpace.DeviceRGB
  }

  @builtin()
  @builtin('setrgbcolor')
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private setColor(
    { value: rInput }: PostScriptObject,
    { value: gInput }: PostScriptObject,
    { value: bInput }: PostScriptObject
  ) {
    //FIXME: Support other colour definitions
    const fitToRgbRange = (number: number) =>
      Math.round(Math.min(Math.max(0, number), 1) * 255)

    const r = fitToRgbRange(rInput)
    const g = fitToRgbRange(gInput)
    const b = fitToRgbRange(bInput)
    const newColor: number = (r << 16) + (g << 8) + b
    this.graphicsState.color = newColor
    this.ctx.strokeStyle = `#${newColor.toString(16).padStart(6, '0')}`
    this.ctx.fillStyle = `#${newColor.toString(16).padStart(6, '0')}`
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
  private currentPoint() {
    const currentPoint = this.graphicsState.path.currentPoint
    this.pushLiteral(currentPoint.x, ObjectType.Real)
    this.pushLiteral(currentPoint.y, ObjectType.Real)
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

  @builtin('rmoveto')
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private relativeMoveTo(x: PostScriptObject, y: PostScriptObject) {
    const currentPoint = this.graphicsState.path.currentPoint
    const offsetCoordinate = this.graphicsState.toDeviceCoordinate({
      x: x.value,
      y: y.value,
    })
    const nextCoordinate = {
      x: currentPoint.x + offsetCoordinate.x,
      y: currentPoint.y + offsetCoordinate.y,
    }
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
    this.graphicsState.path.currentPoint = nextCoordinate
    this.ctx.lineTo(nextCoordinate.x, nextCoordinate.y)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private relativeLineTo(x: PostScriptObject, y: PostScriptObject) {
    const currentPoint = this.graphicsState.path.currentPoint
    const offsetCoordinate = this.graphicsState.toDeviceCoordinate({
      x: x.value,
      y: y.value,
    })
    const nextCoordinate = {
      x: currentPoint.x + offsetCoordinate.x,
      y: currentPoint.y + offsetCoordinate.y,
    }
    this.graphicsState.path.addSegment({
      type: SegmentType.Straight,
      coordinates: [this.graphicsState.path.currentPoint, nextCoordinate],
    })
    this.graphicsState.path.currentPoint = nextCoordinate
    this.ctx.lineTo(nextCoordinate.x, nextCoordinate.y)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private arc(
    { value: x }: PostScriptObject,
    { value: y }: PostScriptObject,
    { value: radius }: PostScriptObject,
    { value: angle1 }: PostScriptObject,
    { value: angle2 }: PostScriptObject
  ) {
    if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
      throw new Error(`Invalid angles ${angle1} or ${angle2}`)
    }
    // FIXME: calculate currentPoint
    const coord = this.graphicsState.toDeviceCoordinate({ x, y })
    this.graphicsState.path.addSegment({
      type: SegmentType.Arc,
      coordinates: [coord],
      angles: [angle1, angle2],
      radius,
      direction: Direction.CounterClockwise,
    })
    this.ctx.arc(
      coord.x,
      coord.y,
      radius,
      degreeToRadians(angle1),
      degreeToRadians(angle2),
      true
    )
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private arcn(
    { value: x }: PostScriptObject,
    { value: y }: PostScriptObject,
    { value: radius }: PostScriptObject,
    { value: angle1 }: PostScriptObject,
    { value: angle2 }: PostScriptObject
  ) {
    if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
      throw new Error(`Invalid angles ${angle1} or ${angle2}`)
    }
    const coord = this.graphicsState.toDeviceCoordinate({ x, y })
    this.graphicsState.path.addSegment({
      type: SegmentType.Arc,
      coordinates: [coord],
      angles: [angle1, angle2],
      radius,
      direction: Direction.Clockwise,
    })
    // FIXME: calculate currentPoint
    this.ctx.arc(
      coord.x,
      coord.y,
      radius,
      degreeToRadians(angle1),
      degreeToRadians(angle2),
      false
    )
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private arct(
    { value: x1 }: PostScriptObject,
    { value: y1 }: PostScriptObject,
    { value: x2 }: PostScriptObject,
    { value: y2 }: PostScriptObject,
    { value: radius }: PostScriptObject
  ) {
    const coordinates = [
      this.graphicsState.toDeviceCoordinate({ x: x1, y: y1 }),
      this.graphicsState.toDeviceCoordinate({ x: x2, y: y2 }),
    ]
    this.graphicsState.path.currentPoint = coordinates[1]!
    this.graphicsState.path.addSegment({
      type: SegmentType.Arc,
      coordinates,
      radius,
    })
    // TODO: ctx arct?
  }

  // TODO: arcto

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private curveto(
    { value: x1 }: PostScriptObject,
    { value: y1 }: PostScriptObject,
    { value: x2 }: PostScriptObject,
    { value: y2 }: PostScriptObject,
    { value: x3 }: PostScriptObject,
    { value: y3 }: PostScriptObject
  ) {
    const cp1 = this.graphicsState.toDeviceCoordinate({ x: x1, y: y1 })
    const cp2 = this.graphicsState.toDeviceCoordinate({ x: x2, y: y2 })
    const endPoint = this.graphicsState.toDeviceCoordinate({ x: x3, y: y3 })
    const coordinates = [cp1, cp2, endPoint]
    this.graphicsState.path.currentPoint = endPoint
    this.graphicsState.path.addSegment({
      type: SegmentType.Bezier,
      coordinates,
    })
    this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private rcurveto(
    { value: x1 }: PostScriptObject,
    { value: y1 }: PostScriptObject,
    { value: x2 }: PostScriptObject,
    { value: y2 }: PostScriptObject,
    { value: x3 }: PostScriptObject,
    { value: y3 }: PostScriptObject
  ) {
    const cp1 = offsetCoordinate(
      toRelativeOffset({ x: x1, y: y1 }, this.graphicsState),
      this.graphicsState.path.currentPoint
    )
    const cp2 = offsetCoordinate(
      toRelativeOffset({ x: x2, y: y2 }, this.graphicsState),
      this.graphicsState.path.currentPoint
    )
    const endPoint = offsetCoordinate(
      toRelativeOffset({ x: x3, y: y3 }, this.graphicsState),
      this.graphicsState.path.currentPoint
    )
    this.graphicsState.path.currentPoint = endPoint
    const coordinates = [cp1, cp2, endPoint]
    this.graphicsState.path.addSegment({
      type: SegmentType.Bezier,
      coordinates,
    })
    this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, endPoint.x, endPoint.y)
  }

  @builtin()
  private closePath() {
    if (!this.graphicsState.path.subpaths.length) {
      // do nothing
      return
    }
    this.graphicsState.path.addSegment({
      type: SegmentType.Straight,
      coordinates: [
        this.graphicsState.path.currentPoint,
        this.graphicsState.path.subpaths[0]![0]!.coordinates![0]!,
      ],
    })
  }

  // ---------------------------------------------------------------------------
  //                         Painting Operators
  // ---------------------------------------------------------------------------
  @builtin()
  private stroke() {
    this.ctx.stroke()
  }

  @builtin()
  private fill() {
    this.ctx.fill()
  }

  @builtin('eofill')
  private evenOddFill() {
    // TODO: Implement actual operator
    this.ctx.fill()
  }

  @builtin('rectstroke')
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private rectangleStrokePlain(
    { value: x }: PostScriptObject,
    { value: y }: PostScriptObject,
    { value: width }: PostScriptObject,
    { value: height }: PostScriptObject
  ) {
    const bottomLeft = this.graphicsState.toDeviceCoordinate({ x, y })
    // To get device width/height
    const topRight = this.graphicsState.toDeviceCoordinate({
      x: x + width,
      y: y + height,
    })
    this.ctx.strokeRect(
      bottomLeft.x,
      bottomLeft.y,
      Math.abs(topRight.x - bottomLeft.x),
      Math.abs(topRight.y - bottomLeft.y) * -1 // multiply by -1 because canvas y axis is flipped
    )
  }

  @builtin('rectfill')
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private rectangleFillPlain(
    { value: x }: PostScriptObject,
    { value: y }: PostScriptObject,
    { value: width }: PostScriptObject,
    { value: height }: PostScriptObject
  ) {
    const bottomLeft = this.graphicsState.toDeviceCoordinate({ x, y })
    // To get device width/height
    const topRight = this.graphicsState.toDeviceCoordinate({
      x: x + width,
      y: y + height,
    })
    this.ctx.fillRect(
      bottomLeft.x,
      bottomLeft.y,
      Math.abs(topRight.x - bottomLeft.x),
      Math.abs(topRight.y - bottomLeft.y) * -1 // multiply by -1 because canvas y axis is flipped
    )
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

  @builtin('for')
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Array
  )
  private _for(
    initial: PostScriptObject,
    increment: PostScriptObject,
    limit: PostScriptObject,
    proc: PostScriptObject
  ) {
    this.beginLoop(
      new ForLoopContext(
        this.executionStack,
        proc,
        this.operandStack,
        initial,
        increment,
        limit
      )
    )
  }

  @builtin()
  private exit() {
    if (this.activeLoop === undefined) {
      throw new Error('exit: No current loop')
    }
    this.activeLoop.exit()
    this.loopStack.pop()
  }

  @builtin()
  private quit(_obj: PostScriptObject) {
    this.stopped = true
  }

  // ---------------------------------------------------------------------------
  //                           File Operators
  // ---------------------------------------------------------------------------

  @builtin('=')
  @operands(ObjectType.Any)
  private debugPrint(obj: PostScriptObject) {
    console.log(prettyPrint(obj))
  }

  @builtin('==')
  @operands(ObjectType.Any)
  private debugPrintObject(obj: PostScriptObject) {
    console.log(obj)
  }

  @builtin('stack')
  private stack() {
    console.log(this.operandStack.map(prettyPrint))
  }

  @builtin('pstack')
  private pstack() {
    console.log(this.operandStack)
  }

  // ---------------------------------------------------------------------------
  //                           File Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.String)
  private show({ value: string }: PostScriptObject) {
    this.ctx.fillText(
      string.asString(),
      this.graphicsState.path.currentPoint.x,
      this.graphicsState.path.currentPoint.y
    )
  }
}
