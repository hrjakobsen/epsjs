import * as stackOperators from '../operators/operand-stack'
import * as dictionaryOperators from '../operators/dictionary'
import * as stringOperators from '../operators/string'
import * as arithmeticMathOperators from '../operators/arithmetic-math'
import * as relationalBooleanBitwiseOperators from '../operators/relational-boolean-bitwise'
import * as arrayOperators from '../operators/array'
import * as packedArrayOperators from '../operators/packed-array'
import * as virtualMemoryOperators from '../operators/virtual-memory'
import * as graphicsStateOperators from '../operators/graphics-state'
import * as coordinateSystemMatrixOperators from '../operators/coordinate-system-matrix'
import * as pathOperators from '../operators/path'
import * as paintingOperators from '../operators/painting'
import * as controlOperators from '../operators/control'
import * as fileOperators from '../operators/file'
import * as typeAttributeConversionOperators from '../operators/type-attribute-conversion'
import * as deviceSetupOutputOperators from '../operators/device-setup-output'
import * as fontOperators from '../operators/glyph-font'
import * as miscellaneousOperators from '../operators/miscellaneous'

import { Access, Executability, ObjectType, OperatorFunction } from '../scanner'
import { PSDictionary } from './dictionary'
import { PSInterpreter } from '../interpreter'
import { createLiteral } from '../utils'

type StackPattern = ObjectType[]
type OverloadResolution = [StackPattern, OperatorFunction]

function stackMatches(interpreter: PSInterpreter, pattern: StackPattern) {
  if (interpreter.operandStack.length < pattern.length) {
    return false
  }
  for (let i = 0; i < pattern.length; i++) {
    if (
      !(
        pattern[pattern.length - 1 - i]! &
        interpreter.operandStack[interpreter.operandStack.length - 1 - i]!.type
      )
    ) {
      return false
    }
  }
  return true
}
function resolveOverload(resolutions: OverloadResolution[]): OperatorFunction {
  return (interpreter) => {
    for (const [pattern, operator] of resolutions) {
      if (stackMatches(interpreter, pattern)) {
        return operator(interpreter)
      }
    }
    throw new Error('No matching overload')
  }
}

