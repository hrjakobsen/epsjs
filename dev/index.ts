import { EditorState } from '@codemirror/state'
import {
  EditorView,
  ViewPlugin,
  highlightTrailingWhitespace,
  keymap,
} from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { PSInterpreter } from '../src'
import { TokenError } from '../src/scanner'
import { ps } from './lezer/ps-language'
import { throttle } from './utils'

const INITIAL_DOC = `/Helvetica 12 selectfont
10 280 moveto
(<- Write code over there) show

/radius { 200 } def

1 0.5 0.4 setrgbcolor
newpath
0 0 moveto
0 0 radius 0 90 arc
fill`

const debouncedRender = throttle(render, 500)

export const view = new EditorView({
  state: EditorState.create({
    doc: localStorage.getItem('doc') || INITIAL_DOC,
    extensions: [
      basicSetup,
      EditorView.lineWrapping,
      ViewPlugin.define(() => ({
        update(update) {
          if (update.docChanged) {
            localStorage.setItem('doc', update.state.doc.toString())
            debouncedRender()
          }
        },
      })),
      keymap.of([indentWithTab]),
      ps(),
      highlightTrailingWhitespace(),
    ],
  }),
  parent: document.getElementById('text')!,
})

async function render(): Promise<PSInterpreter | undefined> {
  try {
    document.getElementById('error')!.innerText = ''
    const stdoutElement = document.getElementById('stdout')!
    stdoutElement.innerHTML = ''
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    // eslint-disable-next-line no-self-assign
    canvas.width = canvas.width
    const context = canvas.getContext('2d')!
    const interpreter = PSInterpreter.load(view.state.doc.sliceString(0))
    if (interpreter.metaData.boundingBox) {
      canvas.width =
        interpreter.metaData.boundingBox.upperRightX -
        interpreter.metaData.boundingBox.lowerLeftX
      canvas.height =
        interpreter.metaData.boundingBox.upperRightY -
        interpreter.metaData.boundingBox.lowerLeftY
    } else {
      canvas.width = 300
      canvas.height = 300
    }
    await interpreter.run(context)
    stdoutElement.innerText = interpreter.stdout.content
    return interpreter
  } catch (e: any) {
    let message = ''
    if (e instanceof TokenError) {
      if (e.token.span) {
        const line = view.state.doc.lineAt(e.token.span.from)
        const column = e.token.span.from - line.from
        message += `Error at ${line.number}:${column}: ${e.message}`
      } else {
        message += e.message
      }
    } else {
      message += e.message
    }
    document.getElementById('error')!.innerText = message + '\n' + e.stack
    return
  }
}

document.getElementById('reset')!.addEventListener('click', () => {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: INITIAL_DOC },
  })
})

render()
