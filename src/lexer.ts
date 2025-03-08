import { BufferedStreamer, InputStream } from './stream'
import { ascii85Decode } from './ascii85'

export const BACKSPACE = 0x08
export const NULL = 0x00
export const TAB = 0x09
export const LINE_FEED = 0x0a
export const FORM_FEED = 0x0c
export const CARRIAGE_RETURN = 0x0d
export const SPACE = 0x20

export enum TokenType {
  Number,
  Name,
  LiteralName,
  ImmediatelyEvaluatedName,
  Comment,
  String,
  ArrayOpen,
  ArrayClose,
  DictionaryOpen,
  DictionaryClose,
  ProcedureOpen,
  ProcedureClose,
}

interface Span {
  from: number
  to: number
}

export interface Token {
  kind: TokenType
  content: string
  span?: Span
}

export class CharStream extends InputStream<number> {
  private _pos = 0

  get pos() {
    return this._pos
  }

  public constructor(private data: string) {
    super()
  }

  peek(offset: number): number | undefined {
    if (this.pos + offset >= this.data.length) {
      return undefined
    }
    return this.data.charCodeAt(this.pos + offset)
  }

  advance(n = 1) {
    if (n < 1) {
      throw new Error('CharStream: advance: n must be greater than 1')
    }
    this._pos = Math.min(this.data.length, this.pos + n)
  }
}

export class PSLexer extends BufferedStreamer<Token> {
  public constructor(private dataStream: InputStream<number>) {
    super()
  }

  protected generateToken(): Token | undefined {
    this.skipWhitespace()

    const nextChar = this.dataStream.next

    if (nextChar === undefined) {
      return undefined
    }

    let token = undefined
    if (isSlash(nextChar) || isRegularCharacter(nextChar)) {
      token = this.parseNameOrNumber(nextChar)
    } else if (isPercentageSign(nextChar)) {
      token = this.parseComment()
    } else if (isParenStart(nextChar)) {
      token = this.parseLiteralString()
    } else if (isSingleCharacterDelimenator(nextChar)) {
      token = this.parseSingleCharacterDelimenator(nextChar)
    } else if (isAngleBracketOpen(nextChar)) {
      token = this.parseAngleBracketExpression()
    } else if (isAngleBracketClose(nextChar)) {
      token = this.parseDictionaryClose()
    }

    if (token == undefined && !isEOF(this.dataStream.next)) {
      throw new Error(
        `Lexer error: Unexpected input at position ${
          this.dataStream.pos
        }: "${String.fromCharCode(this.dataStream.next!)}"`
      )
    }

    this.skipWhitespace()
    return token
  }

  private skipWhitespace() {
    this.dataStream.collectWhile(isWhitespace)
  }

  parseNameOrNumber(nextChar: number) {
    const start = this.dataStream.pos
    const literal = isSlash(nextChar)
    let immediate = false
    if (literal) {
      this.dataStream.advance()
      if (isSlash(this.dataStream.next)) {
        immediate = true
        this.dataStream.advance(1)
      }
    }

    const name = this.dataStream.collectWhile(isRegularCharacter)

    return {
      kind: immediate
        ? TokenType.ImmediatelyEvaluatedName
        : literal
        ? TokenType.LiteralName
        : isNumber(name)
        ? TokenType.Number
        : TokenType.Name,
      content: String.fromCharCode(...name),
      span: {
        from: start,
        to: start + this.dataStream.pos,
      },
    }
  }

  parseComment() {
    const start = this.dataStream.pos
    this.dataStream.advance(1)
    const comment = this.dataStream.collectUntil(conjunction(isNewLine, isEOF))
    return {
      kind: TokenType.Comment,
      content: String.fromCharCode(...comment),
      span: {
        from: start,
        to: this.dataStream.pos,
      },
    }
  }

