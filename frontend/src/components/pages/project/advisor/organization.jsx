import React from 'react'
import {connect} from 'react-redux'

import config from 'config'

import {AdvicePage, Section} from './base'
import {Colors} from 'components/theme'


class RecommendPageBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    project: React.PropTypes.object.isRequired,
  }

  renderDetailedAnalysis() {
    const chartStyle = {
      display: 'flex',
      justifyContent: 'space-around',
      marginTop: 15,
    }
    const itemStyle = {
      display: 'block',
      fontSize: 15,
      fontStyle: 'oblique',
      maxWidth: 165,
      padding: '5 5 5 0',
      textAlign: 'center',
    }
    const enjeuxStyle ={
      fontStyle: 'oblique',
      fontWeight: 500,
      margin: '35px 0 10px 0',
    }
    return <div>
      <Section header="Être encore plus efficace dans votre recherche">
        <p>
          La recherche d'emploi est un vrai travail qui demande de l'organisation et de la
          motivation pour rester efficace.
          C'est aussi une période pleine de défis durant laquelle il est important de préserver
          votre équilibre de vie et votre moral.
        </p>
        <div style={enjeuxStyle}>
          Principaux enjeux :
        </div>
        <div style={chartStyle}>
          <div style={itemStyle}>
            <div><img src={require('images/scale-picto.svg')} /></div>
            <div><span>Équilibrer vie privée et recherche d'emploi </span></div>
          </div>
          <div style={itemStyle}>
            <div><img src={require('images/check-picto.svg')}  /></div>
            <div><span>Utiliser des outils pour organiser votre recherche</span></div>
          </div>
          <div style={itemStyle}>
            <div><img src={require('images/morale-picto.svg')} /></div>
            <div><span>Garder votre moral au top</span></div>
          </div>
        </div>
      </Section>
      <Section header="Conclusion">
        {this.renderConclusion()}
      </Section>
    </div>
  }

  renderConclusion() {
    //TODO(pascal): Uniform conclusion margin accross advice.
    return <div style={{margin: '25px 0 15px 0'}}>
      Bien construire son quotidien est essentiel pour être efficace dans sa recherche d'emploi.
      Nous avons identifié quelques astuces qui pourront vous aider à non seulement accélérer votre
      recherche d'emploi mais aussi rendre votre quotidien plus agréable.
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      declineReasonTitle="Les conseils d'organisation ne vous intéressent pas&nbsp;?"
      declineReasonOptions={[
        `Je suis déjà bien organisé${maybeE}.`,
        'Je préfère recevoir ce type de conseils en personne.',
        "Ce n'est pas ce que je recherche en ce moment.",
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}
      summary={<div>
        <li>
          Nous avons identifié des outils et conseils pour optimiser votre recherche d'emploi.
        </li>
      </div>}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage =
  connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


const AdviceCard = {
  color: Colors.LIGHTER_PURPLE,
  picto: <img src={require('images/organize-picto.svg')} />,
}


export default {AdviceCard, RecommendPage}
