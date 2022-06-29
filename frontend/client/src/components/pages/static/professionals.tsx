import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch} from 'react-redux'

import type {DispatchAllActions} from 'store/actions'
import {sendProfessionalFeedback} from 'store/actions'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import isMobileVersion from 'store/mobile'
import {StaticPage} from 'components/static'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import Textarea from 'components/textarea'


const width = isMobileVersion ? 300 : 800
const textareaStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  height: 300,
  margin: 'auto',
  padding: '15px 12px',
  width,
}


interface FeedbackProps {
  style?: React.CSSProperties
}
const FeedbackBase = (props: FeedbackProps): React.ReactElement => {
  const {style} = props
  const dispatch = useDispatch<DispatchAllActions>()
  const [feedback, setFeedback] = useState('')
  const {t} = useTranslation()

  const submitFeedback = useCallback((): void => {
    dispatch(sendProfessionalFeedback({feedback}, t))
    setFeedback('')
  }, [dispatch, feedback, t])

  const containerStyle = useMemo((): React.CSSProperties => ({
    padding: '50px 10px 0',
    ...style,
  }), [style])

  return <section style={containerStyle}>
    <header style={{marginBottom: 40}}>
      Partager des retours et des idées pour améliorer {config.productName}
    </header>
    <Textarea
      style={textareaStyle}
      onChange={setFeedback}
      placeholder="Laissez-nous vos commentaires"
      value={feedback} />
    <div style={{display: 'block', margin: '20px auto 0', textAlign: 'right', width}}>
      <Button disabled={!feedback} onClick={submitFeedback}>
        Envoyer
      </Button>
    </div>
  </section>
}
const Feedback = React.memo(FeedbackBase)


const titleStyle: React.CSSProperties = {
  backgroundColor: colors.DARK,
  color: '#fff',
  fontSize: 23,
  lineHeight: '28px',
  padding: '80px 10px',
}
const greyBackgroundStyle: React.CSSProperties = {
  backgroundColor: colors.BACKGROUND_GREY,
  color: colors.DARK,
  padding: '50px 10px',
}
const whiteBackgroundStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: colors.DARK,
  padding: '50px 10px',
}
const linkStyle: React.CSSProperties = {
  color: colors.DARK,
  display: 'inline-block',
  fontSize: 20,
  padding: '0 20px',
}
const videoStyle: React.CSSProperties = {
  border: 0,
  height: 315,
  width: isMobileVersion ? '100%' : 560,
}


const ProfessionalsPageBase = (): React.ReactElement => {
  const title = useMemo((): React.ReactNode => <section style={titleStyle}>
    <header style={{fontSize: 35, fontWeight: 'bold', marginBottom: 40}}>
      {config.productName} pour les professionnels
    </header>
    <div style={{margin: 'auto', maxWidth: 800}}>
      Vous utilisez {config.productName} en tant qu'accompagnateur ou accommpagnatrice&nbsp;?<br />
      Donnez-nous votre avis et partagez vos idées pour améliorer
      l'application.<br />
      {config.productName} évolue et progresse grâce à vos idées et retours.
    </div>
  </section>, [])

  const demo = useMemo((): React.ReactNode => <section style={greyBackgroundStyle}>
    <header style={{marginBottom: 40}}>
      Comment faire découvrir {config.productName}
    </header>
    <iframe
      src="https://www.youtube.com/embed/ZmOZhDdFrL0"
      style={videoStyle}
      allowFullScreen={true} title={`Comment créer un compte sur ${config.productName}`} />
  </section>, [])

  const why = useMemo((): React.ReactNode => <section style={whiteBackgroundStyle}>
    <header style={{marginBottom: 40}}>
      Pourquoi proposer {config.productName}
    </header>
    <Testimonials
      cardStyle={{backgroundColor: colors.BACKGROUND_GREY, minHeight: 320}}
      carouselAutoRotationDurationMs={8000}>
      <TestimonialCard
        author={{isMan: true, jobName: 'ancien conseiller Pôle emploi', name: 'Sébastien'}}>
        J'aurais aimé que cette application existe quand j'étais encore
        conseiller à Pôle emploi. Le fait que les chercheurs d'emploi
        puissent recevoir un suivi en ligne avec des actions et des
        informations personnalisées en complément des rendez-vous avec leur
        conseiller est une réelle plus-value.
      </TestimonialCard>
      <TestimonialCard author={{jobName: 'assistante informatique', name: 'Bénédicte'}}>
        J'aime beaucoup… je l'utilise professionnellement (je suis assistante
        informatique dans une mission locale)… donc je la teste et j'en
        parle a mes collègues et via notre page Facebook.
        Les jeunes apprécient aussi surtout ceux qui sont déjà plus ou moins
        autonomes. Les conseils sont avisés. C'est du bon taf !
      </TestimonialCard>
      <TestimonialCard
        author={{jobName: 'conseillère en évolution professionnelle', name: 'Claire'}}>
        Cet outil permet de ne pas rester seul face à ses interrogations. Il
        propose au chercheur d'emploi une structuration de son action
        quotidienne, et l'aiguille au bon moment vers des informations
        sélectionnées, lui évitant de se perdre dans les méandres d'internet.
      </TestimonialCard>
    </Testimonials>
  </section>, [])

  const follow = useMemo((): React.ReactNode => <section style={greyBackgroundStyle}>
    <header style={{marginBottom: 40}}>
      Suivre les évolutions de {config.productName}
    </header>
    <div>
      <a
        href="https://twitter.com/@BobEmploi" style={linkStyle}
        target="_blank" rel="noopener noreferrer">
        Suivre notre page Twitter
      </a>
      <ExternalLink
        href="https://www.facebook.com/groups/bobemploiexperts" style={linkStyle}>
        Rejoindre le groupe Facebook "Les Experts - {config.productName}"
      </ExternalLink>
    </div>
  </section>, [])

  return <StaticPage
    page="professionals" isContentScrollable={true}
    style={{fontSize: 27, textAlign: 'center'}}>
    {title}
    {demo}
    {why}
    <Feedback style={greyBackgroundStyle} />
    {follow}
    <div style={{height: 150}} />
  </StaticPage>
}
export default React.memo(ProfessionalsPageBase)
