export class PostScriptString {
  public data: number[]
  constructor(public readonly length: number) {
    this.data = Array(length).fill(0)
  }

  public set(index: number, value: number) {
    if (index > this.length - 1 || index < 0) {
      throw new Error('Invalid string index')
    }
    if (value < 0 || value > 255) {
      throw new Error('string: invalid char value ' + value)
    }
    this.data[index] = value
  }

  public asString() {
    return String.fromCharCode(...this.data)
  }

  public get(index: number) {
    if (index > this.length || index < 0) {
      throw new Error(
        `Attempted to access index ${index} in string with length ${this.length}`
      )
    }
    return this.data[index]!
  }

  public anchorSearch(other: PostScriptString): boolean {
    if (other.length > this.length) {
      return false
    }
    for (let i = 0; i < other.length; ++i) {
      if (other.data[i] !== this.data[i]) {
        return false
      }
    }
    return true
  }

  public search(other: PostScriptString, index: number = 0): number | false {
    const matchIndex = this.asString().indexOf(other.asString(), index)
    if (matchIndex < 0) {
      return false
    }
    return matchIndex
  }

  public subString(
    index: number,
    count: number = this.length
  ): PostScriptString {
    if (index < 0 || index > this.length) {
      throw new Error(
        `Substring error. Index ${index} out of range of string with length ${this.length}`
      )
    }
    return PostScriptString.fromCharCode(
      ...this.data.slice(index, Math.min(index + count, this.length))
    )
  }

  public static fromCharCode(...chars: number[]) {
    const string = new PostScriptString(chars.length)
    string.data = chars
    return string
  }

  public static fromString(str: string) {
    const string = new PostScriptString(str.length)
    string.data = str.split('').map((char) => char.charCodeAt(0))
    return string
  }

  toString() {
    return this.asString()
  }
}
