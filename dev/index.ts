import { EditorState } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { PostScriptInterpreter } from '../src'
import { TokenError } from '../src/scanner'

const INITIAL_DOC = `10 280 moveto
(<- Write PostScript over there) show

/radius { 200 } def

1 0.5 0.4 setrgbcolor
newpath
0 0 moveto
0 0 radius 0 90 arc
fill`

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
            render()
          }
        },
      })),
      keymap.of([indentWithTab]),
    ],
  }),
  parent: document.getElementById('text')!,
})

function render() {
  try {
    document.getElementById('error')!.innerText = ''
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    // eslint-disable-next-line no-self-assign
    canvas.width = canvas.width
    const context = canvas.getContext('2d')!
    const interpreter = PostScriptInterpreter.load(
      view.state.doc.sliceString(0)
    )
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
    interpreter.run(context)
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
  }
}

document.getElementById('reset')!.addEventListener('click', () => {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: INITIAL_DOC },
  })
})

render()
