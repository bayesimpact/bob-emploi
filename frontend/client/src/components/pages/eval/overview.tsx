import _memoize from 'lodash/memoize'
import PropTypes from 'prop-types'
import React from 'react'

import commentImage from 'images/comment-picto.svg'
import optimizeImage from 'images/optimize-picto.svg'

import {EVAL_SCORES} from './score_levels'


interface PoolOverviewProps {
  onSelectUseCase: (useCase: bayes.bob.UseCase) => void
  useCases: readonly bayes.bob.UseCase[]
}


// TODO(marielaure) : Make new cells for important comments.
class PoolOverview extends React.PureComponent<PoolOverviewProps> {
  public static propTypes = {
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

  private handleSelectUseCase = _memoize(
    (useCase: bayes.bob.UseCase): (() => void) => (): void => this.props.onSelectUseCase(useCase),
    ({useCaseId}: bayes.bob.UseCase): string => useCaseId || '')

  private renderCommentCell(title: React.ReactNode): React.ReactNode {
    const scoreLevelCellStyle = {
      alignItems: 'center',
      display: 'flex',
      padding: '0 15px',
    }
    const imageStyle = {marginLeft: 15}
    return <th>
      <div style={scoreLevelCellStyle}>
        <div style={{flex: 1}}>{title}</div>
        <img src={commentImage} alt="" style={imageStyle} />
      </div>
    </th>
  }

  private renderHeader(): React.ReactNode {
    const containerStyle = {
      backgroundColor: colors.BOB_BLUE_HOVER,
      color: '#fff',
    }
    const cellStyle = {
      padding: '14px 15px 11px',
    }
    return <thead style={containerStyle}>
      <tr>
        <th style={cellStyle}>Métier</th>
        <th style={cellStyle}>Note</th>
        {this.renderCommentCell('Commentaire texte diagnostic')}
        {this.renderCommentCell('Commentaires généraux')}
      </tr>
    </thead>
  }

  private renderUseCase = (useCase: bayes.bob.UseCase, index: number): React.ReactNode => {
    const {evaluation, indexInPool, title, useCaseId} = useCase
    const containerStyle = {
      backgroundColor: index % 2 ? colors.LIGHT_GREY : '#fff',
      color: colors.DARK_TWO,
    }
    const cellStyle = {
      padding: 14,
    }
    const imageInTextStyle = {
      verticalAlign: 'middle',
      width: 15,
    }
    return <tr key={useCaseId} style={containerStyle}>
      <td onClick={this.handleSelectUseCase(useCase)} style={{...cellStyle, cursor: 'pointer'}}>
        {indexInPool || '0'} - {title}
      </td>
      <td style={cellStyle}>
        {EVAL_SCORES.
          filter(({score}): boolean => score === (evaluation && evaluation.score)).
          map(({image, score}): React.ReactNode => <img
            key={`${useCaseId}-eval-${score}`} src={image} alt={score}
            style={{height: 25, verticalAlign: 'middle'}} />)}
      </td>
      <td style={cellStyle}>
        {evaluation && evaluation.diagnostic && evaluation.diagnostic.text &&
          evaluation.diagnostic.text.comment || ''}
      </td>
      <td style={cellStyle}>
        {/* TODO(pascal): Consider truncating very long comments. */}
        {evaluation && evaluation.comments || ''}
        {Object.entries(evaluation && evaluation.advices || {}).
          filter(([unusedAdviceId, {comment, shouldBeOptimized}]): boolean =>
            !!(comment || shouldBeOptimized)).
          map(([adviceId, {comment, shouldBeOptimized}]): React.ReactNode =>
            <div key={`comment-${useCaseId}-${adviceId}`}>
              {adviceId}: {shouldBeOptimized && <span>
                <img src={optimizeImage} style={imageInTextStyle} alt="" /> à optimiser, </span>
              }
              {comment}
            </div>)}
      </td>
    </tr>
  }

  public render(): React.ReactNode {
    const {useCases} = this.props
    return <table style={{fontSize: 14, width: '100%'}}>
      {this.renderHeader()}
      <tbody>
        {useCases.map(this.renderUseCase)}
      </tbody>
    </table>
  }
}


export {PoolOverview}
