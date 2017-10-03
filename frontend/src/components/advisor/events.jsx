import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {getEvents} from 'store/actions'

import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import {Icon, PaddedOnMobile, Styles} from 'components/theme'

import eventsTypes from './data/events.json'

import {AdviceSuggestionList, ToolCard} from './base'


// Move to library if needed somewhere else
const monthsShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const niceDate = timestamp => {
  const date = new Date(timestamp)
  const day = date.getDay()
  const month = date.getMonth()
  const year = date.getFullYear()
  return `${day} ${monthsShort[month]} ${year}`
}


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      eventsData: PropTypes.shape({
        eventName: PropTypes.string.isRequired,
      }),
    }).isRequired,
    project: PropTypes.object,
  }

  getEventName() {
    const {advice, project} = this.props
    if (advice.eventsData && advice.eventsData.eventName) {
      return {atNext: "à l'évènement ", eventLocation: advice.eventsData.eventName}
    }
    if (eventsTypes) {
      const romeIdFirstLetter = project.targetJob.jobGroup.romeId[0]
      if (eventsTypes[romeIdFirstLetter]) {
        return eventsTypes[romeIdFirstLetter]
      }
    }
    return {atNext: 'à ', eventLocation: 'un évènement'}
  }

  render() {
    const {atNext, eventLocation} = this.getEventName()
    return <div style={{fontSize: 30}}>
      <div>
        Vous pourriez rencontrer votre nouvel employeur {atNext}<strong>{eventLocation}</strong>.
      </div>
    </div>
  }
}


const EVENT_TOOLS = [
  {
    href: 'http://www.emploi-store.fr/portail/services/poleEmploiEvenements',
    imageSrc: poleEmploiEventsImage,
    title: 'App Pôle Emploi Évènements',
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


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    events: PropTypes.arrayOf(PropTypes.shape({
      link: PropTypes.string.isRequired,
      organiser: PropTypes.string.isRequired,
      startDate: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    }).isRequired).isRequired,
    project: PropTypes.shape({
      projectId: PropTypes.string.isRequired,
    }).isRequired,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    const {dispatch, events, project} = this.props
    if (!events.length) {
      dispatch(getEvents(project))
    }
  }

  renderEvents(events) {
    return <div>
      <PaddedOnMobile style={{marginBottom: 15}}>
        Nous avons trouvé <strong>{events.length} évènement{events.length > 1 ? 's' : ''}</strong>
        {' '}qui pourrai{events.length > 1 ? 'ent' : 't'} vous intéresser :
      </PaddedOnMobile>

      <AdviceSuggestionList style={{marginBottom: 20}}>
        {events.map(event => <Event {...event} key={event.link} />)}
      </AdviceSuggestionList>
    </div>
  }

  render() {
    const {events} = this.props
    const {isMobileVersion} = this.context
    const cardStyle = {
      marginTop: isMobileVersion ? 2 : 20,
      width: isMobileVersion ? '100%' : 465,
    }
    const toolsContainerStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      flexWrap: 'wrap',
    }
    return <div style={{fontSize: 21}}>
      {(events && events.length) ? this.renderEvents(events) : null}
      <PaddedOnMobile style={{marginBottom: 5}}>
        Nous avons trouvé <strong>{EVENT_TOOLS.length} outils</strong> pour
        découvrir plus d'évènements
      </PaddedOnMobile>

      <div style={toolsContainerStyle}>
        {EVENT_TOOLS.map(({title, ...props}, index) =>
          <ToolCard
            {...props} key={index}
            style={{marginRight: index % 2 ? 0 : 20, ...cardStyle}}>
            {title}
          </ToolCard>
        )}
      </div>
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => {
  const {events} = (app.adviceData[project.projectId] || {}).events || {}
  return {events: events || []}
})(ExpandedAdviceCardContentBase)


class EventBase extends React.Component {
  static propTypes = {
    filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    link: PropTypes.string.isRequired,
    organiser: PropTypes.string.isRequired,
    startDate: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {filters, link, organiser, startDate, title, ...extraProps} = this.props
    return <div
      onClick={() => window.open(link, '_blank')} {...extraProps}>
      <strong style={Styles.CENTER_FONT_VERTICALLY}>
        {title}
      </strong>
      <span style={{fontWeight: 'normal', marginLeft: '1em', ...Styles.CENTER_FONT_VERTICALLY}}>
        par {organiser}
      </span>
      <span style={{flex: 1}} />
      <span style={Styles.CENTER_FONT_VERTICALLY}>{niceDate(startDate)}</span>
      <Icon name="chevron-right" style={{fontSize: 20, marginLeft: '1em'}} />
    </div>
  }
}
const Event = Radium(EventBase)


export default {AdviceCard, ExpandedAdviceCardContent}
