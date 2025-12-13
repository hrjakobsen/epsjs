import { Coordinate } from '../coordinate'

export class Font {
  constructor(
    readonly head: HeadTable,
    readonly glyf: GlyfTable,
    readonly hmtx: HmtxTable,
    readonly hhea: HheaTable
  ) {}

  public getAdvanceWidth(glyphIndex: number) {
    if (glyphIndex < this.hhea.numberOfHMetrics) {
      return this.hmtx.horizontalMetrics[glyphIndex].advanceWidth
    } else {
      return this.hmtx.horizontalMetrics[this.hhea.numberOfHMetrics - 1]
        .advanceWidth
    }
  }

  static parse(data: DataView, offset: number = 0) {
    let cursor = offset
    const tableDirectory = TableDirectory.parse(data, cursor)
    cursor += TableDirectory.BYTE_SIZE
    assert(tableDirectory.sfntVersion === 0x10000)
    const tables = []
    for (let i = 0; i < tableDirectory.numTables; ++i) {
      tables.push(TableRecord.parse(data, cursor))
      cursor += TableRecord.BYTE_SIZE
    }

    const maxpHeader = tables.find(
      (table) => table.tableTag.toString() === 'maxp'
    )
    if (!maxpHeader) {
      throw new Error('Missing maxp table')
    }
    const maxp = MaxpTable.parse(data, maxpHeader.offset)

    const headHeader = tables.find(
      (table) => table.tableTag.toString() === 'head'
    )
    if (!headHeader) {
      throw new Error('Missing head table')
    }
    const head = HeadTable.parse(data, headHeader.offset)

    const locaHeader = tables.find(
      (table) => table.tableTag.toString() === 'loca'
    )
    if (!locaHeader) {
      throw new Error('Missing loca table')
    }

    const locaTable = LocaTable.parse(
      data,
      locaHeader.offset,
      head.indexToLocFormat === 1,
      maxp.numGlyphs
    )

    const glyfHeader = tables.find(
      (table) => table.tableTag.toString() === 'glyf'
    )
    if (!glyfHeader) {
      throw new Error('Missing glyf table')
    }
    const glyf = GlyfTable.parse(
      data,
      glyfHeader.offset,
      maxp.numGlyphs,
      locaTable
    )

    const hheaHeader = tables.find(
      (table) => table.tableTag.toString() === 'hhea'
    )
    if (!hheaHeader) {
      throw new Error('Missing hhea table')
    }
    const hhea = HheaTable.parse(data, hheaHeader.offset)

    const hmtxHeader = tables.find(
      (table) => table.tableTag.toString() === 'hmtx'
    )
    if (!hmtxHeader) {
      throw new Error('Missing hmtx table')
    }
    const hmtx = HmtxTable.parse(data, hmtxHeader.offset, maxp.numGlyphs, hhea)

    return new Font(head, glyf, hmtx, hhea)
  }
}

export class TableDirectory {
  static BYTE_SIZE = 12

  constructor(
    readonly sfntVersion: number,
    readonly numTables: number,
    readonly searchRange: number,
    readonly entrySelector: number,
    readonly rangeShift: number
  ) {}

  static parse(data: DataView, offset: number): TableDirectory {
    const sfntVersion = data.getInt32(offset + 0, false)
    const numTables = data.getUint16(offset + 4, false)
    const searchRange = data.getUint16(offset + 6, false)
    const entrySelector = data.getUint16(offset + 8, false)
    const rangeShift = data.getUint16(offset + 10, false)

    return new TableDirectory(
      sfntVersion,
      numTables,
      searchRange,
      entrySelector,
      rangeShift
    )
  }
}

export class TableRecord {
  static BYTE_SIZE = 16
  constructor(
    readonly tableTag: Tag,
    readonly checksum: number,
    readonly offset: number,
    readonly length: number
  ) {}

