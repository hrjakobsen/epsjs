import {
  CARRIAGE_RETURN,
  CharStream,
  LINE_FEED,
  PostScriptLexer,
} from './lexer'
import { PostScriptObject, PostScriptScanner } from './scanner'
import { InputStream } from './stream'
import { PostScriptString } from './string'

type ReadResult = {
  substring: PostScriptString
  success: boolean
}

export interface ReadableFile {
  isAtEndOfFile(): boolean
  read(): number | undefined
  readString(string: PostScriptString): ReadResult
  readLine(string: PostScriptString): ReadResult
  readHexString(string: PostScriptString): ReadResult
  token(): PostScriptObject | undefined
}

abstract class Filter implements ReadableFile {
  abstract isAtEndOfFile(): boolean
  abstract read(): number | undefined
  abstract readString(): ReadResult
  abstract readLine(): ReadResult
  abstract readHexString(): ReadResult
  abstract token(): PostScriptObject | undefined
}

export class PostScriptFile implements ReadableFile {
  private scanner: PostScriptScanner

  constructor(private charStream: InputStream<number>) {
    this.scanner = new PostScriptScanner(new PostScriptLexer(this.charStream))
  }

  isAtEndOfFile(): boolean {
    return this.charStream.next === undefined
  }

  read(): number | undefined {
    const next = this.charStream.next
    if (next !== undefined) {
      this.charStream.advance(1)
    }
    return next
  }

  readString(string: PostScriptString): ReadResult {
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
    return {
      success: true,
      substring: string.subString(0),
    }
  }

  readLine(string: PostScriptString): ReadResult {
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
        this.charStream.advance(1)
        if (this.charStream.next === LINE_FEED) {
          this.charStream.advance(1)
        }
        return result
      } else if (next === LINE_FEED) {
        // Stop at LF and advance past it
        this.charStream.advance(1)
        return {
          success: true,
          substring: string.subString(0, i),
        }
      }
      string.set(i, next)
    }
    throw new Error('rangecheckerror')
  }

  readHexString(string: PostScriptString): ReadResult {
    const findHex = (): number | undefined => {
      while (this.charStream.next !== undefined) {
        if (isHex(this.charStream.next)) {
          return this.charStream.next
        }
        this.charStream.advance(1)
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

  token(): PostScriptObject | undefined {
    const next = this.scanner.next
    this.scanner.advance(1)
    return next
  }

  public static fromString(contents: string): PostScriptFile {
    return new PostScriptFile(new CharStream(contents))
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
