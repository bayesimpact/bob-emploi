import _omit from 'lodash/omit'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {genderize, getDateString} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import Picto from 'images/advices/picto-events.png'

import {AdviceSuggestionList, ToolCard, connectExpandedCardWithContent} from './base'


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


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      events: PropTypes.arrayOf(PropTypes.shape({
        link: PropTypes.string.isRequired,
        organiser: PropTypes.string.isRequired,
        startDate: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    profile: PropTypes.shape({
      gender: PropTypes.string,
    }).isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderEvents(events) {
    const {onExplore} = this.props
    return <div>
      <div style={{marginBottom: 15}}>
        Nous avons trouvé <strong>{events.length} évènement{events.length > 1 ? 's' : ''}</strong>
        {' '}qui pourrai{events.length > 1 ? 'ent' : 't'}
        {this.props.userYou("t'intéresser :", 'vous intéresser :')}
      </div>

      <AdviceSuggestionList style={{marginBottom: 20}}>
        {events.map(event => <Event
          {...event} key={event.link} onClick={() => onExplore('event')} />)}
      </AdviceSuggestionList>
    </div>
  }

  render() {
    const {adviceData: {events}, onExplore, profile: {gender}, userYou} = this.props
    const cardStyle = {
      marginTop: isMobileVersion ? 2 : 20,
      width: isMobileVersion ? '100%' : 465,
    }
    const toolsContainerStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      flexWrap: 'wrap',
    }
    const maybeE = genderize('·e', 'e', '', gender)
    return <div>
      {(events && events.length) ? this.renderEvents(events) : null}
      <div style={{marginBottom: 5}}>
        Assister à des évènements liés à {userYou('ton', 'votre')} métier {userYou('te ', 'vous ')}
        permet de rester engagé{maybeE} dans {userYou('ta', 'votre')} sphère professionnelle
        pendant {userYou('ta', 'votre')} recherche. {userYou('Tu pourras', 'Vous pourrez')} aussi
        renforcer {userYou('ton', 'votre')} réseau et {userYou('te', 'vous')} tenir au courant des
        nouveautés.<br />
        Nous avons trouvé <strong>{EVENT_TOOLS.length} outils</strong> pour
        découvrir plus d'évènements. Garde{userYou('', 'z')} aussi un œil sur la presse locale, les
        réseaux sociaux et les actualités de {userYou('ta', 'votre')} mairie 🗒.
      </div>

      <div style={toolsContainerStyle}>
        {EVENT_TOOLS.map(({title, ...props}, index) =>
          <ToolCard
            {...props} key={index} onClick={() => onExplore('tool')}
            style={{marginRight: index % 2 ? 0 : 20, ...cardStyle}}>
            {title}
          </ToolCard>
        )}
      </div>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class EventBase extends React.Component {
  static propTypes = {
    filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    link: PropTypes.string.isRequired,
    organiser: PropTypes.string.isRequired,
    startDate: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
  }

  render() {
    const {link, organiser, startDate, title, ...extraProps} = this.props
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      flexShrink: 0,
      fontSize: 20,
      height: 20,
      marginLeft: '1em',
      width: 20,
    }
    return <div
      onClick={() => window.open(link, '_blank')} {..._omit(extraProps, ['filters'])}>
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


export default {ExpandedAdviceCardContent, Picto}