const BUILT_INS_LIST: [string, OperatorFunction][] = [
  ['pop', stackOperators.pop],
  ['exch', stackOperators.exch],
  ['dup', stackOperators.dup],
  ['index', stackOperators.index],
  ['roll', stackOperators.roll],
  ['clear', stackOperators.clear],
  ['count', stackOperators.count],
  ['mark', stackOperators.mark],
  ['cleartomark', stackOperators.clearToMark],
  ['counttomark', stackOperators.countToMark],
  ['dict', dictionaryOperators.dict],
  ['<<', dictionaryOperators.startDict],
  ['>>', dictionaryOperators.endDict],
  ['maxlength', dictionaryOperators.maxLength],
  ['begin', dictionaryOperators.begin],
  ['end', dictionaryOperators.end],
  ['def', dictionaryOperators.def],
  ['load', dictionaryOperators.load],
  ['store', dictionaryOperators.store],
  ['undef', dictionaryOperators.undef],
  ['known', dictionaryOperators.known],
  ['where', dictionaryOperators.where],
  ['currentdict', dictionaryOperators.currentDict],
  ['errordict', dictionaryOperators.errorDict],
  ['$error', dictionaryOperators.error],
  ['systemdict', dictionaryOperators.systemDict],
  ['userdict', dictionaryOperators.userDict],
  ['globaldict', dictionaryOperators.globalDict],
  ['statusdict', dictionaryOperators.statusDict],
  ['countdictstack', dictionaryOperators.countDictStack],
  ['dictstack', dictionaryOperators.dictStack],
  ['cleardictstack', dictionaryOperators.cleardictstack],
  ['string', stringOperators.string],
  ['anchorsearch', stringOperators.anchorSearch],
  ['search', stringOperators.search],
  ['token', stringOperators.token],
  ['bind', miscellaneousOperators.bind],
  ['realtime', miscellaneousOperators.realtime],
  ['usertime', miscellaneousOperators.usertime],
  ['eq', relationalBooleanBitwiseOperators.eq],
  ['ne', relationalBooleanBitwiseOperators.ne],
  ['ge', relationalBooleanBitwiseOperators.ge],
  ['gt', relationalBooleanBitwiseOperators.gt],
  ['le', relationalBooleanBitwiseOperators.le],
  ['lt', relationalBooleanBitwiseOperators.lt],
  ['and', relationalBooleanBitwiseOperators.and],
  ['not', relationalBooleanBitwiseOperators.not],
  ['or', relationalBooleanBitwiseOperators.or],
  ['xor', relationalBooleanBitwiseOperators.xor],
  ['bitshift', relationalBooleanBitwiseOperators.bitshift],
  ['add', arithmeticMathOperators.add],
  ['div', arithmeticMathOperators.div],
  ['idiv', arithmeticMathOperators.idiv],
  ['mod', arithmeticMathOperators.mod],
  ['mul', arithmeticMathOperators.mul],
  ['sub', arithmeticMathOperators.sub],
  ['abs', arithmeticMathOperators.abs],
  ['neg', arithmeticMathOperators.neg],
  ['ceiling', arithmeticMathOperators.ceiling],
  ['floor', arithmeticMathOperators.floor],
  ['round', arithmeticMathOperators.round],
  ['truncate', arithmeticMathOperators.truncate],
  ['sqrt', arithmeticMathOperators.sqrt],
  ['atan', arithmeticMathOperators.atan],
  ['cos', arithmeticMathOperators.cos],
  ['sin', arithmeticMathOperators.sin],
  ['exp', arithmeticMathOperators.exp],
  ['ln', arithmeticMathOperators.ln],
  ['log', arithmeticMathOperators.log],
  ['rand', arithmeticMathOperators.rand],
  ['srand', arithmeticMathOperators.srand],
  ['rrand', arithmeticMathOperators.rrand],
  ['array', arrayOperators.array],
  ['[', arrayOperators.arrayStart],
  [']', arrayOperators.arrayEnd],
  ['astore', arrayOperators.aStore],
  ['packedarray', packedArrayOperators.packedArray],
  ['setpacking', packedArrayOperators.setPacking],
  ['currentpacking', packedArrayOperators.currentPacking],
  ['save', virtualMemoryOperators.save],
  ['restore', virtualMemoryOperators.restore],
  ['gsave', graphicsStateOperators.gsave],
  ['grestore', graphicsStateOperators.grestore],
  ['setlinewidth', graphicsStateOperators.setLineWidth],
  ['currentlinewidth', graphicsStateOperators.currentLineWidth],
  ['setlinecap', graphicsStateOperators.setLineCap],
  ['currentlinecap', graphicsStateOperators.currentLineCap],
  ['setlinejoin', graphicsStateOperators.setLineJoin],
  ['currentlinejoin', graphicsStateOperators.currentLineJoin],
  ['setmiterlimit', graphicsStateOperators.setMiterLimit],
  ['currentmiterlimit', graphicsStateOperators.currentMiterLimit],
  ['setcolorspace', graphicsStateOperators.setColorSpace],
  ['setrgbcolor', graphicsStateOperators.setColor],
  ['setcolor', graphicsStateOperators.setColor],
  ['setgray', graphicsStateOperators.setGray],
  ['concat', graphicsStateOperators.concat],
  ['setdash', graphicsStateOperators.setDash],
  ['matrix', coordinateSystemMatrixOperators.matrix],
  ['currentmatrix', coordinateSystemMatrixOperators.currentMatrix],
  ['setmatrix', coordinateSystemMatrixOperators.setMatrix],
  ['translate', coordinateSystemMatrixOperators.translate],
  ['scale', coordinateSystemMatrixOperators.scale],
  ['rotate', coordinateSystemMatrixOperators.rotate],
  ['newpath', pathOperators.newPath],
  ['currentpoint', pathOperators.currentPoint],
  ['moveto', pathOperators.moveTo],
  ['rmoveto', pathOperators.rMoveTo],
  ['lineto', pathOperators.lineTo],
  ['rlineto', pathOperators.rLineTo],
  ['arc', pathOperators.arc],
  ['arcn', pathOperators.arcn],
  ['arct', pathOperators.arct],
  ['arcto', pathOperators.arcto],
  ['curveto', pathOperators.curveto],
  ['rcurveto', pathOperators.rcurveto],
  ['closepath', pathOperators.closePath],
  ['clip', pathOperators.clip],
  ['rectclip', pathOperators.rectClip],
  ['stroke', paintingOperators.stroke],
  ['fill', paintingOperators.fill],
  ['eofill', paintingOperators.eofill],
  ['rectstroke', paintingOperators.rectstroke],
  ['rectfill', paintingOperators.rectfill],
  ['exec', controlOperators.exec],
  ['if', controlOperators._if],
  ['ifelse', controlOperators.ifelse],
  ['for', controlOperators._for],
  ['repeat', controlOperators.repeat],
  ['loop', controlOperators.loop],
  ['exit', controlOperators.exit],
  ['stop', controlOperators.stop],
  ['stopped', controlOperators.stopped],
  ['countexecstack', controlOperators.countExecStack],
  ['execstack', controlOperators.execStack],
  ['quit', controlOperators.quit],
  ['start', controlOperators.start],
  ['=', fileOperators.debugPrint],
  ['==', fileOperators.debugPrintObject],
  ['stack', fileOperators.stack],
  ['pstack', fileOperators.pstack],
  ['readstring', fileOperators.readString],
  ['filter', fileOperators.filter],
  ['currentfile', fileOperators.currentFile],
  ['type', typeAttributeConversionOperators.type],
  ['cvlit', typeAttributeConversionOperators.cvlit],
  ['cvx', typeAttributeConversionOperators.cvx],
  ['xcheck', typeAttributeConversionOperators.xcheck],
  ['executeonly', typeAttributeConversionOperators.executeonly],
  ['noaccess', typeAttributeConversionOperators.noaccess],
  ['readonly', typeAttributeConversionOperators.readonly],
  ['rcheck', typeAttributeConversionOperators.rcheck],
  ['wcheck', typeAttributeConversionOperators.wcheck],
  ['cvi', typeAttributeConversionOperators.cvi],
  ['cvn', typeAttributeConversionOperators.cvn],
  ['cvr', typeAttributeConversionOperators.cvr],
  ['cvrs', typeAttributeConversionOperators.cvrs],
  ['cvs', typeAttributeConversionOperators.cvs],
  ['showpage', deviceSetupOutputOperators.showPage],
  ['debug', deviceSetupOutputOperators.debug],
  ['findfont', fontOperators.findFont],
  ['setfont', fontOperators.setFont],
  ['scalefont', fontOperators.scaleFont],
  ['definefont', fontOperators.defineFont],
  ['selectfont', fontOperators.selectFont],
  ['makefont', fontOperators.makeFont],
  ['stringwidth', fontOperators.stringWidth],
  ['show', fontOperators.show],
  ['ashow', fontOperators.ashow],
  // Overloads
  [
    'copy',
    resolveOverload([
      [[ObjectType.Integer], stackOperators.copy],
      [[ObjectType.Array, ObjectType.Array], arrayOperators.copy],
      [
        [ObjectType.PackedArray, ObjectType.PackedArray],
        packedArrayOperators.copy,
      ],
      [[ObjectType.String, ObjectType.String], stringOperators.copy],
    ]),
  ],
  [
    'length',
    resolveOverload([
      [[ObjectType.Array], arrayOperators.length],
      [[ObjectType.PackedArray], packedArrayOperators.length],
      [[ObjectType.String], stringOperators.length],
      [[ObjectType.Dictionary], dictionaryOperators.length],
    ]),
  ],
  [
    'get',
    resolveOverload([
      [[ObjectType.Array, ObjectType.Integer], arrayOperators.get],
      [[ObjectType.PackedArray, ObjectType.Integer], packedArrayOperators.get],
      [[ObjectType.String, ObjectType.Integer], stringOperators.get],
      [[ObjectType.Dictionary, ObjectType.Any], dictionaryOperators.get],
    ]),
  ],
  [
    'put',
    resolveOverload([
      [
        [ObjectType.Array, ObjectType.Integer, ObjectType.Any],
        arrayOperators.put,
      ],
      [
        [ObjectType.String, ObjectType.Integer, ObjectType.Integer],
        stringOperators.put,
      ],
      [
        [ObjectType.Dictionary, ObjectType.Any, ObjectType.Any],
        dictionaryOperators.put,
      ],
    ]),
  ],
  [
    'forall',
    resolveOverload([
      [[ObjectType.Array, ObjectType.Array], arrayOperators.forall],
      [[ObjectType.String, ObjectType.Array], stringOperators.forall],
      [[ObjectType.PackedArray, ObjectType.Array], packedArrayOperators.forall],
      [[ObjectType.Dictionary, ObjectType.Array], dictionaryOperators.forall],
    ]),
  ],
  [
    'getinterval',
    resolveOverload([
      [
        [ObjectType.Array, ObjectType.Integer, ObjectType.Integer],
        arrayOperators.getInterval,
      ],
      [
        [ObjectType.PackedArray, ObjectType.Integer, ObjectType.Integer],
        packedArrayOperators.getInterval,
      ],
      [
        [ObjectType.String, ObjectType.Integer, ObjectType.Integer],
        stringOperators.getInterval,
      ],
    ]),
  ],
  [
    'putinterval',
    resolveOverload([
      [
        [ObjectType.Array, ObjectType.Integer, ObjectType.Array],
        arrayOperators.putInterval,
      ],
      [
        [ObjectType.Array, ObjectType.Integer, ObjectType.PackedArray],
        packedArrayOperators.putInterval,
      ],
      [
        [ObjectType.String, ObjectType.Integer, ObjectType.String],
        stringOperators.putInterval,
      ],
    ]),
  ],
  [
    'aload',
    resolveOverload([
      [[ObjectType.Array], arrayOperators.aLoad],
      [[ObjectType.PackedArray], packedArrayOperators.aLoad],
    ]),
  ],
]

