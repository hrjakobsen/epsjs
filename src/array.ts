import { PSObject } from './scanner'

export class PSArray {
  constructor(private data: PSObject[]) {}

  public get(index: number) {
    return this.data[index]
  }

  public set(index: number, obj: PSObject) {
    this.data[index] = obj
  }

  public copy() {
    return new PSArray([...this.data])
  }

  public push(value: PSObject) {
    this.data.push(value)
  }

  public get length() {
    return this.data.length
  }

  public slice(start?: number, end?: number) {
    return new PSArray(this.data.slice(start, end))
  }

  public get items(): readonly PSObject[] {
    return this.data
  }

  public splice(
    start: number,
    count: number | undefined,
    replacewith: PSArray
  ) {
    if (count === undefined) {
      return new PSArray(this.data.splice(start, count))
    }
    return new PSArray(this.data.splice(start, count, ...replacewith.data))
  }

  public map<T>(mapper: (obj: PSObject) => T): T[] {
    return this.data.map(mapper)
  }

  public join(joiner: string) {
    return this.data.join(joiner)
  }

  public toString() {
    return this.data.toString()
  }
}
