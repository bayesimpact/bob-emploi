import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {GrowingNumber} from 'components/theme'
import {getDateString} from 'store/french'

import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import NewPicto from 'images/advices/picto-events.svg'

import {MethodSuggestionList, CardProps, CardWithContentProps, ToolCard,
  connectExpandedCardWithContent, makeTakeAwayFromAdviceData} from './base'


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


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.Events>> {
  public static propTypes = {
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

  private renderEvents(events: readonly bayes.bob.Event[]): React.ReactNode {
    const {handleExplore, userYou} = this.props
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

  public render(): React.ReactNode {
    const {adviceData: {events}, handleExplore} = this.props
    const methodTitle = <React.Fragment>
      <GrowingNumber number={EVENT_TOOLS.length} isSteady={true} />
      {' '} outils pour trouver des évènements
    </React.Fragment>
    const hasEvents = events && events.length
    const eventBoxStyle = hasEvents && {marginTop: 20}
    return <div>
      {hasEvents ? this.renderEvents(events) : null}
      <MethodSuggestionList title={methodTitle} style={eventBoxStyle}>
        {EVENT_TOOLS.map(({title, ...props}, index: number): ReactStylableElement =>
          <ToolCard {...props} key={index} onClick={handleExplore('tool')}>
            {title}
          </ToolCard>
        )}
      </MethodSuggestionList>
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.Events, CardProps>()(ExpandedAdviceCardContentBase)


interface EventProps extends bayes.bob.Event {
  onClick?: () => void
}


class EventBase extends React.PureComponent<EventProps> {
  public static propTypes = {
    // TODO(cyrille): Drop `filters` if unused.
    filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    link: PropTypes.string.isRequired,
    organiser: PropTypes.string.isRequired,
    startDate: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }

  private handleOpenLink(): void {
    window.open(this.props.link, '_blank')
  }

  public render(): React.ReactNode {
    const {filters: omittedFilters, link: omittedLink, organiser, startDate, title,
      ...extraProps} = this.props
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      flexShrink: 0,
      fontSize: 20,
      height: 20,
      marginLeft: '1em',
      width: 20,
    }
    return <div onClick={this.handleOpenLink} {...extraProps}>
      <strong>
        {title}
      </strong>
      <span style={{fontWeight: 'normal', marginLeft: '1em'}}>
        par {organiser}
      </span>
      <span style={{flex: 1}} />
      <span>{getDateString(startDate)}</span>
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const Event = Radium(EventBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({events}: bayes.bob.Events): readonly bayes.bob.Event[] => events, 'évènement')

export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
