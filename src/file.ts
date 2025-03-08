import {
  decodeAscii85Group,
  EXCLAM_OFFSET,
  GREATER_THAN_CHARCODE,
  TILDE_CHARCODE,
  Z_CHARCODE,
} from './ascii85'
import { PSInterpreter } from './interpreter'
import { CARRIAGE_RETURN, CharStream, LINE_FEED, PSLexer } from './lexer'
import { PSObject, PSScanner } from './scanner'
import { InputStream } from './stream'
import { PSString } from './string'

type ReadResult = {
  substring: PSString
  success: boolean
}

export interface PSReadableFile {
  isAtEndOfFile(): boolean
  read(): number | undefined
  peek(): number | undefined
  readString(string: PSString): ReadResult
  readLine(string: PSString): ReadResult
  readHexString(string: PSString): ReadResult
  token(): PSObject | undefined
}

abstract class PeekableFile implements PSReadableFile {
  private bufferedCharCode: number | undefined

  isAtEndOfFile(): boolean {
    return this.peek() === undefined
  }

  abstract readCharacter(): number | undefined

  read(): number | undefined {
    if (this.bufferedCharCode !== undefined) {
      this.bufferedCharCode = undefined
      return this.bufferedCharCode
    }
    return this.readCharacter()
  }

  peek(): number | undefined {
    if (this.bufferedCharCode !== undefined) {
      return this.bufferedCharCode
    }
    this.bufferedCharCode = this.readCharacter()
    return this.bufferedCharCode
  }

  readString(string: PSString): ReadResult {
    for (let i = 0; i < string.length; ++i) {
      const next = this.read()
      if (next === undefined) {
        return {
          success: false,
          substring: string.subString(0, i),
        }
      }
      string.set(i, next)
    }
    return { success: true, substring: string.subString(0) }
  }

  readLine(string: PSString): ReadResult {
    for (let i = 0; i < string.length; ++i) {
      const next = this.read()
      if (next === undefined) {
        return {
          success: false,
          substring: string.subString(0, i),
        }
      } else if (next === CARRIAGE_RETURN) {
        // Stop here, and advance past CR / CRLF
        const result = {
          success: true,
          substring: string.subString(0, i),
        }
        if (this.peek() === LINE_FEED) {
          this.read()
        }
        return result
      } else if (next === LINE_FEED) {
        // Stop at LF and advance past it
        return {
          success: true,
          substring: string.subString(0, i),
        }
      }
      string.set(i, next)
    }
    throw new Error('rangecheckerror')
  }

  readHexString(string: PSString): ReadResult {
    const findHex = (): number | undefined => {
      while (this.peek() !== undefined) {
        if (isHex(this.peek()!)) {
          return this.peek()
        }
        this.read()
      }
      return undefined
    }
    for (let i = 0; i < string.length; ++i) {
      const first = findHex()
      if (first === undefined) {
        return {
          success: false,
          substring: string.subString(0, i),
        }
      }
      const second = findHex()
      if (second === undefined) {
        throw new Error('Invalid hex character')
      }
      const codepoint = parseInt(String.fromCodePoint(first, second), 16)
      string.set(i, codepoint)
    }
    return {
      success: true,
      substring: string.subString(0),
    }
  }

  abstract token(): PSObject<unknown> | undefined
}

export class CharStreamBackedFile extends PeekableFile {
  private scanner: PSScanner

  constructor(private charStream: InputStream<number>) {
    super()
    this.scanner = new PSScanner(new PSLexer(this.charStream))
  }

  readCharacter(): number | undefined {
    const next = this.charStream.next
    if (next !== undefined) {
      this.charStream.advance(1)
    }
    return next
  }

  token(): PSObject | undefined {
    const next = this.scanner.next
    this.scanner.advance(1)
    return next
  }

  withInterpreter(interpreter: PSInterpreter) {
    this.scanner.interpreter = interpreter
    return this
  }

  public static fromString(contents: string): CharStreamBackedFile {
    return new CharStreamBackedFile(new CharStream(contents))
  }
}

abstract class DecodingFilter extends PeekableFile {
  constructor(protected backingFile: PSReadableFile) {
    super()
  }

  token(): PSObject<unknown> | undefined {
    throw new Error('Method not implemented.')
  }
}

export class Ascii85DecodeFilter extends DecodingFilter {
  private bufferedCharacters: number[] = []
  private isEof = false

  override isAtEndOfFile(): boolean {
    return this.bufferedCharacters.length === 0 && this.isEof
  }

  readCharacter(): number | undefined {
    if (this.bufferedCharacters.length) {
      return this.bufferedCharacters.shift()!
    }
    const buffer: number[] = []
    const nextChar = this.backingFile.read()
    if (nextChar === undefined) {
      throw new Error('ioerror')
    }
    if (nextChar === TILDE_CHARCODE) {
      // next must be >
      if (this.backingFile.read() !== GREATER_THAN_CHARCODE) {
        throw new Error('ioerror: Invalid eod')
      }
      this.isEof = true
      return undefined
    }
    if (nextChar === Z_CHARCODE) {
      buffer.push(
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET,
        EXCLAM_OFFSET
      )
      this.bufferedCharacters.push(...decodeAscii85Group(buffer))
      return this.bufferedCharacters.shift()!
    }
    buffer.push(nextChar)
    for (let i = 0; i < 4; ++i) {
      // Read up to 5 characters or ->
      const next = this.backingFile.read()
      if (next === undefined) {
        throw new Error('invalid eof')
      }
      if (next === TILDE_CHARCODE) {
        // next must be >
        if (this.backingFile.read() !== GREATER_THAN_CHARCODE) {
          throw new Error('ioerror: Invalid eod')
        }
        this.isEof = true
        this.bufferedCharacters.push(...decodeAscii85Group(buffer))
        return this.bufferedCharacters.shift()
      }
      buffer.push(next)
    }
    this.bufferedCharacters.push(...decodeAscii85Group(buffer))
    return this.bufferedCharacters.shift()
  }
}

const isHex = (codepoint: number) =>
  (codepoint >= CHARCODE_A && codepoint <= CHARCODE_F) ||
  (codepoint >= CHARCODE_a && codepoint <= CHARCODE_f) ||
  (codepoint >= CHARCODE_0 && codepoint <= CHARCODE_9)

const CHARCODE_A = 'A'.charCodeAt(0)
const CHARCODE_F = 'F'.charCodeAt(0)
const CHARCODE_a = 'a'.charCodeAt(0)
const CHARCODE_f = 'f'.charCodeAt(0)
const CHARCODE_0 = '0'.charCodeAt(0)
const CHARCODE_9 = '9'.charCodeAt(0)
