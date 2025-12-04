import { testProgram } from '../utils'

describe('math operators', function () {
  it('handles addition', async function () {
    const interpreter = await testProgram('1 2 add')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles subtraction', async function () {
    const interpreter = await testProgram('3 1 sub')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(2)
  })

  it('handles division', async function () {
    const interpreter = await testProgram('10 4 div')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(2.5)
  })

  it('handles integer division', async function () {
    const interpreter = await testProgram('10 4 idiv')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(2)
  })

  it('handles modulo', async function () {
    const interpreter = await testProgram('10 3 mod')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(1)
  })

  it('handles multiplication', async function () {
    const interpreter = await testProgram('3 4 mul')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(12)
  })

  it('handles abs for negative numbers', async function () {
    const interpreter = await testProgram('-3 abs')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles abs for positive numbers', async function () {
    const interpreter = await testProgram('3 abs')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles negation of negative numbers', async function () {
    const interpreter = await testProgram('-3 neg')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles negation of positive numbers', async function () {
    const interpreter = await testProgram('3 neg')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(-3)
  })

  it('handles ceiling of positive numbers', async function () {
    const interpreter = await testProgram('3.1 ceiling')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(4)
  })

  it('handles ceiling of negative numbers', async function () {
    const interpreter = await testProgram('-3.1 ceiling')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(-3)
  })

  it('handles rounding of positive numbers', async function () {
    const interpreter = await testProgram('3.1 round')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles rounding of negative numbers', async function () {
    const interpreter = await testProgram('-3.1 round')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(-3)
  })

  it('handles floor of positive numbers', async function () {
    const interpreter = await testProgram('3.1 floor')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles floor of negative numbers', async function () {
    const interpreter = await testProgram('-3.1 floor')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(-4)
  })

  it('handles sqrt', async function () {
    const interpreter = await testProgram('9 sqrt')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(3)
  })

  it('handles cosine', async function () {
    const interpreter = await testProgram('45 cos')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(0.707)
  })

  it('handles sine', async function () {
    const interpreter = await testProgram('45 sin')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(0.7071)
  })

  it('handles atan', async function () {
    let interpreter = await testProgram('0 1 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(0)

    interpreter = await testProgram('1 0 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(90)

    interpreter = await testProgram('-100 0 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(270)

    interpreter = await testProgram('4 4 atan')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(45)
  })

  it('handles exponents', async function () {
    const interpreter = await testProgram('2 3 exp')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toEqual(8)
  })

  it('handles natural logarithm', async function () {
    const interpreter = await testProgram('18 ln')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(2.89)
  })

  it('handles log 10', async function () {
    const interpreter = await testProgram('20 log')
    expect(interpreter.operandStack).toHaveLength(1)
    expect(interpreter.operandStack[0].value).toBeCloseTo(1.3)
  })
})
