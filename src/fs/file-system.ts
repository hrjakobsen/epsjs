import { CharStreamBackedFile } from '../file'
import initPs from '../std/init.ps?raw'
import miscPs from '../std/misc.ps?raw'
import resourcesPs from '../std/resources.ps?raw'
import errorPs from '../std/error.ps?raw'
import symbolNeu from '../../src/assets/fonts/symbol/symbol-neu.ps?url'
import tgAdventorBold from '../../src/assets/fonts/tg/TG-Adventor-Bold.ps?url'
import tgAdventorBoldOblique from '../../src/assets/fonts/tg/TG-Adventor-BoldOblique.ps?url'
import tgAdventorOblique from '../../src/assets/fonts/tg/TG-Adventor-Oblique.ps?url'
import tgAdventor from '../../src/assets/fonts/tg/TG-Adventor.ps?url'
import tgBonumBold from '../../src/assets/fonts/tg/TG-Bonum-Bold.ps?url'
import tgBonumBoldOblique from '../../src/assets/fonts/tg/TG-Bonum-BoldOblique.ps?url'
import tgBonumOblique from '../../src/assets/fonts/tg/TG-Bonum-Oblique.ps?url'
import tgBonum from '../../src/assets/fonts/tg/TG-Bonum.ps?url'
import tgChorus from '../../src/assets/fonts/tg/TG-Chorus.ps?url'
import tgCursorBold from '../../src/assets/fonts/tg/TG-Cursor-Bold.ps?url'
import tgCursorBoldOblique from '../../src/assets/fonts/tg/TG-Cursor-BoldOblique.ps?url'
import tgCursorOblique from '../../src/assets/fonts/tg/TG-Cursor-Oblique.ps?url'
import tgCursor from '../../src/assets/fonts/tg/TG-Cursor.ps?url'
import tgHerosBold from '../../src/assets/fonts/tg/TG-Heros-Bold.ps?url'
import tgHerosBoldOblique from '../../src/assets/fonts/tg/TG-Heros-BoldOblique.ps?url'
import tgHerosNarrowBold from '../../src/assets/fonts/tg/TG-Heros-Narrow-Bold.ps?url'
import tgHerosNarrowBoldOblique from '../../src/assets/fonts/tg/TG-Heros-Narrow-BoldOblique.ps?url'
import tgHerosNarrowOblique from '../../src/assets/fonts/tg/TG-Heros-Narrow-Oblique.ps?url'
import tgHerosNarrow from '../../src/assets/fonts/tg/TG-Heros-Narrow.ps?url'
import tgHerosOblique from '../../src/assets/fonts/tg/TG-Heros-Oblique.ps?url'
import tgHeros from '../../src/assets/fonts/tg/TG-Heros.ps?url'
import tgPagellaBold from '../../src/assets/fonts/tg/TG-Pagella-Bold.ps?url'
import tgPagellaBoldOblique from '../../src/assets/fonts/tg/TG-Pagella-BoldOblique.ps?url'
import tgPagellaOblique from '../../src/assets/fonts/tg/TG-Pagella-Oblique.ps?url'
import tgPagella from '../../src/assets/fonts/tg/TG-Pagella.ps?url'
import tgScholaBold from '../../src/assets/fonts/tg/TG-Schola-Bold.ps?url'
import tgScholaBoldOblique from '../../src/assets/fonts/tg/TG-Schola-BoldOblique.ps?url'
import tgScholaOblique from '../../src/assets/fonts/tg/TG-Schola-Oblique.ps?url'
import tgSchola from '../../src/assets/fonts/tg/TG-Schola.ps?url'
import tgTermesBold from '../../src/assets/fonts/tg/TG-Termes-Bold.ps?url'
import tgTermesBoldItalic from '../../src/assets/fonts/tg/TG-Termes-BoldItalic.ps?url'
import tgTermesItalic from '../../src/assets/fonts/tg/TG-Termes-Italic.ps?url'
import tgTermes from '../../src/assets/fonts/tg/TG-Termes.ps?url'
import { PSInterpreter } from '../interpreter'
import { IoError } from '../error'

abstract class File {
  abstract read(): Promise<string>
}

class LoadedFile extends File {
  constructor(private contents: string) {
    super()
  }

  async read(): Promise<string> {
    return this.contents
  }
}

class LazyFile extends File {
  constructor(private path: string) {
    super()
  }

  async read(): Promise<string> {
    const response = await fetch(this.path)
    if (!response.ok) {
      throw new IoError()
    }
    return await response.text()
  }
}

export class FileSystem {
  private files: Map<string, File> = new Map()

