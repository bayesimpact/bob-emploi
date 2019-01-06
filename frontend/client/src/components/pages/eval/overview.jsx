import PropTypes from 'prop-types'
import React from 'react'

import commentImage from 'images/comment-picto.svg'
import optimizeImage from 'images/optimize-picto.svg'

import {EVAL_SCORES} from './score_levels'


// TODO(marielaure) : Make new cells for important comments.
class PoolOverview extends React.Component {
  static propTypes = {
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

  renderCommentCell(title) {
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

  renderHeader() {
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

  renderUseCase = (useCase, index) => {
    const {onSelectUseCase} = this.props
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
      <td onClick={() => onSelectUseCase(useCase)} style={{...cellStyle, cursor: 'pointer'}}>
        {indexInPool || '0'} - {title}
      </td>
      <td style={cellStyle}>
        {EVAL_SCORES.
          filter(({score}) => score === (evaluation && evaluation.score)).
          map(({image, score}) => <img
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
        {Object.keys(evaluation && evaluation.advices || {}).
          filter(adviceId =>
            evaluation.advices[adviceId].comment || evaluation.advices[adviceId].shouldBeOptimized
          ).
          map(adviceId => <div key={`comment-${useCaseId}-${adviceId}`}>
            {adviceId}: {evaluation.advices[adviceId].shouldBeOptimized && <span>
              <img src={optimizeImage} style={imageInTextStyle} alt="" /> à optimiser, </span>
            }
            {evaluation.advices[adviceId].comment}
          </div>)}
      </td>
    </tr>
  }

  render() {
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
