import type {TFunction} from 'i18next'
import React from 'react'

import {inCityPrefix} from 'store/french'

import adieLogo from 'images/adie-logo.svg'

import ExternalLink from 'components/external_link'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {TestimonialCard} from 'components/testimonials'
import Picto from 'images/advices/picto-create-your-company.svg'

import type {CardProps} from './base'
import {ExpandableAction, MethodSection, MethodSuggestionList, useAdviceData} from './base'


const emptyArray = [] as const

const noMarginStyle: React.CSSProperties = {
  margin: 0,
}


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
(props: TestimonialsProps): React.ReactElement => {
  const {
    t,
    testimonials,
  } = props
  const numTestimonials = testimonials.length
  const title = <Trans parent={null} count={numTestimonials} t={t}>
    <GrowingNumber number={numTestimonials} /> histoire de personne avec un parcours proche du vôtre
    qui s'est lancée.
  </Trans>

  const testimonialFooter = <Trans parent="p" t={t} style={noMarginStyle}>
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

const renderLocation = (city: string, t: TFunction): string => {
  if (!city) {
    return ''
  }
  const {cityName, prefix} = inCityPrefix(city, t)
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
    {' '}évènement {{inCity: renderLocation(city, t)}} pour les "entrepreneurs de demain"
  </Trans>
  const footer = <Trans parent="p" t={t} style={noMarginStyle}>
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
  const {t} = props
  const {data: adviceData, loading} = useAdviceData<bayes.bob.CreateCompanyExpandedData>(props)
  const {relatedTestimonials: {testimonials = emptyArray} = {}} = adviceData
  const hasTestimonials = !!testimonials.length
  if (loading) {
    return loading
  }
  return <div>
    {hasTestimonials ? <Testimonials {...props} testimonials={testimonials} /> : <Markdown
      content={
        // i18next-extract-mark-context-next-line ["fr", "uk", "usa"]
        t("Lorsque vous essayez de trouver votre propre idée d'entreprise, posez-vous les " +
        'questions suivantes\u00A0:\n' +
        '* Quel problème résout-il\u00A0?\n' +
        '* A qui profitera votre solution\u00A0?\n' +
        '* Pourquoi votre solution est-elle meilleure que les alternatives\u00A0?\n' +
        "* Comment s'inscrit-il dans l'air du temps\u00A0?\n" +
        '* Quelles mesures pouvez-vous prendre pour protéger votre idée\u00A0?\n\n' +
        'Vous trouverez ' +
        '[ici](https://www.pole-emploi.fr/candidat/je-creereprends-une-entreprise.html#) de ' +
        'nombreuses ressources pour vous lancer.', {context: config.countryId})} />}
    <Events
      style={hasTestimonials ? {marginTop: 20} : {}} {...props} adviceData={adviceData} />
  </div>
}
const ExpandedAdviceCardContent = React.memo(CreateYourCompany)


interface EventProps extends bayes.bob.Event {
  onClick: () => void
  style?: React.CSSProperties
}

const titleStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  fontWeight: 'normal',
  marginRight: '1em',
}

const EventBase: React.FC<EventProps> = (props: EventProps): React.ReactElement => {
  const {cityName, description, onClick, timingText, title, style} = props

  return <ExpandableAction
    title={<span style={titleStyle}>
      <span style={{flex: 1}}>{title}</span>
      {cityName ? <strong style={{marginRight: '1em'}}>{cityName} </strong> : null}
      <span style={{fontWeight: 500}}> {timingText}</span>
    </span>} onContentShown={onClick} style={style}>
    <div style={{fontWeight: 'normal'}}>
      <Markdown content={description} />
    </div>
  </ExpandableAction>
}
const Event = React.memo(EventBase)


export default {ExpandedAdviceCardContent, Picto}
