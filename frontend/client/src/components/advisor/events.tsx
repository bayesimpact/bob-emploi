import type {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useMemo} from 'react'

import {getDateString} from 'store/french'
import type {LocalizableString} from 'store/i18n'
import {prepareT, prepareT as prepareTNoExtract} from 'store/i18n'

import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumExternalLink} from 'components/radium'
import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import nationalCareerFairsImage from 'images/national-career-fairs-logo.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import Picto from 'images/advices/picto-events.svg'

import type {CardProps} from './base'
import {MethodSuggestionList, ToolCard, useAdviceData} from './base'


interface Tool {
  countryId: string
  href: string
  imageSrc: string
  title: LocalizableString
}


const EVENT_TOOLS: readonly Tool[] = ([
  {
    countryId: 'fr',
    href: 'http://www.emploi-store.fr/portail/services/poleEmploiEvenements', // checkURL
    imageSrc: poleEmploiEventsImage,
    title: prepareT('App Pôle emploi Évènements'),
  },
  {
    countryId: 'fr',
    href: 'https://www.meetup.com/fr-FR/', // checkURL
    imageSrc: meetupImage,
    title: prepareTNoExtract('Meetup'),
  },
  {
    countryId: 'fr',
    href: 'https://www.jobteaser.com/fr/events', // checkURL
    imageSrc: jobteaserImage,
    title: prepareTNoExtract('Jobteaser'),
  },
  {
    countryId: 'fr',
    href: 'http://www.recrut.com/les_salons', // checkURL
    imageSrc: recrutImage,
    title: prepareTNoExtract('Recrut'),
  },
  {
    countryId: 'fr',
    href: 'http://www.pole-emploi.fr/informations/en-region-@/region/?/evenements.html', // checkURL
    imageSrc: poleEmploiImage,
    title: prepareT('Évènements régionaux'),
  },
  {
    countryId: 'usa',
    href: 'https://www.nationalcareerfairs.com/', // checkURL
    imageSrc: nationalCareerFairsImage,
    title: prepareTNoExtract('National Career Fairs'),
  },
  {
    countryId: 'usa',
    href: 'https://www.meetup.com/en-US/', // checkURL
    imageSrc: meetupImage,
    title: prepareTNoExtract('Meetup'),
  },
  {
    countryId: 'uk',
    href: 'https://www.meetup.com/en/', // checkURL
    imageSrc: meetupImage,
    title: prepareTNoExtract('Meetup'),
  },
] as const).filter(({countryId}) => countryId === config.countryId)


const NETWORKING_INTROS: readonly LocalizableString[] = [
  prepareT("Savez-vous ce qui est prévu pour la suite de l'événement\u00A0?"),
  prepareT("Connaissez-vous l'organisateur depuis longtemps\u00A0?"),
  prepareT("Que pensez-vous de l'organisation\u00A0?"),
  prepareT("Qu'est-ce que cette conférence vous inspire pour votre activité\u00A0?"),
  prepareT("Comment avez-vous trouvé l'intervenante\u00A0?"),
  prepareT("Qu'avez-vous pensé des thèmes abordés\u00A0?"),
  prepareT('Comment avez-vous entendu parler de cet événement\u00A0?'),
  prepareT("Qu'est-ce qui vous a fait venir\u00A0?"),
  prepareT("Participez-vous souvent à ce genre d'événement\u00A0?"),
]


interface EventsListProps {
  events: readonly bayes.bob.Event[]
  handleExplore: (visualElement: string) => () => void
  t: TFunction
}
const EventsListBase: React.FC<EventsListProps> =
  (props: EventsListProps): React.ReactElement => {
    const {events, handleExplore, t} = props
    const title = <Trans parent={null} t={t} count={events.length}>
      <GrowingNumber number={events.length} isSteady={true} />
      {' '}évènement pourrait vous intéresser
    </Trans>
    return <MethodSuggestionList title={title}>
      {events.map((event: bayes.bob.Event): ReactStylableElement => <Event
        {...event} key={event.link} onClick={handleExplore('event')} t={t} />)}
    </MethodSuggestionList>
  }
const EventsList = React.memo(EventsListBase)


const EventsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, t, t: translate} = props
  const {data: {events}, loading} = useAdviceData<bayes.bob.Events>(props)
  const hasEvents = !!(events && events.length)
  const eventBoxStyle = hasEvents && {marginTop: 20} || undefined

  const methodTitle = <Trans parent={null} t={t}>
    <GrowingNumber number={EVENT_TOOLS.length} isSteady={true} />
    {' '}outils pour trouver des évènements
  </Trans>
  if (loading) {
    return loading
  }
  return <div>
    {(hasEvents && events) ? <EventsList {...{events, handleExplore, t}} /> : null}
    <MethodSuggestionList title={<Trans t={t}>
      <GrowingNumber number={NETWORKING_INTROS.length} /> questions pour lancer la conversation
    </Trans>} isNotClickable={true} style={eventBoxStyle}>
      {NETWORKING_INTROS.map((intro, index) => <div key={index}>{translate(...intro)}</div>)}
    </MethodSuggestionList>
    <MethodSuggestionList title={methodTitle} style={{marginTop: 20}}>
      {EVENT_TOOLS.map(({title, ...props}, index: number): ReactStylableElement =>
        <ToolCard {...props} key={index} onClick={handleExplore('tool')}>
          {translate(...title)}
        </ToolCard>,
      )}
    </MethodSuggestionList>
  </div>
}
const ExpandedAdviceCardContent = React.memo(EventsMethod)


interface EventProps extends bayes.bob.Event {
  onClick?: () => void
  style?: RadiumCSSProperties
  t: TFunction
}

const chevronStyle = {
  fill: colors.CHARCOAL_GREY,
  flexShrink: 0,
  fontSize: 20,
  height: 20,
  marginLeft: '1em',
  width: 20,
}
const EventBase: React.FC<EventProps> = (props: EventProps): React.ReactElement => {
  const {filters: omittedFilters, link, organiser, startDate, style, t, title,
    ...extraProps} = props
  const linkStyle = useMemo(() => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  return <RadiumExternalLink style={linkStyle} href={link} {...extraProps}>
    <strong>
      {title}
    </strong>
    <span style={{fontWeight: 'normal', marginLeft: '1em'}}>
      {t('par {{organiser}}', {organiser})}
    </span>
    <span style={{flex: 1}} />
    <span>{startDate && getDateString(startDate, t)}</span>
    <ChevronRightIcon style={chevronStyle} />
  </RadiumExternalLink>
}
const Event = React.memo(EventBase)


export default {ExpandedAdviceCardContent, Picto}
