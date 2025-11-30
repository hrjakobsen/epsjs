import { checkStackValues, testProgram } from '../utils'

describe('relational, boolean, and bitwise operators', function () {
  /**
    bitshift
   */

  describe('eq', function () {
    it('returns true same numbers', async function () {
      const interpreter = await testProgram('1 1 eq')
      checkStackValues(interpreter, true)
    })

    it('returns false for different numbers', async function () {
      const interpreter = await testProgram('1 2 eq')
      checkStackValues(interpreter, false)
    })

    it('returns true same strings', async function () {
      const interpreter = await testProgram('(a) (a) eq')
      checkStackValues(interpreter, true)
    })

    it('returns false for different strings', async function () {
      const interpreter = await testProgram('(a) (b) eq')
      checkStackValues(interpreter, false)
    })

    it('returns true same booleans', async function () {
      const interpreter = await testProgram('true true eq')
      checkStackValues(interpreter, true)
    })

    it('returns false for different booleans', async function () {
      const interpreter = await testProgram('true false eq')
      checkStackValues(interpreter, false)
    })
  })

  describe('ne', function () {
    it('returns false for same numbers', async function () {
      const interpreter = await testProgram('1 1 ne')
      checkStackValues(interpreter, false)
    })

    it('returns true for different numbers', async function () {
      const interpreter = await testProgram('1 2 ne')
      checkStackValues(interpreter, true)
    })

    it('returns false for same strings', async function () {
      const interpreter = await testProgram('(a) (a) ne')
      checkStackValues(interpreter, false)
    })

    it('returns true for different strings', async function () {
      const interpreter = await testProgram('(a) (b) ne')
      checkStackValues(interpreter, true)
    })

    it('returns false for same booleans', async function () {
      const interpreter = await testProgram('true true ne')
      checkStackValues(interpreter, false)
    })

    it('returns true for different booleans', async function () {
      const interpreter = await testProgram('true false ne')
      checkStackValues(interpreter, true)
    })
  })

  describe('ge', function () {
    it('returns true for greater numbers', async function () {
      const interpreter = await testProgram('2 1 ge')
      checkStackValues(interpreter, true)
    })

    it('returns true for equal numbers', async function () {
      const interpreter = await testProgram('1 1 ge')
      checkStackValues(interpreter, true)
    })

    it('returns false for lesser numbers', async function () {
      const interpreter = await testProgram('1 2 ge')
      checkStackValues(interpreter, false)
    })

    it('compares reals and integers', async function () {
      const interpreter = await testProgram('1 1.1 ge')
      checkStackValues(interpreter, false)
    })
  })

  describe('gt', function () {
    it('returns true for greater numbers', async function () {
      const interpreter = await testProgram('2 1 gt')
      checkStackValues(interpreter, true)
    })

    it('returns false for equal numbers', async function () {
      const interpreter = await testProgram('1 1 gt')
      checkStackValues(interpreter, false)
    })

    it('returns false for lesser numbers', async function () {
      const interpreter = await testProgram('1 2 gt')
      checkStackValues(interpreter, false)
    })

    it('compares reals and integers', async function () {
      const interpreter = await testProgram('1 1.1 gt')
      checkStackValues(interpreter, false)
    })
  })

  describe('le', function () {
    it('returns false for greater numbers', async function () {
      const interpreter = await testProgram('2 1 le')
      checkStackValues(interpreter, false)
    })

    it('returns true for equal numbers', async function () {
      const interpreter = await testProgram('1 1 le')
      checkStackValues(interpreter, true)
    })

    it('returns true for lesser numbers', async function () {
      const interpreter = await testProgram('1 2 le')
      checkStackValues(interpreter, true)
    })

    it('compares reals and integers', async function () {
      const interpreter = await testProgram('1 1.1 le')
      checkStackValues(interpreter, true)
    })
  })

  describe('lt', function () {
    it('returns false for greater numbers', async function () {
      const interpreter = await testProgram('2 1 lt')
      checkStackValues(interpreter, false)
    })

    it('returns false for equal numbers', async function () {
      const interpreter = await testProgram('1 1 lt')
      checkStackValues(interpreter, false)
    })

    it('returns true for lesser numbers', async function () {
      const interpreter = await testProgram('1 2 lt')
      checkStackValues(interpreter, true)
    })

    it('compares reals and integers', async function () {
      const interpreter = await testProgram('1 1.1 lt')
      checkStackValues(interpreter, true)
    })
  })

  describe('and', function () {
    it('returns true for true and true', async function () {
      const interpreter = await testProgram('true true and')
      checkStackValues(interpreter, true)
    })

    it('returns false for true and false', async function () {
      const interpreter = await testProgram('true false and')
      checkStackValues(interpreter, false)
    })

    it('returns false for false and true', async function () {
      const interpreter = await testProgram('false true and')
      checkStackValues(interpreter, false)
    })

    it('returns false for false and false', async function () {
      const interpreter = await testProgram('false false and')
      checkStackValues(interpreter, false)
    })
  })

  describe('or', function () {
    it('returns true for true or true', async function () {
      const interpreter = await testProgram('true true or')
      checkStackValues(interpreter, true)
    })

    it('returns true for true or false', async function () {
      const interpreter = await testProgram('true false or')
      checkStackValues(interpreter, true)
    })

    it('returns true for false or true', async function () {
      const interpreter = await testProgram('false true or')
      checkStackValues(interpreter, true)
    })

    it('returns false for false or false', async function () {
      const interpreter = await testProgram('false false or')
      checkStackValues(interpreter, false)
    })
  })

  describe('xor', function () {
    it('returns false for true xor true', async function () {
      const interpreter = await testProgram('true true xor')
      checkStackValues(interpreter, false)
    })

    it('returns true for true xor false', async function () {
      const interpreter = await testProgram('true false xor')
      checkStackValues(interpreter, true)
    })

    it('returns true for false xor true', async function () {
      const interpreter = await testProgram('false true xor')
      checkStackValues(interpreter, true)
    })

    it('returns false for false xor false', async function () {
      const interpreter = await testProgram('false false xor')
      checkStackValues(interpreter, false)
    })
  })

  it('pushes false object', async function () {
    const interpreter = await testProgram('false')
    checkStackValues(interpreter, false)
  })

  it('pushes true object', async function () {
    const interpreter = await testProgram('true')
    checkStackValues(interpreter, true)
  })

  describe('not', function () {
    it('negates true', async function () {
      const interpreter = await testProgram('true not')
      checkStackValues(interpreter, false)
    })

    it('negates false', async function () {
      const interpreter = await testProgram('false not')
      checkStackValues(interpreter, true)
    })

    it('negates integer', async function () {
      const interpreter = await testProgram('1 not')
      checkStackValues(interpreter, -2)
    })
  })

  describe('bitshift', function () {
    it('shifts left', async function () {
      const interpreter = await testProgram('1 3 bitshift')
      checkStackValues(interpreter, 8)
    })

    it('shifts right', async function () {
      const interpreter = await testProgram('8 -3 bitshift')
      checkStackValues(interpreter, 1)
    })
  })
})