  parseLiteralString() {
    // Scan literal string
    const start = this.dataStream.pos
    this.dataStream.advance(1)
    let parenDepth = 1
    const codepoints: number[] = []
    let next = this.dataStream.next
    while (next !== undefined) {
      next = this.dataStream.next
      this.dataStream.advance(1)
      if (isParenStart(next)) {
        ++parenDepth
        codepoints.push(next!)
        continue
      }
      if (isParenEnd(next)) {
        if (parenDepth === 1) {
          break
        }
        --parenDepth
        codepoints.push(next!)
        continue
      }

      const escapeSequence = (char: string, replacement: string | number) => {
        if (next !== char.charCodeAt(0)) {
          return false
        }
        this.dataStream.advance(1)
        codepoints.push(
          typeof replacement === 'string'
            ? replacement.charCodeAt(0)
            : replacement
        )
        return true
      }
      if (isBackSlash(next)) {
        next = this.dataStream.next
        if (next === undefined) {
          throw new Error(`Invalid escape sequence: \\${next}`)
        }
        if (
          escapeSequence('n', '\n') ||
          escapeSequence('r', '\r') ||
          escapeSequence('t', '\t') ||
          escapeSequence('b', BACKSPACE) || // Backspace
          escapeSequence('f', FORM_FEED) || // Formfeed
          escapeSequence('\\', '\\') ||
          escapeSequence('(', '(') ||
          escapeSequence(')', ')')
        ) {
          continue
        }
        if (next === '\n'.charCodeAt(0)) {
          // Ignore the newline
          this.dataStream.advance(1)
          continue
        }
        if (next === FORM_FEED) {
          // Ignore the formeed
          this.dataStream.advance(1)
          continue
        }
        if (isOctalDigit(next)) {
          // Parse up to three digits in octal
          const octalCodepoints = [next!]
          this.advance(1)
          for (let i = 0; i < 2; ++i) {
            if (isOctalDigit(this.dataStream.next)) {
              octalCodepoints.push(this.dataStream.next!)
              this.dataStream.advance(1)
            } else {
              break
            }
          }
          const characterCode = Number.parseInt(
            String.fromCharCode(...octalCodepoints),
            8
          )
          codepoints.push(characterCode)
          continue
        }
        // Otherwise we just ignore the \
      } else {
        codepoints.push(next!)
      }
    }
    const stringValue = String.fromCharCode(...codepoints)
    return {
      kind: TokenType.String,
      content: stringValue,
      span: {
        from: start,
        to: this.dataStream.pos,
      },
    }
  }

  parseSingleCharacterDelimenator(nextChar: number) {
    this.dataStream.advance(1)
    const content = String.fromCharCode(nextChar)
    return {
      kind: singleCharacterDelimenatorMap.get(content)!,
      content,
      span: {
        from: this.dataStream.pos - 1,
        to: this.dataStream.pos,
      },
    }
  }

  parseAngleBracketExpression() {
    this.dataStream.advance(1)
    // First figure out which type of object will follow
    const nextChar = this.dataStream.next
    if (nextChar === undefined) {
      throw new Error('Unexpected EOF after <')
    }
    if (isAngleBracketClose(nextChar)) {
      this.dataStream.advance(1)
      return {
        kind: TokenType.String,
        content: '',
        span: {
          from: this.dataStream.pos - 2,
          to: this.dataStream.pos,
        },
      }
    }
    if (isAngleBracketOpen(nextChar)) {
      this.dataStream.advance(1)
      return {
        kind: TokenType.DictionaryOpen,
        content: '<<',
        span: {
          from: this.dataStream.pos - 2,
          to: this.dataStream.pos,
        },
      }
    }
    if (isTilde(nextChar)) {
      this.dataStream.advance(1)
      return this.parseBase85String()
    }

    return this.parseHexString()
  }

  parseBase85String() {
    const start = this.dataStream.pos - 2
    const string = String.fromCharCode(...this.dataStream.collectUntil(isTilde))
    if (!isTilde(this.dataStream.next)) {
      throw new Error('Missing end of base85 encoded string')
    }
    this.dataStream.advance(1)
    if (!isAngleBracketClose(this.dataStream.next)) {
      throw new Error('missing > at end of base85 encoded string')
    }
    this.dataStream.advance(1)

    return {
      kind: TokenType.String,
      content: String.fromCharCode(...ascii85Decode(string)),
      span: {
        from: start,
        to: this.dataStream.pos,
      },
    }
  }

