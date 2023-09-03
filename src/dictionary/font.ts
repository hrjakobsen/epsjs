import { PostScriptArray } from '../array'
import { ObjectType } from '../scanner'
import { PostScriptString } from '../string'
import { createLiteral } from '../utils'
import { PostScriptDictionary } from './dictionary'

const MIN_CAPACITY = 3

export class PostScriptFontDictionary extends PostScriptDictionary {
  constructor(fontName: string, scale: number = 1) {
    super(false, MIN_CAPACITY)
    this.forceSet(
      createLiteral('FontType', ObjectType.Name),
      createLiteral(42, ObjectType.Integer)
    )
    this.forceSet(
      createLiteral('FontName', ObjectType.Name),
      createLiteral(PostScriptString.fromString(fontName), ObjectType.String)
    )
    this.forceSet(
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
  }

  public override isFontDictionary() {
    return true
  }

  public override copy(): PostScriptDictionary {
    const name = (
      this.searchByName('FontName')!.value as PostScriptString
    ).asString()
    const newDict = new PostScriptFontDictionary(name, 0)
    for (const [key, value] of this.map.entries()) {
      newDict.forceSet(key, value)
    }
    const matrix = newDict.searchByName('FontMatrix')!.value as PostScriptArray
    const copy = matrix.slice(0) // shallow copy
    newDict.forceSet(
      createLiteral('FontMatrix', ObjectType.Name),
      createLiteral(copy, ObjectType.Array)
    )
    return newDict
  }
}
