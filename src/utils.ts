import { ObjectType } from './scanner.js'

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
