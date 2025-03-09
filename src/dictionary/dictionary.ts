import { PSArray } from '../array'
import { ObjectType, PSObject } from '../scanner'
import { PSString } from '../string'
import { createLiteral, prettyPrint } from '../utils'

const MIN_FONT_CAPACITY = 3

export class PSDictionary {
  protected map = new Map<any, PSObject>()
  // HACK
  private keysMap = new Map<any, PSObject>()

  constructor(public readonly capacity: number) {}

  public set(key: PSObject, value: PSObject) {
    if (this.map.size >= this.capacity && !this.has(key)) {
      throw new Error('No more capacity in dictionary')
    }
    this.forceSet(key, value)
  }

  public has(key: PSObject) {
    return this.map.has(this.toKey(key))
  }

  public entries() {
    return this.map.entries()
  }

  public keys(): PSObject[] {
    return [...this.map.keys()].map((key) => this.keysMap.get(key)!)
  }

  public get(key: PSObject) {
    return this.map.get(this.toKey(key))
  }

  public forceSet(key: PSObject, value: PSObject) {
    const keyInMap = this.toKey(key)
    this.map.set(keyInMap, value)
    this.keysMap.set(keyInMap, key)
  }

  public remove(key: PSObject) {
    this.map.delete(this.toKey(key))
  }

  protected toKey(obj: PSObject) {
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
    const newDict = new PSDictionary(this.capacity)
    const newDictEntries = Array.from(this.map.entries())
    const newDictKeys = Array.from(this.keysMap.entries())
    newDict.map = new Map(newDictEntries)
    newDict.keysMap = new Map(newDictKeys)
    return newDict
  }

  public static newFont(fontName: string, scale = 1) {
    const fontDict = new PSDictionary(MIN_FONT_CAPACITY)
    fontDict.forceSet(
      createLiteral('FontType', ObjectType.Name),
      createLiteral(42, ObjectType.Integer)
    )
    fontDict.forceSet(
      createLiteral('FontName', ObjectType.Name),
      createLiteral(PSString.fromString(fontName), ObjectType.String)
    )
    fontDict.forceSet(
      createLiteral('FontMatrix', ObjectType.Name),
      createLiteral(
        new PSArray(
          [0.001 * scale, 0, 0, 0.001 * scale, 0, 0].map((num) =>
            createLiteral(num, ObjectType.Real)
          )
        ),
        ObjectType.Array
      )
    )
    return fontDict
  }

  toDebugString(): string {
    return `{ ${[...this.entries()]
      .map((entry) => {
        const [name, value] = entry
        return `${name}: ${prettyPrint(value)}`
      })
      .join('\n')} }`
  }
}
