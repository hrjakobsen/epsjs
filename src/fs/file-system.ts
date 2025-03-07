import { CharStreamBackedFile } from '../file'
import initPs from '../std/init.ps?raw'
import miscPs from '../std/misc.ps?raw'

export class FileSystem {
  private files: Map<string, string> = new Map()

  constructor() {}

  addFileFromString(path: string, contents: string) {
    this.files.set(path, contents)
  }

  getFile(path: string) {
    const file = this.files.get(path)
    if (file === undefined) {
      throw new Error('No such file ' + path)
    }
    return CharStreamBackedFile.fromString(file)
  }

  exists(path: string) {
    return this.files.has(path)
  }

  public static stdFs() {
    const fs = new FileSystem()
    fs.addFileFromString('init.ps', initPs)
    fs.addFileFromString('misc.ps', miscPs)
    return fs
  }
}
