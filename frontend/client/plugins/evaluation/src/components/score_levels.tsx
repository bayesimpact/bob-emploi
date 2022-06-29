import badImage from 'images/bad-picto.svg'
import excellentImage from 'images/excellent-picto.svg'
import goodImage from 'images/good-picto.svg'
import rankOneImage from 'images/rank-one-picto.svg'
import rankThreeImage from 'images/rank-three-picto.svg'
import rankTwoImage from 'images/rank-two-picto.svg'
import rankZeroImage from 'images/rank-zero-picto.svg'

import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'
import {colorToAlpha} from 'components/colors'


export const ADVICE_SCORES = [
  {
    image: rankThreeImage,
    tagColor: colorToAlpha(colors.RED_PINK, .3),
    title: prepareT('Prioritaire'),
    value: '3',
  },
  {
    image: rankTwoImage,
    tagColor: colorToAlpha(colors.SQUASH, .4),
    title: prepareT('Secondaire'),
    value: '2',
  },
  {
    image: rankOneImage,
    tagColor: colorToAlpha(colors.BOB_BLUE, .4),
    title: prepareT('À regarder'),
    value: '1',
  },
  {
    image: rankZeroImage,
    tagColor: colors.SILVER,
    title: prepareT('À cacher'),
    value: '0',
  },
] as const


export const EVAL_SCORES: readonly {
  image: string
  score: bayes.bob.UseCaseScore
  title: LocalizableString
}[] = [
  {
    image: excellentImage,
    score: 'EXCELLENT',
    title: prepareT('Excellent'),
  },
  {
    image: goodImage,
    score: 'GOOD_ENOUGH',
    title: prepareT('Bien'),
  },
  {
    image: badImage,
    score: 'BAD',
    title: prepareT('Mauvais'),
  },
] as const