  static parse(data: DataView, offset: number) {
    const tableTag = Tag.parse(data, offset)
    const checksum = data.getUint32(offset + 4, false)
    const offsetR = data.getUint32(offset + 8, false)
    const length = data.getUint32(offset + 12, false)

    return new TableRecord(tableTag, checksum, offsetR, length)
  }
}

class Tag {
  static BYTE_SIZE = 4

  constructor(readonly buffer: Uint8Array) {}

  static parse(data: DataView, offset: number) {
    const tag1 = data.getUint8(offset)
    const tag2 = data.getUint8(offset + 1)
    const tag3 = data.getUint8(offset + 2)
    const tag4 = data.getUint8(offset + 3)

    return new Tag(new Uint8Array([tag1, tag2, tag3, tag4]))
  }

  toString() {
    let str = ''
    for (let i = 0; i <= this.buffer.length; ++i) {
      const charCode = this.buffer[i]
      if (charCode >= 0x20 && charCode <= 0x7e) {
        str += String.fromCharCode(charCode)
      }
    }
    return str || '-unknown-'
  }
}

export class GlyphHeader {
  static BYTE_SIZE = 10

  constructor(
    readonly numberOfContours: number,
    readonly xMin: number,
    readonly yMin: number,
    readonly xMax: number,
    readonly yMax: number
  ) {}

  static parse(data: DataView, offset: number) {
    const numberOfContours = data.getInt16(offset, false)
    const xMin = data.getInt16(offset + 2, false)
    const yMin = data.getInt16(offset + 4, false)
    const xMax = data.getInt16(offset + 6, false)
    const yMax = data.getInt16(offset + 8, false)

    return new GlyphHeader(numberOfContours, xMin, yMin, xMax, yMax)
  }
}
type GlyphPoint = Coordinate & { onCurve: boolean }

export class Glyph {
  constructor(
    readonly header: GlyphHeader,
    readonly byteSize: number,
    readonly coordinates: GlyphPoint[],
    readonly endPtsOfContours: number[]
  ) {}

  static parseGlyph(
    data: DataView,
    glyfTableOffset: number,
    glyphIndex: number,
    locaTable: LocaTable,
    glyphCache: (Glyph | undefined)[]
  ) {
    if (glyphCache[glyphIndex] !== undefined) {
      return glyphCache[glyphIndex]
    }
    const current = locaTable.offsets[glyphIndex]
    const next = locaTable.offsets[glyphIndex + 1]
    if (current === next) {
      // empty glyph
      return new Glyph(new GlyphHeader(0, 0, 0, 0, 0), 0, [], [])
    }
    let cursor = current + glyfTableOffset
    const header = GlyphHeader.parse(data, cursor)
    cursor += GlyphHeader.BYTE_SIZE
    if (header.numberOfContours >= 0) {
      // A simple glyph
      const glyph = Glyph.parseSimpleGlyph(data, cursor, header)
      glyphCache[glyphIndex] = glyph
      return glyph
    } else {
      // A composite glyph
      const glyph = Glyph.parseCompositeGlyph(
        data,
        cursor,
        glyfTableOffset,
        header,
        locaTable,
        glyphCache
      )
      glyphCache[glyphIndex] = glyph
      return glyph
    }
  }

