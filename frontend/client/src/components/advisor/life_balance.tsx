import type {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'

import useMedia from 'hooks/media'
import type {LocalizableString} from 'store/i18n'
import {prepareT} from 'store/i18n'

import cinemaIcon from 'images/hobbies/cinema.svg'
import cookIcon from 'images/hobbies/cook.svg'
import fitnessIcon from 'images/hobbies/fitness.svg'
import runIcon from 'images/hobbies/run.svg'
import searchIcon from 'images/hobbies/search.svg'
import swimIcon from 'images/hobbies/swim.svg'
import Picto from 'images/advices/picto-life-balance.svg'

import {RadiumExternalLink} from 'components/radium'

import type {CardProps} from './base'
import {MethodSuggestionList} from './base'


const hobbies = [
  {
    icon: fitnessIcon,
    keywords: prepareT('salle sport'),
    title: prepareT('Aller dans une salle de sport'),
  },
  {
    icon: cookIcon,
    keywords: prepareT('cours cuisine'),
    title: prepareT('Faire des cours de cuisine entre amis'),
  },
  {
    icon: swimIcon,
    keywords: prepareT('piscine'),
    title: prepareT('Aller à la piscine'),
  },
  {
    icon: cinemaIcon,
    keywords: prepareT('cinéma'),
    title: prepareT('Se détendre devant un film au cinéma'),
  },
  {
    icon: runIcon,
    keywords: prepareT('randonnée'),
    title: prepareT('Marcher / courir'),
  },
  ...config.findOtherActivitiesUrl ? [{
    icon: searchIcon,
    title: prepareT("Trouver d'autres activités…"),
    url: config.findOtherActivitiesUrl,
  }] : [],
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
const ExpandedAdviceCardContent = React.memo(LifeBalanceMethod)

interface HobbyProps {
  city?: bayes.bob.FrenchCity
  icon: string
  keywords?: LocalizableString
  onClick: () => void
  style?: React.CSSProperties
  title: LocalizableString
  t: TFunction
  url?: string
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
    style, title, t: translate} = props
  const media = useMedia()
  const href = url && url.replace('%cityId', cityId) ||
    `https://${config.googleTopLevelDomain}/search?q=${encodeURIComponent(keywords + ' ' + name)}`
  const containerStyle: RadiumCSSProperties = useMemo(() => ({
    ...style,
    color: 'inherit',
    fontWeight: 'bold',
    paddingLeft: 12,
    textDecoration: 'none',
  }), [style])
  return <RadiumExternalLink href={href} style={containerStyle} onClick={onClick}>
    {icon ? <img src={icon} style={imageStyle} alt="" /> : null}
    <span>
      {translate(...title)}
    </span>
    <span style={separatorStyle} />
    {media === 'print' ? null : <ChevronRightIcon
      style={chevronStyle} aria-hidden={true} focusable={false} />}
  </RadiumExternalLink>
}
const Hobby = React.memo(HobbyBase)


export default {ExpandedAdviceCardContent, Picto}
