import { PSArray } from '../array'
import { TypecheckError, UndefinedResourceError } from '../error'
import { ProcedureContext } from '../execution-contexts/procedure-context'
import { Font } from '../fonts/font'
import { PSInterpreter } from '../interpreter'
import { Access, Executability, ObjectType, PSObject } from '../scanner'
import { PSString } from '../string'
import { createLiteral } from '../utils'

export async function defineresource(interpreter: PSInterpreter) {
  await delegateResourceCommand(
    interpreter,
    1,
    'DefineResource',
    async (category) => {
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
    }
  )
}

const FontMapping: Record<string, string> = {
  Helvetica: 'TG-Heros',
  'Helvetica-Bold': 'TG-Heros-Bold',
  'Helvetica-Oblique': 'TG-Heros-Oblique',
  'Helvetica-BoldOblique': 'TG-Heros-BoldOblique',
  'Helvetica-Narrow': 'TG-Heros-Narrow',
  'Helvetica-Narrow-Bold': 'TG-Heros-Narrow-Bold',
  'Helvetica-Narrow-Oblique': 'TG-Heros-Narrow-Oblique',
  'Helvetica-Narrow-BoldOblique': 'TG-Heros-Narrow-BoldOblique',
  'Times-Roman': 'TG-Termes',
  'Times-Bold': 'TG-Termes-Bold',
  'Times-Italic': 'TG-Termes-Italic',
  'Times-BoldItalic': 'TG-Termes-BoldItalic',
  Courier: 'TG-Cursor',
  'Courier-Bold': 'TG-Cursor-Bold',
  'Courier-Oblique': 'TG-Cursor-Oblique',
  'Courier-BoldOblique': 'TG-Cursor-BoldOblique',
  'AvantGarde-Book': 'TG-Adventor',
  'AvantGarde-Demi': 'TG-Adventor-Bold',
  'AvantGarde-BookOblique': 'TG-Adventor-Oblique',
  'AvantGarde-DemiOblique': 'TG-Adventor-BoldOblique',
  'Bookman-Light': 'TG-Bonum',
  'Bookman-Demi': 'TG-Bonum-Bold',
  'Bookman-LightItalic': 'TG-Bonum-Oblique',
  'Bookman-DemiItalic': 'TG-Bonum-BoldOblique',
  'NewCenturySchlbk-Roman': 'TG-Schola',
  'NewCenturySchlbk-Bold': 'TG-Schola-Bold',
  'NewCenturySchlbk-Italic': 'TG-Schola-Oblique',
  'NewCenturySchlbk-BoldItalic': 'TG-Schola-BoldOblique',
  'Palatino-Roman': 'TG-Pagella',
  'Palatino-Bold': 'TG-Pagella-Bold',
  'Palatino-Italic': 'TG-Pagella-Oblique',
  'Palatino-BoldItalic': 'TG-Pagella-BoldOblique',
  'ZapfChancery-MediumItalic': 'TG-Chorus',
  Symbol: 'Symbol-Neu',
}

export async function findresource(interpreter: PSInterpreter) {
  await delegateResourceCommand(interpreter, 0, 'FindResource', (category) => {
    if (category.value === 'Font') {
      const [key] = interpreter.operandStack.pop(ObjectType.Name)
      if (key.value in FontMapping) {
        interpreter.operandStack.push({ ...key, value: FontMapping[key.value] })
      } else {
        interpreter.operandStack.push(key)
      }
    }
  })
}

async function delegateResourceCommand(
  interpreter: PSInterpreter,
  keyOffset: number,
  procedure: string,
  extraBehaviour?: (category: PSObject<ObjectType.Name>) => Promise<void> | void
) {
  const [category] = interpreter.operandStack.pop(ObjectType.Name)
  const keyIndex = interpreter.operandStack.length - 1 - keyOffset
  const key = interpreter.operandStack.at(keyIndex)
  if (key.type === ObjectType.String) {
    interpreter.operandStack.set(keyIndex, {
      ...key,
      type: ObjectType.Name,
      value: (key as PSObject<ObjectType.String>).value.asString(),
    })
  }
  try {
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
    await extraBehaviour?.(category)

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
  } catch (error) {
    interpreter.operandStack.push(category)
    throw error
  }
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
  const buffers = data.map((x: PSObject) => {
    if (x.type !== ObjectType.String) {
      throw new TypecheckError()
    }
    return (x.value as PSString).asBuffer()
  })
  const totalLength = buffers.reduce((acc, x) => acc + x.byteLength, 0)
  const binaryData = new Uint8Array(totalLength)
  let cursor = 0
  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; ++i) {
      binaryData[cursor++] = buffer[i]
    }
  }
  const view = new DataView(binaryData.buffer, 0)
  const font = Font.parse(view)

  const fid = interpreter.parsedFonts.defineFont(font)
  fontDict.value.set(createLiteral('FID', ObjectType.Name), fid)
}
