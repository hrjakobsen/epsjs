import { isWhitespace } from './lexer'

const EIGHTYFIVE_POW_FOUR = 52200625
const EIGHTYFIVE_POW_THREE = 614125
const EIGHTYFIVE_POW_TWO = 7225
const EIGHTYFIVE_POW_ONE = 85

const TWO_HUNDRED_FIFTY_SIX_POW_THREE = 16777216
const TWO_HUNDRED_FIFTY_SIX_POW_TWO = 65536
const TWO_HUNDRED_FIFTY_SIX_POW_ONE = 256
const MAX_UINT = 4294967295

export const EXCLAM_OFFSET = '!'.charCodeAt(0)
export const Z_CHARCODE = 'z'.charCodeAt(0)
export const TILDE_CHARCODE = '~'.charCodeAt(0)
export const GREATER_THAN_CHARCODE = '>'.charCodeAt(0)
export const U_OFFSET = 'u'.charCodeAt(0)

export function decodeAscii85Group(group: number[]): number[] {
  if (group.length === 0) {
    throw new Error('ioerror: nothing to decode')
  }

  if (group.length > 5) {
    throw new Error('ioerror: invalid length in convertgroup')
  }
  const padding = 5 - group.length
  if (padding === 4) {
    // PLRM page 132. We'd have nothing to push to the decoded data!
    throw new Error('ioerror: 4 character padding is invalid')
  }

  if (group.some((x) => x < EXCLAM_OFFSET || x > U_OFFSET)) {
    throw new Error('ioerror: Invalid base85 encoding')
  }

  group.push(...Array(padding).fill(U_OFFSET))
  const [c1, c2, c3, c4, c5] = group.map((x) => x - EXCLAM_OFFSET)

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

  return [b1, b2, b3, b4].slice(0, 4 - padding)
}

export function ascii85Decode(input: string) {
  const decodedData: number[] = []
  const currentData: number[] = []

  for (let i = 0; i < input.length; ++i) {
    if (input[i] === 'z') {
      currentData.push(
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET
      )
    } else if (isWhitespace(input.charCodeAt(0))) {
      continue
    } else {
      currentData.push(input[i]!.charCodeAt(0))
    }
    if (currentData.length >= 5) {
      decodedData.push(...decodeAscii85Group(currentData))
      decodedData.splice(0, 5)
    }
  }
  if (currentData.length) {
    decodedData.push(...decodeAscii85Group(currentData))
  }
  return decodedData
}
