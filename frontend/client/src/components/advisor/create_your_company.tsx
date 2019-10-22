import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {inCityPrefix} from 'store/french'

import adieLogo from 'images/adie-logo.svg'

import {TestimonialCard} from 'components/testimonials'
import {ExternalLink, GrowingNumber, Markdown, UpDownIcon} from 'components/theme'
import Picto from 'images/advices/picto-create-your-company.svg'

import {CardProps, CardWithContentProps, MethodSection, MethodSuggestionList,
  connectExpandedCardWithContent} from './base'


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.CreateCompanyExpandedData>> {
  public static propTypes = {
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
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    userYou: PropTypes.func.isRequired,
  }

  private renderLocation(city: string): React.ReactNode {
    if (!city) {
      return null
    }
    const {cityName, prefix} = inCityPrefix(city)
    return prefix + cityName
  }

  private renderEvents(style: React.CSSProperties): React.ReactNode {
    const {adviceData: {closeByEvents: {city = '', events = []} = {}}, handleExplore} = this.props

    if (!events.length) {
      return null
    }
    const title = <React.Fragment>
      <GrowingNumber style={{fontWeight: 'bold'}} number={events.length} isSteady={true} />
      {' '}évènement{events.length > 1 ? 's' : ''} {this.renderLocation(city)} pour
      les "entrepreneurs de demain"
    </React.Fragment>

    const seeAllLinkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'initial',
    }
    const footer = <React.Fragment>
      <img src={adieLogo} style={{height: 20, marginRight: 10}} alt="logo adie" />
      Voir tous les évènements sur <ExternalLink
        style={seeAllLinkStyle} onClick={handleExplore('events')}
        href="http://www.rdv-adie.org/evenements/?utm_source=bob-emploi#des-evenements-partout-en-france">
        le site de l'adie</ExternalLink>
    </React.Fragment>

    return <MethodSuggestionList title={title} footer={footer} style={style}>
      {events.filter(({title}): boolean => !!title).
        map((event, index): ReactStylableElement => <Event
          {...event} key={`event-${index}`}
          onClick={handleExplore('event')} />)}
    </MethodSuggestionList>
  }

  private renderTestimonials(): React.ReactNode {
    const {
      adviceData: {
        relatedTestimonials: {testimonials = []} = {},
      },
      userYou,
    } = this.props
    if (!testimonials.length) {
      return null
    }
    const numTestimonials = testimonials.length
    const maybeS = numTestimonials > 1 ? 's' : ''
    const haveStarted = numTestimonials > 1 ? 'se sont lancées' : "s'est lancée"
    const title = <React.Fragment>
      <GrowingNumber number={numTestimonials} /> histoire{maybeS} de personne{maybeS} avec un
      parcours proche du {userYou('tien', 'vôtre')} qui {haveStarted}.
    </React.Fragment>
    const footer = <React.Fragment>
      <img src={adieLogo} style={{height: 20, marginRight: 10}} alt="logo adie" />
      Découvrir l'accompagnement gratuit proposé par <ExternalLink
        key="see-more" style={{color: colors.BOB_BLUE, textDecoration: 'initial'}}
        href="https://www.adie.org/?utm_source=bob-emploi">
        l'adie</ExternalLink>
    </React.Fragment>
    const testimonialsStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
    }
    return <MethodSection title={title} footer={footer}>
      <div style={testimonialsStyle}>
        {testimonials.map(
          ({authorJobName, authorName, description, imageLink, link}, index):
          ReactStylableElement => <TestimonialCard
            author={{imageLink: imageLink, jobName: authorJobName, name: authorName || ''}}
            isLong={true} style={{margin: '0 0 20px'}}
            key={index}><Markdown content={description} />
            <ExternalLink href={link}>
              Lire la suite sur le site de l'adie
            </ExternalLink></TestimonialCard>)}
      </div>
    </MethodSection>
  }

  public render(): React.ReactNode {
    const {relatedTestimonials: {testimonials = []} = {}} = this.props.adviceData
    return <div>
      {this.renderTestimonials()}
      {this.renderEvents(testimonials ? {marginTop: 20} : {})}
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.CreateCompanyExpandedData, CardProps>(
    ExpandedAdviceCardContentBase)


interface EventState {
  isExpanded: boolean
}


interface EventProps extends bayes.bob.Event {
  onClick: () => void
  style?: React.CSSProperties
}


class EventBase extends React.PureComponent<EventProps, EventState> {
  public static propTypes = {
    cityName: PropTypes.string,
    description: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    style: PropTypes.object,
    timingText: PropTypes.string,
    title: PropTypes.string.isRequired,
  }

  public state = {
    isExpanded: false,
  }

  private handleClick = (): void => {
    const {isExpanded} = this.state
    const {onClick} = this.props
    this.setState({isExpanded: !isExpanded})
    if (!isExpanded) {
      onClick && onClick()
    }
  }

  public render(): React.ReactNode {
    const {cityName, description, style, timingText, title} = this.props
    const {isExpanded} = this.state
    const containerStyle: React.CSSProperties = {
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
