import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React from 'react'

import {RadiumExternalLink} from 'components/radium'
import {GrowingNumber} from 'components/theme'
import {getDateString, YouChooser} from 'store/french'

import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import Picto from 'images/advices/picto-events.svg'

import {MethodSuggestionList, CardProps, CardWithContentProps, ToolCard,
  connectExpandedCardWithContent} from './base'


const EVENT_TOOLS = [
  {
    href: 'http://www.emploi-store.fr/portail/services/poleEmploiEvenements',
    imageSrc: poleEmploiEventsImage,
    title: 'App Pôle emploi Évènements',
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
    title: 'Évènements régionaux',
  },
]

interface EventsListProps {
  events: readonly bayes.bob.Event[]
  handleExplore: (visualElement: string) => () => void
  userYou: YouChooser
}
const EventsListBase: React.FC<EventsListProps> =
  (props: EventsListProps): React.ReactElement => {
    const {events, handleExplore, userYou} = props
    const title = <React.Fragment>
      <GrowingNumber number={events.length} isSteady={true} />
      {' '}évènement{events.length > 1 ? 's ' : ' '}
      pourrai{events.length > 1 ? 'ent ' : 't '}
      {userYou("t'intéresser :", 'vous intéresser :')}
    </React.Fragment>
    return <MethodSuggestionList title={title}>
      {events.map((event: bayes.bob.Event): ReactStylableElement => <Event
        {...event} key={event.link} onClick={handleExplore('event')} />)}
    </MethodSuggestionList>
  }
EventsListBase.propTypes = {
  events: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
  handleExplore: PropTypes.func.isRequired,
  userYou: PropTypes.func.isRequired,
}
const EventsList = React.memo(EventsListBase)

const methodTitle = <React.Fragment>
  <GrowingNumber number={EVENT_TOOLS.length} isSteady={true} />
  {' '}outils pour trouver des évènements
</React.Fragment>

const ExpandedAdviceCardContentBase: React.FC<CardWithContentProps<bayes.bob.Events>> =
  (props: CardWithContentProps<bayes.bob.Events>): React.ReactElement => {
    const {adviceData: {events}, handleExplore, userYou} = props
    const hasEvents = !!(events && events.length)
    const eventBoxStyle = hasEvents && {marginTop: 20} || undefined
    return <div>
      {(hasEvents && events) ? <EventsList {...{events, handleExplore, userYou}} /> : null}
      <MethodSuggestionList title={methodTitle} style={eventBoxStyle}>
        {EVENT_TOOLS.map(({title, ...props}, index: number): ReactStylableElement =>
          <ToolCard {...props} key={index} onClick={handleExplore('tool')}>
            {title}
          </ToolCard>
        )}
      </MethodSuggestionList>
    </div>
  }
ExpandedAdviceCardContentBase.propTypes = {
  adviceData: PropTypes.shape({
    events: PropTypes.arrayOf(PropTypes.shape({
      link: PropTypes.string.isRequired,
      organiser: PropTypes.string.isRequired,
      startDate: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }).isRequired),
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  userYou: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.Events, CardProps>(
    React.memo(ExpandedAdviceCardContentBase))


interface EventProps extends bayes.bob.Event {
  onClick?: () => void
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
  const {filters: omittedFilters, link, organiser, startDate, title,
    ...extraProps} = props
  return <RadiumExternalLink href={link} {...extraProps}>
    <strong>
      {title}
    </strong>
    <span style={{fontWeight: 'normal', marginLeft: '1em'}}>
      par {organiser}
    </span>
    <span style={{flex: 1}} />
    <span>{startDate && getDateString(startDate)}</span>
    <ChevronRightIcon style={chevronStyle} />
  </RadiumExternalLink>
}
EventBase.propTypes = {
  // TODO(cyrille): Drop `filters` if unused.
  filters: PropTypes.arrayOf(PropTypes.string.isRequired),
  link: PropTypes.string.isRequired,
  organiser: PropTypes.string.isRequired,
  startDate: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
}
const Event = React.memo(EventBase)


export default {ExpandedAdviceCardContent, Picto}
