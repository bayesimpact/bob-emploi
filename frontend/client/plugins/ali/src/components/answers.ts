export type QuestionType = 'yes/no/later' | 'yes/no' | 'confidence' | 'levels'

export type AnswerType = -2 | -1 | 1 | 2 | boolean | 'later'

export interface AnswerOption {
  name: string
  value: AnswerType
}

const answers: {[type in QuestionType]: readonly AnswerOption[]} = {
  'confidence': [
    {name: 'Non pas du tout', value: -2},
    {name: 'Non pas vraiment', value: -1},
    {name: 'Oui plutôt', value: 1},
    {name: 'Oui tout à fait', value: 2},
  ],
  'levels': [
    {name: 'Non pas du tout', value: -2},
    {name: 'Non pas vraiment', value: -1},
    {name: 'Oui plutôt', value: 1},
    {name: 'Oui tout à fait', value: 2},
  ],
  'yes/no': [
    {name: 'Oui', value: true},
    {name: 'Non', value: false},
  ],
  'yes/no/later': [
    {name: 'Oui', value: true},
    {name: 'Peut-être plus tard', value: 'later'},
    {name: 'Non', value: false},
  ],
}

export default answers
