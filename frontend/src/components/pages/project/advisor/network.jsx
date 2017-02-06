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
      <Section header="Opportunités proposées en développant son réseau">
        <p>
          Le réseau est un levier de retour à l'emploi très puissant.
          On estime que seulement <strong>40% du marché de l'emploi est
          visible,</strong> c'est-à-dire que la plupart des embauches
          ne passe pas par des annonces.
        </p>
        <ApplicationModeChart applicationModes={applicationModes} />
        <p>
          Dans votre métier cette tendance est particulièrement prononcée.
          Le réseau est considéré comme le canal numéro 1 pour trouver
          un emploi devant les candidatures spontanées ou les intermédiaires de
          placement par exemple.
        </p>
      </Section>
      <Section header="Conclusion">
        {this.renderConclusion()}
      </Section>
    </div>
  }

  renderConclusion() {
    return <div>
      <p><strong>Nous vous encourageons à développer votre réseau.</strong></p>
      <p>
        Développer et mobiliser votre réseau en parallèle de vos candidatures
        vous aidera à affiner vos demandes et trouver un emploi plus
        facilement.
      </p>
      <p>
        Nous pouvons vous aider à cultiver votre réseau actuel pour
        l'enrichir, le développer et en faire un véritable atout pour
        retrouver un emploi.
      </p>
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      summary={<li>
        Le réseau semble être un atout essentiel pour trouver un emploi dans
        votre secteur.
      </li>}
      declineReasonTitle="Améliorer votre réseau ne vous convient pas&nbsp;?"
      declineReasonOptions={[
        'Je préfère passer par un autre canal de recrutement.',
        "J'ai déjà un très bon réseau et je l'utilise bien.",
        'Passer par mon réseau ne me convient pas.',
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage =
  connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


const AdviceCard = {
  color: Colors.RED_PINK,
  picto: <img src={require('images/network-picto.svg')} />,
}


export default {AdviceCard, RecommendPage}
