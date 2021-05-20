import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import commentImage from 'images/comment-picto.svg'
import optimizeImage from 'images/optimize-picto.svg'

import {EVAL_SCORES} from './score_levels'


const scoreLevelCellStyle = {
  alignItems: 'center',
  display: 'flex',
  padding: '0 15px',
}
const imageStyle = {marginLeft: 15}
const titleStyle = {flex: 1}


const CommentCellBase = ({children}: {children: React.ReactNode}): React.ReactElement => <th>
  <div style={scoreLevelCellStyle}>
    <div style={titleStyle}>{children}</div>
    <img src={commentImage} alt="" style={imageStyle} />
  </div>
</th>
const CommentCell = React.memo(CommentCellBase)


const headContainerStyle = {
  backgroundColor: colors.BOB_BLUE_HOVER,
  color: '#fff',
}
const cellStyle = {
  padding: '14px 15px 11px',
}


const HeaderBase = (): React.ReactElement => {
  const {t} = useTranslation()
  return <thead style={headContainerStyle}>
    <tr>
      <th style={cellStyle}>{t('Métier')}</th>
      <th style={cellStyle}>{t('Note')}</th>
      <CommentCell>{t('Commentaire texte diagnostic')}</CommentCell>
      <CommentCell>{t('Commentaires généraux')}</CommentCell>
    </tr>
  </thead>
}
const Header = React.memo(HeaderBase)


interface UseCaseProps {
  index: number
  onSelect: (useCase: bayes.bob.UseCase) => void
  useCase: bayes.bob.UseCase
}


const useCaseCellStyle = {
  padding: 14,
}
const imageInTextStyle = {
  verticalAlign: 'middle',
  width: 15,
}


const UseCaseBase = ({index, onSelect, useCase}: UseCaseProps): React.ReactElement => {
  const {evaluation, indexInPool, title, useCaseId} = useCase
  const {t} = useTranslation()
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: index % 2 ? colors.LIGHT_GREY : '#fff',
    color: colors.DARK_TWO,
  }), [index])
  const onClick = useCallback((): void => onSelect(useCase), [onSelect, useCase])
  return <tr style={containerStyle}>
    <td style={useCaseCellStyle}>
      <button onClick={onClick}>
        {indexInPool || '0'} - {title}
      </button>
    </td>
    <td style={useCaseCellStyle}>
      {EVAL_SCORES.
        filter(({score}): boolean => score === (evaluation && evaluation.score)).
        map(({image, score}): React.ReactNode => <img
          key={`${useCaseId}-eval-${score}`} src={image} alt={score}
          style={{height: 25, verticalAlign: 'middle'}} />)}
    </td>
    <td style={useCaseCellStyle}>
      {evaluation && evaluation.diagnostic && evaluation.diagnostic.text &&
        evaluation.diagnostic.text.comment || ''}
    </td>
    <td style={useCaseCellStyle}>
      {/* TODO(pascal): Consider truncating very long comments. */}
      {evaluation && evaluation.comments || ''}
      {Object.entries(evaluation && evaluation.advices || {}).
        filter(([unusedAdviceId, {comment, shouldBeOptimized}]): boolean =>
          !!(comment || shouldBeOptimized)).
        map(([adviceId, {comment, shouldBeOptimized}]): React.ReactNode =>
          <div key={`comment-${useCaseId}-${adviceId}`}>
            {adviceId}: {shouldBeOptimized && <span>
              <img src={optimizeImage} style={imageInTextStyle} alt="" /> {
                t('à optimiser')
              }, </span>
            }
            {comment}
          </div>)}
    </td>
  </tr>
}
const UseCase = React.memo(UseCaseBase)


interface PoolOverviewProps {
  onSelectUseCase: (useCase: bayes.bob.UseCase) => void
  useCases: readonly bayes.bob.UseCase[]
}


const tableStyle = {
  fontSize: 14,
  width: '100%',
}


// TODO(sil) : Make new cells for important comments.
const PoolOverview = (props: PoolOverviewProps): React.ReactElement => {
  const {onSelectUseCase, useCases} = props
  return <table style={tableStyle}>
    <Header />
    <tbody>
      {useCases.map((useCase, index) =>
        <UseCase
          useCase={useCase} index={index} onSelect={onSelectUseCase} key={useCase.useCaseId} />)}
    </tbody>
  </table>
}
PoolOverview.propTypes = {
  onSelectUseCase: PropTypes.func.isRequired,
  useCases: PropTypes.arrayOf(PropTypes.shape({
    evaluation: PropTypes.shape({
      comments: PropTypes.string,
      score: PropTypes.string,
    }),
    indexInPool: PropTypes.number,
    title: PropTypes.string,
    useCaseId: PropTypes.string.isRequired,
  }).isRequired).isRequired,
}



export default React.memo(PoolOverview)
