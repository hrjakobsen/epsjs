import { PostScriptArray } from '../array'
import { ObjectType, PostScriptObject } from '../scanner'
import { PostScriptString } from '../string'
import { createLiteral } from '../utils'

const MIN_FONT_CAPACITY = 3

export class PostScriptDictionary {
  protected map = new Map<any, PostScriptObject>()
  // HACK
  private keysMap = new Map<any, PostScriptObject>()

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

  public isFontDictionary() {
    return (
      Boolean(this.searchByName('FontType')) &&
      Boolean(this.searchByName('FontName')) &&
      Boolean(this.searchByName('FontMatrix'))
    )
  }

  public searchByName(name: string) {
    return this.get(createLiteral(name, ObjectType.Name))
  }

  public copy() {
    const newDict = new PostScriptDictionary(this.readOnly, this.capacity)
    const newDictEntries = Array.from(this.map.entries())
    const newDictKeys = Array.from(this.keysMap.entries())
    newDict.map = new Map(newDictEntries)
    newDict.keysMap = new Map(newDictKeys)
    return newDict
  }

  public static newFont(fontName: string, scale = 1) {
    const fontDict = new PostScriptDictionary(false, MIN_FONT_CAPACITY)
    fontDict.forceSet(
      createLiteral('FontType', ObjectType.Name),
      createLiteral(42, ObjectType.Integer)
    )
    fontDict.forceSet(
      createLiteral('FontName', ObjectType.Name),
      createLiteral(PostScriptString.fromString(fontName), ObjectType.String)
    )
    fontDict.forceSet(
      createLiteral('FontMatrix', ObjectType.Name),
      createLiteral(
        new PostScriptArray(
          [0.001 * scale, 0, 0, 0.001 * scale, 0, 0].map((num) =>
            createLiteral(num, ObjectType.Real)
          )
        ),
        ObjectType.Array
      )
    )
    return fontDict
  }
}
