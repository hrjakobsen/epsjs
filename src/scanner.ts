import { PSArray } from './array'
import { PSDictionary } from './dictionary/dictionary'
import { PSReadableFile } from './file'
import { PSInterpreter } from './interpreter'
import { BASE_10_INT, PSLexer, RADIX_NUMBER, Token, TokenType } from './lexer'
import { BufferedStreamer } from './stream'
import { PSString } from './string'

export enum ObjectType {
  Any = -1, // NOTE: Internal
  Boolean = 1,
  FontID = 2,
  Integer = 4,
  Mark = 8,
  Name = 16,
  Null = 32,
  Operator = 64,
  Real = 128,
  Array = 256,
  Dictionary = 512,
  File = 1024,
  GState = 2048,
  PackedArray = 4096,
  Save = 8192,
  String = 16384,
}

export function getObjectTypeName(type: ObjectType): string {
  if (type === ObjectType.Any) {
    return 'any'
  }
  const typeMapping: [number, string][] = [
    [ObjectType.Boolean, 'boolean'],
    [ObjectType.FontID, 'fontID'],
    [ObjectType.Integer, 'integer'],
    [ObjectType.Mark, 'mark'],
    [ObjectType.Name, 'name'],
    [ObjectType.Null, 'null'],
    [ObjectType.Operator, 'operator'],
    [ObjectType.Real, 'real'],
    [ObjectType.Array, 'array'],
    [ObjectType.Dictionary, 'dictionary'],
    [ObjectType.File, 'file'],
    [ObjectType.GState, 'gstate'],
    [ObjectType.PackedArray, 'packedarray'],
    [ObjectType.Save, 'save'],
    [ObjectType.String, 'string'],
  ]

  const types = []
  for (const [typ, value] of typeMapping) {
    if (type & typ) {
      types.push(value)
    }
  }
  return types.join(' | ')
}

export enum Executability {
  Literal,
  Executable,
}

export enum Access {
  Unlimited,
  ReadOnly,
  ExecuteOnly,
  None,
}

type Attributes = {
  executability: Executability
  access: Access
}

export class TokenError extends Error {
  constructor(public token: Token, message: string) {
    super(message)
  }
}

export type OperatorFunction = (interpreter: PSInterpreter) => void

// TODO: There's probably a nicer way of doing this
export type ObjectValue<T extends ObjectType | unknown = unknown> =
  T extends ObjectType.Integer
    ? number
    : T extends ObjectType.Real
    ? number
    : T extends ObjectType.Boolean
    ? boolean
    : T extends ObjectType.FontID
    ? never
    : T extends ObjectType.Mark
    ? undefined
    : T extends ObjectType.Name
    ? string
    : T extends ObjectType.Null
    ? null
    : T extends ObjectType.Operator
    ? OperatorFunction
    : T extends ObjectType.Array
    ? PSArray
    : T extends ObjectType.Dictionary
    ? PSDictionary
    : T extends ObjectType.File
    ? PSReadableFile
    : T extends ObjectType.GState
    ? never
    : T extends ObjectType.PackedArray
    ? never
    : T extends ObjectType.Save
    ? never
    : T extends ObjectType.String
    ? PSString
    : unknown

export type PSObject<T extends ObjectType | unknown = unknown> = {
  type: ObjectType
  attributes: Attributes
  value: ObjectValue<T>
}

export type BoundingBox = {
  lowerLeftX: number
  lowerLeftY: number
  upperRightX: number
  upperRightY: number
}

export type EPSMetaData = {
  boundingBox?: BoundingBox
}

export class PSScanner extends BufferedStreamer<PSObject> {
  public interpreter?: PSInterpreter
  constructor(private _lexer: PSLexer) {
    super()
  }

