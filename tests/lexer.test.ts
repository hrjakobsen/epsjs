import { CharStream, PostScriptLexer, TokenType } from '../src/lexer'

describe('PostscriptLexer', function () {
  it('Parses identifiers', function () {
    const lexer = new PostScriptLexer(new CharStream('/Courrier'))
    expect(lexer.next).toEqual({
      kind: TokenType.LiteralName,
      content: 'Courrier',
      span: {
        from: 0,
        to: 9,
      },
    })
  })

  it('Parses strings', function () {
    const lexer = new PostScriptLexer(new CharStream('(test af hest) sdf'))
    expect(lexer.next).toEqual({
      kind: TokenType.String,
      content: 'test af hest',
      span: {
        from: 0,
        to: 14,
      },
    })
  })

  it('Parses comments', function () {
    const lexer = new PostScriptLexer(new CharStream('%test of comments\ntest'))
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
    it('Parses decimal numbers', function () {
      const lexer = new PostScriptLexer(new CharStream('12.23'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '12.23',
        span: {
          from: 0,
          to: 5,
        },
      })
    })

    it('Parses integers', function () {
      const lexer = new PostScriptLexer(new CharStream('1223'))
      expect(lexer.next).toEqual({
        kind: TokenType.Number,
        content: '1223',
        span: {
          from: 0,
          to: 4,
        },
      })
    })
  })
})
