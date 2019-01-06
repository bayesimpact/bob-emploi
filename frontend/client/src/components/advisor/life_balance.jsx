import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import cinemaIcon from 'images/hobbies/cinema.svg'
import cookIcon from 'images/hobbies/cook.svg'
import fitnessIcon from 'images/hobbies/fitness.svg'
import runIcon from 'images/hobbies/run.svg'
import searchIcon from 'images/hobbies/search.svg'
import swimIcon from 'images/hobbies/swim.svg'
import Picto from 'images/advices/picto-life-balance.png'

import {AdviceSuggestionList} from './base'


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
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.shape({
      city: PropTypes.object.isRequired,
    }).isRequired,
  }

  render() {
    const {onExplore, project: {city}} = this.props
    return <AdviceSuggestionList>
      {hobbies.map((hobby, index) => <Hobby
        {...hobby} key={`hobby-${index}`} city={city}
        onClick={() => onExplore('hobby')} />)}
    </AdviceSuggestionList>
  }
}


class HobbyBase extends React.Component {
  static propTypes = {
    city: PropTypes.shape({
      cityId: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
    icon: PropTypes.string,
    keywords: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
    title: PropTypes.node.isRequired,
    url: PropTypes.string,
  }

  handleClick = () => {
    const {city: {cityId = '', name = ''} = {}, keywords, onClick, url} = this.props
    const finalUrl = url && url.replace('%cityId', cityId) ||
      `https://www.google.fr/search?q=${encodeURIComponent(keywords + ' ' + name)}`
    window.open(finalUrl, '_blank')
    onClick && onClick()
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
      <span>
        {title}
      </span>
      <span style={{flex: 1}} />
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </div>
  }
}
const Hobby = Radium(HobbyBase)


export default {ExpandedAdviceCardContent, Picto}
