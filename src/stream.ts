function negate<T extends (...args: any[]) => boolean>(predicate: T): T {
  return ((...args: any[]): boolean => {
    return !predicate(...args)
  }) as unknown as T
}

export abstract class InputStream<Input> {
  get next(): Input | undefined {
    return this.peek(0)
  }

  public collectWhile(predicate: (nextItem: Input) => boolean): Input[] {
    const tokens = []
    while (this.next !== undefined && predicate(this.next)) {
      tokens.push(this.next)
      this.advance(1)
    }
    return tokens
  }

  public collectUntil(predicate: (nextItem: Input) => boolean): Input[] {
    return this.collectWhile(negate(predicate))
  }

  abstract get pos(): number
  abstract peek(offset: number): Input | undefined
  abstract advance(n?: number): void
}

export abstract class BufferedStreamer<
  TokenType
> extends InputStream<TokenType> {
  protected _pos = 0
  protected tokenBuffer: TokenType[] = []

  get pos(): number {
    return this._pos
  }

  protected abstract generateToken(): TokenType | undefined

  peek(offset: number): TokenType | undefined {
    while (this.tokenBuffer.length < offset + 1) {
      const next = this.generateToken()
      if (next === undefined) {
        break
      }
      this.tokenBuffer.push(next)
    }
    return this.tokenBuffer[offset]
  }

  advance(n = 1) {
    if (n < 1) {
      throw new Error('PSLexer: advance: n must be greater than 1')
    }
    const removed = this.tokenBuffer.splice(0, n)
    this._pos += removed.length
  }
}
