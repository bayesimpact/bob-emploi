import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {lowerFirstLetter, ofPrefix} from 'store/french'

import {Colors, GrowingNumber, PaddedOnMobile, StringJoiner, Styles} from 'components/theme'
import laBonneFormationImage from 'images/labonneformation-picto.png'
import Picto from 'images/advices/picto-training.png'

import {AdviceSuggestionList, ToolCard} from './base'

const valueToColor = {
  // 0 is unknown
  0: 'initial',
  1: Colors.RED_PINK,
  2: Colors.BUTTERSCOTCH,
  3: Colors.BOB_BLUE,
  4: Colors.GREENISH_TEAL,
  5: Colors.GREENISH_TEAL,
}

const valueToText = {
  // 0 is unknown
  0: 'Inconnu',
  1: 'Faible',
  2: 'Correct',
  3: 'Satisfaisant',
  4: 'Bon',
  5: 'Excellent',
}

class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      trainingData: PropTypes.shape({
        trainings: PropTypes.arrayOf(PropTypes.shape({
          name: PropTypes.string,
        }).isRequired),
      }),
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice: {trainingData: {trainings = []} = {}}, fontSize, project} = this.props
    const {modifiedName: cityName, prefix} = ofPrefix(project.mobility.city.name)

    if (!trainings.length) {
      return <div style={{fontSize: fontSize}}>
        Des formations près {prefix}<strong>{cityName}</strong> ont un fort taux de retour à
        l'emploi.
      </div>
    }

    const trainingNames = trainings.map(training => training.name)
    const uniqueTrainingNames = trainingNames.sort().filter(
      function(item, pos, array) {
        return !pos || item !== array[pos - 1]
      })

    return <div style={{fontSize: fontSize}}>
      Des formations près {prefix}<strong>{cityName}</strong> comme{' '}
      <StringJoiner>
        {uniqueTrainingNames.slice(0, 2).map((name, index) => <strong key={`company-${index}`}>
          {name}
        </strong>)}
      </StringJoiner>
      {' '}ont un fort taux de retour à l'emploi.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      trainingData: PropTypes.shape({
        trainings: PropTypes.arrayOf(PropTypes.shape({
          cityName: PropTypes.string,
          hiringPotential: PropTypes.number,
          name: PropTypes.string,
          url: PropTypes.string,
        }).isRequired),
      }),
    }).isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  createLBFLink() {
    const {project} = this.props
    const domain = lowerFirstLetter(project.targetJob.jobGroup.name)
    return `https://labonneformation.pole-emploi.fr/formations/${domain}/france`
  }

  render() {
    const {advice: {trainingData: {trainings = []} = {}}, project, userYou} = this.props
    const toolCardStyle = {
      maxWidth: 950,
    }

    if (!trainings.length) {
      return null
    }
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <GrowingNumber style={{fontWeight: 'bold'}} number={trainings.length}
          isSteady={true} /> formation{trainings.length > 0 ? 's' : ''} autour
          de {userYou('toi', 'vous')}&nbsp;:
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {trainings.map((training, index) => <TrainingSuggestion
          training={training} key={`city-${index}`} />)}
      </AdviceSuggestionList>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15, marginTop: 30}}>
        Nous aimons beaucoup ce site pour trouver d'autres formations
        en <strong>{lowerFirstLetter(project.targetJob.jobGroup.name)}&nbsp;</strong>:
      </PaddedOnMobile>
      <div style={toolCardStyle}>
        <ToolCard imageSrc={laBonneFormationImage} href={this.createLBFLink()}>
          La Bonne Formation
          <div style={{fontSize: 13, fontWeight: 'normal'}}>
            pour trouver des formations qui ont un fort potentiel d'embauche en sortie.
          </div>
        </ToolCard>
      </div>
    </div>
  }
}

class TrainingSuggestionBase extends React.Component {
  static propTypes = {
    style: PropTypes.string,
    training: PropTypes.shape({
      cityName: PropTypes.string,
      hiringPotential: PropTypes.number,
      name: PropTypes.string,
      url: PropTypes.string,
    }).isRequired,
  }

  handleClick = () => {
    const {url} = this.props.training
    window.open(url, '_blank')
  }

  renderBoxes(score) {
    if (!score) {
      return null
    }

    const boxStyle = {
      display: 'inline-block',
      height: 10,
      marginRight: 1,
      width: 20,
    }
    const containerStyle = {
      display: 'flex',
      flexDirection: 'column',
      marginLeft: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }

    const selectedColor = valueToColor[score]
    const defaultColor = Colors.MODAL_PROJECT_GREY
    // There might be a more elegant way to do that, but it would be overkill and less readable.
    return <div style={containerStyle}>
      <div style={{color: valueToColor[score], textAlign: 'center'}}>
        {valueToText[score]}
      </div>
      <div style={{width: 105}}>
        <div style={{...boxStyle, backgroundColor: selectedColor, borderRadius: '20px 0 0 20px'}} />
        <div style={{...boxStyle, backgroundColor: score > 1 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 2 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 3 ? selectedColor : defaultColor}} />
        <div style={{...boxStyle, backgroundColor: score > 4 ? selectedColor : defaultColor,
          borderRadius: '0 20px 20px 0'}} />
      </div>
    </div>
  }

  render() {
    const {training: {cityName, name, hiringPotential}, style} = this.props
    const containerStyle = {
      ...style,
      fontWeight: 'normal',
    }
    const trainingStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const chevronStyle = {
      fill: Colors.CHARCOAL_GREY,
      flexShrink: 0,
      height: 20,
      lineHeight: 1,
      padding: '0 0 0 10px',
      width: 30,
    }
    return <div style={containerStyle} onClick={this.handleClick} key="training">
      <span style={trainingStyle}>
        <strong>{name}</strong> - {cityName}
      </span>
      <div style={{flex: 1}} />
      {this.renderBoxes(hiringPotential)}
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const TrainingSuggestion = Radium(TrainingSuggestionBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
