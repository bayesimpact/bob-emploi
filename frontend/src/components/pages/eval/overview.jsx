import PropTypes from 'prop-types'
import React from 'react'

import commentImage from 'images/comment-picto.svg'
import optimizeImage from 'images/optimize-picto.svg'

import {Colors, Styles, Tag} from 'components/theme'

import {ADVICE_SCORES, EVAL_SCORES} from './score_levels'


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

  renderHeader() {
    const containerStyle = {
      backgroundColor: Colors.BOB_BLUE_HOVER,
      color: '#fff',
    }
    const cellStyle = {
      padding: '14px 15px 11px',
    }
    const scoreLevelCellStyle = {
      alignItems: 'center',
      display: 'flex',
      padding: '0 15px',
    }
    const imageStyle = {marginLeft: 15}
    const headersWithImage = ADVICE_SCORES.concat([{
      image: commentImage,
      title: 'Commentaires',
      value: 'comments',
    }])
    return <thead style={containerStyle}>
      <tr>
        <th style={cellStyle}>Métier</th>
        <th style={cellStyle}>Note</th>
        {headersWithImage.map(({image, title, value}) => <th
          key={`title-advice-${value}`}>
          <div style={scoreLevelCellStyle}>
            <div style={{...Styles.CENTER_FONT_VERTICALLY, flex: 1}}>
              {title}
            </div>
            <img src={image} alt="" style={imageStyle} />
          </div>
        </th>)}
      </tr>
    </thead>
  }

  renderUseCase = (useCase, index) => {
    const {onSelectUseCase} = this.props
    const {evaluation, indexInPool, title, useCaseId} = useCase
    const containerStyle = {
      backgroundColor: index % 2 ? Colors.LIGHT_GREY : '#fff',
      color: Colors.DARK_TWO,
    }
    const cellStyle = {
      padding: 14,
    }
    const adviceTagStyle = tagColor => ({
      backgroundColor: tagColor || Colors.SILVER,
      borderRadius: 4,
      color: Colors.DARK_TWO,
      fontSize: 'inherit',
      fontWeight: 'initial',
      margin: 4,
      textTransform: 'initial',
    })
    const imageInTextStyle = {
      verticalAlign: 'middle',
      width: 15,
    }
    return <tr key={useCaseId} style={containerStyle}>
      <td onClick={() => onSelectUseCase(useCase)} style={{...cellStyle, cursor: 'pointer'}}>
        <div style={Styles.CENTER_FONT_VERTICALLY}>
          {indexInPool || '0'} - {title}
        </div>
      </td>
      <td style={cellStyle}>
        {EVAL_SCORES.
          filter(({score}) => score === (evaluation && evaluation.score)).
          map(({image, score}) => <img
            key={`${useCaseId}-eval-${score}`} src={image} alt={score}
            style={{height: 25, verticalAlign: 'middle'}} />)}
      </td>
      {ADVICE_SCORES.map(({tagColor, value}) =>
        <td style={{padding: 10}} key={`${useCaseId}-${value}`}>
          {Object.keys(evaluation && evaluation.modules || {}).
            filter(adviceId => (evaluation.modules[adviceId] || 0) + '' === value).
            map(adviceId =>
              <Tag key={`${useCaseId}-${adviceId}`} style={adviceTagStyle(tagColor)}>
                {adviceId}
              </Tag>
            )}
        </td>)}
      <td style={cellStyle}>
        {/* TODO(pascal): Consider truncating very long comments. */}
        <div style={Styles.CENTER_FONT_VERTICALLY}>
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
        </div>
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
