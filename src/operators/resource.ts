import { PSArray } from '../array'
import { TypecheckError, UndefinedResourceError } from '../error'
import { ProcedureContext } from '../execution-contexts/procedure-context'
import { Font } from '../fonts/font'
import { PSInterpreter } from '../interpreter'
import { Access, Executability, ObjectType, PSObject } from '../scanner'
import { PSString } from '../string'
import { createLiteral } from '../utils'

export function defineresource(interpreter: PSInterpreter) {
  delegateResourceCommand(interpreter, 'DefineResource', async (category) => {
    if (category.value === 'Font') {
      const [instance, key] = interpreter.operandStack.pop(
        ObjectType.Dictionary,
        ObjectType.Name | ObjectType.String
      )
      if (!instance.value.isFontDictionary()) {
        throw new TypecheckError()
      }
      if (
        !(
          instance.value.get(createLiteral('FontType', ObjectType.Name))
            ?.value === 42
        )
      ) {
        console.error('Only type 42 fonts are supported')
        throw new TypecheckError()
      }
      try {
        await loadFontData(interpreter, instance)
      } finally {
        interpreter.operandStack.push(key, instance)
      }
    }
  })
}

export function findresource(interpreter: PSInterpreter) {
  delegateResourceCommand(interpreter, 'FindResource')
}

function delegateResourceCommand(
  interpreter: PSInterpreter,
  procedure: string,
  extraBehaviour?: (category: PSObject<ObjectType.Name>) => Promise<void> | void
) {
  interpreter.operandStack.withPopped([ObjectType.Name], ([category]) => {
    const globalCategoryDict = interpreter.symbolLookup(
      createLiteral('GlobalCategoryDirectory', ObjectType.Name)
    )
    if (!globalCategoryDict) {
      throw new UndefinedResourceError()
    }
    if (globalCategoryDict.type !== ObjectType.Dictionary) {
      throw new TypecheckError()
    }
    const categoryDict = (
      globalCategoryDict as PSObject<ObjectType.Dictionary>
    ).value.get(createLiteral(category.value, ObjectType.Name))

    // Extra behaviour for certain categories (e.g. fonts)
    extraBehaviour?.(category)

    interpreter.dictionaryStack.push(globalCategoryDict)
    const perCategoryProc = (
      categoryDict as PSObject<ObjectType.Dictionary>
    ).value.get(createLiteral(procedure, ObjectType.Name))
    if (!perCategoryProc) {
      interpreter.dictionaryStack.pop()
      throw new UndefinedResourceError()
    }
    if (
      perCategoryProc.type !== ObjectType.Array ||
      perCategoryProc.attributes.executability !== Executability.Executable
    ) {
      interpreter.dictionaryStack.pop()
      throw new TypecheckError()
    }
    interpreter.executionStack.push({
      attributes: {
        executability: Executability.Executable,
        access: Access.Unlimited,
      },
      type: ObjectType.Name,
      value: 'end',
    })
    interpreter.executionStack.push(
      new ProcedureContext(interpreter, perCategoryProc)
    )
  })
}

async function loadFontData(
  interpreter: PSInterpreter,
  fontDict: PSObject<ObjectType.Dictionary>
) {
  if (!fontDict.value.isFontDictionary()) {
    throw new Error('definefont: Not a font dictionary')
  }
  // const name = fontDict.value.searchByName('FontName')!
  const data = fontDict.value.searchByName('sfnts')!.value as PSArray
  let totalLength = 0
  for (const str of data.items) {
    if (str.type !== ObjectType.String) {
      throw new Error('Invalid data type, expected string got ' + str.type)
    }
    totalLength += (str as PSObject<ObjectType.String>).value.length
  }
  const binaryData = new Uint8Array(totalLength)
  let cursor = 0
  for (const str of data.items) {
    const buffer = (str.value as PSString).asBuffer()
    for (let i = 0; i <= buffer.length; ++i) {
      binaryData[cursor++] = buffer[i]
    }
  }
  const view = new DataView(binaryData.buffer, 0)
  const font = Font.parse(view)

  const fid = interpreter.parsedFonts.defineFont(font)
  fontDict.value.set(createLiteral('FID', ObjectType.Name), fid)
}
