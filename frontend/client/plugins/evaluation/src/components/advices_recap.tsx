import _groupBy from 'lodash/groupBy'
import React, {useCallback, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'

import type {ValidAdvice} from 'store/advice'
import {isValidAdvice} from 'store/advice'
import {combineTOptions, prepareT} from 'store/i18n'

import CircularProgress from 'components/circular_progress'
import {SmartLink} from 'components/radium'
import Textarea from 'components/textarea'
import optimizeImage from 'images/optimize-picto.svg'
import commentImage from 'images/comment-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'

import {ADVICE_SCORES} from './score_levels'


const ADVICE_GROUP_PROPS = {
  1: {
    image: '',
    title: prepareT('À regarder'),
  },
  2: {
    image: twoStarsImage,
    title: prepareT('{{count}} étoile', {count: 2}),
  },
  3: {
    image: threeStarsImage,
    title: prepareT('{{count}} étoile', {count: 3}),
  },
} as const

type NumStars = '1'|'2'|'3'

const emptyArray = [] as const
const emptyObject = {} as const

interface AdvicesRecapProps {
  adviceEvaluations: {
    [adviceId: string]: bayes.bob.AdviceEvaluation
  }
  advices: readonly bayes.bob.Advice[]
  isLoading: boolean
  moduleNewScores: {
    [adviceId: string]: number
  }
  onEvaluateAdvice: (adviceId: string, evaluation: bayes.bob.AdviceEvaluation) => void
  onRescoreAdvice: (adviceId: string, newScore: string) => void
  profile: bayes.bob.UserProfile
  project: bayes.bob.Project
  style?: React.CSSProperties
}


const AdvicesRecapBase = (props: AdvicesRecapProps): React.ReactElement => {
  const {advices, adviceEvaluations, isLoading, moduleNewScores, onRescoreAdvice,
    onEvaluateAdvice, profile, project, style} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: '#fff',
    padding: 10,
    ...style,
  }), [style])
  const adviceGroups: {[K in NumStars]?: readonly bayes.bob.Advice[]} =
    _groupBy(
      advices.filter(({numStars}: bayes.bob.Advice): boolean =>
        !!numStars && !!ADVICE_GROUP_PROPS[(numStars + '') as NumStars]),
      'numStars')
  const groupKeys = Object.keys(ADVICE_GROUP_PROPS).sort().reverse() as NumStars[]
  if (isLoading) {
    return <CircularProgress />
  }
  return <div style={containerStyle}>
    <div>
      {groupKeys.map((numStars: NumStars): React.ReactNode => (
        <AdvicesRecapSection
          key={`section-${numStars}-stars`} advices={adviceGroups[numStars] || emptyArray}
          {...{adviceEvaluations, moduleNewScores, numStars,
            onEvaluateAdvice, onRescoreAdvice, profile, project}} />
      ))}
    </div>
  </div>
}
const AdvicesRecap = React.memo(AdvicesRecapBase)


interface EvalAdviceScoreButtonProps extends Omit<EvalElementButtonProps, 'onClick'> {
  adviceId: string
  onRescore: (adviceId: string, value: string) => void
  value: string
}


const EvalAdviceScoreButtonBase = (props: EvalAdviceScoreButtonProps): React.ReactElement => {
  const {adviceId, onRescore, value, ...otherProps} = props
  const handleClick = useCallback(
    (): void => onRescore(adviceId, value),
    [adviceId, onRescore, value],
  )
  return <EvalElementButton onClick={handleClick} {...otherProps} />
}
const EvalAdviceScoreButton = React.memo(EvalAdviceScoreButtonBase)


interface AdviceRecapProps {
  advice: ValidAdvice
  evaluation: bayes.bob.AdviceEvaluation
  onEvaluateAdvice: (adviceId: string, evaluation: bayes.bob.AdviceEvaluation) => void
  onRescoreAdvice: (adviceId: string, newScore: string) => void
  sectionScore: NumStars
  score: string
}


