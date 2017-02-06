import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {Colors} from 'components/theme'

import {AdvicePage, ApplicationModeChart, Section} from './base'


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


const AdviceCard = {
  color: Colors.BUTTERSCOTCH,
  picto: <img src={require('images/spontaneous-application-picto.svg')} />,
}


export default {AdviceCard, RecommendPage}