  // https://learn.microsoft.com/en-us/typography/opentype/spec/glyf#simple-glyph-description
  static parseSimpleGlyph(data: DataView, offset: number, header: GlyphHeader) {
    let cursor = offset
    const endPtsOfContours = new Uint16Array(header.numberOfContours)
    for (let i = 0; i < header.numberOfContours; ++i) {
      endPtsOfContours[i] = data.getUint16(cursor, false)
      cursor += 2
    }
    const instructionLength = data.getUint16(cursor, false)
    cursor += 2
    const instructions = new Uint8Array(instructionLength)
    for (let i = 0; i < instructionLength; ++i) {
      instructions[i] = data.getUint8(cursor)
      cursor += 1
    }

    // The number of points is determined by the last entry in the endPtsOfContours array
    const numPoints =
      header.numberOfContours > 0
        ? endPtsOfContours[endPtsOfContours.length - 1] + 1
        : 0
    const flags = new Uint8Array(numPoints)

    for (let flagIndex = 0; flagIndex < numPoints; ++flagIndex) {
      const currentFlag = data.getUint8(cursor)
      cursor += 1
      flags[flagIndex] = currentFlag
      if (currentFlag & SimpleGlyphFlags.REPEAT_FLAG) {
        const numRepeats = data.getUint8(cursor)
        cursor += 1
        for (let i = 0; i < numRepeats; ++i) {
          flags[flagIndex + 1 + i] = currentFlag
        }
        flagIndex += numRepeats
      }
    }

    function parseCoordinates(
      flags: Uint8Array,
      shortFlag: number,
      sameOrPositiveShortFlag: number
    ) {
      const coordinates = []
      let current = 0

      for (let pointIndex = 0; pointIndex < flags.length; ++pointIndex) {
        const short = flags[pointIndex] & shortFlag
        const sameOrPositiveShort = flags[pointIndex] & sameOrPositiveShortFlag
        let delta = 0
        if (short) {
          const val = data.getUint8(cursor)
          cursor += 1
          if (sameOrPositiveShort) {
            delta = val
          } else {
            delta = -val
          }
        } else if (sameOrPositiveShort) {
          delta = 0
        } else {
          delta = data.getInt16(cursor, false)
          cursor += 2
        }
        current += delta
        coordinates.push(current)
      }
      return coordinates
    }

    const xCoordinates = parseCoordinates(
      flags,
      SimpleGlyphFlags.X_SHORT_VECTOR,
      SimpleGlyphFlags.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR
    )

    const yCoordinates = parseCoordinates(
      flags,
      SimpleGlyphFlags.Y_SHORT_VECTOR,
      SimpleGlyphFlags.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR
    )

    const coordinates: GlyphPoint[] = []
    for (let i = 0; i < flags.length; ++i) {
      coordinates.push({
        x: xCoordinates[i],
        y: yCoordinates[i],
        onCurve: Boolean(flags[i] & SimpleGlyphFlags.ON_CURVE_POINT),
      })
    }

    const byteSize = cursor - offset

    return new Glyph(
      header,
      byteSize,
      coordinates,
      Array.from(endPtsOfContours)
    )
  }

