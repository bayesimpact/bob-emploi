import {TFunction} from 'i18next'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'

import {getDateString} from 'store/french'
import {prepareT} from 'store/i18n'

import {Trans} from 'components/i18n'
import {RadiumExternalLink} from 'components/radium'
import {GrowingNumber} from 'components/theme'
import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import Picto from 'images/advices/picto-events.svg'

import {MethodSuggestionList, CardProps, ToolCard, useAdviceData} from './base'


const EVENT_TOOLS = [
  {
    href: 'http://www.emploi-store.fr/portail/services/poleEmploiEvenements',
    imageSrc: poleEmploiEventsImage,
    title: prepareT('App Pôle emploi Évènements'),
  },
  {
    href: 'https://www.meetup.com/fr-FR/',
    imageSrc: meetupImage,
    title: 'Meetup',
  },
  {
    href: 'https://www.jobteaser.com/fr/events',
    imageSrc: jobteaserImage,
    title: 'Jobteaser',
  },
  {
    href: 'http://www.recrut.com/les_salons',
    imageSrc: recrutImage,
    title: 'Recrut',
  },
  {
    href: 'http://www.pole-emploi.fr/informations/en-region-@/region/?/evenements.html',
    imageSrc: poleEmploiImage,
    title: prepareT('Évènements régionaux'),
  },
] as const


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
EventsListBase.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
}
const EventsList = React.memo(EventsListBase)


const EventsMethod: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const {handleExplore, t, t: translate} = props
  const {events} = useAdviceData<bayes.bob.Events>(props)
  const hasEvents = !!(events && events.length)
  const eventBoxStyle = hasEvents && {marginTop: 20} || undefined

  const methodTitle = <Trans parent={null} t={t}>
    <GrowingNumber number={EVENT_TOOLS.length} isSteady={true} />
    {' '}outils pour trouver des évènements
  </Trans>
  return <div>
    {(hasEvents && events) ? <EventsList {...{events, handleExplore, t}} /> : null}
    <MethodSuggestionList title={methodTitle} style={eventBoxStyle}>
      {EVENT_TOOLS.map(({title, ...props}, index: number): ReactStylableElement =>
        <ToolCard {...props} key={index} onClick={handleExplore('tool')}>
          {translate(title)}
        </ToolCard>,
      )}
    </MethodSuggestionList>
  </div>
}
EventsMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
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
EventBase.propTypes = {
  filters: PropTypes.arrayOf(PropTypes.string.isRequired),
  link: PropTypes.string.isRequired,
  organiser: PropTypes.string.isRequired,
  startDate: PropTypes.string.isRequired,
  style: PropTypes.object,
  t: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
}
const Event = React.memo(EventBase)


export default {ExpandedAdviceCardContent, Picto}
