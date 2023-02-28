import { PostScriptObject } from './scanner'

export class PostScriptArray {
  public procedureIndex = 0
  constructor(private data: PostScriptObject[]) {}

  public get(index: number) {
    return this.data[index]
  }

  public set(index: number, obj: PostScriptObject) {
    this.data[index] = obj
  }

  public copy() {
    return new PostScriptArray([...this.data])
  }

  public push(value: PostScriptObject) {
    this.data.push(value)
  }

  public get length() {
    return this.data.length
  }

  public slice(start?: number, end?: number) {
    return new PostScriptArray(this.data.slice(start, end))
  }

  public get items(): readonly PostScriptObject[] {
    return this.data
  }

  public splice(
    start: number,
    count: number | undefined,
    replacewith: PostScriptArray
  ) {
    if (count === undefined) {
      return new PostScriptArray(this.data.splice(start, count))
    }
    return new PostScriptArray(
      this.data.splice(start, count, ...replacewith.data)
    )
  }

  public map<T>(mapper: (obj: PostScriptObject) => T): T[] {
    return this.data.map(mapper)
  }

  public join(joiner: string) {
    return this.data.join(joiner)
  }

  public toString() {
    return this.data.toString()
  }
}