  static parseCompositeGlyph(
    data: DataView,
    offset: number,
    glyphTableOffset: number,
    header: GlyphHeader,
    locaTable: LocaTable,
    glyphCache: (Glyph | undefined)[]
  ) {
    let cursor = offset
    let flags: number
    const combinedPoints: GlyphPoint[] = []
    const combinedContours: number[] = []

    do {
      flags = data.getUint16(cursor, false)
      cursor += 2
      const componentGlyphIndex = data.getUint16(cursor, false)
      cursor += 2

      const component = Glyph.parseGlyph(
        data,
        glyphTableOffset,
        componentGlyphIndex,
        locaTable,
        glyphCache
      )

      let arg1: number
      let arg2: number
      // Check if arguments are 16-bit words or 8-bit bytes
      if (flags & CompositeGlyphFlags.ARG_1_AND_2_ARE_WORDS) {
        arg1 = data.getInt16(cursor, false)
        cursor += 2
        arg2 = data.getInt16(cursor, false)
        cursor += 2
      } else {
        arg1 = data.getInt8(cursor)
        cursor += 1
        arg2 = data.getInt8(cursor)
        cursor += 1
      }
      // Default tranformation matrix
      let a = 1
      let b = 0
      let c = 0
      let d = 1
      let dx = 0
      let dy = 0

      function readF2Dot14() {
        const raw = data.getInt16(cursor, false)
        cursor += 2
        return raw / 16384.0 // Divide by 2^14
      }

      if (flags & CompositeGlyphFlags.WE_HAVE_A_SCALE) {
        const s = readF2Dot14()
        a = s
        d = s
      } else if (flags & CompositeGlyphFlags.WE_HAVE_AN_X_AND_Y_SCALE) {
        a = readF2Dot14()
        d = readF2Dot14()
      } else if (flags & CompositeGlyphFlags.WE_HAVE_A_TWO_BY_TWO) {
        a = readF2Dot14()
        b = readF2Dot14()
        c = readF2Dot14()
        d = readF2Dot14()
      }

      if (flags & CompositeGlyphFlags.ARGS_ARE_XY_VALUES) {
        if (flags & CompositeGlyphFlags.SCALED_COMPONENT_OFFSET) {
          // The offsets are attached to the component *before* transformation.
          // We must apply the rotation/scale to the offset vector itself.
          dx = arg1 * a + arg2 * c
          dy = arg1 * b + arg2 * d
        } else {
          // The offsets are in the Parent's coordinate space.
          // Just add them directly.
          dx = arg1
          dy = arg2
        }
      } else {
        const rawChildPt = component.coordinates[arg2]
        const parentPt = combinedPoints[arg1]
        const scaledChildX = rawChildPt.x * a + rawChildPt.y * c
        const scaledChildY = rawChildPt.x * b + rawChildPt.y * d
        dx = parentPt.x - scaledChildX
        dy = parentPt.y - scaledChildY
      }

      const points: GlyphPoint[] = component.coordinates.map((p) => {
        const x = p.x
        const y = p.y
        return {
          x: x * a + y * c + dx,
          y: x * b + y * d + dy,
          onCurve: p.onCurve,
        }
      })
      combinedContours.push(
        ...component.endPtsOfContours.map((x) => x + combinedPoints.length)
      )
      combinedPoints.push(...points)
    } while (flags & CompositeGlyphFlags.MORE_COMPONENTS)
    const byteSize = cursor - offset
    return new Glyph(header, byteSize, combinedPoints, combinedContours)
  }
}

export const SimpleGlyphFlags = {
  ON_CURVE_POINT: 0x01,
  X_SHORT_VECTOR: 0x02,
  Y_SHORT_VECTOR: 0x04,
  REPEAT_FLAG: 0x08,
  X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR: 0x10,
  Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR: 0x20,
  OVERLAP_SIMPLE: 0x40,
}

export const CompositeGlyphFlags = {
  ARG_1_AND_2_ARE_WORDS: 0x01,
  ARGS_ARE_XY_VALUES: 0x02,
  ROUND_XY_TO_GRID: 0x04,
  WE_HAVE_A_SCALE: 0x08,
  MORE_COMPONENTS: 0x20,
  WE_HAVE_AN_X_AND_Y_SCALE: 0x40,
  WE_HAVE_A_TWO_BY_TWO: 0x80,
  WE_HAVE_INSTRUCTIONS: 0x100,
  USE_MY_METRICS: 0x200,
  OVERLAP_COMPOUND: 0x400,
  SCALED_COMPONENT_OFFSET: 0x800,
  UNSCALED_COMPONENT_OFFSET: 0x1000,
}

// https://learn.microsoft.com/en-us/typography/opentype/spec/glyf
export class GlyfTable {
  constructor(readonly glyphs: Glyph[]) {}

  static parse(
    data: DataView,
    offset: number,
    numGlyphs: number,
    locaTable: LocaTable
  ) {
    const glyphs: (Glyph | undefined)[] = []
    for (let i = 0; i < numGlyphs; ++i) {
      glyphs.push(undefined)
    }
    for (let i = 0; i < numGlyphs; ++i) {
      const glyph = Glyph.parseGlyph(data, offset, i, locaTable, glyphs)
      glyphs[i] = glyph
    }
    return new GlyfTable(glyphs.filter((glyph) => glyph !== undefined))
  }
}

