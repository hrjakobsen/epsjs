import { checkStackValues, testProgram } from '../utils'

describe('operand stack operators', function () {
  it('handles pop', function () {
    const interpreter = testProgram('1 2 3 pop')
    checkStackValues(interpreter, 1, 2)
  })

  it('handles exch', function () {
    const interpreter = testProgram('1 2 exch')
    checkStackValues(interpreter, 2, 1)
  })

  it('handles dup', function () {
    const interpreter = testProgram('1 dup')
    checkStackValues(interpreter, 1, 1)
  })

  it('handles copy', function () {
    const interpreter = testProgram('1 2 3 2 copy')
    checkStackValues(interpreter, 1, 2, 3, 2, 3)
  })

  describe('index', function () {
    it('indexes from the back', function () {
      const interpreter = testProgram('1 2 3 4 5 2 index')
      checkStackValues(interpreter, 1, 2, 3, 4, 5, 3)
    })

    it('handles index 0', function () {
      const interpreter = testProgram('1 2 3 4 5 0 index')
      checkStackValues(interpreter, 1, 2, 3, 4, 5, 5)
    })
  })

  describe('roll', function () {
    it('handles positive roll', function () {
      const interpreter = testProgram('(a) (b) (c) 3 1 roll')
      checkStackValues(interpreter, 'c', 'a', 'b')
    })

    it('handles negative roll', function () {
      const interpreter = testProgram('(a) (b) (c) 3 -1 roll')
      checkStackValues(interpreter, 'b', 'c', 'a')
    })

    it('handles zero roll', function () {
      const interpreter = testProgram('(a) (b) (c) 3 0 roll')
      checkStackValues(interpreter, 'a', 'b', 'c')
    })
  })

  it('handles clear', function () {
    const interpreter = testProgram('1 2 3 clear')
    expect(interpreter.operandStack).toHaveLength(0)
  })

  it('handles count', function () {
    const interpreter = testProgram('1 1 1 count')
    checkStackValues(interpreter, 1, 1, 1, 3)
  })

  it('handles mark', function () {
    const interpreter = testProgram('mark')
    checkStackValues(interpreter, '*mark')
  })

  it('handles cleartomark', function () {
    const interpreter = testProgram('1 2 mark 3 4 5 cleartomark')
    checkStackValues(interpreter, 1, 2)
  })

  it('handles counttomark', function () {
    const interpreter = testProgram('1 2 mark 3 4 5 counttomark')
    checkStackValues(interpreter, 1, 2, '*mark', 3, 4, 5, 3)
  })
})