const AdviceRecapBase = (props: AdviceRecapProps): React.ReactElement => {
  const {advice, evaluation: {comment, shouldBeOptimized}, onEvaluateAdvice, onRescoreAdvice,
    sectionScore, score} = props
  const {t} = useTranslation()
  const {adviceId} = advice
  const handleToggleAdviceToOptimize = useCallback((): void => {
    adviceId && onEvaluateAdvice(adviceId, {shouldBeOptimized: !shouldBeOptimized})
  }, [adviceId, onEvaluateAdvice, shouldBeOptimized])
  const handleCommentChange = useCallback((comment: string): void => {
    adviceId && onEvaluateAdvice(adviceId, {comment})
  }, [adviceId, onEvaluateAdvice])
  const [isCommentShown, setIsCommentShown] = useState(false)
  // TODO(florian): focus directly inside the comment box when switching on.
  const toggleCommentShown =
    useCallback((): void => setIsCommentShown((wasShown: boolean): boolean => !wasShown), [])

  const textareaStyle = {
    borderColor: colors.BOB_BLUE,
    fontSize: 14,
    marginTop: -10,
    width: '100%',
  }

  return <div>
    <div style={{display: 'flex', fontSize: 15, padding: 5}}>
      <span style={{flex: 1}}>
        {adviceId}
      </span>
      {ADVICE_SCORES.map(({image, value}): React.ReactNode => {
        return <EvalAdviceScoreButton
          key={`rescore-${value}-stars`}
          isPreselected={value === (sectionScore + '')}
          isSelected={value === score}
          onRescore={onRescoreAdvice} adviceId={adviceId} value={value}>
          <img src={image} alt={`${value}*`} />
        </EvalAdviceScoreButton>
      })}
      <EvalElementButton
        isSelected={shouldBeOptimized}
        onClick={handleToggleAdviceToOptimize}>
        <img src={optimizeImage} alt={t('À optimiser')} title={t('À optimiser')} />
      </EvalElementButton>
      <EvalElementButton
        isSelected={!!comment || isCommentShown}
        onClick={toggleCommentShown}>
        <img src={commentImage} alt={t('Commenter')} title={t('Commenter')} />
      </EvalElementButton>
    </div>
    {isCommentShown ? <Textarea
      style={textareaStyle} value={comment || ''} onChange={handleCommentChange} />
      : null}
  </div>
}
const AdviceRecap = React.memo(AdviceRecapBase)


interface ExtraAdviceProps {
  adviceId: string
  onClear: (adviceId: string) => void
}
const extraAdviceStyle = {
  border: `solid 1px ${colors.BOB_BLUE}`,
  margin: '5px 0',
  padding: 6,
}


const ExtraAdviceBase = (props: ExtraAdviceProps): React.ReactElement => {
  const {adviceId, onClear} = props
  const {t} = useTranslation()
  const handleClear = useCallback((): void => onClear(adviceId), [adviceId, onClear])
  return <div style={extraAdviceStyle}>
    <div style={{alignItems: 'center', display: 'flex'}}>
      <span style={{flex: 1}}>{adviceId}</span>
      <button
        style={{cursor: 'pointer', padding: 5}} type="button"
        onClick={handleClear} aria-label={t('Retirer')}>×</button>
    </div>
  </div>
}
const ExtraAdvice = React.memo(ExtraAdviceBase)


interface AdvicesRecapSectionProps {
  adviceEvaluations: {
    [adviceId: string]: bayes.bob.AdviceEvaluation
  }
  advices: readonly bayes.bob.Advice[]
  moduleNewScores: {
    [adviceId: string]: number
  }
  numStars: NumStars
  onEvaluateAdvice: (adviceId: string, evaluation: bayes.bob.AdviceEvaluation) => void
  onRescoreAdvice: (adviceId: string, newScore: string) => void
}