  constructor(private interpreter: PSInterpreter) {}

  addFileFromString(path: string, contents: string) {
    this.files.set(path, new LoadedFile(contents))
  }

  addFileFromUrl(path: string, url: string) {
    this.files.set(path, new LazyFile(url))
  }

  async getFile(path: string) {
    const file = this.files.get(path)
    if (file === undefined) {
      throw new IoError()
    }
    const contents = await file.read()
    return CharStreamBackedFile.fromString(contents).withInterpreter(
      this.interpreter
    )
  }

  exists(path: string) {
    return this.files.has(path)
  }

  public static stdFs(interpreter: PSInterpreter) {
    const fs = new FileSystem(interpreter)
    fs.addFileFromString('init.ps', initPs)
    fs.addFileFromString('misc.ps', miscPs)
    fs.addFileFromString('resources.ps', resourcesPs)
    fs.addFileFromString('error.ps', errorPs)
    fs.addFileFromUrl('fonts/Symbol-Neu.ps', symbolNeu)
    fs.addFileFromUrl('fonts/TG-Adventor-Bold.ps', tgAdventorBold)
    fs.addFileFromUrl('fonts/TG-Adventor-BoldOblique.ps', tgAdventorBoldOblique)
    fs.addFileFromUrl('fonts/TG-Adventor-Oblique.ps', tgAdventorOblique)
    fs.addFileFromUrl('fonts/TG-Adventor.ps', tgAdventor)
    fs.addFileFromUrl('fonts/TG-Bonum-Bold.ps', tgBonumBold)
    fs.addFileFromUrl('fonts/TG-Bonum-BoldOblique.ps', tgBonumBoldOblique)
    fs.addFileFromUrl('fonts/TG-Bonum-Oblique.ps', tgBonumOblique)
    fs.addFileFromUrl('fonts/TG-Bonum.ps', tgBonum)
    fs.addFileFromUrl('fonts/TG-Chorus.ps', tgChorus)
    fs.addFileFromUrl('fonts/TG-Cursor-Bold.ps', tgCursorBold)
    fs.addFileFromUrl('fonts/TG-Cursor-BoldOblique.ps', tgCursorBoldOblique)
    fs.addFileFromUrl('fonts/TG-Cursor-Oblique.ps', tgCursorOblique)
    fs.addFileFromUrl('fonts/TG-Cursor.ps', tgCursor)
    fs.addFileFromUrl('fonts/TG-Heros-Bold.ps', tgHerosBold)
    fs.addFileFromUrl('fonts/TG-Heros-BoldOblique.ps', tgHerosBoldOblique)
    fs.addFileFromUrl('fonts/TG-Heros-Narrow-Bold.ps', tgHerosNarrowBold)
    fs.addFileFromUrl(
      'fonts/TG-Heros-Narrow-BoldOblique.ps',
      tgHerosNarrowBoldOblique
    )
    fs.addFileFromUrl('fonts/TG-Heros-Narrow-Oblique.ps', tgHerosNarrowOblique)
    fs.addFileFromUrl('fonts/TG-Heros-Narrow.ps', tgHerosNarrow)
    fs.addFileFromUrl('fonts/TG-Heros-Oblique.ps', tgHerosOblique)
    fs.addFileFromUrl('fonts/TG-Heros.ps', tgHeros)
    fs.addFileFromUrl('fonts/TG-Pagella-Bold.ps', tgPagellaBold)
    fs.addFileFromUrl('fonts/TG-Pagella-BoldOblique.ps', tgPagellaBoldOblique)
    fs.addFileFromUrl('fonts/TG-Pagella-Oblique.ps', tgPagellaOblique)
    fs.addFileFromUrl('fonts/TG-Pagella.ps', tgPagella)
    fs.addFileFromUrl('fonts/TG-Schola-Bold.ps', tgScholaBold)
    fs.addFileFromUrl('fonts/TG-Schola-BoldOblique.ps', tgScholaBoldOblique)
    fs.addFileFromUrl('fonts/TG-Schola-Oblique.ps', tgScholaOblique)
    fs.addFileFromUrl('fonts/TG-Schola.ps', tgSchola)
    fs.addFileFromUrl('fonts/TG-Termes-Bold.ps', tgTermesBold)
    fs.addFileFromUrl('fonts/TG-Termes-BoldItalic.ps', tgTermesBoldItalic)
    fs.addFileFromUrl('fonts/TG-Termes-Italic.ps', tgTermesItalic)
    fs.addFileFromUrl('fonts/TG-Termes.ps', tgTermes)
    return fs
  }
}
