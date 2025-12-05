// https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf#page=537

export class PSError extends Error {
  constructor(public readonly type: string) {
    super()
  }
}

export class ConfigurationError extends PSError {
  constructor() {
    super('configurationerror')
  }
}

export class DictFullError extends PSError {
  constructor() {
    super('dictfull')
  }
}

export class DictStackOverflowError extends PSError {
  constructor() {
    super('dictstackoverflow')
  }
}

export class ExecStackOverflowError extends PSError {
  constructor() {
    super('execstackoverflow')
  }
}

export class InterruptError extends PSError {
  constructor() {
    super('interrupt')
  }
}

export class InvalidAccessError extends PSError {
  constructor() {
    super('invalidaccess')
  }
}

export class InvalidExitError extends PSError {
  constructor() {
    super('invalidexit')
  }
}

export class InvalidFileAccessError extends PSError {
  constructor() {
    super('invalidfileaccess')
  }
}

export class InvalidFontError extends PSError {
  constructor() {
    super('invalidfont')
  }
}

export class InvalidRestoreError extends PSError {
  constructor() {
    super('invalidrestore')
  }
}

export class IoError extends PSError {
  constructor() {
    super('ioerror')
  }
}

export class LimitCheckError extends PSError {
  constructor() {
    super('limitcheck')
  }
}

export class NoCurrentPointError extends PSError {
  constructor() {
    super('nocurrentpoint')
  }
}

export class RangeCheckError extends PSError {
  constructor() {
    super('rangecheck')
  }
}

export class StackOverflowError extends PSError {
  constructor() {
    super('stackoverflow')
  }
}

export class StackUnderflowError extends PSError {
  constructor() {
    super('stackunderflow')
  }
}

export class SyntaxError extends PSError {
  constructor() {
    super('syntaxerror')
  }
}

export class TimeoutError extends PSError {
  constructor() {
    super('timeout')
  }
}

export class TypecheckError extends PSError {
  constructor() {
    super('typecheck')
  }
}

export class UndefinedError extends PSError {
  constructor() {
    super('undefined')
  }
}

export class UndefinedFilenameError extends PSError {
  constructor() {
    super('undefinedfilename')
  }
}

export class UndefinedResourceError extends PSError {
  constructor() {
    super('undefinedresource')
  }
}

export class UndefinedResultError extends PSError {
  constructor() {
    super('undefinedresult')
  }
}

export class UnmatchedMarkError extends PSError {
  constructor() {
    super('unmatchedmark')
  }
}

export class UnregisteredError extends PSError {
  constructor() {
    super('unregistered')
  }
}

export class VmError extends PSError {
  constructor() {
    super('VMerror')
  }
}