const alreadyReported = new Set()
for (const name of BUILT_INS_LIST.map((x) => x[0])) {
  if (
    BUILT_INS_LIST.filter((x) => name === x[0]).length > 1 &&
    !alreadyReported.has(name)
  ) {
    console.warn('Duplicate name: ' + name)
    alreadyReported.add(name)
  }
}

const BUILT_INS = new Map(BUILT_INS_LIST)

export class SystemDictionary extends PSDictionary {
  constructor() {
    super(true, BUILT_INS.size)
    for (const [builtin, definition] of BUILT_INS.entries()) {
      this.addBuiltinOperator(builtin, definition)
    }
    this.forceSet(
      createLiteral('null', ObjectType.Name),
      miscellaneousOperators.NULL_OBJECT
    )
    this.forceSet(
      createLiteral('languagelevel', ObjectType.Name),
      miscellaneousOperators.LANGUAGE_LEVEL_OBJECT
    )
    this.forceSet(
      createLiteral('product', ObjectType.Name),
      miscellaneousOperators.PRODUCT_NAME_OBJECT
    )
    this.forceSet(
      createLiteral('revision', ObjectType.Name),
      miscellaneousOperators.REVISION_OBJECT
    )
    this.forceSet(
      createLiteral('version', ObjectType.Name),
      miscellaneousOperators.VERSION_OBJECT
    )
    this.forceSet(
      createLiteral('serialnumber', ObjectType.Name),
      miscellaneousOperators.SERIAL_NUMBER_OBJECT
    )
    this.forceSet(
      createLiteral('false', ObjectType.Name),
      relationalBooleanBitwiseOperators.FALSE_OBJECT
    )
    this.forceSet(
      createLiteral('true', ObjectType.Name),
      relationalBooleanBitwiseOperators.TRUE_OBJECT
    )
  }

  private addBuiltinOperator(name: string, definition: OperatorFunction) {
    this.forceSet(
      {
        attributes: {
          access: Access.ExecuteOnly,
          executability: Executability.Executable,
        },
        type: ObjectType.Name,
        value: name,
      },
      {
        attributes: {
          access: Access.ExecuteOnly,
          executability: Executability.Executable,
        },
        type: ObjectType.Operator,
        value: definition,
      }
    )
  }
}
