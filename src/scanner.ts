import { PostScriptArray } from './array'
import { PostScriptDictionary } from './dictionary/dictionary'
import { PostScriptFile } from './file'
import { BASE_10_INT, PostScriptLexer, RADIX_NUMBER, TokenType } from './lexer'
import { BufferedStreamer } from './stream'
import { PostScriptString } from './string'

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

// TODO: There's probably a nicer way of doing this
type ObjectValue<T extends ObjectType | unknown = unknown> =
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
    ? string
    : T extends ObjectType.Array
    ? PostScriptArray
    : T extends ObjectType.Dictionary
    ? PostScriptDictionary
    : T extends ObjectType.File
    ? PostScriptFile
    : T extends ObjectType.GState
    ? never
    : T extends ObjectType.PackedArray
    ? never
    : T extends ObjectType.Save
    ? never
    : T extends ObjectType.String
    ? PostScriptString
    : unknown

export type PostScriptObject<T extends ObjectType | unknown = unknown> = {
  type: ObjectType
  attributes: Attributes
  value: ObjectValue<T>
}

export type EPSMetaData = {
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export class PostScriptScanner extends BufferedStreamer<PostScriptObject> {
  constructor(private _lexer: PostScriptLexer) {
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
            x: parseInt(boundingBox[1]!),
            y: parseInt(boundingBox[2]!),
            width: parseInt(boundingBox[3]!),
            height: parseInt(boundingBox[4]!),
          }
        }
        if (token.content.match(/^%EndComments$/)) {
          break
        }
      }
    }
    return metaData
  }

  protected override generateToken(): PostScriptObject<unknown> | undefined {
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
        throw new Error('Not implemented')
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
        throw new Error('Unexpected }')
      default:
        return undefined
    }
  }

  scanNumber(): PostScriptObject {
    const numberString = this._lexer.next!.content
    let value: number
    let type = ObjectType.Real
    if (numberString.match(RADIX_NUMBER)) {
      const parts = numberString.split('#')
      const base = parseInt(parts[0]!)
      value = parseInt(parts[1]!, base)
    } else if (numberString.match(BASE_10_INT)) {
      value = parseInt(numberString)
      type = ObjectType.Integer
    } else {
      value = parseFloat(numberString)
    }

    this._lexer.advance()
    return {
      type,
      attributes: {
        executability: Executability.Literal,
        access: Access.Unlimited,
      },
      value,
    }
  }

  scanName(access: Access, executability: Executability): PostScriptObject {
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

  scanString(): PostScriptObject {
    const content = this._lexer.next!.content
    this._lexer.advance()
    return {
      type: ObjectType.String,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Literal,
      },
      value: PostScriptString.fromString(content),
    }
  }

  scanProcedure(): PostScriptObject {
    this._lexer.advance(1)
    const procedure: PostScriptObject<ObjectType.Array> = {
      type: ObjectType.Array,
      attributes: {
        access: Access.Unlimited,
        executability: Executability.Executable,
      },
      value: new PostScriptArray([]),
    }
    while (
      this._lexer.next &&
      this._lexer.next?.kind !== TokenType.ProcedureClose
    ) {
      procedure.value.push(this.generateToken()!)
    }
    if (this._lexer.next?.kind !== TokenType.ProcedureClose) {
      throw new Error('Missing }')
    }
    this._lexer.advance(1)
    return procedure
  }
}
