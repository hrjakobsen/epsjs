import { builtin, operands } from './decorators'
import { PostScriptDictionary } from './dictionary/dictionary'
import { SystemDictionary } from './dictionary/system-dictionary'
import { Ascii85DecodeFilter, CharStreamBackedFile } from './file'
import {
  ArrayForAllLoopContext,
  DictionaryForAllLoopContext,
  ForLoopContext,
  InfiteLoopContext,
  LoopContext,
  RepeatLoopContext,
  StringForAllLoopContext,
} from './loop-context'
import {
  TransformationMatrix,
  matrixFromPostScriptArray,
  matrixMultiply,
  scalingMatrix,
  translationMatrix,
} from './coordinate'
import {
  Access,
  EPSMetaData,
  Executability,
  ObjectType,
  parseNumber,
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
import { PostScriptArray } from './array'
import { CharStream, PostScriptLexer } from './lexer'
import { GraphicsContext, LineCap, LineJoin } from './graphics/context'
import { CanvasBackedGraphicsContext } from './graphics/canvas'

const MAX_STEPS = 100_000
const MAX_DICT_CAPACITY = 1024
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
  private fonts = new PostScriptDictionary(false, 1024)

  private dictionaryStack: PostScriptDictionary[] = [
    new SystemDictionary(),
    new PostScriptDictionary(false, 1024),
  ]
  public operandStack: PostScriptObject[] = []
  private executionStack: (
    | PostScriptObject<ObjectType.Array>
    | PostScriptObject<ObjectType.File>
  )[] = []
  private loopStack: LoopContext[] = []

  private beginLoop(loop: LoopContext) {
    if (this.loopStack.length >= MAX_LOOP_STACK_SIZE) {
      throw new Error('Too many nested loops')
    }
    this.loopStack.push(loop)
  }

  private get printer() {
    if (!this._printer) {
      throw new Error('No printer attached')
    }
    return this._printer
  }

  private stopped = false
  private stepsLeft = MAX_STEPS

  private get dictionary() {
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

  private get activeLoop() {
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

  private resolveBuiltin(operatorName: string): string {
    const overloads = BUILT_INS.get(operatorName)
    if (overloads === undefined) {
      throw new Error(`Unknown builtin ${operatorName}`)
    }
    if (overloads.length === 1) {
      return overloads[0]!
    }

    outer: for (const overloadName of overloads) {
      const overloadTypes = OVERLOADS.get(overloadName)
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
      const value = this.symbolLookup(item)!
      if (value.type === ObjectType.Operator) {
        const methodName = this.resolveBuiltin(
          (value as PostScriptObject<ObjectType.Operator>).value
        )
        if (!(methodName in this)) {
          throw new Error("Can't find builtin method " + methodName)
        }
        const method = (this as any)[methodName].bind(this)
        method()
        return
      } else if (
        value.type === ObjectType.Array &&
        value.attributes.executability === Executability.Executable
      ) {
        // Push procedure to executionStack
        const procedureBody: PostScriptObject<ObjectType.Array> = {
          ...value,
          value: (value as PostScriptObject<ObjectType.Array>).value.copy(),
        }
        this.executionStack.push(procedureBody)
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
    let metadata = {}
    try {
      metadata = new PostScriptScanner(
        new PostScriptLexer(new CharStream(program))
      ).getMetaData()
    } catch (error) {
      console.log('error collecting metadata')
    }
    const interpreter = new PostScriptInterpreter(
      CharStreamBackedFile.fromString(program),
      metadata
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
  private copyStack({
    value: numberOfElements,
  }: PostScriptObject<ObjectType.Integer>) {
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
  private index({ value: offset }: PostScriptObject<ObjectType.Integer>) {
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
    { value: numElements }: PostScriptObject<ObjectType.Integer>,
    { value: numRolls }: PostScriptObject<ObjectType.Integer>
  ) {
    if (this.operandStack.length < numElements) {
      throw new Error('roll: Not enough elements')
    }
    const toRotate = this.operandStack.splice(
      this.operandStack.length - numElements,
      numElements
    )
    for (let i = 0; i < Math.abs(numRolls); ++i) {
      const upwards = numRolls > 0
      if (upwards) {
        toRotate.unshift(toRotate.pop()!)
      } else {
        toRotate.push(toRotate.shift()!)
      }
    }
    this.operandStack.push(...toRotate)
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
  private dict({ value: capacity }: PostScriptObject<ObjectType.Integer>) {
    if (capacity > MAX_DICT_CAPACITY) {
      throw new Error(
        `${capacity} is higher than the max capacity of ${MAX_DICT_CAPACITY}`
      )
    }
    const dictionary = new PostScriptDictionary(false, capacity)
    this.pushLiteral(dictionary, ObjectType.Dictionary)
  }

  // https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
  @builtin('<<')
  private startDict() {
    this.pushLiteral(undefined, ObjectType.Mark)
  }

  // https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=539
  @builtin('>>')
  private endDict() {
    const mark = this.findIndexOfMark()
    if (mark === undefined) {
      throw new Error('>>: Missing mark on stack')
    }
    const elements = this.operandStack.splice(mark + 1)
    this.operandStack.pop() // pop mark
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
  private begin({
    value: dictionary,
  }: PostScriptObject<ObjectType.Dictionary>) {
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
    { value: dictionary }: PostScriptObject<ObjectType.Dictionary>,
    key: PostScriptObject
  ) {
    this.operandStack.push(dictionary.get(key)!)
  }

  @builtin('put')
  @operands(ObjectType.Dictionary, ObjectType.Any, ObjectType.Any)
  private putDict(
    { value: dictionary }: PostScriptObject<ObjectType.Dictionary>,
    key: PostScriptObject,
    value: PostScriptObject
  ) {
    dictionary.set(key, value)
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Any)
  private undef(
    { value: dictionary }: PostScriptObject<ObjectType.Dictionary>,
    key: PostScriptObject
  ) {
    dictionary.remove(key)
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Any)
  private known(
    { value: dictionary }: PostScriptObject<ObjectType.Dictionary>,
    key: PostScriptObject
  ) {
    this.pushLiteral(dictionary.has(key), ObjectType.Boolean)
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
        this.pushLiteral(true, ObjectType.Boolean)
        return
      }
    }
    this.pushLiteral(false, ObjectType.Boolean)
  }

  @builtin()
  private currentDict() {
    this.pushLiteral(this.dictionary, ObjectType.Dictionary)
  }

  @builtin()
  private countDictStack() {
    this.pushLiteral(this.dictionaryStack.length, ObjectType.Integer)
  }

  @builtin('forall')
  @operands(ObjectType.Dictionary, ObjectType.Array)
  private forallDictionary(
    dictionary: PostScriptObject<ObjectType.Dictionary>,
    proc: PostScriptObject<ObjectType.Array>
  ) {
    this.beginLoop(
      new DictionaryForAllLoopContext(
        this.executionStack,
        proc,
        this.operandStack,
        dictionary
      )
    )
  }

  // TODO: cleardictstack, dictstack, forall, default dictionaries

  // ---------------------------------------------------------------------------
  //                          String Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Integer)
  private string({ value: length }: PostScriptObject<ObjectType.Integer>) {
    // TODO: Enforce max string length
    this.pushLiteral(new PostScriptString(length), ObjectType.String)
  }

  @builtin('length')
  @operands(ObjectType.String)
  private stringLength({ value: string }: PostScriptObject<ObjectType.String>) {
    this.pushLiteral(string.length, ObjectType.Integer)
  }

  @builtin('get')
  @operands(ObjectType.String, ObjectType.Integer)
  private stringGet(
    { value: string }: PostScriptObject<ObjectType.String>,
    { value: index }: PostScriptObject<ObjectType.Integer>
  ) {
    this.pushLiteral(string.get(index), ObjectType.Integer)
  }

  @builtin('put')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private stringPut(
    { value: string }: PostScriptObject<ObjectType.String>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    { value: newValue }: PostScriptObject<ObjectType.Integer>
  ) {
    string.set(index, newValue)
  }

  @builtin('getinterval')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.Integer)
  private stringGetInterval(
    { value: string }: PostScriptObject<ObjectType.String>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    { value: count }: PostScriptObject<ObjectType.Integer>
  ) {
    if (index < 0 || count < 0 || index + count > string.length) {
      throw new Error(
        `Invalid substring with index ${index} and count ${count}`
      )
    }
    this.pushLiteral(
      PostScriptString.fromCharCode(...string.data.slice(index, index + count)),
      ObjectType.String
    )
  }

  @builtin('putinterval')
  @operands(ObjectType.String, ObjectType.Integer, ObjectType.String)
  private stringPutInterval(
    { value: target }: PostScriptObject<ObjectType.String>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    { value: source }: PostScriptObject<ObjectType.String>
  ) {
    if (index < 0) {
      throw new Error('putinterval: index cannot be negative')
    }

    if (!(target.length < source.length + index)) {
      throw new Error(
        `putinterval: Cannot fit string of length ${source.length} into string of length ${target.length} starting at index ${index}`
      )
    }

    target.data.splice(index, source.length, ...source.data)
  }

  @builtin('copy')
  @operands(ObjectType.String, ObjectType.String)
  private copyString(
    { value: source }: PostScriptObject<ObjectType.String>,
    { value: target }: PostScriptObject<ObjectType.String>
  ) {
    if (!(target.length < source.length)) {
      throw new Error(
        `putinterval: Cannot fit string of length ${source.length} into string of length ${target.length}`
      )
    }

    const removed = target.data.splice(0, source.length, ...source.data)
    this.pushLiteral(
      PostScriptString.fromCharCode(...removed),
      ObjectType.String
    )
  }

  @builtin('forall')
  @operands(ObjectType.String, ObjectType.Array)
  private forallString(
    string: PostScriptObject<ObjectType.String>,
    proc: PostScriptObject<ObjectType.Array>
  ) {
    this.beginLoop(
      new StringForAllLoopContext(
        this.executionStack,
        proc,
        this.operandStack,
        string
      )
    )
  }

  @builtin()
  @operands(ObjectType.String, ObjectType.String)
  private anchorSearch(
    haystack: PostScriptObject<ObjectType.String>,
    { value: needle }: PostScriptObject<ObjectType.String>
  ) {
    const matches = haystack.value.anchorSearch(needle)
    if (!matches) {
      this.operandStack.push(haystack)
      this.pushLiteral(false, ObjectType.Boolean)
      return
    }
    const match = haystack.value.subString(0, needle.length)
    const post = haystack.value.subString(needle.length)
    this.pushLiteral(post, ObjectType.String)
    this.pushLiteral(match, ObjectType.String)
    this.pushLiteral(true, ObjectType.Boolean)
  }

  @builtin()
  @operands(ObjectType.String, ObjectType.String)
  private seek(
    haystack: PostScriptObject<ObjectType.String>,
    { value: needle }: PostScriptObject<ObjectType.String>
  ) {
    const matchIndex = haystack.value.search(needle)
    if (matchIndex === false) {
      this.operandStack.push(haystack)
      this.pushLiteral(false, ObjectType.Boolean)
      return
    }
    const pre = haystack.value.subString(0, matchIndex)
    const match = haystack.value.subString(matchIndex, needle.length)
    const post = haystack.value.subString(matchIndex + needle.length)
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
    {
      value: v1,
      type: t1,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >
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
    {
      value: v1,
      type: t1,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >
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
    {
      value: v1,
      type: t1,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >
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
    {
      value: v1,
      type: t1,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.String
    >
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
    {
      value: v1,
      type: t1,
    }: PostScriptObject<ObjectType.Boolean | ObjectType.Integer>,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<ObjectType.Boolean | ObjectType.Integer>
  ) {
    if (t1 !== t2) {
      throw new Error('and requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 && v2, ObjectType.Boolean)
    } else {
      this.pushLiteral((v1 as number) & (v2 as number), ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Boolean,
    ObjectType.Integer | ObjectType.Boolean
  )
  private or(
    {
      value: v1,
      type: t1,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Boolean>,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Boolean>
  ) {
    if (t1 !== t2) {
      throw new Error('or requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 || v2, ObjectType.Boolean)
    } else {
      this.pushLiteral((v1 as number) | (v2 as number), ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Boolean,
    ObjectType.Integer | ObjectType.Boolean
  )
  private xor(
    {
      value: v1,
      type: t1,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Boolean>,
    {
      value: v2,
      type: t2,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Boolean>
  ) {
    if (t1 !== t2) {
      throw new Error('xor requires same type of params')
    }
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(v1 || (v2 && (!v1 || !v2)), ObjectType.Boolean)
    } else {
      this.pushLiteral((v1 as number) ^ (v2 as number), ObjectType.Boolean)
    }
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private bitshift(
    { value }: PostScriptObject<ObjectType.Integer>,
    { value: shift }: PostScriptObject<ObjectType.Integer>
  ) {
    this.pushLiteral(
      shift ? value << shift : value >> shift,
      ObjectType.Integer
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Boolean)
  private not({
    value: v1,
    type: t1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Boolean>) {
    if (t1 === ObjectType.Boolean) {
      this.pushLiteral(!v1, ObjectType.Boolean)
    } else {
      this.pushLiteral(~v1, ObjectType.Integer)
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
    {
      type: t1,
      value: v1,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    {
      type: t2,
      value: v2,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
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
    { value: v1 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: v2 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.pushLiteralNumber(v1 / v2, ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private idiv(
    { value: v1 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: v2 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.pushLiteralNumber(Math.floor(v1 / v2))
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Integer)
  private mod(
    { value: v1 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: v2 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.pushLiteralNumber(v1 % v2)
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private mul(
    {
      type: t1,
      value: v1,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    {
      type: t2,
      value: v2,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
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
    {
      type: t1,
      value: v1,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    {
      type: t2,
      value: v2,
    }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    const isReal = t1 === ObjectType.Real || t2 === ObjectType.Real
    this.pushLiteralNumber(
      v1 - v2,
      isReal ? ObjectType.Real : ObjectType.Integer
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private abs({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      Math.abs(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private neg({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(-v1, t1 as ObjectType.Integer | ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private ceiling({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      Math.ceil(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private floor({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      Math.ceil(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private round({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      Math.round(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private truncate({
    type: t1,
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      Math.trunc(v1),
      t1 as ObjectType.Integer | ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private sqrt({
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(Math.sqrt(v1), ObjectType.Real)
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private atan(
    { value: v1 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: v2 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.pushLiteralNumber(
      radiansToDegrees(Math.atan(v1 / v2)),
      ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private cos({
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(
      radiansToDegrees(Math.cos(degreeToRadians(v1))),
      ObjectType.Real
    )
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private sin({
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
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
    { value: v1 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: v2 }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.pushLiteralNumber(Math.pow(v1, v2), ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private ln({
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.pushLiteralNumber(Math.log2(v1), ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private log({
    value: v1,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
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
  private array({ value: length }: PostScriptObject<ObjectType.Integer>) {
    this.pushLiteral(
      new PostScriptArray(
        Array(length).fill(createLiteral(null, ObjectType.Null))
      ),
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
    this.pushLiteral(new PostScriptArray(list), ObjectType.Array)
  }

  @builtin('length')
  @operands(ObjectType.Array)
  private arrayLength({ value: elements }: PostScriptObject<ObjectType.Array>) {
    this.pushLiteral(elements.length, ObjectType.Integer)
  }

  @builtin('get')
  @operands(ObjectType.Array, ObjectType.Integer)
  private getArray(
    { value: elements }: PostScriptObject<ObjectType.Array>,
    { value: index }: PostScriptObject<ObjectType.Integer>
  ) {
    if (elements.length <= index) {
      throw new Error(
        `Index ${index} out of range of array with length ${elements.length}`
      )
    }
    this.operandStack.push(elements.get(index)!)
  }

  @builtin('put')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Any)
  private putArray(
    { value: elements }: PostScriptObject<ObjectType.Array>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    item: PostScriptObject
  ) {
    if (elements.length <= index) {
      throw new Error(
        `Index ${index} out of range of array with length ${elements.length}`
      )
    }
    elements.set(index, item)
  }

  @builtin('getinterval')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Integer)
  private arrayGetInterval(
    { value: elements }: PostScriptObject<ObjectType.Array>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    { value: count }: PostScriptObject<ObjectType.Integer>
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
    this.pushLiteral(elements.slice(index, index + count), ObjectType.Array)
  }

  @builtin('putinterval')
  @operands(ObjectType.Array, ObjectType.Integer, ObjectType.Array)
  private arrayPutInterval(
    { value: target }: PostScriptObject<ObjectType.Array>,
    { value: index }: PostScriptObject<ObjectType.Integer>,
    { value: source }: PostScriptObject<ObjectType.Array>
  ) {
    if (target.length < index + source.length) {
      throw new Error(
        `putinterval: inserting source array with length ${source.length} in array with length ${target.length} starting at index ${index} is out of range`
      )
    }
    target.splice(index, source.length, source)
  }

  @builtin()
  @operands(ObjectType.Array)
  private astore(array: PostScriptObject<ObjectType.Array>) {
    const { value: elements } = array
    if (this.operandStack.length < elements.length) {
      throw new Error(
        `astore: Not enough elements on stack. Required ${elements.length} found ${this.operandStack.length}`
      )
    }
    // Move items from stack into array
    elements.splice(
      0,
      elements.length,
      new PostScriptArray([
        ...this.operandStack.splice(this.operandStack.length - elements.length),
      ])
    )
    this.operandStack.push(array)
  }

  @builtin()
  @operands(ObjectType.Array)
  private aload(array: PostScriptObject<ObjectType.Array>) {
    this.operandStack.push(...array.value.items, array)
  }

  @builtin('copy')
  @operands(ObjectType.Array, ObjectType.Array)
  private copyArray(
    { value: source }: PostScriptObject<ObjectType.Array>,
    { value: target }: PostScriptObject<ObjectType.Array>
  ) {
    // Returns the removed elements of target
    if (target.length < source.length) {
      throw new Error(
        `copy: Cannot copy array of length ${source.length} into array of length ${target.length}`
      )
    }
    const returnedElements = target.splice(0, source.length, source)
    this.pushLiteral(returnedElements, ObjectType.Array)
  }

  @builtin('forall')
  @operands(ObjectType.Array, ObjectType.Array)
  private forallArray(
    array: PostScriptObject<ObjectType.Array>,
    proc: PostScriptObject<ObjectType.Array>
  ) {
    this.beginLoop(
      new ArrayForAllLoopContext(
        this.executionStack,
        proc,
        this.operandStack,
        array
      )
    )
  }

  // ---------------------------------------------------------------------------
  //                      Virtual Memory Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private save() {
    // TODO: Implement
    this.pushLiteral(1, ObjectType.Integer)
  }

  @builtin()
  @operands(ObjectType.Any)
  private restore(_val: PostScriptObject) {
    // TODO: Implement
  }

  // ---------------------------------------------------------------------------
  //                      Miscellaneous Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Array)
  private bind(proc: PostScriptObject<ObjectType.Array>) {
    // TODO: implement recursive binding
    this.operandStack.push(proc)
  }

  // ---------------------------------------------------------------------------
  //                      Graphics State Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private gsave() {
    this.printer.save()
  }

  @builtin()
  private grestore() {
    this.printer.restore()
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private setLineWidth({
    value: lineWidth,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.printer.setLineWidth(lineWidth)
  }

  @builtin()
  @operands()
  private currentLineWidth() {
    this.pushLiteral(this.printer.getLineWidth(), ObjectType.Real)
  }

  @builtin()
  @operands(ObjectType.Integer)
  private setLineCap({ value: lineCap }: PostScriptObject<ObjectType.Integer>) {
    if (lineCap in LineCap) {
      this.printer.setLineCap(lineCap)
    } else {
      throw new Error('Invalid line cap type')
    }
  }

  @builtin()
  private currentLineCap() {
    this.pushLiteral(this.printer.getLineCap(), ObjectType.Integer)
  }

  @builtin()
  @operands(ObjectType.Integer)
  private setLineJoin({
    value: lineJoin,
  }: PostScriptObject<ObjectType.Integer>) {
    if (lineJoin in LineJoin) {
      this.printer.setLineJoin(lineJoin)
    } else {
      throw new Error('Invalid line join type')
    }
  }

  @builtin()
  private currentLineJoin() {
    this.pushLiteral(this.printer.getLineJoin(), ObjectType.Integer)
  }

  @builtin()
  @operands(ObjectType.Integer | ObjectType.Real)
  private setMiterLimit({
    value: miterLimit,
  }: PostScriptObject<ObjectType.Integer | ObjectType.Real>) {
    this.printer.setMiterLimit(miterLimit)
  }

  @builtin()
  private currentMiterLimit() {
    this.pushLiteral(this.printer.getMiterLimit(), ObjectType.Integer)
  }

  // TODO: strokeadjust

  @builtin()
  @operands(ObjectType.Array, ObjectType.Name)
  private setColorSpace() {
    // FIXME: Support more than rgb
  }

  @builtin()
  @builtin('setrgbcolor')
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private setColor(
    { value: rInput }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: gInput }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: bInput }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    //FIXME: Support other colour definitions
    const fitToRgbRange = (number: number) =>
      Math.round(Math.min(Math.max(0, number), 1) * 255)

    const r = fitToRgbRange(rInput)
    const g = fitToRgbRange(gInput)
    const b = fitToRgbRange(bInput)
    this.printer.setRgbColor(r, g, b)
  }

  @builtin()
  @operands(ObjectType.Real | ObjectType.Integer)
  private setGray({
    value: gray,
  }: PostScriptObject<ObjectType.Real | ObjectType.Integer>) {
    if (gray < 0 || gray > 1) {
      throw new Error('Invalid gray value')
    }
    this.printer.setRgbColor(gray * 255, gray * 255, gray * 255)
  }

  // ---------------------------------------------------------------------------
  //                      Graphics State Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Array)
  private concat(matrix: PostScriptObject<ObjectType.Array>) {
    const transformationMatrix = matrixFromPostScriptArray(matrix)
    this.printer.concat(transformationMatrix)
  }

  @builtin()
  @operands(ObjectType.Array, ObjectType.Integer | ObjectType.Real)
  private setDash(
    { value: array }: PostScriptObject<ObjectType.Array>,
    { value: offset }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    for (const item of array.items) {
      if (item.type !== ObjectType.Integer && item.type !== ObjectType.Real) {
        throw new Error('Invalid dash array')
      }
    }
    this.printer.setDash(
      array.map((x) => x.value as number),
      offset
    )
  }

  // ---------------------------------------------------------------------------
  //                  Coordinate System and Matrix Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands()
  private matrix() {
    this.pushLiteral(
      new PostScriptArray(
        [1, 0, 0, 1, 0, 0].map((x) => createLiteral(x, ObjectType.Real))
      ),
      ObjectType.Array
    )
  }

  @builtin()
  @operands(ObjectType.Array)
  private currentMatrix(matrix: PostScriptObject<ObjectType.Array>) {
    if (matrix.value.length !== 6) {
      throw new Error(
        `currentmatrix: Invalid matrix length ${matrix.value.length}`
      )
    }
    matrix.value = new PostScriptArray(
      this.printer
        .getTransformationMatrix()
        .map((x) => createLiteral(x, ObjectType.Real))
    )
    this.operandStack.push(matrix)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  private translate(
    offsetXOrY: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    offsetYOrMatrix: PostScriptObject<
      ObjectType.Real | ObjectType.Integer | ObjectType.Array
    >
  ) {
    let offsetX: PostScriptObject<ObjectType.Real | ObjectType.Integer>
    let offsetY: PostScriptObject<ObjectType.Real | ObjectType.Integer>
    const modifyCTM = offsetYOrMatrix.type !== ObjectType.Array
    if (!modifyCTM) {
      offsetY = offsetXOrY
      const topOfStack = this.operandStack.pop()
      if (
        topOfStack?.type !== ObjectType.Real &&
        topOfStack?.type !== ObjectType.Integer
      ) {
        throw new Error('translate: Invalid x offset')
      }
      offsetX = topOfStack
    } else {
      offsetX = offsetXOrY
      offsetY = offsetYOrMatrix
    }
    const translation = translationMatrix(offsetX.value, offsetY.value)
    if (modifyCTM) {
      this.printer.concat(translation)
    } else {
      offsetYOrMatrix.value = new PostScriptArray(
        translation.map((number) => createLiteral(number, ObjectType.Real))
      )
      this.operandStack.push(offsetYOrMatrix)
    }
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer | ObjectType.Array
  )
  private scale(
    scaleXOrY: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    scaleYOrMatrix: PostScriptObject<
      ObjectType.Real | ObjectType.Integer | ObjectType.Array
    >
  ) {
    let scaleX: PostScriptObject<ObjectType.Real | ObjectType.Integer>
    let scaleY: PostScriptObject<ObjectType.Real | ObjectType.Integer>
    const modifyCTM = scaleYOrMatrix.type !== ObjectType.Array
    if (!modifyCTM) {
      scaleY = scaleXOrY
      const topOfStack = this.operandStack.pop()
      if (
        topOfStack?.type !== ObjectType.Real &&
        topOfStack?.type !== ObjectType.Integer
      ) {
        throw new Error('scale: Invalid x scale')
      }
      scaleX = topOfStack
    } else {
      scaleX = scaleXOrY
      scaleY = scaleYOrMatrix
    }
    const scale = scalingMatrix(scaleX.value, scaleY.value)
    if (modifyCTM) {
      this.printer.concat(scale)
    } else {
      scaleYOrMatrix.value = new PostScriptArray(
        scale.map((number) => createLiteral(number, ObjectType.Real))
      )
      this.operandStack.push(scaleYOrMatrix)
    }
  }

  // ---------------------------------------------------------------------------
  //                       Path Construction Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private newPath() {
    this.printer.newPath()
  }

  @builtin()
  private currentPoint() {
    const currentPoint = this.printer.getCurrentPoint()
    this.pushLiteral(currentPoint.x, ObjectType.Real)
    this.pushLiteral(currentPoint.y, ObjectType.Real)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private moveTo(
    x: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    y: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    const nextCoordinate = {
      x: x.value,
      y: y.value,
    }
    this.printer.moveTo(nextCoordinate)
  }

  @builtin('rmoveto')
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private relativeMoveTo(
    x: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    y: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    const currentPoint = this.printer.getCurrentPoint()
    const nextCoordinate = {
      x: currentPoint.x + x.value,
      y: currentPoint.y + y.value,
    }
    this.printer.moveTo(nextCoordinate)
  }

  @builtin()
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private lineTo(
    x: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    y: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    this.printer.lineTo({ x: x.value, y: y.value })
  }

  @builtin('rlineto')
  @operands(
    ObjectType.Real | ObjectType.Integer,
    ObjectType.Real | ObjectType.Integer
  )
  private relativeLineTo(
    x: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    y: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    const currentPoint = this.printer.getCurrentPoint()
    const nextCoordinate = {
      x: currentPoint.x + x.value,
      y: currentPoint.y + y.value,
    }
    this.printer.lineTo(nextCoordinate)
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
    { value: x }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: radius }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: angle1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: angle2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
      throw new Error(`Invalid angles ${angle1} or ${angle2}`)
    }
    this.printer.arc({ x, y }, radius, angle1, angle2, true)
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
    { value: x }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: radius }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: angle1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: angle2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    if (angle1 < 0 || angle1 > 360 || angle2 < 0 || angle2 > 360) {
      throw new Error(`Invalid angles ${angle1} or ${angle2}`)
    }
    this.printer.arc({ x, y }, radius, angle1, angle2, false)
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
    { value: _x1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: _y1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: _x2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: _y2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: _radius }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    // TODO: ctx arct?
    throw new Error('arct: Not implemented')
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
    { value: x1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: x2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: x3 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y3 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    this.printer.bezierCurveTo(
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 }
    )
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
    { value: x1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y1 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: x2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y2 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: x3 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y3 }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    const currentPoint = this.printer.getCurrentPoint()
    const cp1 = { x: currentPoint.x + x1, y: currentPoint.y + y1 }
    const cp2 = { x: currentPoint.x + x2, y: currentPoint.y + y2 }
    const endPoint = { x: currentPoint.x + x3, y: currentPoint.y + y3 }
    this.printer.bezierCurveTo(cp1, cp2, endPoint)
  }

  @builtin()
  private closePath() {
    this.printer.closePath()
  }

  @builtin()
  private clip() {
    this.printer.clip()
  }

  @builtin()
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private rectClip(
    { value: x }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: y }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: width }: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    { value: height }: PostScriptObject<ObjectType.Integer | ObjectType.Real>
  ) {
    this.printer.rectClip({ x, y }, width, height)
  }

  // ---------------------------------------------------------------------------
  //                         Painting Operators
  // ---------------------------------------------------------------------------
  @builtin()
  private stroke() {
    this.printer.stroke()
  }

  @builtin()
  private fill() {
    this.printer.fill()
  }

  @builtin('eofill')
  private evenOddFill() {
    this.printer.eofill()
  }

  @builtin('rectstroke')
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private rectangleStrokePlain(
    { value: x }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: width }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: height }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    this.printer.strokeRect({ x, y }, width, height)
  }

  @builtin('rectfill')
  @operands(
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real,
    ObjectType.Integer | ObjectType.Real
  )
  private rectangleFillPlain(
    { value: x }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: y }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: width }: PostScriptObject<ObjectType.Real | ObjectType.Integer>,
    { value: height }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    this.printer.fillRect({ x, y }, width, height)
  }

  // ---------------------------------------------------------------------------
  //                           Control Operators
  // ---------------------------------------------------------------------------

  @builtin('if')
  @operands(ObjectType.Boolean, ObjectType.Array)
  private _if(
    { value: bool }: PostScriptObject<ObjectType.Boolean>,
    procedure: PostScriptObject<ObjectType.Array>
  ) {
    if (procedure.attributes.executability === Executability.Literal) {
      throw new Error('Second argument to if is not a procedure')
    }
    if (bool) {
      this.executionStack.push({ ...procedure, value: procedure.value.copy() })
    }
  }

  @builtin()
  @operands(ObjectType.Boolean, ObjectType.Array, ObjectType.Array)
  private ifelse(
    { value: bool }: PostScriptObject<ObjectType.Boolean>,
    procedureTrue: PostScriptObject<ObjectType.Array>,
    procedureFalse: PostScriptObject<ObjectType.Array>
  ) {
    if (
      procedureTrue.attributes.executability === Executability.Literal ||
      procedureFalse.attributes.executability === Executability.Literal
    ) {
      throw new Error('Second argument to if is not a procedure')
    }
    if (bool) {
      this.executionStack.push({
        ...procedureTrue,
        value: procedureTrue.value.copy(),
      })
    } else {
      this.executionStack.push({
        ...procedureFalse,
        value: procedureFalse.value.copy(),
      })
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
    initial: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    increment: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    limit: PostScriptObject<ObjectType.Integer | ObjectType.Real>,
    proc: PostScriptObject<ObjectType.Array>
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
  @operands(ObjectType.Array)
  private loop(proc: PostScriptObject) {
    this.beginLoop(new InfiteLoopContext(this.executionStack, proc))
  }

  @builtin()
  @operands(ObjectType.Integer, ObjectType.Array)
  private repeat(iterations: PostScriptObject, proc: PostScriptObject) {
    this.beginLoop(new RepeatLoopContext(this.executionStack, proc, iterations))
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

  // https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
  @builtin('=')
  @operands(ObjectType.Any)
  private debugPrint(obj: PostScriptObject) {
    console.log(prettyPrint(obj))
  }

  // https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=540
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
  //             Type, Attribute, and Conversion Operators
  // ---------------------------------------------------------------------------

  @builtin()
  @operands(ObjectType.Any)
  private type({ type }: PostScriptObject) {
    let name
    switch (type) {
      case ObjectType.Boolean:
        name = 'booleantype'
        break
      case ObjectType.FontID:
        name = 'fonttype'
        break
      case ObjectType.Integer:
        name = 'integertype'
        break
      case ObjectType.Mark:
        name = 'marktype'
        break
      case ObjectType.Name:
        name = 'nametype'
        break
      case ObjectType.Null:
        name = 'nulltype'
        break
      case ObjectType.Operator:
        name = 'operatortype'
        break
      case ObjectType.Real:
        name = 'realtype'
        break
      case ObjectType.Array:
        name = 'arraytype'
        break
      case ObjectType.Dictionary:
        name = 'dicttype'
        break
      case ObjectType.File:
        name = 'filetype'
        break
      case ObjectType.GState:
        name = 'gstatetype'
        break
      case ObjectType.PackedArray:
        name = 'packedarraytype'
        break
      case ObjectType.Save:
        name = 'savetype'
        break
      case ObjectType.String:
        name = 'stringtype'
        break
      default:
        name = 'unknown'
    }
    this.operandStack.push({
      type: ObjectType.Name,
      attributes: {
        executability: Executability.Executable,
        access: Access.Unlimited,
      },
      value: name,
    })
  }

  @builtin()
  @operands(ObjectType.Any)
  private cvlit(obj: PostScriptObject) {
    obj.attributes.executability = Executability.Literal
    this.operandStack.push(obj)
  }

  @builtin()
  @operands(ObjectType.Any)
  private cvx(obj: PostScriptObject) {
    obj.attributes.executability = Executability.Executable
    this.operandStack.push(obj)
  }

  @builtin()
  @operands(ObjectType.Any)
  private xcheck(obj: PostScriptObject) {
    this.operandStack.push(
      createLiteral(
        obj.attributes.executability === Executability.Executable,
        ObjectType.Boolean
      )
    )
  }

  @builtin()
  @operands(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.String
  )
  private executeonly(obj: PostScriptObject) {
    obj.attributes.access = Access.ExecuteOnly
    this.operandStack.push(obj)
  }

  @builtin()
  @operands(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  private noaccess(obj: PostScriptObject) {
    obj.attributes.access = Access.None
    this.operandStack.push(obj)
  }

  @builtin()
  @operands(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  private readonly(obj: PostScriptObject) {
    obj.attributes.access = Access.ReadOnly
    this.operandStack.push(obj)
  }

  @builtin()
  @operands(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  private rcheck(obj: PostScriptObject) {
    this.operandStack.push(
      createLiteral(
        Boolean(obj.attributes.access | (Access.ReadOnly | Access.Unlimited)),
        ObjectType.Boolean
      )
    )
  }

  @builtin()
  @operands(
    ObjectType.Array |
      ObjectType.PackedArray |
      ObjectType.File |
      ObjectType.Dictionary |
      ObjectType.String
  )
  private wcheck(obj: PostScriptObject) {
    this.operandStack.push(
      createLiteral(
        Boolean(obj.attributes.access | Access.Unlimited),
        ObjectType.Boolean
      )
    )
  }

  @builtin()
  @operands(ObjectType.String | ObjectType.Real | ObjectType.Integer)
  private cvi(
    obj: PostScriptObject<
      ObjectType.String | ObjectType.Real | ObjectType.Integer
    >
  ) {
    // Convert to integer
    let res: number
    if (obj.type === ObjectType.String) {
      res = parseNumber(obj.value.toString()).value
    } else {
      res = (obj as PostScriptObject<ObjectType.Integer | ObjectType.Real>)
        .value
    }
    this.operandStack.push(createLiteral(Math.trunc(res), ObjectType.Integer))
  }

  @builtin()
  @operands(ObjectType.String | ObjectType.Real | ObjectType.Integer)
  private cvn(obj: PostScriptObject<ObjectType.String>) {
    // Convert to name
    this.operandStack.push({
      attributes: {
        executability: obj.attributes.executability,
        access: obj.attributes.access,
      },
      type: ObjectType.Name,
      value: obj.value.asString(),
    })
  }

  @builtin()
  @operands(ObjectType.String | ObjectType.Real | ObjectType.Integer)
  private cvr(
    obj: PostScriptObject<
      ObjectType.String | ObjectType.Real | ObjectType.Integer
    >
  ) {
    // Convert to real
    let res: number
    if (obj.type === ObjectType.String) {
      res = parseNumber(obj.value.toString()).value
    } else {
      res = (obj as PostScriptObject<ObjectType.Integer | ObjectType.Real>)
        .value
    }
    this.operandStack.push(createLiteral(res, ObjectType.Real))
  }

  // ---------------------------------------------------------------------------
  //                           File Operators
  // ---------------------------------------------------------------------------
  @builtin()
  @operands(ObjectType.File, ObjectType.String)
  private readString(
    { value: file }: PostScriptObject<ObjectType.File>,
    { value: target }: PostScriptObject<ObjectType.String>
  ) {
    const result = file.readString(target)
    this.operandStack.push(
      createLiteral(result.substring, ObjectType.String),
      createLiteral(result.success, ObjectType.Boolean)
    )
  }

  @builtin()
  @operands(ObjectType.File, ObjectType.Name)
  private filter(
    { value: inputFile }: PostScriptObject<ObjectType.File>,
    name: PostScriptObject<ObjectType.Name>
  ) {
    if (name.attributes.executability !== Executability.Literal) {
      throw new Error('filter: Must be a literal name')
    }
    if (name.value !== 'ASCII85Decode') {
      throw new Error(`Unsupported filter: ${name.value}`)
    }
    this.operandStack.push(
      createLiteral(new Ascii85DecodeFilter(inputFile), ObjectType.File)
    )
  }

  @builtin()
  private currentFile() {
    const files = this.executionStack.filter((x) => x.type === ObjectType.File)
    if (files.length === 0) {
      throw new Error('No current file')
    }
    this.operandStack.push(
      createLiteral(files[files.length - 1]!.value, ObjectType.File)
    )
  }

  @builtin('file')
  @builtin('write')
  @builtin('closefile')
  @builtin('flush')
  @builtin('flushfile')
  @builtin('resetfile')
  @builtin('run')
  @builtin('deletefile')
  @builtin('renamefile')
  @builtin('filenameforall')
  @builtin('print')
  @builtin('printobject')
  @builtin('writeobject')
  @builtin('setobjectformat')
  @builtin('currentobjectformat')
  private fileerror() {
    throw new Error('not supported')
  }

  @builtin()
  @operands(ObjectType.String)
  private show({ value: string }: PostScriptObject<ObjectType.String>) {
    this.printer.fillText(string.asString(), this.printer.getCurrentPoint())
  }

  // ---------------------------------------------------------------------------
  //                 Device Setup and Output Operators
  // ---------------------------------------------------------------------------

  @builtin()
  private showPage() {
    // Do nothing
  }

  @builtin()
  private debug() {
    // eslint-disable-next-line no-debugger
    debugger
  }

  // ---------------------------------------------------------------------------
  //                         Glyph and Font Operators
  // ---------------------------------------------------------------------------

  private _findFont(key: PostScriptObject<ObjectType.Any>) {
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

  @builtin()
  @operands(ObjectType.Any)
  private findFont(key: PostScriptObject<ObjectType.Any>) {
    const font = this._findFont(key)
    this.pushLiteral(font, ObjectType.Dictionary)
  }

  @builtin()
  @operands(ObjectType.Dictionary)
  private setFont({ value: font }: PostScriptObject<ObjectType.Dictionary>) {
    if (!font.isFontDictionary()) {
      throw new Error('setFont: Not a font dictionary')
    }
    this.printer.setFont(font)
  }

  private _scaleFontMatrix(
    font: PostScriptDictionary,
    matrix: TransformationMatrix
  ) {
    if (!font.isFontDictionary()) {
      throw new Error('Not a font dictionary')
    }
    const fontMatrix = (
      font.searchByName('FontMatrix')!.value as PostScriptArray
    ).map((x) => x.value as number) as TransformationMatrix
    const newMatrix = matrixMultiply(matrix, fontMatrix)
    font.set(
      createLiteral('FontMatrix', ObjectType.Name),
      createLiteral(
        new PostScriptArray(newMatrix.map(createLiteral)),
        ObjectType.Array
      )
    )
  }

  private _scaleFont(font: PostScriptDictionary, scale: number) {
    if (!font.isFontDictionary()) {
      throw new Error('scalefont: Not a font dictionary')
    }
    const copy = font.copy()
    this._scaleFontMatrix(copy, scalingMatrix(scale, scale))
    return copy
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Real | ObjectType.Integer)
  private scaleFont(
    { value: font }: PostScriptObject<ObjectType.Dictionary>,
    { value: scale }: PostScriptObject<ObjectType.Real | ObjectType.Integer>
  ) {
    const copy = this._scaleFont(font, scale)
    this.pushLiteral(copy, ObjectType.Dictionary)
  }

  @builtin()
  @operands(ObjectType.Any, ObjectType.Dictionary)
  private defineFont(
    key: PostScriptObject<ObjectType.Any>,
    font: PostScriptObject<ObjectType.Dictionary>
  ) {
    if (!font.value.isFontDictionary()) {
      throw new Error('definefont: Not a font dictionary')
    }
    this.fonts.set(key, font)
    this.operandStack.push(font)
  }

  @builtin()
  @operands(
    ObjectType.Any,
    ObjectType.Integer | ObjectType.Real | ObjectType.Array
  )
  private selectFont(
    key: PostScriptObject<ObjectType.Any>,
    scaleOrMatrix: PostScriptObject<
      ObjectType.Integer | ObjectType.Real | ObjectType.Array
    >
  ) {
    const font = this._findFont(key).copy()
    if (scaleOrMatrix.type === ObjectType.Array) {
      this._scaleFontMatrix(font, matrixFromPostScriptArray(scaleOrMatrix))
      this.printer.setFont(font)
    } else {
      const scale = scaleOrMatrix.value as number
      const scaledFont = this._scaleFont(font, scale)
      this.printer.setFont(scaledFont)
    }
  }

  @builtin()
  @operands(ObjectType.Dictionary, ObjectType.Array)
  private makeFont(
    font: PostScriptObject<ObjectType.Dictionary>,
    matrix: PostScriptObject<ObjectType.Array>
  ) {
    if (!font.value.isFontDictionary()) {
      throw new Error('makefont: Not a font dictionary')
    }
    const copy = font.value.copy()
    this._scaleFontMatrix(copy, matrixFromPostScriptArray(matrix))
    this.operandStack.push(createLiteral(copy, ObjectType.Dictionary))
  }
}