const AdvicesRecapSectionBase = (props: AdvicesRecapSectionProps): React.ReactElement => {
  const {adviceEvaluations, advices, moduleNewScores, numStars, onEvaluateAdvice,
    onRescoreAdvice} = props
  const {t, t: translate} = useTranslation()
  const extraAdviceInput = useRef<HTMLInputElement>(null)

  const handleAddAdvice = useCallback((adviceId: string): void => {
    onRescoreAdvice(adviceId, numStars)
    if (extraAdviceInput.current) {
      extraAdviceInput.current.value = ''
    }
  }, [onRescoreAdvice, numStars])

  const handleClearAdvice =
    useCallback((adviceId: string): void => onRescoreAdvice(adviceId, ''), [onRescoreAdvice])

  const handleExtraInputKeyPress =
  useCallback(({key, currentTarget}: React.KeyboardEvent<HTMLInputElement>): void => {
    (key === 'Enter') && handleAddAdvice(currentTarget.value)
  }, [handleAddAdvice])

  const advicesShown =
    new Set(advices.filter(isValidAdvice).map(({adviceId}): string => adviceId))
  const rescoredAdvices = Object.keys(moduleNewScores)
  const extraAdvices = rescoredAdvices.filter(
    (adviceId: string): boolean => !advicesShown.has(adviceId) &&
    (moduleNewScores[adviceId] + '') === (numStars + ''))

  const {image, title} = ADVICE_GROUP_PROPS[numStars]
  const translatedTitle = translate(...combineTOptions(
    title, {count: Number.parseInt(numStars, 10)}))
  const headerStyle = {
    display: 'flex',
    justifyContent: 'center',
    padding: '15px 0px',
  }
  return <div>
    <div style={headerStyle}>
      {image
        ? <img src={image} style={{height: 63, width: 63}} alt={translatedTitle} />
        : <span style={{fontSize: 36, fontWeight: 'bold'}}>{translatedTitle}</span>
      }
    </div>
    {advices.map((advice): React.ReactElement|null =>
      isValidAdvice(advice) ? <AdviceRecap
        key={advice.adviceId} advice={advice}
        evaluation={adviceEvaluations[advice.adviceId] || emptyObject}
        onEvaluateAdvice={onEvaluateAdvice} onRescoreAdvice={onRescoreAdvice}
        sectionScore={numStars} score={moduleNewScores[advice.adviceId] + ''} /> : null)}
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {extraAdvices.map((adviceId): React.ReactNode => <ExtraAdvice
        key={adviceId} adviceId={adviceId} onClear={handleClearAdvice} />)}
      <input
        ref={extraAdviceInput} style={{fontSize: 14, marginTop: 10, padding: 8}}
        placeholder={t('+ Saisir un autre conseil à ajouter')}
        onKeyPress={handleExtraInputKeyPress} />
    </div>
  </div>
}
const AdvicesRecapSection = React.memo(AdvicesRecapSectionBase)


interface EvalElementButtonProps {
  children: React.ReactNode
  isPreselected?: boolean
  isSelected?: boolean
  onClick: () => void
  style?: React.CSSProperties
}


const EvalElementButtonBase = (props: EvalElementButtonProps): React.ReactElement => {
  const {children, isPreselected, isSelected, onClick, style} = props
  const containerStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      filter: 'initial',
      opacity: 1,
    },
    'cursor': 'pointer',
    'filter': isSelected ? 'initial' : 'grayscale(100%)',
    'opacity': (isPreselected && !isSelected) ? .5 : 1,
    'padding': 5,
    ...style,
  }), [isPreselected, isSelected, style])
  return <SmartLink onClick={onClick} style={containerStyle} aria-pressed={isSelected}>
    {children}
  </SmartLink>
}
const EvalElementButton = React.memo(EvalElementButtonBase)


export {AdvicesRecap, EvalElementButton}
