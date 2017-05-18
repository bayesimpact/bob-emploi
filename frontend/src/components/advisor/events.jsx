import React from 'react'
import PropTypes from 'prop-types'

import jobteaserImage from 'images/jobteaser-picto.png'
import meetupImage from 'images/meetup-picto.png'
import poleEmploiEventsImage from 'images/pole-emploi-evenements-picto.png'
import poleEmploiImage from 'images/pee-picto.png'
import recrutImage from 'images/recrut-picto.png'
import {Colors, GrowingNumber, Icon, PaddedOnMobile, PieChart} from 'components/theme'

import eventsTypes from './data/events.json'

import {ToolCard} from './base'


class FullAdviceCard extends React.Component {
  static propTypes = {
    project: PropTypes.object,
  }

  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  render() {
    const {project} = this.props
    const {isMobileVersion} = this.context
    // TODO(guillaume): Add the number of events when we have it.
    // TODO(guillaume): Remove the fixed width, find a cleaner way to keep the text on one line.
    const atAnEvent = (eventsTypes || {})[project.targetJob.jobGroup.romeId[0]] || 'à un évènement.'

    return <div style={{alignItems: 'center', display: 'flex', fontSize: 30, lineHeight: '1.2em'}}>
      <div>
        Vous pourriez rencontrer votre nouvel employeur {atAnEvent}.
      </div>
      {isMobileVersion ? null : <div style={{marginLeft: 50, width: 250}}>
        <PieChart
          style={{color: Colors.SKY_BLUE, marginLeft: 'auto', marginRight: 'auto'}}
          percentage={60}
          backgroundColor={Colors.MODAL_PROJECT_GREY}>
          <GrowingNumber number={60} />%
        </PieChart>
        <div style={{fontSize: 13, fontWeight: 500, lineHeight: '1em', marginTop: 10}}>
          des gens ont trouvé ça utile
        </div>
      </div>}
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


class AdvicePageContent extends React.Component {
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


export default {AdvicePageContent, FullAdviceCard}
