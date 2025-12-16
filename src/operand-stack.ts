import {
  RangeCheckError,
  StackUnderflowError,
  TypecheckError,
  UnmatchedMarkError,
} from './error'
import { ObjectType, PSObject } from './scanner'

export class OperandStack {
  private _stack: PSObject[] = []

  public push(...values: PSObject[]) {
    this._stack.push(...values)
  }

  public set(index: number, value: PSObject) {
    if (index < 0 || index >= this._stack.length) {
      throw new RangeCheckError()
    }
    this._stack[index] = value
  }

  public pop<T extends ObjectType[]>(
    ...types: T
  ): {
    [K in keyof T]: PSObject<T[K]>
  } {
    if (this.length < types.length) {
      throw new StackUnderflowError()
    }
    for (let i = 0; i < types.length; ++i) {
      const objectIndex = this.length - 1 - i
      if (!(this._stack[objectIndex].type & types[i])) {
        throw new TypecheckError()
      }
    }
    const result = this._stack.splice(this.length - types.length)
    return result.reverse() as { [K in keyof T]: PSObject<T[K]> }
  }

  public withPopped<const T extends ObjectType[]>(
    types: T,
    cb: (args: {
      [K in keyof T]: PSObject<T[K]>
    }) => void
  ) {
    if (this.length < types.length) {
      throw new StackUnderflowError()
    }
    for (let i = 0; i < types.length; ++i) {
      const objectIndex = this.length - 1 - i
      if (!(this._stack[objectIndex].type & types[i])) {
        throw new TypecheckError()
      }
    }
    const args = this._stack.splice(this.length - types.length).reverse() as {
      [K in keyof T]: PSObject<T[K]>
    }
    try {
      cb(args)
    } catch (e) {
      this._stack.push(...args.reverse())
      throw e
    }
  }

  public get length(): number {
    return this._stack.length
  }

  public at(index: number): PSObject {
    if (index < 0 || index >= this._stack.length) {
      throw new StackUnderflowError()
    }
    return this._stack[index]
  }

  public clear() {
    this._stack = []
  }

  public findIndexOfMark() {
    for (let index = this._stack.length - 1; index >= 0; --index) {
      const element = this._stack[index]
      if (element!.type === ObjectType.Mark) {
        return index
      }
    }
    return undefined
  }

  public popMarked(): PSObject[] {
    const markIndex = this.findIndexOfMark()
    if (markIndex === undefined) {
      throw new UnmatchedMarkError()
    }
    const result = this._stack.splice(markIndex + 1)
    this._stack.pop()
    return result
  }

  public splice(start: number, deleteCount?: number): PSObject[] {
    if (deleteCount !== undefined) {
      return this._stack.splice(start, deleteCount)
    }
    return this._stack.splice(start)
  }

  public copy(numberOfElements: number) {
    const elements = this._stack
      .slice(this.length - numberOfElements)
      .map((x) => ({ ...x }))
    this._stack.push(...elements)
  }

  public map(fn: (obj: PSObject) => any): any[] {
    return this._stack.map(fn)
  }
}
