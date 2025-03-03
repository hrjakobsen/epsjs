import { CharStream, PSLexer } from '../src/lexer'
import { Access, Executability, ObjectType, PSScanner } from '../src/scanner'

function createScanner(text: string): PSScanner {
  return new PSScanner(new PSLexer(new CharStream(text)))
}

const LITTERAL_ATTRIBUTES = {
  access: Access.Unlimited,
  executability: Executability.Literal,
}

describe('PSScanner', function () {
  describe('numbers', function () {
    it('scans integers', function () {
      const scanner = createScanner('12')
      expect(scanner.next).toEqual({
        type: ObjectType.Integer,
        value: 12,
        attributes: LITTERAL_ATTRIBUTES,
      })
    })

    it('scans reals', function () {
      const scanner = createScanner('12.2')
      expect(scanner.next).toEqual({
        type: ObjectType.Real,
        value: 12.2,
        attributes: LITTERAL_ATTRIBUTES,
      })
    })

    it('scans e notation', function () {
      const scanner = createScanner('12.2e3')
      expect(scanner.next).toEqual({
        type: ObjectType.Real,
        value: 12.2e3,
        attributes: LITTERAL_ATTRIBUTES,
      })
    })

    it('scans E notation', function () {
      const scanner = createScanner('12.2E3')
      expect(scanner.next).toEqual({
        type: ObjectType.Real,
        value: 12.2e3,
        attributes: LITTERAL_ATTRIBUTES,
      })
    })

    it('scans numbers in base 8', function () {
      const scanner = createScanner('8#123')
      expect(scanner.next).toEqual({
        type: ObjectType.Integer,
        value: 0o123,
        attributes: LITTERAL_ATTRIBUTES,
      })
    })

    it('scans numbers in base 3', function () {
      const scanner = createScanner('3#121')
      expect(scanner.next).toEqual({
        type: ObjectType.Integer,
        value: parseInt('121', 3),
        attributes: LITTERAL_ATTRIBUTES,
      })
    })
  })
})
