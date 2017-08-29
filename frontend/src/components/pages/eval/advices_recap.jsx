import Radium from 'radium'
import React from 'react'
import ReactHeight from 'react-height'
import PropTypes from 'prop-types'
import _ from 'underscore'

import rankOneImage from 'images/rank-one-picto.svg'
import rankThreeImage from 'images/rank-three-picto.svg'
import rankTwoImage from 'images/rank-two-picto.svg'
import rankZeroImage from 'images/rank-zero-picto.svg'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'

import {AdviceCard} from 'components/advisor'
import {Colors, LabeledToggle, Styles} from 'components/theme'


class AdvicesRecap extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    showAdviceCards: false,
  }

  render() {
    const {advices, moduleNewScores, onRescoreAdvice, profile, project, style} = this.props
    const {showAdviceCards} = this.state
    const containerStyle = {
      backgroundColor: '#fff',
      padding: 10,
      ...style,
    }
    const adviceGroups = _.groupBy(advices, 'numStars')
    const groupKeys = Object.keys(adviceGroups).sort().reverse()
    return <div style={containerStyle}>
      <LabeledToggle
        label="Afficher les cartes des conseils"
        type="checkbox" isSelected={showAdviceCards}
        onClick={() => this.setState({showAdviceCards: !showAdviceCards})} />
      <div>
        {groupKeys.map(numStars => (
          <AdvicesRecapSection
            key={`section-${numStars}-stars`} profile={profile}
            project={project} advices={adviceGroups[numStars]}
            onRescoreAdvice={onRescoreAdvice} moduleNewScores={moduleNewScores}
            numStars={numStars} showAdviceCards={showAdviceCards} />
        ))}
      </div>
    </div>
  }
}

const ADVICE_GROUP_PROPS = {
  '1': {
    title: 'À regarder',
  },
  '2': {
    image: twoStarsImage,
  },
  '3': {
    image: threeStarsImage,
  },
}


const RESCORE_BUTTONS = [
  {
    image: rankThreeImage,
    value: '3',
  },
  {
    image: rankTwoImage,
    value: '2',
  },
  {
    image: rankOneImage,
    value: '1',
  },
  {
    image: rankZeroImage,
    value: '0',
  },
]


class AdvicesRecapSection extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
    moduleNewScores: PropTypes.objectOf(PropTypes.number.isRequired).isRequired,
    numStars: PropTypes.oneOf(Object.keys(ADVICE_GROUP_PROPS)).isRequired,
    onRescoreAdvice: PropTypes.func.isRequired,
    profile: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    showAdviceCards: PropTypes.bool.isRequired,
  }

  handleAddAdvice = adviceId => {
    const {numStars, onRescoreAdvice} = this.props
    onRescoreAdvice(adviceId, numStars)
    if (this.extraAdviceInput) {
      this.extraAdviceInput.value = ''
    }
  }

  renderRescoreButtons = advice => {
    const {moduleNewScores, numStars, onRescoreAdvice} = this.props
    const newScore = moduleNewScores[advice.adviceId] + ''
    return RESCORE_BUTTONS.map(({image, value}) => {
      return <RescoreAdviceButton
        key={`rescore-${advice.adviceId}-${value}-stars`}
        isPreselected={value === numStars}
        isSelected={value === newScore}
        onClick={() => onRescoreAdvice(advice.adviceId, value)}>
        <img src={image} alt={`${numStars}*`} />
      </RescoreAdviceButton>
    })
  }

  renderAdvice = advice => {
    const {profile, project, showAdviceCards} = this.props
    return <div key={advice.adviceId}>
      <div style={{display: 'flex', fontSize: 15, padding: 5}}>
        <span style={{flex: 1}}>
          {advice.adviceId}
        </span>
        {this.renderRescoreButtons(advice)}
      </div>
      {showAdviceCards ? <ScaledAdvice
        scale={.5} advice={advice} profile={profile} project={project}
        style={{marginLeft: 60}} /> : null}
    </div>
  }

  renderExtraAdvices() {
    const {advices, moduleNewScores, numStars} = this.props
    const advicesShown = _.object(
      advices.map(({adviceId}) => adviceId), new Array(advices.length).fill(true))
    const rescoredAdvices = _.keys(moduleNewScores)
    const extraAdvices = rescoredAdvices.filter(
      adviceId => !advicesShown[adviceId] &&
      (moduleNewScores[adviceId] + '') === numStars)
    const extraAdviceStyle = {
      border: `solid 1px ${Colors.SKY_BLUE}`,
      margin: '5px 0',
      padding: 6,
    }
    // TODO(pascal): Add a way to remove an extra advice.
    return <div style={{display: 'flex', flexDirection: 'column'}}>
      {extraAdvices.map(adviceId => <div key={adviceId} style={extraAdviceStyle}>
        <div style={Styles.CENTER_FONT_VERTICALLY}>
          {adviceId}
        </div>
      </div>)}
      <input
        ref={dom => {
          this.extraAdviceInput = dom
        }} style={{fontSize: 14, marginTop: 10, padding: 8}}
        placeholder="+ Saisir un autre conseil à ajouter"
        onKeyPress={event => (event.key === 'Enter') && this.handleAddAdvice(event.target.value)} />
    </div>
  }

  render() {
    const {advices, numStars} = this.props
    const {image, title} = ADVICE_GROUP_PROPS[numStars]
    const headerStyle = {
      display: 'flex',
      justifyContent: 'center',
      'padding': '15px 0px',
    }
    return <div>
      <div style={headerStyle}>
        {image
          ? <img src={image} style={{height: 63, width: 63}} />
          : <span style={{fontSize: 36, fontWeight: 'bold'}}>{title}</span>
        }
      </div>
      {advices.map(this.renderAdvice)}
      {this.renderExtraAdvices()}
    </div>
  }
}


class RescoreAdviceButtonBase extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    isPreselected: PropTypes.bool,
    isSelected: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
  }

  render() {
    const {children ,isPreselected, isSelected, onClick} = this.props
    const containerStyle = {
      ':hover': {
        filter: 'initial',
        opacity: 1,
      },
      cursor: 'pointer',
      filter: isSelected ? 'initial': 'grayscale(100%)',
      opacity: (isPreselected && !isSelected) ? .5 : 1,
      padding: 5,
    }
    return <span onClick={onClick} style={containerStyle}>
      {children}
    </span>
  }
}
const RescoreAdviceButton = Radium(RescoreAdviceButtonBase)


class ScaledAdvice extends React.Component {
  static propTypes = {
    scale: PropTypes.number.isRequired,
    style: PropTypes.object,
  }

  state = {
    height: '',
  }

  render() {
    const {scale, style, ...extraProps} = this.props
    const adviceCardStyle = {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }
    const height = this.state.height
    const wrapperStyle = {
      height: height ? height * scale : 'initial',
      overflow: 'hidden',
      position: 'relative',
      ...style,
    }
    return <div style={wrapperStyle}>
      <ReactHeight
        style={{width: (100 / scale) + '%'}}
        onHeightReady={height => this.setState({height})}>
        <AdviceCard {...extraProps} style={adviceCardStyle} />
      </ReactHeight>
    </div>
  }
}


export {AdvicesRecap}
