import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, sendProfessionalFeedback} from 'store/actions'

import {InfoCollNotificationBox} from 'components/info_coll'
import {isMobileVersion} from 'components/mobile'
import {StaticPage} from 'components/static'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import {Button, ExternalLink, Textarea} from 'components/theme'


class ProfessionalsPageBase
  extends React.PureComponent<{dispatch: DispatchAllActions}, {feedback: string}> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }

  public state = {
    feedback: '',
  }

  private submitFeedback = (): void => {
    const {dispatch} = this.props
    const {feedback} = this.state
    dispatch(sendProfessionalFeedback({feedback}))
    this.setState({feedback: ''})
  }

  private handleFeedbackChange = (feedback: string): void => this.setState({feedback})

  private renderTitle(): React.ReactNode {
    const style = {
      backgroundColor: colors.DARK,
      color: '#fff',
      fontSize: 23,
      lineHeight: '28px',
      padding: '80px 10px',
    }
    return <section style={style}>
      <header style={{fontSize: 35, fontWeight: 'bold', marginBottom: 40}}>
        {config.productName} pour les professionels
      </header>
      <div style={{margin: 'auto', maxWidth: 800}}>
        Vous utilisez {config.productName} en tant qu'accompagnateur&nbsp;?<br />
        Donnez-nous votre avis et partagez vos idées pour améliorer
        l'application.<br />
        {config.productName} évolue et progresse grâce à vos idées et retours.
      </div>
    </section>
  }

  private renderDemo(style): React.ReactNode {
    const containerStyle = {
      ...style,
    }
    return <section style={containerStyle}>
      <header style={{marginBottom: 40}}>
        Comment faire découvrir {config.productName}
      </header>
      <iframe
        width={isMobileVersion ? '100%' : 560} height={315} frameBorder={0}
        src="https://www.youtube.com/embed/ZmOZhDdFrL0"
        allowFullScreen={true} />
    </section>
  }

  private renderWhy(style: React.CSSProperties): React.ReactNode {
    return <section style={style}>
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
    </section>
  }

  private renderFeedback(style: React.CSSProperties): React.ReactNode {
    const {feedback} = this.state
    const width = isMobileVersion ? 300 : 800
    const textareaStyle = {
      display: 'block',
      fontSize: 14,
      height: 300,
      margin: 'auto',
      padding: '15px 12px',
      width,
    }
    return <section style={style}>
      <header style={{marginBottom: 40}}>
        Partager des retours et des idées pour améliorer {config.productName}
      </header>
      <Textarea
        style={textareaStyle}
        onChange={this.handleFeedbackChange}
        placeholder="Laissez-nous vos commentaires"
        value={feedback} />
      <div style={{display: 'block', margin: '20px auto 0', textAlign: 'right', width}}>
        <Button disabled={!feedback} onClick={this.submitFeedback}>
          Envoyer
        </Button>
      </div>
    </section>
  }

  private renderFollow(style: React.CSSProperties): React.ReactNode {
    const linkStyle = {
      color: colors.DARK,
      display: 'inline-block',
      fontSize: 20,
      padding: '0 20px',
    }
    return <section style={style}>
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
    </section>
  }

  public render(): React.ReactNode {
    const greyBackgroundStyle = {
      backgroundColor: colors.BACKGROUND_GREY,
      color: colors.DARK,
      padding: '50px 10px',
    }
    const whiteBackgroundStyle = {
      backgroundColor: '#fff',
      color: colors.DARK,
      padding: '50px 10px',
    }
    return <StaticPage
      page="professionals" isContentScrollable={true}
      style={{fontSize: 27, textAlign: 'center'}}>
      <InfoCollNotificationBox />
      {this.renderTitle()}
      {this.renderDemo(greyBackgroundStyle)}
      {this.renderWhy(whiteBackgroundStyle)}
      {this.renderFeedback({...greyBackgroundStyle, padding: '50px 10px 0'})}
      {this.renderFollow(greyBackgroundStyle)}
      <div style={{height: 150}} />
    </StaticPage>
  }
}
export default connect()(ProfessionalsPageBase)
