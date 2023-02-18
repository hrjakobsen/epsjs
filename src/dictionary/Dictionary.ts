import { PostScriptObject } from '../scanner.js'

export class Dictionary {
  protected readonly map = new Map<any, PostScriptObject>()
  constructor(public readonly readOnly: boolean) {}

  public set(key: PostScriptObject, value: PostScriptObject) {
    if (this.readOnly) {
      throw new Error('Attempting to write to readonly dictionary')
    }
    this.forceSet(key, value)
  }

  public get(key: PostScriptObject) {
    return this.map.get(this.toKey(key))
  }

  public forceSet(key: PostScriptObject, value: PostScriptObject) {
    this.map.set(this.toKey(key), value)
  }

  protected toKey(obj: PostScriptObject) {
    return obj.value
  }
}
