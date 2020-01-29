import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useMemo, useState, useCallback} from 'react'

import {inCityPrefix} from 'store/french'

import adieLogo from 'images/adie-logo.svg'

import {Trans} from 'components/i18n'
import {RadiumDiv} from 'components/radium'
import {TestimonialCard} from 'components/testimonials'
import {ExternalLink, GrowingNumber, Markdown, UpDownIcon} from 'components/theme'
import Picto from 'images/advices/picto-create-your-company.svg'

import {CardProps, MethodSection, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const


interface TestimonialsProps extends CardProps {
  testimonials: readonly bayes.bob.Testimonial[]
  t: TFunction
}

const testimonialsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-around',
}

const Testimonials: React.FC<TestimonialsProps> =
(props: TestimonialsProps): React.ReactElement|null => {
  const {
    t,
    testimonials,
  } = props
  if (!testimonials.length) {
    return null
  }
  const numTestimonials = testimonials.length
  const title = <Trans parent={null} count={numTestimonials} t={t}>
    <GrowingNumber number={numTestimonials} /> histoire de personne avec un parcours proche du vôtre
    qui s'est lancée.
  </Trans>

  const testimonialFooter = <Trans parent={null} t={t}>
    <img src={adieLogo} style={{height: 20, marginRight: 10}} alt="logo adie" />
    Découvrir l'accompagnement gratuit proposé par <ExternalLink
      key="see-more" style={{color: colors.BOB_BLUE, textDecoration: 'initial'}}
      href="https://www.adie.org/?utm_source=bob-emploi">
      l'adie</ExternalLink>
  </Trans>

  return <MethodSection title={title} footer={testimonialFooter}>
    <div style={testimonialsStyle}>
      {testimonials.map(
        ({authorJobName, authorName, description, imageLink, link}, index):
        ReactStylableElement => <TestimonialCard
          author={{imageLink: imageLink, jobName: authorJobName, name: authorName || ''}}
          isLong={true} style={{margin: '0 0 20px'}}
          key={index}><Markdown content={description} />
          <ExternalLink href={link}>
            {t("Lire la suite sur le site de l'adie")}
          </ExternalLink></TestimonialCard>)}
    </div>
  </MethodSection>
}

interface EventsProps extends CardProps {
  adviceData: bayes.bob.CreateCompanyExpandedData
  handleExplore: (visualElement: string) => () => void
  style?: React.CSSProperties
  t: TFunction
}

const renderLocation = (city: string): string => {
  if (!city) {
    return ''
  }
  const {cityName, prefix} = inCityPrefix(city)
  return prefix + cityName
}
const seeAllLinkStyle = {
  color: colors.BOB_BLUE,
  textDecoration: 'initial',
}

const EventsBase: React.FC<EventsProps> = (props: EventsProps): React.ReactElement|null => {
  const {
    adviceData: {closeByEvents: {city = '', events = []} = {}},
    handleExplore,
    style,
    t,
  } = props

  if (!events.length) {
    return null
  }
  const title = <Trans parent={null} t={t} count={events.length}>
    <GrowingNumber style={{fontWeight: 'bold'}} number={events.length} isSteady={true} />
    {' '}évènement {{inCity: renderLocation(city)}} pour les "entrepreneurs de demain"
  </Trans>
  const footer = <Trans parent={null} t={t}>
    <img src={adieLogo} style={{height: 20, marginRight: 10}} alt="logo adie" />
    Voir tous les évènements sur <ExternalLink
      style={seeAllLinkStyle} onClick={handleExplore('events')}
      href="http://www.rdv-adie.org/evenements/?utm_source=bob-emploi#des-evenements-partout-en-france">
      le site de l'adie</ExternalLink>
  </Trans>

  return <MethodSuggestionList title={title} footer={footer} style={style}>
    {events.filter(({title}): boolean => !!title).
      map((event, index): ReactStylableElement => <Event
        {...event} key={`event-${index}`}
        onClick={handleExplore('events')} />)}
  </MethodSuggestionList>
}
const Events = React.memo(EventsBase)


const CreateYourCompany: React.FC<CardProps> = (props: CardProps): React.ReactElement => {
  const adviceData = useAdviceData<bayes.bob.CreateCompanyExpandedData>(props)
  const {relatedTestimonials: {testimonials = emptyArray} = {}} = adviceData
  return <div>
    <Testimonials {...props} testimonials={testimonials} />
    <Events
      style={testimonials ? {marginTop: 20} : {}} {...props} adviceData={adviceData} />
  </div>
}
CreateYourCompany.propTypes = {
  backgroundColor: PropTypes.string,
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent = React.memo(CreateYourCompany)


interface EventProps extends bayes.bob.Event {
  onClick: () => void
  style?: React.CSSProperties
}

const titleStyle = {
  alignItems: 'center',
  display: 'flex',
  minHeight: 48,
}

const EventBase: React.FC<EventProps> = (props: EventProps): React.ReactElement => {
  const {cityName, description, onClick, style, timingText, title} = props
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = useCallback((): void => {
    setIsExpanded(wasExpanded => !wasExpanded)
    if (!isExpanded) {
      onClick && onClick()
    }
  }, [isExpanded, onClick])

  const containerStyle: React.CSSProperties = useMemo(() => ({
    ...style,
    alignItems: 'stretch',
    flexDirection: 'column',
  }), [style])
  return <RadiumDiv style={containerStyle} onClick={handleClick}>
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
  </RadiumDiv>

}
EventBase.propTypes = {
  cityName: PropTypes.string,
  description: PropTypes.string,
  onClick: PropTypes.func.isRequired,
  style: PropTypes.object,
  timingText: PropTypes.string,
  title: PropTypes.string.isRequired,
}
const Event = React.memo(EventBase)


export default {ExpandedAdviceCardContent, Picto}
