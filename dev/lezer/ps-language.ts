import { LanguageSupport, LRLanguage } from '@codemirror/language'
import { parser } from './ps.grammar'
import { styleTags, tags } from '@lezer/highlight'
import { completeFromList } from '@codemirror/autocomplete'
import { BUILT_INS_LIST } from '../../src/dictionary/system-dictionary'

export const PSLanguage = LRLanguage.define({
  name: 'ps',
  parser: parser.configure({
    props: [
      styleTags({
        Name: tags.labelName,
        LineComment: tags.lineComment,
        Number: tags.number,
        Operator: tags.name,
        'String/...': tags.string,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: '%' },
    autocomplete: completeFromList(
      BUILT_INS_LIST.map(([operator]) => operator)
    ),
  },
})

export const ps = () => [new LanguageSupport(PSLanguage, [])]
