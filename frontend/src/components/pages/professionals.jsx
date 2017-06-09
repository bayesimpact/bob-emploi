import React from 'react'
import PropTypes from 'prop-types'

import config from 'config'

import {sendProfessionalFeedback} from 'store/actions'

import {PageWithNavigationBar} from 'components/navigation'
import {TestimonialCard, Testimonials} from 'components/testimonials'
import {Button, Colors} from 'components/theme'


class ProfessionalsPage extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  state = {
    feedback: '',
  }

  submitFeedback = () => {
    const {dispatch} = this.props
    const {feedback} = this.state
    dispatch(sendProfessionalFeedback(feedback))
    this.setState({feedback: ''})
  }

  render() {
    const greyBackgroundStyle = {
      backgroundColor: Colors.BACKGROUND_GREY,
      color: Colors.DARK,
      padding: '50px 10px',
    }
    const whiteBackgroundStyle = {
      backgroundColor: '#fff',
      color: Colors.DARK,
      padding: '50px 10px',
    }
    return <PageWithNavigationBar
        page="professionals" isContentScrollable={true}
        style={{fontSize: 27, textAlign: 'center'}}>
      {this.renderTitle()}
      {this.renderDemo(greyBackgroundStyle)}
      {this.renderWhy(whiteBackgroundStyle)}
      {this.renderFeedback({...greyBackgroundStyle, padding: '50px 10px 0'})}
      {this.renderFollow(greyBackgroundStyle)}
    </PageWithNavigationBar>
  }

  renderTitle() {
    const style = {
      backgroundColor: Colors.DARK,
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
        l'application. {config.productName} évolue et progresse grâce à vos idées et
        retours.
      </div>
    </section>
  }

  renderDemo(style) {
    const {isMobileVersion} = this.context
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

  renderWhy(style) {
    return <section style={style}>
      <header style={{marginBottom: 40}}>
        Pourquoi proposer {config.productName}
      </header>
      <Testimonials
          cardStyle={{backgroundColor: Colors.BACKGROUND_GREY, minHeight: 320}}
          carouselAutoRotationDurationMs={8000}>
        <TestimonialCard author="Sébastien, ancien conseiller Pôle emploi" isAuthorMan={true}>
          J'aurais aimé que cette application existe quand j'étais encore
          conseiller à Pôle emploi. Le fait que les chercheurs d'emploi
          puissent recevoir un suivi en ligne avec des actions et des
          informations personnalisées en complément des rendez-vous avec leur
          conseiller est une réelle plus-value.
        </TestimonialCard>
        <TestimonialCard author="Bénédicte, assistante informatique">
          J'aime beaucoup… je l'utilise professionnellement (je suis assistante
          informatique dans une mission locale)… donc je la teste et j'en
          parle a mes collègues et via notre page Facebook.
          Les jeunes apprécient aussi surtout ceux qui sont déjà plus ou moins
          autonomes. Les conseils sont avisés. C'est du bon taf !
        </TestimonialCard>
        <TestimonialCard author="Claire, conseillère en évolution professionnelle">
          Cet outil permet de ne pas rester seul face à ses interrogations. Il
          propose au chercheur d'emploi une structuration de son action
          quotidienne, et l'aiguille au bon moment vers des informations
          sélectionnées, lui évitant de se perdre dans les méandres d'internet.
        </TestimonialCard>
      </Testimonials>
    </section>
  }

  renderFeedback(style) {
    const {isMobileVersion} = this.context
    const {feedback} = this.state
    const width = isMobileVersion ? 300 : 800
    const textareaStyle = {
      fontSize: 14,
      height: 300,
      padding: '15px 12px',
      width,
    }
    return <section style={style}>
      <header style={{marginBottom: 40}}>
        Partager des retours et des idées pour améliorer {config.productName}
      </header>
      <textarea
          style={textareaStyle}
          onChange={event => this.setState({feedback: event.target.value})}
          placeholder="Laissez-nous vos commentaires"
          value={feedback} />
      <div style={{display: 'inline-block', textAlign: 'right', width}}>
        <Button disabled={!feedback} onClick={this.submitFeedback}>
          Envoyer
        </Button>
      </div>
    </section>
  }

  renderFollow(style) {
    const linkStyle = {
      color: Colors.DARK,
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
        <a
            href="https://www.facebook.com/groups/bobemploiexperts"
            style={linkStyle} target="_blank" rel="noopener noreferrer">
          Rejoindre le groupe Facebook "Les Experts - {config.productName}"
        </a>
      </div>
    </section>
  }
}


export {ProfessionalsPage}