// https://learn.microsoft.com/en-us/typography/opentype/spec/maxp
export class MaxpTable {
  constructor(readonly version: number, readonly numGlyphs: number) {}

  static parse(data: DataView, offset: number) {
    const version = data.getUint32(offset, false)
    const numGlyps = data.getUint16(offset + 4, false)

    return new MaxpTable(version, numGlyps)
  }
}

// https://learn.microsoft.com/en-us/typography/opentype/spec/loca
export class LocaTable {
  constructor(readonly byteSize: number, readonly offsets: number[]) {}

  static parse(
    data: DataView,
    offset: number,
    longFormat: boolean,
    numGlyphs: number
  ) {
    let cursor = offset
    const offsets: number[] = []

    function readOffset() {
      if (longFormat) {
        const read = data.getUint32(cursor, false)
        cursor += 4
        return read
      } else {
        const read = data.getUint16(cursor, false) * 2
        cursor += 2
        return read
      }
    }

    for (let i = 0; i < numGlyphs + 1; ++i) {
      offsets.push(readOffset())
    }

    const byteSize = cursor - offset

    return new LocaTable(byteSize, offsets)
  }
}

class FixedNumber {
  constructor(readonly upper: number, readonly lower: number) {}

  static parse(val: number) {
    return new FixedNumber(val >> 16, val & 0xffff)
  }
}

class LongDateTime {
  constructor(readonly backing: bigint) {}
}

// https://learn.microsoft.com/en-us/typography/opentype/spec/head
export class HeadTable {
  constructor(
    readonly majorVersion: number,
    readonly minorVersion: number,
    readonly fontRevision: FixedNumber,
    readonly checksumAdjustment: number,
    readonly magicNumber: number,
    readonly flags: number,
    readonly unitsPerEm: number,
    readonly created: LongDateTime,
    readonly modified: LongDateTime,
    readonly xMin: number,
    readonly yMin: number,
    readonly xMax: number,
    readonly yMax: number,
    readonly macStyle: number,
    readonly lowestRecPPEM: number,
    readonly fontDirectionHint: number,
    readonly indexToLocFormat: number,
    readonly glyphDataFormat: number
  ) {}

  static parse(data: DataView, offset: number) {
    const majorVersion = data.getUint16(offset, false)
    assert(majorVersion === 1)
    const minorVersion = data.getUint16(offset + 2, false)
    assert(minorVersion === 0)
    const fontRevision = FixedNumber.parse(data.getUint32(offset + 4, false))
    const checksumAdjustment = data.getUint32(offset + 8, false)
    const magicNumber = data.getUint32(offset + 12, false)
    assert(magicNumber === 0x5f0f3cf5)
    const flags = data.getUint16(offset + 16, false)
    const unitsPerEm = data.getUint16(offset + 18, false)
    assert(unitsPerEm >= 16 && unitsPerEm <= 16384)
    const created = new LongDateTime(data.getBigInt64(offset + 20, false))
    const modified = new LongDateTime(data.getBigInt64(offset + 28, false))
    const xMin = data.getInt16(offset + 36, false)
    const yMin = data.getInt16(offset + 38, false)
    const xMax = data.getInt16(offset + 40, false)
    const yMax = data.getInt16(offset + 42, false)
    const macStyle = data.getUint16(offset + 44, false)
    const lowestRecPPEM = data.getUint16(offset + 46, false)
    const fontDirectionHint = data.getInt16(offset + 48, false)
    const indexToLocFormat = data.getInt16(offset + 50, false)
    const glyphDataFormat = data.getInt16(offset + 52, false)

    return new HeadTable(
      majorVersion,
      minorVersion,
      fontRevision,
      checksumAdjustment,
      magicNumber,
      flags,
      unitsPerEm,
      created,
      modified,
      xMin,
      yMin,
      xMax,
      yMax,
      macStyle,
      lowestRecPPEM,
      fontDirectionHint,
      indexToLocFormat,
      glyphDataFormat
    )
  }

