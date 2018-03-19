import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import ChevronUpIcon from 'mdi-react/ChevronUpIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {inCityPrefix} from 'store/french'

import adieLogo from 'images/adie-logo.png'

import {Colors, GrowingNumber, Markdown, PaddedOnMobile} from 'components/theme'
import Picto from 'images/advices/picto-create-your-company.png'

import {AdviceSuggestionList, connectExpandedCardWithContent} from './base'


class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.shape({
      createYourCompanyData: PropTypes.shape({
        city: PropTypes.string,
        period: PropTypes.string,
      }),
    }).isRequired,
    fontSize: PropTypes.number.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  renderLocation() {
    const {city} = this.props.advice.createYourCompanyData || {}
    if (!city) {
      return 'partout en France'
    }
    const {cityName, prefix} = inCityPrefix(city)
    return prefix + cityName
  }

  render() {
    const {advice, fontSize, userYou} = this.props
    const {period} = advice.createYourCompanyData || {}
    return <div style={{fontSize: fontSize}}>
      {userYou('As-tu', 'Avez-vous')} déjà envisagé
      de {userYou('tu', 'vous')} lancer à {userYou('ton', 'votre')} compte&nbsp;?
      Des <strong>ateliers de la création d'entreprise</strong> ont
      lieu {this.renderLocation()} {period || 'prochainement'}, une bonne occasion d'y
      réfléchir 😉.
    </div>
  }
}


class SimpleLink extends React.Component {
  render() {
    return <a {...this.props} />
  }
}
const RadiumLink = Radium(SimpleLink)


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      city: PropTypes.string,
      events: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string.isRequired,
      }).isRequired),
    }).isRequired,
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

  render() {
    const {adviceData} = this.props
    const {city, events} = adviceData

    if (!events || !events.length) {
      return null
    }

    const seeAllLinkStyle = {
      color: 'inherit',
      textDecoration: 'initial',
    }

    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Nous avons trouvé <GrowingNumber
          style={{fontWeight: 'bold'}} number={events.length} isSteady={true} />
        {' '}événement{events.length > 1 ? 's' : ''} {this.renderLocation(city)} pour
        les "entrepreneurs de demain"&nbsp;:
      </PaddedOnMobile>
      <AdviceSuggestionList style={{marginTop: 15}}>
        {events.map((event, index) => <Event {...event} key={`event-${index}`} />).
          // TODO(pascal): Factorize with spontaneous.
          concat([<RadiumLink
            key="see-more" target="_blank" style={seeAllLinkStyle} rel="noopener noreferer"
            href="http://www.rdv-adie.org/evenements/?utm_source=bob-emploi#des-evenements-partout-en-france">
            Voir tous les évènements sur le site de l'ADIE
            <span style={{flex: 1}} />
            <img src={adieLogo} style={{height: 40, marginRight: 20}} alt="" />
            <ChevronRightIcon fill={Colors.CHARCOAL_GREY} />
          </RadiumLink>])}
      </AdviceSuggestionList>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class EventBase extends React.Component {
  static propTypes = {
    cityName: PropTypes.string,
    description: PropTypes.string,
    style: PropTypes.object,
    timingText: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  state = {
    isExpanded: false,
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
    return <div style={containerStyle} onClick={() => this.setState({isExpanded: !isExpanded})}>
      <div style={titleStyle}>
        {title}
        <span style={{flex: 1}} />
        {cityName ? <strong style={{marginRight: '1em'}}>{cityName} </strong> : null}
        <span style={{fontWeight: 500}}> {timingText}</span>
        {isExpanded ?
          <ChevronUpIcon fill={Colors.CHARCOAL_GREY} /> :
          <ChevronDownIcon fill={Colors.CHARCOAL_GREY} />}
      </div>
      {isExpanded ? <div style={{fontWeight: 'normal'}}>
        <Markdown content={description} />
      </div> : null}
    </div>
  }
}
const Event = Radium(EventBase)


export default {AdviceCard, ExpandedAdviceCardContent, Picto}
