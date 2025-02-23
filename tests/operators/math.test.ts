import { testProgram } from '../utils'

describe('math operators', function () {
  it('handles addition', function () {
    const interpreter = testProgram('1 2 add')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles subtraction', function () {
    const interpreter = testProgram('3 1 sub')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(2)
  })

  it('handles division', function () {
    const interpreter = testProgram('10 4 div')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(2.5)
  })

  it('handles integer division', function () {
    const interpreter = testProgram('10 4 idiv')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(2)
  })

  it('handles modulo', function () {
    const interpreter = testProgram('10 3 mod')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(1)
  })

  it('handles multiplication', function () {
    const interpreter = testProgram('3 4 mul')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(12)
  })

  it('handles abs for negative numbers', function () {
    const interpreter = testProgram('-3 abs')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles abs for positive numbers', function () {
    const interpreter = testProgram('3 abs')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles negation of negative numbers', function () {
    const interpreter = testProgram('-3 neg')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles negation of positive numbers', function () {
    const interpreter = testProgram('3 neg')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(-3)
  })

  it('handles ceiling of positive numbers', function () {
    const interpreter = testProgram('3.1 ceiling')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(4)
  })

  it('handles ceiling of negative numbers', function () {
    const interpreter = testProgram('-3.1 ceiling')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(-3)
  })

  it('handles rounding of positive numbers', function () {
    const interpreter = testProgram('3.1 round')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles rounding of negative numbers', function () {
    const interpreter = testProgram('-3.1 round')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(-3)
  })

  it('handles floor of positive numbers', function () {
    const interpreter = testProgram('3.1 floor')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles floor of negative numbers', function () {
    const interpreter = testProgram('-3.1 floor')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(-4)
  })

  it('handles sqrt', function () {
    const interpreter = testProgram('9 sqrt')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(3)
  })

  it('handles cosine', function () {
    const interpreter = testProgram('45 cos')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(0.707)
  })

  it('handles sine', function () {
    const interpreter = testProgram('45 sin')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(0.7071)
  })

  it('handles atan', function () {
    let interpreter = testProgram('0 1 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(0)

    interpreter = testProgram('1 0 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(90)

    interpreter = testProgram('-100 0 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(270)

    interpreter = testProgram('4 4 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(45)
  })

  it('handles exponents', function () {
    const interpreter = testProgram('2 3 exp')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toEqual(8)
  })

  it('handles natural logarithm', function () {
    const interpreter = testProgram('18 ln')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(2.89)
  })

  it('handles log 10', function () {
    const interpreter = testProgram('20 log')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0]!.value).toBeCloseTo(1.3)
  })
})