  parseHexString() {
    const start = this.dataStream.pos - 1
    const hexString = String.fromCharCode(
      ...this.dataStream.collectUntil(isAngleBracketClose)
    ).replace(/\s/g, '')
    if (!isAngleBracketClose(this.dataStream.next)) {
      throw new Error('Missing end of hex string')
    }
    this.dataStream.advance()
    if (!hexString.match(/^([0-9a-fA-F][0-9a-fA-F])*$/)) {
      throw new Error('Invalid hex string')
    }
    return {
      kind: TokenType.String,
      content: readHexString(hexString),
      span: {
        from: start,
        to: this.dataStream.pos,
      },
    }
  }

  parseDictionaryClose() {
    this.dataStream.advance(1)
    if (!isAngleBracketClose(this.dataStream.next)) {
      throw new Error('Expected >')
    }
    this.dataStream.advance(1)
    return {
      kind: TokenType.DictionaryClose,
      content: '>>',
      span: {
        from: this.dataStream.pos - 2,
        to: this.dataStream.pos,
      },
    }
  }

  sourceOffset(): number {
    return this.dataStream.pos
  }
}

function isOneOf(...char: string[]) {
  return (codepoint?: number) => {
    return (
      codepoint !== undefined && char.some((c) => c.charCodeAt(0) === codepoint)
    )
  }
}
function isCharCodeOf(...codepoints: number[]) {
  return (codepoint?: number) => {
    return codepoint !== undefined && codepoints.some((c) => c === codepoint)
  }
}

function isPrintableAscii(codepoint: number) {
  return codepoint <= 126 && codepoint >= 33
}
function isRegularCharacter(codepoint: number) {
  return (
    isPrintableAscii(codepoint) &&
    !isReservedCharacter(codepoint) &&
    !isWhitespace(codepoint)
  )
}
const isReservedCharacter = isOneOf(
  '(',
  ')',
  '<',
  '>',
  '[',
  ']',
  '{',
  '}',
  '/',
  '%'
)
const isOctalDigit = isOneOf('0', '1', '2', '3', '4', '5', '6', '7')
const isSlash = isOneOf('/')
const isBackSlash = isOneOf('\\')
const isTilde = isOneOf('~')
const isAngleBracketOpen = isOneOf('<')
const isAngleBracketClose = isOneOf('>')
export const isWhitespace = isCharCodeOf(
  NULL,
  TAB,
  LINE_FEED,
  FORM_FEED,
  CARRIAGE_RETURN,
  SPACE
)
const isPercentageSign = isOneOf('%')
const isNewLine = isOneOf('\n')
const isParenStart = isOneOf('(')
const isParenEnd = isOneOf(')')

const isSingleCharacterDelimenator = isOneOf('{', '}', '[', ']')
const singleCharacterDelimenatorMap = new Map([
  ['{', TokenType.ProcedureOpen],
  ['}', TokenType.ProcedureClose],
  ['[', TokenType.ArrayOpen],
  [']', TokenType.ArrayClose],
])

function isEOF(codepoint?: number) {
  return codepoint === undefined
}

function conjunction(...predicate: ((codepoint?: number) => boolean)[]) {
  return (codepoint?: number): boolean => {
    return predicate.some((p) => p(codepoint))
  }
}

export const BASE_10_NUMBER = /^[+-]?((\d+(\.\d*)?)|(\.\d+))([eE]-?\d+)?$/
export const BASE_10_INT = /^[+-]?\d+$/
export const RADIX_NUMBER = /^\d+#[0-9a-zA-Z]+$/

function isNumber(contentChars: number[]) {
  const content = String.fromCharCode(...contentChars)
  return (
    Boolean(content.match(BASE_10_NUMBER)) ||
    Boolean(content.match(RADIX_NUMBER))
  )
}

function readHexString(hexString: string) {
  const charcodes = []
  for (let c = 0; c < hexString.length - 2; c++) {
    charcodes.push(parseInt(hexString.substring(c, c + 2), 16))
  }
  return String.fromCharCode(...charcodes)
}
