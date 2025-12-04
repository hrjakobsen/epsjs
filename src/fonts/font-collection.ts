import { ObjectType, PSObject } from '../scanner'
import { createLiteral } from '../utils'
import { Font } from './font'

export class FontCollection {
  private nextId = 0
  private fonts = new Map<number, Font>()

  constructor() {}

  defineFont(font: Font) {
    const id = this.allocateId()
    this.fonts.set(id, font)
    return createLiteral(id, ObjectType.FontID)
  }

  private allocateId() {
    return this.nextId++
  }

  getFont(id: PSObject<ObjectType.FontID>) {
    const lookup = this.fonts.get(id.value)
    if (!lookup) {
      throw new Error('Invalid font id')
    }
    return lookup
  }
}
