import { ObjectType, PostScriptObject } from './scanner.js'

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

export function prettyPrint(obj: PostScriptObject): string {
  switch (obj.type) {
    case ObjectType.FontID:
    case ObjectType.Mark:
      return '<mark>'
    case ObjectType.Operator:
      return `<operator ${obj.value}>`
    case ObjectType.Array:
      return `[ ${obj.value.map(prettyPrint).join(', ')} ]`
    case ObjectType.Dictionary:
      return `{ ${obj.value
        .entries()
        .map(
          (name: string, value: PostScriptObject) =>
            `${name}: ${prettyPrint(value)}`
        )
        .join('\n')} }`
    case ObjectType.File:
      return '<file>'
    case ObjectType.GState:
      return '<graphics state>'
    case ObjectType.PackedArray:
      return '<packed array>'
    case ObjectType.Save:
      return '<save>'
    case ObjectType.Null:
    case ObjectType.Real:
    case ObjectType.Name:
    case ObjectType.Integer:
    case ObjectType.Boolean:
    case ObjectType.String:
      return obj.value
  }
  return ''
}
