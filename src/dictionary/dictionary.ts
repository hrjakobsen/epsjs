import { PostScriptObject } from '../scanner'

export class PostScriptDictionary {
  protected readonly map = new Map<any, PostScriptObject>()
  // HACK
  private readonly keysMap = new Map<any, PostScriptObject>()

  constructor(
    public readonly readOnly: boolean,
    private readonly capacity: number
  ) {}

  public set(key: PostScriptObject, value: PostScriptObject) {
    if (this.readOnly) {
      throw new Error('Attempting to write to readonly dictionary')
    }
    if (this.map.size >= this.capacity && this.map.has(key)) {
      throw new Error('No more capacity in dictionary')
    }
    this.forceSet(key, value)
  }

  public has(key: PostScriptObject) {
    return this.map.has(this.toKey(key))
  }

  public entries() {
    return this.map.entries()
  }

  public keys(): PostScriptObject[] {
    return [...this.map.keys()].map((key) => this.keysMap.get(key)!)
  }

  public get(key: PostScriptObject) {
    return this.map.get(this.toKey(key))
  }

  public forceSet(key: PostScriptObject, value: PostScriptObject) {
    const keyInMap = this.toKey(key)
    this.map.set(keyInMap, value)
    this.keysMap.set(keyInMap, key)
  }

  public remove(key: PostScriptObject) {
    this.map.delete(this.toKey(key))
  }

  protected toKey(obj: PostScriptObject) {
    return obj.value
  }

  public get size() {
    return this.map.size
  }
}
