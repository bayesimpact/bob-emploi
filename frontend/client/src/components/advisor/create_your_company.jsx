import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {inCityPrefix} from 'store/french'

import adieLogo from 'images/adie-logo.png'

import {CardCarousel} from 'components/card_carousel'
import {TestimonialCard} from 'components/testimonials'
import {ExternalLink, GrowingNumber, Markdown, UpDownIcon} from 'components/theme'
import Picto from 'images/advices/picto-create-your-company.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'


const RadiumExternalLink = Radium(ExternalLink)


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      closeByEvents: PropTypes.shape({
        city: PropTypes.string,
        events: PropTypes.arrayOf(PropTypes.shape({
          title: PropTypes.string.isRequired,
        }).isRequired),
      }),
      relatedTestimonials: PropTypes.shape({
        testimonials: PropTypes.arrayOf(PropTypes.object.isRequired),
      }),
    }).isRequired,
    backgroundColor: PropTypes.string,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderLocation(city) {
    if (!city) {
      return null
    }
    const {cityName, prefix} = inCityPrefix(city)
    return prefix + cityName
  }

  renderEvents() {
    const {onExplore} = this.props
    const {city, events = []} = this.props.adviceData.closeByEvents || {}

    if (!events.length) {
      return null
    }

    const seeAllLinkStyle = {
      color: 'inherit',
      textDecoration: 'initial',
    }

    return <div>
      <div>
        Nous avons trouvé <GrowingNumber
          style={{fontWeight: 'bold'}} number={events.length} isSteady={true} />
        {' '}événement{events.length > 1 ? 's' : ''} {this.renderLocation(city)} pour
        les "entrepreneurs de demain"&nbsp;:
      </div>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {events.map((event, index) => <Event
          {...event} key={`event-${index}`}
          onClick={() => onExplore('event')} />).
          // TODO(pascal): Factorize with spontaneous.
          concat([<RadiumExternalLink
            key="see-more" style={seeAllLinkStyle} onClick={() => onExplore('events')}
            href="http://www.rdv-adie.org/evenements/?utm_source=bob-emploi#des-evenements-partout-en-france">
            Voir tous les évènements sur le site de l'Adie
            <span style={{flex: 1}} />
            <img src={adieLogo} style={{height: 40, marginRight: 20}} alt="" />
            <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY}} />
          </RadiumExternalLink>])}
      </AdviceSuggestionList>
    </div>
  }

  renderTestimonials() {
    const {
      closeByEvents: {events = []} = {},
      relatedTestimonials: {testimonials = []} = {},
    } = this.props.adviceData
    if (!testimonials.length) {
      return null
    }
    const numTestimonials = testimonials.length
    const maybeS = count => count > 1 ? 's' : ''
    return <div style={{marginBottom: events.length ? 20 : 0}}>
      <div>
        Et pourquoi pas moi ? Si vous êtes comme 37% des Français vous avez déjà pensé à créer
        votre propre activité. Pour vous aider à faire mûrir l'idée, nous avons sélectionné pour
        vous <GrowingNumber style={{fontWeight: 'bold'}} number={numTestimonials} isSteady={true} />
        <strong>{' '}histoire{maybeS(numTestimonials)}</strong> de personnes avec un parcours
        proches du vôtre qui se sont lancées.<br />
        <br />
        Si vous avez envie d'aller plus loin, on vous a ajouté un lien vers l'Adie, l'Association
        pour le droit à l'initiative économique 😉
      </div>

      <div style={{marginTop: 15}}>
        <CardCarousel
          backGroundColor={this.props.backgroundColor || '#fff'}
          isLarge={true}>
          {testimonials.map(
            ({authorJobName, authorName, description, imageLink, link}, idx) => <TestimonialCard
              author={{imageLink: imageLink, jobName: authorJobName, name: authorName}}
              isLong={true}
              key={`testimonial-${idx}`}><Markdown content={description} />
              <ExternalLink href={link}>
                Lire la suite sur le site de l'Adie
              </ExternalLink></TestimonialCard>)}
        </CardCarousel>
        <RadiumExternalLink
          key="see-more" style={{color: 'inherit', textDecoration: 'initial'}}
          href="https://www.adie.org/?utm_source=bob-emploi">
          Découvrir l'accompagnement gratuit proposé par l'Adie
          <span style={{flex: 1}} />
          <img src={adieLogo} style={{height: 40, marginRight: 20}} alt="" />
          <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY}} />
        </RadiumExternalLink>
      </div>
    </div>
  }

  render() {
    return <div>
      {this.renderTestimonials()}
      {this.renderEvents()}
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent(({user}) => ({
  featuresEnabled: user.featuresEnabled || {},
}))(ExpandedAdviceCardContentBase)


class EventBase extends React.Component {
  static propTypes = {
    cityName: PropTypes.string,
    description: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
    timingText: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  state = {
    isExpanded: false,
  }

  handleClick = () => {
    const {isExpanded} = this.state
    const {onClick} = this.props
    this.setState({isExpanded: !isExpanded})
    if (!isExpanded) {
      onClick && onClick()
    }
  }

  render() {
    const {cityName, description, style, timingText, title} = this.props
    const {isExpanded} = this.state
    const containerStyle = {
      ...style,
      alignItems: 'stretch',
      flexDirection: 'column',
    }
    const titleStyle = {
      alignItems: 'center',
      display: 'flex',
      minHeight: 48,
    }
    return <div style={containerStyle} onClick={this.handleClick}>
      <div style={titleStyle}>
        {title}
        <span style={{flex: 1}} />
        {cityName ? <strong style={{marginRight: '1em'}}>{cityName} </strong> : null}
        <span style={{fontWeight: 500}}> {timingText}</span>
        <UpDownIcon
          icon="chevron"
          isUp={isExpanded}
        />
      </div>
      {isExpanded ? <div style={{fontWeight: 'normal'}}>
        <Markdown content={description} />
      </div> : null}
    </div>
  }
}
const Event = Radium(EventBase)


export default {ExpandedAdviceCardContent, Picto}
