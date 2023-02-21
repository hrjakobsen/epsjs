import { BufferedStreamer, InputStream } from './stream'

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

  advance(n: number = 1): number | undefined {
    if (n < 1) {
      throw new Error('CharStream: advance: n must be greater than 1')
    }
    const val = this.peek(n)
    this._pos = Math.min(this.data.length, this.pos + n)
    return val
  }
}

export class PostScriptLexer extends BufferedStreamer<Token> {
  public constructor(private dataStream: InputStream<number>) {
    super()
  }

  protected generateToken(): Token | undefined {
    this.skipWhitespace()

    const nextChar = this.dataStream.next

    if (nextChar === undefined) {
      return undefined
    }

    if (isSlash(nextChar) || isRegularCharacter(nextChar)) {
      return this.parseNameOrNumber(nextChar)
    } else if (isPercentageSign(nextChar)) {
      return this.parseComment()
    } else if (isParenStart(nextChar)) {
      return this.parseLiteralString()
    } else if (isSingleCharacterDelimenator(nextChar)) {
      return this.parseSingleCharacterDelimenator(nextChar)
    } else if (isAngleBracketOpen(nextChar)) {
      return this.parseAngleBracketExpression()
    } else if (isAngleBracketClose(nextChar)) {
      return this.parseDictionaryClose()
    }

    if (!isEOF(this.dataStream.next)) {
      throw new Error(
        `Lexer error: Unexpected input at position ${
          this.dataStream.pos
        }: "${String.fromCharCode(this.dataStream.next!)}"`
      )
    }

    return undefined
  }

  private skipWhitespace() {
    this.dataStream.collectWhile(isWhitespace)
  }

  parseNameOrNumber(nextChar: number) {
    const start = this.dataStream.pos
    const literal = isSlash(nextChar)
    if (literal) {
      this.dataStream.advance()
    }
    const name = this.dataStream.collectWhile(isRegularCharacter)

    return {
      kind: literal
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
    // TODO: Support balanced parentheses
    const start = this.dataStream.pos
    this.dataStream.advance(1)
    const stringValue = this.dataStream.collectUntil(isParenEnd)
    this.dataStream.advance(1)
    return {
      kind: TokenType.String,
      content: String.fromCharCode(...stringValue),
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
      throw new Error('TODO: Parse base85 ASCII strings')
    }

    return this.parseHexString()
  }

  parseHexString() {
    const start = this.dataStream.pos - 1
    const hexString = String.fromCharCode(
      ...this.dataStream.collectUntil(isAngleBracketClose)
    )
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
}

function isOneOf(...char: string[]) {
  return (codepoint?: number) => {
    return (
      codepoint !== undefined && char.some((c) => c.charCodeAt(0) === codepoint)
    )
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

const isSlash = isOneOf('/')
const isTilde = isOneOf('~')
const isAngleBracketOpen = isOneOf('<')
const isAngleBracketClose = isOneOf('>')
const isWhitespace = isOneOf(' ', '\t', '\r', '\n') // TODO: Support all whitespace characters from Table 3.1 in PLRM
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

export const BASE_10_NUMBER = /^[+\-]?((\d+(\.\d*)?)|(\.\d+))([eE]-?\d+)?$/
export const BASE_10_INT = /^[+\-]?\d+$/
export const RADIX_NUMBER = /^\d+#[0-9a-zA-Z]$/

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
