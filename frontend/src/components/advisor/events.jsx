import React from 'react'
import PropTypes from 'prop-types'

import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import {Icon, PaddedOnMobile} from 'components/theme'

import eventsTypes from './data/events.json'

import {ToolCard} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    project: PropTypes.object,
  }

  render() {
    const {project} = this.props
    const {atNext, eventLocation} = (eventsTypes || {})[project.targetJob.jobGroup.romeId[0]] ||
      {atNext: 'à ', eventLocation: 'un évènement'}
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


class ExpandedAdviceCardContent extends React.Component {
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  renderToolCard(image, title, href, style) {
    const cardStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      cursor: 'pointer',
      display: 'flex',
      padding: 10,
      ...style,
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      fontSize: 14,
      fontWeight: 'bold',
    }
    return <div style={cardStyle} onClick={() => window.open(href, '_blank')}>
      <div style={titleStyle}>
        <img src={image}
          style={{height: 55, width: 55}} />
        <div style={{paddingLeft: 20}}>{title}</div>
      </div>
      <Icon name="chevron-right" style={{fontSize: 20}} />
    </div>
  }

  render() {
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


export default {AdviceCard, ExpandedAdviceCardContent}
