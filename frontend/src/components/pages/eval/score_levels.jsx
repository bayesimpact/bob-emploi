import badImage from 'images/bad-picto.svg'
import excellentImage from 'images/excellent-picto.svg'
import goodImage from 'images/good-picto.svg'
import rankOneImage from 'images/rank-one-picto.svg'
import rankThreeImage from 'images/rank-three-picto.svg'
import rankTwoImage from 'images/rank-two-picto.svg'
import rankZeroImage from 'images/rank-zero-picto.svg'

import {Colors, colorToAlpha} from 'components/theme'


export const ADVICE_SCORES = [
  {
    image: rankThreeImage,
    tagColor: colorToAlpha(Colors.RED_PINK, .3),
    title: 'Prioritaire',
    value: '3',
  },
  {
    image: rankTwoImage,
    tagColor: colorToAlpha(Colors.SQUASH, .4),
    title: 'Secondaire',
    value: '2',
  },
  {
    image: rankOneImage,
    tagColor: colorToAlpha(Colors.BOB_BLUE, .4),
    title: 'À regarder',
    value: '1',
  },
  {
    image: rankZeroImage,
    tagColor: Colors.SILVER,
    title: 'À cacher',
    value: '0',
  },
]


export const EVAL_SCORES = [
  {
    image: excellentImage,
    score: 'EXCELLENT',
    title: 'Excellent',
  },
  {
    image: goodImage,
    score: 'GOOD_ENOUGH',
    title: 'Bien',
  },
  {
    image: badImage,
    score: 'BAD',
    title: 'Mauvais',
  },
]
