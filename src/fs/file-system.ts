import { CharStreamBackedFile } from '../file'
import initPs from '../std/init.ps?raw'
import miscPs from '../std/misc.ps?raw'
import errorPs from '../std/error.ps?raw'
import symbolFont from '../../src/assets/fonts/symbol/symbol-neu.ps?raw'
import arimoRegular from '../../src/assets/fonts/arimo/arimo-regular.ps?raw'
import arimoBold from '../../src/assets/fonts/arimo/arimo-bold.ps?raw'
import arimoOblique from '../../src/assets/fonts/arimo/arimo-oblique.ps?raw'
import arimoBoldOblique from '../../src/assets/fonts/arimo/arimo-bold-oblique.ps?raw'
import { PSInterpreter } from '../interpreter'

export class FileSystem {
  private files: Map<string, string> = new Map()

  constructor(private interpreter: PSInterpreter) {}

  addFileFromString(path: string, contents: string) {
    this.files.set(path, contents)
  }

  getFile(path: string) {
    const file = this.files.get(path)
    if (file === undefined) {
      throw new Error('No such file ' + path)
    }
    return CharStreamBackedFile.fromString(file).withInterpreter(
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
    fs.addFileFromString('error.ps', errorPs)
    fs.addFileFromString('symbol.ps', symbolFont)
    fs.addFileFromString('arimo-regular.ps', arimoRegular)
    fs.addFileFromString('arimo-bold.ps', arimoBold)
    fs.addFileFromString('arimo-oblique.ps', arimoOblique)
    fs.addFileFromString('arimo-bold-oblique.ps', arimoBoldOblique)
    return fs
  }
}
