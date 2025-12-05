import { midpoint } from '../coordinate'
import { SimpleGlyph, SimpleGlyphFlags } from '../fonts/font'

export function createSimpleGlyphPath(
  ctx: CanvasRenderingContext2D,
  glyph: SimpleGlyph
) {
  ctx.beginPath()
  for (
    let contourEndIndex = 0;
    contourEndIndex < glyph.endPtsOfContours.length;
    ++contourEndIndex
  ) {
    const start =
      contourEndIndex === 0
        ? 0
        : glyph.endPtsOfContours[contourEndIndex - 1] + 1
    const end = glyph.endPtsOfContours[contourEndIndex]
    const indices = glyph.coordinates.slice(start, end + 1)

    // move to start of curve
    const firstPoint = indices[0]
    if (firstPoint.flags & SimpleGlyphFlags.ON_CURVE_POINT) {
      ctx.moveTo(firstPoint.x, firstPoint.y)
    } else {
      const lastPoint = indices[indices.length - 1]
      if (lastPoint.flags & SimpleGlyphFlags.ON_CURVE_POINT) {
        ctx.moveTo(lastPoint.x, lastPoint.y)
      } else {
        const midPoint = midpoint(firstPoint, lastPoint)
        ctx.moveTo(midPoint.x, midPoint.y)
      }
    }

    // Iterate the points
    for (let i = 0; i < indices.length; ++i) {
      const curr = indices[i]
      const next = indices[(i + 1) % indices.length]
      if (curr.flags & SimpleGlyphFlags.ON_CURVE_POINT) {
        if (next.flags & SimpleGlyphFlags.ON_CURVE_POINT) {
          ctx.lineTo(next.x, next.y)
        } else {
          // This is the start of a curve, do nothing
        }
      } else {
        if (next.flags & SimpleGlyphFlags.ON_CURVE_POINT) {
          ctx.quadraticCurveTo(curr.x, curr.y, next.x, next.y)
        } else {
          const virtualEnd = midpoint(curr, next)

          ctx.quadraticCurveTo(curr.x, curr.y, virtualEnd.x, virtualEnd.y)
        }
      }
    }

    // Close the path
    ctx.closePath()
  }
}