  public getMetaData(): EPSMetaData {
    const metaData: EPSMetaData = {}
    for (let i = 0; this._lexer.peek(i); ++i) {
      const token = this._lexer.peek(i)!
      if (token.kind === TokenType.Comment) {
        const boundingBox = token.content.match(
          /^%BoundingBox: (\d+) (\d+) (\d+) (\d+)$/
        )
        if (boundingBox) {
          metaData.boundingBox = {
            lowerLeftX: parseInt(boundingBox[1]!),
            lowerLeftY: parseInt(boundingBox[2]!),
            upperRightX: parseInt(boundingBox[3]!),
            upperRightY: parseInt(boundingBox[4]!),
          }
        }
        if (token.content.match(/^%EndComments$/)) {
          return metaData
        }
      }
    }
    return metaData
  }

  protected override generateToken(): PSObject<unknown> | undefined {
    if (this._lexer.next === undefined) {
      return undefined
    }
    const token = this._lexer.next
    switch (token.kind) {
      case TokenType.Number: {
        return this.scanNumber()
      }
      case TokenType.Name:
        return this.scanName(Access.Unlimited, Executability.Executable)
      case TokenType.LiteralName:
        return this.scanName(Access.Unlimited, Executability.Literal)
      case TokenType.ImmediatelyEvaluatedName:
        return this.immediatelyEvaluateName()
      case TokenType.Comment:
        // Skip the comment token
        this._lexer.advance()
        return this.generateToken()
      case TokenType.String:
        return this.scanString()
      case TokenType.ArrayOpen:
      case TokenType.ArrayClose:
      case TokenType.DictionaryOpen:
      case TokenType.DictionaryClose:
        return this.scanName(Access.Unlimited, Executability.Executable)
      case TokenType.ProcedureOpen:
        return this.scanProcedure()
      case TokenType.ProcedureClose:
        throw new TokenError(token, 'Unexpected }')
      default:
        return undefined
    }
  }

  scanNumber(): PSObject {
    const numberString = this._lexer.next!.content
    const parsedNumber = parseNumber(numberString)

    this._lexer.advance()
    return {
      type: parsedNumber.type,
      attributes: {
        executability: Executability.Literal,
        access: Access.Unlimited,
      },
      value: parsedNumber.value,
    }
  }

  scanName(access: Access, executability: Executability): PSObject {
    const name = this._lexer.next!.content
    this._lexer.advance()
    return {
      type: ObjectType.Name,
      attributes: {
        access,
        executability,
      },
      value: name,
    }
  }

  scanString(): PSObject {
    const content = this._lexer.next!.content
    this._lexer.advance()
    return {
      type: ObjectType.String,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
      value: PSString.fromString(content),
    }
  }

  scanProcedure(): PSObject {
    this._lexer.advance(1)
    const procedure: PSObject<ObjectType.Array> = {
      type: ObjectType.Array,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Executable,
      },
      value: new PSArray([]),
    }
    while (
      this._lexer.next &&
      this._lexer.next?.kind !== TokenType.ProcedureClose
    ) {
      if (this._lexer.next?.kind === TokenType.Comment) {
        this._lexer.advance()
        continue
      }
      procedure.value.push(this.generateToken()!)
    }
    if (this._lexer.next?.kind !== TokenType.ProcedureClose) {
      throw new Error('Missing }')
    }
    this._lexer.advance(1)
    return procedure
  }

  sourceOffset(): number {
    return this._lexer.sourceOffset()
  }

  immediatelyEvaluateName() {
    const token = this._lexer.next!
    if (!this.interpreter) {
      throw new Error('No interpreter present while scanning')
    }
    const obj = this.interpreter.symbolLookup({
      type: ObjectType.Name,
      value: token.content,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
    })
    this._lexer.advance(1)
    if (!obj) {
      throw new Error(
        'Unable to lookup immediately evaluated name ' + token.content
      )
    }
    return obj
  }
}

export function parseNumber(numberString: string): {
  value: number
  type: ObjectType
} {
  let value: number
  let type = ObjectType.Real
  if (numberString.match(RADIX_NUMBER)) {
    const parts = numberString.split('#')
    const base = parseInt(parts[0]!)
    value = parseInt(parts[1]!, base)
    type = ObjectType.Integer
  } else if (numberString.match(BASE_10_INT)) {
    value = parseInt(numberString)
    type = ObjectType.Integer
  } else {
    value = parseFloat(numberString)
  }
  return { value, type }
}
