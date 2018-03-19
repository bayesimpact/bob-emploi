import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {Colors, Styles} from 'components/theme'
import cinemaIcon from 'images/hobbies/cinema.svg'
import cookIcon from 'images/hobbies/cook.svg'
import fitnessIcon from 'images/hobbies/fitness.svg'
import runIcon from 'images/hobbies/run.svg'
import searchIcon from 'images/hobbies/search.svg'
import swimIcon from 'images/hobbies/swim.svg'
import Picto from 'images/advices/picto-life-balance.png'

import {AdviceSuggestionList} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  render() {
    const {fontSize, userYou} = this.props
    return <div style={{fontSize: fontSize}}>
      {userYou('Fais', 'Faites')} du sport ou
      {userYou(' va', ' allez')} au cinéma…
      Ça {userYou('te', 'vous')} booste le moral et ça ajoute du peps dans
      {userYou(' ton', ' votre')} CV.
    </div>
  }
}


const hobbies = [
  {
    icon: fitnessIcon,
    keywords: 'salle sport',
    title: 'Aller dans une salle de sport',
  },
  {
    icon: cookIcon,
    keywords: 'cours cuisine',
    title: 'Faire des cours de cuisine entre amis',
  },
  {
    icon: swimIcon,
    keywords: 'piscine',
    title: 'Aller à la piscine',
  },
  {
    icon: cinemaIcon,
    keywords: 'cinéma',
    title: 'Se détendre devant un film au cinéma',
  },
  {
    icon: runIcon,
    keywords: 'randonnée',
    title: 'Marcher / courir',
  },
  {
    icon: searchIcon,
    title: "Trouver d'autres activités…",
    url: '/api/redirect/eterritoire/%cityId',
  },
]


class ExpandedAdviceCardContent extends React.Component {
  static propTypes = {
    project: PropTypes.shape({
      mobility: PropTypes.shape({
        city: PropTypes.object.isRequired,
      }).isRequired,
    }).isRequired,
  }

  render() {
    const {city} = this.props.project.mobility
    return <AdviceSuggestionList>
      {hobbies.map((hobby, index) => <Hobby {...hobby} key={`hobby-${index}`} city={city} />)}
    </AdviceSuggestionList>
  }
}


class HobbyBase extends React.Component {
  static propTypes = {
    city: PropTypes.object.isRequired,
    icon: PropTypes.string,
    keywords: PropTypes.string,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
    url: PropTypes.string,
  }

  handleClick = () => {
    const {city, keywords, url} = this.props
    const finalUrl = url && url.replace('%cityId', city.cityId) ||
      `https://www.google.fr/search?q=${encodeURIComponent(keywords + ' ' + city.name)}`
    window.open(finalUrl, '_blank')
  }

  render() {
    const {icon, style, title} = this.props
    const containerStyle = {
      ...style,
      fontWeight: 'bold',
      paddingLeft: 12,
    }
    return <div style={containerStyle} onClick={this.handleClick}>
      {icon ? <img src={icon} style={{marginRight: 12}} alt="" /> : null}
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {title}
      </span>
      <span style={{flex: 1}} />
      <ChevronRightIcon style={{fill: Colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </div>
  }
}
const Hobby = Radium(HobbyBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