  static BYTE_SIZE = 54
}

export class HheaTable {
  constructor(
    readonly majorVersion: number,
    readonly minorVersion: number,
    readonly ascender: number,
    readonly descender: number,
    readonly lineGap: number,
    readonly advanceWidthMax: number,
    readonly minLeftSideBearing: number,
    readonly minRightSideBearing: number,
    readonly xMaxExtent: number,
    readonly caretSlopeRise: number,
    readonly caretSlopeRun: number,
    readonly caretOffset: number,
    readonly reserved1: number,
    readonly reserved2: number,
    readonly reserved3: number,
    readonly reserved4: number,
    readonly metricDataFormat: number,
    readonly numberOfHMetrics: number
  ) {}

  static parse(data: DataView, offset: number) {
    const majorVersion = data.getUint16(offset, false)
    assert(majorVersion === 1)
    const minorVersion = data.getUint16(offset + 2, false)
    assert(minorVersion === 0)
    const ascender = data.getInt16(offset + 4, false)
    const descender = data.getInt16(offset + 6, false)
    const lineGap = data.getInt16(offset + 8, false)
    const advanceWidthMax = data.getUint16(offset + 10, false)
    const minLeftSideBearing = data.getInt16(offset + 12, false)
    const minRightSideBearing = data.getInt16(offset + 14, false)
    const xMaxExtent = data.getInt16(offset + 16, false)
    const caretSlopeRise = data.getInt16(offset + 18, false)
    const caretSlopeRun = data.getInt16(offset + 20, false)
    const caretOffset = data.getInt16(offset + 22, false)
    const reserved1 = data.getInt16(offset + 24, false)
    assert(reserved1 === 0)
    const reserved2 = data.getInt16(offset + 26, false)
    assert(reserved2 === 0)
    const reserved3 = data.getInt16(offset + 28, false)
    assert(reserved3 === 0)
    const reserved4 = data.getInt16(offset + 30, false)
    assert(reserved4 === 0)
    const metricDataFormat = data.getInt16(offset + 32, false)
    const numberOfHMetrics = data.getUint16(offset + 34, false)

    return new HheaTable(
      majorVersion,
      minorVersion,
      ascender,
      descender,
      lineGap,
      advanceWidthMax,
      minLeftSideBearing,
      minRightSideBearing,
      xMaxExtent,
      caretSlopeRise,
      caretSlopeRun,
      caretOffset,
      reserved1,
      reserved2,
      reserved3,
      reserved4,
      metricDataFormat,
      numberOfHMetrics
    )
  }
}

class LongHorizontalMetric {
  constructor(
    readonly advanceWidth: number,
    readonly leftSideBearing: number
  ) {}
}

export class HmtxTable {
  constructor(
    readonly horizontalMetrics: LongHorizontalMetric[],
    readonly leftSideBearings: number[]
  ) {}

  static parse(
    data: DataView,
    offset: number,
    numGlyphs: number,
    hheaTable: HheaTable
  ) {
    let cursor = offset
    const horizontalMetrics: LongHorizontalMetric[] = []
    for (let i = 0; i < hheaTable.numberOfHMetrics; ++i) {
      const advanceWidth = data.getUint16(cursor, false)
      cursor += 2
      const lsb = data.getInt16(cursor, false)
      cursor += 2
      horizontalMetrics.push(new LongHorizontalMetric(advanceWidth, lsb))
    }

    const leftSideBearings: number[] = []
    for (let i = 0; i < numGlyphs - hheaTable.numberOfHMetrics; ++i) {
      const lsb = data.getInt16(cursor, false)
      cursor += 2
      leftSideBearings.push(lsb)
    }

    return new HmtxTable(horizontalMetrics, leftSideBearings)
  }
}

function assert(assertion: boolean, msg?: string) {
  if (!assertion)
    throw new Error(`Assertion failed${msg !== undefined ? ': ' + msg : ''}`)
}
