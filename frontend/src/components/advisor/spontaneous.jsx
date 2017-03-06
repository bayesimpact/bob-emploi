import React from 'react'
import {connect} from 'react-redux'
import _ from 'underscore'

import config from 'config'

import {USER_PROFILE_SHAPE, userAge} from 'store/user'

import {AdviceCard, AdvicePage, ApplicationModeChart, HowToBox, Section} from './base'
import {Colors} from 'components/theme'


class RecommendPageBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    project: React.PropTypes.object.isRequired,
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    const applicationModes = project.localStats && project.localStats.imt &&
      project.localStats.imt.applicationModes || null
    return <div>
      <Section header="Opportunités proposées la candidature spontanée">
        <p>
          Les candidatures spontanées vous permettent de montrer votre motivation
          et d'accéder plus facilement au marché caché.
        </p>
        <p>
          On estime que seulement 40% du marché de l'emploi est visible,
          c'est-à-dire que la plupart des embauches ne passe pas par des annonces.
          En envoyant des candidatures spontanées vous pourrez anticiper
          les besoins de l'entreprise et augmenter vos chances de retrouver un emploi.
        </p>
        <p>
          Dans votre secteur, cette tendance semble particulièrement forte.
          La candidature spontanée est considérée comme le meilleure canal pour
          retrouver un emploi.
        </p>
        <ApplicationModeChart applicationModes={applicationModes} />
      </Section>
      <Section header="Conclusion">
        {this.renderConclusion()}
      </Section>
    </div>
  }

  renderConclusion() {
    return <div>
      <p><strong>Nous vous encourageons à envoyer des candidatures spontanées.</strong></p>
      <p>
        Envoyer des candidatures spontanées en parallèle de vos candidatures vous
        aidera à affiner vos demandes et trouver un emploi plus facilement.
      </p>
      <p>
        Nous pouvons vous aider à cibler et préparer des candidatures spontanées
        pour en faire un véritable atout.
      </p>
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      declineReasonTitle="Les candidatures spontanées ne vous conviennent pas&nbsp;?"
      declineReasonOptions={[
        'Je préfère passer par un autre canal de recrutement.',
        'Je fais déjà de nombreuses candidatures spontannées.',
        'Les candidatures spontannées ne me conviennent pas.',
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}
      summary={<li>
        La candidature spontanée semble être le meilleur canal pour trouver un
        emploi dans votre secteur.
      </li>}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage =
  connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


class FullAdviceCard extends React.Component {
  static propTypes = {
    profile: USER_PROFILE_SHAPE.isRequired,
  }

  renderTitle(title) {
    const style = {
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: 500,
      marginBottom: 10,
      textTransform: 'uppercase',
    }
    return <header style={style}>
      {title}
    </header>
  }

  renderWhy(style) {
    const frameStyle = {
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      padding: '30px 0',
      textAlign: 'center',
    }
    const legendStyle = {
      color: Colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
    }
    return <div style={style}>
      {this.renderTitle('Pourquoi :')}
      <div style={frameStyle}>
        <div style={{fontSize: 30, marginBottom: 10}}>
          <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>1</strong> emploi
          sur <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>5</strong>
        </div>
        <strong>est décroché</strong> suite à<br />
        une candidature spontanée
      </div>
      <div style={legendStyle}>
        source : IMT Pôle emploi 2016
      </div>

      <div style={{...frameStyle, marginTop: 35}}>
        <div style={{fontSize: 30, marginBottom: 10}}>
          <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>66% </strong>
          des employeurs
        </div>
        <strong>recrutent</strong> via des candidatures spontanées
      </div>
      <div style={legendStyle}>
        source : Enquête IFOP 2016
      </div>
    </div>
  }

  renderHowStep(stepNumber, children) {
    const numberStyle = {
      borderBottom: `solid 2px ${Colors.SKY_BLUE}`,
      fontSize: 30,
      fontWeight: 'bold',
      margin: '25px auto',
      padding: 3,
      width: 40,
    }
    return <div style={{margin: '0 20px', textAlign: 'center'}}>
      <div style={numberStyle}>
        {stepNumber}
      </div>
      {children}
    </div>
  }

  renderHow(style) {
    const {profile} = this.props
    const darkFrameStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      padding: 25,
    }
    const maybeE = profile.gender === 'FEMININE' ? 'e' : ''
    const frustrations = _.indexBy(profile.frustrations || [], key => key)
    return <div style={style}>
      {this.renderTitle('Comment :')}
      <div style={darkFrameStyle}>
        <div style={{fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase'}}>
          Avancez étape par étape
        </div>
        <div style={{display: 'flex', justifyContent: 'space-around'}}>
          {this.renderHowStep(1, 'Ciblez les entreprises qui vous intéressent')}
          {this.renderHowStep(2, 'Personnalisez vos CV et lettre de motivation')}
          {this.renderHowStep(3, "Faites des relances si vous n'avez pas de réponse")}
        </div>
      </div>
      <HowToBox
          disabled={frustrations['NO_OFFER_ANSWERS'] < 0}
          title="Présentez vous en personne"
          reason="Vous nous avez dit ne pas avoir beaucoup de réponses">
        Vous déplacer dans l'entreprise pour déposer votre CV à la main
        montre votre motivation et votre détermination. Vous aurez plus
        de réponses ainsi.
      </HowToBox>
      <HowToBox
          title="Faites de votre âge un atout"
          disabled={frustrations['AGE_DISCRIMINATION'] < 0 ||
            userAge(profile.yearOfBirth) > 50}
          reason={`Vous nous avez dit être frustré${maybeE} par votre âge`}>
        <ul>
          <li>Faites un CV par compétences</li>
          <li>Montrez que vous etes stable, expérimenté et operationnel</li>
        </ul>
      </HowToBox>
    </div>
  }

  render() {
    return <AdviceCard
        title="Les candidatures spontanées peuvent-elles vous aider&nbsp;?"
        goal="faire de bonnes candidatures spontanées"
        {...this.props}>
      <div style={{display: 'flex'}}>
        {this.renderWhy({flex: 1, marginRight: 30})}
        {this.renderHow({flex: 2})}
      </div>
    </AdviceCard>
  }
}


export default {FullAdviceCard, RecommendPage}
