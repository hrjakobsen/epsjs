import { isWhitespace } from './lexer'
import { ObjectType, PostScriptObject } from './scanner'

export function radiansToDegrees(rad: number) {
  return (rad * 180) / Math.PI
}

export function degreeToRadians(deg: number) {
  return (deg * Math.PI) / 180
}

export function compareTypeCompatible(
  type1: ObjectType,
  type2: ObjectType
): boolean {
  if (type1 & (ObjectType.Integer | ObjectType.Real)) {
    return Boolean(type2 & (ObjectType.Integer | ObjectType.Real))
  }
  return type1 == type2
}

export function prettyPrint(obj: PostScriptObject): string {
  switch (obj.type) {
    case ObjectType.FontID:
    case ObjectType.Mark:
      return '<mark>'
    case ObjectType.Operator:
      return `<operator ${obj.value}>`
    case ObjectType.Array:
      return `[ ${obj.value.map(prettyPrint).join(', ')} ]`
    case ObjectType.Dictionary:
      return `{ ${obj.value
        .entries()
        .map(
          (name: string, value: PostScriptObject) =>
            `${name}: ${prettyPrint(value)}`
        )
        .join('\n')} }`
    case ObjectType.File:
      return '<file>'
    case ObjectType.GState:
      return '<graphics state>'
    case ObjectType.PackedArray:
      return '<packed array>'
    case ObjectType.Save:
      return '<save>'
    case ObjectType.String:
      return obj.value.asString()
    case ObjectType.Null:
    case ObjectType.Real:
    case ObjectType.Name:
    case ObjectType.Integer:
    case ObjectType.Boolean:
      return obj.value
  }
  return ''
}

const EIGHTYFIVE_POW_FOUR = 52200625
const EIGHTYFIVE_POW_THREE = 614125
const EIGHTYFIVE_POW_TWO = 7225
const EIGHTYFIVE_POW_ONE = 85

const TWO_HUNDRED_FIFTY_SIX_POW_THREE = 16777216
const TWO_HUNDRED_FIFTY_SIX_POW_TWO = 65536
const TWO_HUNDRED_FIFTY_SIX_POW_ONE = 256
const MAX_UINT = 4294967295

const EXCLAM_OFFSET = '!'.charCodeAt(0)

export function base85Decode(input: string) {
  const decodedData: number[] = []
  const currentData: string[] = []
  const convertGroup = () => {
    if (currentData.length === 0) {
      return
    }

    if (currentData.length > 5) {
      throw new Error('ioerror: invalid length in convertgroup')
    }
    const padding = 5 - currentData.length
    if (padding === 4) {
      // PLRM page 132. We'd have nothing to push to the decoded data!
      throw new Error('ioerror: 4 character padding is invalid')
    }
    currentData.push(...Array(padding).fill('u'))
    const [c1, c2, c3, c4, c5] = currentData.map(
      (x) => x.charCodeAt(0) - EXCLAM_OFFSET
    )

    // Calculate the uint that embeds the 4 bytes as
    // c1 * 85^4 + c2* 85^3 + c3 * 85^2 + c4 * 85^1 + c5
    //                     = b1 * 256^3 + b2 * 256^2 + b3 * 256^1 + b4

    const val =
      c1! * EIGHTYFIVE_POW_FOUR +
      c2! * EIGHTYFIVE_POW_THREE +
      c3! * EIGHTYFIVE_POW_TWO +
      c4! * EIGHTYFIVE_POW_ONE +
      c5!

    if (val > MAX_UINT) {
      throw new Error('ioerror')
    }

    const b4 = val % TWO_HUNDRED_FIFTY_SIX_POW_ONE
    const b3WithOffset = (val % TWO_HUNDRED_FIFTY_SIX_POW_TWO) - b4
    const b2WithOffset =
      (val % TWO_HUNDRED_FIFTY_SIX_POW_THREE) - b3WithOffset - b4
    const b1WithOffset = val - b3WithOffset - b2WithOffset - b4

    // Bitshift the 4 bytes from the uint
    const b3 = b3WithOffset >> 8
    const b2 = b2WithOffset >> 16
    const b1 = b1WithOffset >> 24

    decodedData.push(...[b1, b2, b3, b4].slice(0, 4 - padding))
    currentData.length = 0
  }

  for (let i = 0; i < input.length; ++i) {
    if (input[i] === 'z') {
      currentData.push('!', '!', '!', '!', '!')
    } else if (isWhitespace(input.charCodeAt(0))) {
      continue
    } else {
      currentData.push(input[i]!)
    }
    if (currentData.length >= 5) {
      convertGroup()
    }
  }
  convertGroup()
  return decodedData
}
