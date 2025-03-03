import { CharStream, PSLexer, TokenType } from '../src/lexer'

describe('PSLexer', function () {
  it('lexes identifiers', function () {
    const lexer = new PSLexer(new CharStream('/Courrier'))
    expect(lexer.next).toEqual({
      kind: TokenType.LiteralName,
      content: 'Courrier',
      span: {
        from: 0,
        to: 9,
      },
    })
  })

  it('lexes strings', function () {
    const lexer = new PSLexer(new CharStream('(test af hest) sdf'))
    expect(lexer.next).toEqual({
      kind: TokenType.String,
      content: 'test af hest',
      span: {
        from: 0,
        to: 14,
      },
    })
  })

  it('lexes comments', function () {
    const lexer = new PSLexer(new CharStream('%test of comments\ntest'))
    expect(lexer.next).toEqual({
      kind: TokenType.Comment,
      content: 'test of comments',
      span: {
        from: 0,
        to: 17,
      },
    })
  })

  describe('numbers', function () {
    it('lexes e notation', function () {
      const lexer = new PSLexer(new CharStream('12.2e3'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '12.2e3',
        span: {
          from: 0,
          to: 6,
        },
      })
    })

    it('lexes E notation', function () {
      const lexer = new PSLexer(new CharStream('12.2E3'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '12.2E3',
        span: {
          from: 0,
          to: 6,
        },
      })
    })

    it('lexes decimal numbers', function () {
      const lexer = new PSLexer(new CharStream('12.23'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '12.23',
        span: {
          from: 0,
          to: 5,
        },
      })
    })

    it('lexes integers', function () {
      const lexer = new PSLexer(new CharStream('1223'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '1223',
        span: {
          from: 0,
          to: 4,
        },
      })
    })

    it('lexes octal numbers with base', function () {
      const lexer = new PSLexer(new CharStream('8#123'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '8#123',
        span: {
          from: 0,
          to: 5,
        },
      })
    })

    it('lexes ternary numbers with base', function () {
      const lexer = new PSLexer(new CharStream('3#122'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '3#122',
        span: {
          from: 0,
          to: 5,
        },
      })
    })
  })
})
