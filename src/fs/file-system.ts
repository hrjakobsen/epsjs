import { CharStreamBackedFile } from '../file'
import initPs from '../std/init.ps?raw'
import miscPs from '../std/misc.ps?raw'
import resourcesPs from '../std/resources.ps?raw'
import errorPs from '../std/error.ps?raw'
import symbolFont from '../../src/assets/fonts/symbol/symbol-neu.ps?url'
import arimoRegular from '../../src/assets/fonts/arimo/arimo-regular.ps?url'
import arimoBold from '../../src/assets/fonts/arimo/arimo-bold.ps?url'
import arimoOblique from '../../src/assets/fonts/arimo/arimo-oblique.ps?url'
import arimoBoldOblique from '../../src/assets/fonts/arimo/arimo-bold-oblique.ps?url'
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
    fs.addFileFromUrl('fonts/Symbol.ps', symbolFont)
    fs.addFileFromUrl('fonts/Helvetica.ps', arimoRegular)
    fs.addFileFromUrl('fonts/Helvetica-Bold.ps', arimoBold)
    fs.addFileFromUrl('fonts/Helvetica-Oblique.ps', arimoOblique)
    fs.addFileFromUrl('fonts/Helvetica-BoldOblique.ps', arimoBoldOblique)
    return fs
  }
}
