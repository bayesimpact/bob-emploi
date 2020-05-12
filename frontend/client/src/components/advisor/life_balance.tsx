import {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import {prepareT} from 'store/i18n'

import cinemaIcon from 'images/hobbies/cinema.svg'
import cookIcon from 'images/hobbies/cook.svg'
import fitnessIcon from 'images/hobbies/fitness.svg'
import runIcon from 'images/hobbies/run.svg'
import searchIcon from 'images/hobbies/search.svg'
import swimIcon from 'images/hobbies/swim.svg'
import Picto from 'images/advices/picto-life-balance.svg'

import {RadiumDiv} from 'components/radium'

import {CardProps, MethodSuggestionList} from './base'


const hobbies = [
  {
    icon: fitnessIcon,
    keywords: 'salle sport',
    title: prepareT('Aller dans une salle de sport'),
  },
  {
    icon: cookIcon,
    keywords: 'cours cuisine',
    title: prepareT('Faire des cours de cuisine entre amis'),
  },
  {
    icon: swimIcon,
    keywords: 'piscine',
    title: prepareT('Aller à la piscine'),
  },
  {
    icon: cinemaIcon,
    keywords: 'cinéma',
    title: prepareT('Se détendre devant un film au cinéma'),
  },
  {
    icon: runIcon,
    keywords: 'randonnée',
    title: prepareT('Marcher / courir'),
  },
  {
    icon: searchIcon,
    title: prepareT("Trouver d'autres activités…"),
    url: '/api/redirect/eterritoire/%cityId',
  },
] as const


const LifeBalanceMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, project: {city}, t: translate} = props
  const handleClick = useMemo(() => handleExplore('hobby'), [handleExplore])
  return <MethodSuggestionList>
    {hobbies.map((hobby, index): ReactStylableElement => <Hobby
      {...hobby} key={`hobby-${index}`} city={city}
      onClick={handleClick} t={translate} />)}
  </MethodSuggestionList>
}
LifeBalanceMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.shape({
    city: PropTypes.object.isRequired,
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(LifeBalanceMethod)

interface HobbyProps {
  city?: bayes.bob.FrenchCity
  icon: string
  keywords?: string
  onClick: () => void
  style?: React.CSSProperties
  title: string
  t: TFunction
  url?: string
}

const handleClick = (
  cityId: string, cityName: string, keywords: string|undefined,
  onClick: () => void, url: string|undefined): void => {
  const finalUrl = url && url.replace('%cityId', cityId) ||
    `https://www.google.fr/search?q=${encodeURIComponent(keywords + ' ' + name)}`
  window.open(finalUrl, '_blank')
  onClick && onClick()
}
const imageStyle: React.CSSProperties = {
  marginRight: 12,
}
const separatorStyle: React.CSSProperties = {
  flex: 1,
}
const chevronStyle: React.CSSProperties = {
  fill: colors.CHARCOAL_GREY,
  height: 20,
  width: 20,
}
const HobbyBase: React.FC<HobbyProps> = (props: HobbyProps): React.ReactElement => {
  const {city: {cityId = '', name = ''} = {}, icon, keywords, onClick, url,
    style, title = '', t: translate} = props
  const handleHobbyClick = useCallback((): void => {
    handleClick(cityId, name, keywords, onClick, url)
  }, [cityId, name, keywords, onClick, url])
  const containerStyle: React.CSSProperties = useMemo(() => ({
    ...style,
    fontWeight: 'bold',
    paddingLeft: 12,
  }), [style])
  return <RadiumDiv style={containerStyle} onClick={handleHobbyClick}>
    {icon ? <img src={icon} style={imageStyle} alt="" /> : null}
    <span>
      {translate(title)}
    </span>
    <span style={separatorStyle} />
    <ChevronRightIcon style={chevronStyle} />
  </RadiumDiv>
}
HobbyBase.propTypes = {
  city: PropTypes.shape({
    cityId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  }),
  icon: PropTypes.string,
  keywords: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
  title: PropTypes.node.isRequired,
  url: PropTypes.string,
}
const Hobby = React.memo(HobbyBase)


export default {ExpandedAdviceCardContent, Picto}
