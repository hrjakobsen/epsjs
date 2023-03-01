import { Access, Executability, ObjectType, PostScriptObject } from './scanner'

export function radiansToDegrees(rad: number) {
  return (rad * 180) / Math.PI
}

export function degreeToRadians(deg: number) {
  return (deg * Math.PI) / 180
}

export function compareTypeCompatible(
  type1: ObjectType,
  type2: ObjectType
): boolean {
  if (type1 & (ObjectType.Integer | ObjectType.Real)) {
    return Boolean(type2 & (ObjectType.Integer | ObjectType.Real))
  }
  return type1 == type2
}

export function prettyPrint(obj: PostScriptObject<unknown>): string {
  switch (obj.type) {
    case ObjectType.FontID:
    case ObjectType.Mark:
      return '<mark>'
    case ObjectType.Operator:
      return `<operator ${obj.value}>`
    case ObjectType.Array:
      return `[ ${(obj as PostScriptObject<ObjectType.Array>).value
        .map(prettyPrint)
        .join(', ')} ]`
    case ObjectType.Dictionary:
      return `{ ${[
        ...(obj as PostScriptObject<ObjectType.Dictionary>).value.entries(),
      ]
        .map((entry) => {
          const [name, value] = entry
          return `${name}: ${prettyPrint(value)}`
        })
        .join('\n')} }`
    case ObjectType.File:
      return '<file>'
    case ObjectType.GState:
      return '<graphics state>'
    case ObjectType.PackedArray:
      return '<packed array>'
    case ObjectType.Save:
      return '<save>'
    case ObjectType.String:
      return (obj as PostScriptObject<ObjectType.String>).value.asString()
    case ObjectType.Null:
    case ObjectType.Real:
    case ObjectType.Name:
    case ObjectType.Integer:
      return String(obj.value)
    case ObjectType.Boolean:
      return (obj as PostScriptObject<ObjectType.Boolean>).value
        ? 'true'
        : 'false'
  }
  return ''
}

export function createLiteral(value: any, type: ObjectType) {
  return {
    type,
    value,
    attributes: {
      access: Access.Unlimited,
      executability: Executability.Literal,
    },
  }
}
