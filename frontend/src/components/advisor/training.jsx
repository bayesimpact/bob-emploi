import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {lowerFirstLetter, ofCityPrefix} from 'store/french'

import laBonneFormationImage from 'images/labonneformation-picto.png'
import {AppearingList, Colors, PaddedOnMobile, StringJoiner,
  Styles} from 'components/theme'

import {ToolCard} from './base'

const valueToColor = {
  // 0 is unknown
  0: 'initial',
  1: Colors.RED_PINK,
  2: Colors.BUTTERSCOTCH,
  3: Colors.SKY_BLUE,
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
    project: PropTypes.object.isRequired,
  }

  render() {
    const {project} = this.props
    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)
    const trainingNames = ['Connaissance et maîtrise du cheveu afro/métissé',
      'Coiffure pour le spectacle', 'Coiffeur artistique - Hair Designer']
    return <div style={{fontSize: 30}}>
      Des formations près {prefix}<strong>{cityName}</strong> comme{' '}
      <StringJoiner>
        {trainingNames.map((name, index) => <strong key={`company-${index}`}>
          {name}
        </strong>)}
      </StringJoiner>
      {' '}ont un fort taux de retour à l'emploi.
    </div>
  }
}


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    project: PropTypes.object.isRequired,
  }

  createLBFLink() {
    const {project} = this.props
    const domain = lowerFirstLetter(project.targetJob.jobGroup.name)
    return `https://labonneformation.pole-emploi.fr/formations/${domain}`
  }

  render() {
    const {project} = this.props
    const toolCardStyle = {
      maxWidth: 950,
    }

    // TODO(guillaume): Fill values from server.
    const trainings = [
      {
        cityName: 'Lyon',
        departmentName: 'Rhône',
        hiringPotential: 5,
        trainingName: 'Connaissance et maîtrise du cheveu afro/métissé',
        url: 'http://www.google.com',
      },
      {
        cityName: 'St Etienne',
        departmentName: 'Loire',
        hiringPotential: 3,
        trainingName: 'Coiffure pour le spectacle',
        url: 'http://www.google.com',
      },
      {
        cityName: 'Marseille',
        departmentName: 'Bouches du Rhône',
        hiringPotential: 2,
        trainingName: 'Coiffeur artistique - Hair Designer',
        url: 'http://www.google.com',
      },
      {
        cityName: 'Marseille',
        departmentName: 'Bouches du Rhône',
        hiringPotential: 1,
        trainingName: 'CAP Coiffure',
        url: 'http://www.google.com',
      },
    ]

    const {cityName, prefix} = ofCityPrefix(project.mobility.city.name)
    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        <strong>Potentiel d'embauche</strong> des formations autour de vous&nbsp;:
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {trainings.map((training, index) => <TrainingSuggestion
          training={training} key={`city-${index}`} style={{marginTop: index ? -1 : 0}} />)}
      </AppearingList>
      <PaddedOnMobile style={{fontSize: 21, marginBottom: 15, marginTop: 30}}>
        Trouver d'autres formations
        en {lowerFirstLetter(project.targetJob.jobGroup.name)} près {prefix}
        <strong>{cityName}</strong>&nbsp;:
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
    training: PropTypes.object.isRequired,
  }

  handleClick = () => {
    const {url} = this.props.training
    window.open(url, '_blank')
  }

  renderBoxes(score) {
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
    const {training, style} = this.props
    const {cityName, trainingName, hiringPotential} = training
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 20px',
      ...style,
    }
    const trainingNameStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={containerStyle} onClick={this.handleClick}>
      <span style={trainingNameStyle}>
        <strong>{trainingName}</strong> - {cityName}
      </span>
      <div style={{flex: 1}} />
      {this.renderBoxes(hiringPotential)}
    </div>
  }
}
const TrainingSuggestion = Radium(TrainingSuggestionBase)


export default {AdviceCard, ExpandedAdviceCardContent}
