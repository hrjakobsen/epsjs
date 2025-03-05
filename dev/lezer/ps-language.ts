import { LanguageSupport, LRLanguage } from '@codemirror/language'
import { parser } from './ps.grammar'
import { styleTags, tags } from '@lezer/highlight'

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
  },
})

export const ps = () => [new LanguageSupport(PSLanguage)]
