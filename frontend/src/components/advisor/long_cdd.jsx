import React from 'react'
import {connect} from 'react-redux'

import config from 'config'
import {lowerFirstLetter, upperFirstLetter} from 'store/french'
import {Colors} from 'components/theme'

import {AdvicePage, Section} from './base'

const computeContractToPercentage = employmentTypePercentages => {
  const contractToPercentage = {}
  employmentTypePercentages.forEach(element => {
    contractToPercentage[element.employmentType] = Math.round(element.percentage)
  })
  return contractToPercentage
}

const contractTypeNames = {
  CDD_LESS_EQUAL_3_MONTHS: 'CDD de courte durée',
  CDD_OVER_3_MONTHS: 'CDD de longue durée',
  CDI: 'CDI',
  INTERIM: 'intérim',
}


const renderStatisticsText = employmentTypePercentages => {
  // Computes the string containing detailed statistics about the job's contract types.
  const contractToPercentage = computeContractToPercentage(employmentTypePercentages)
  // If there is no long CDD or CDI stats, we don't give detailed statistics.
  if (!contractToPercentage.CDD_OVER_3_MONTHS || !contractToPercentage.CDI) {
    return ''
  }

  const otherContracts = ['CDI', 'CDD_LESS_EQUAL_3_MONTHS', 'INTERIM'].
    filter(contractType => contractToPercentage[contractType]).
    map(contractType =>
      `${contractToPercentage[contractType]}% en ${contractTypeNames[contractType]}`)

  const otherContractStrings = otherContracts.length ?
    [otherContracts.slice(0, -1).join(', '), otherContracts.slice(-1)[0]].join(', et ') : ''

  return <span>En effet, <strong>{contractToPercentage.CDD_OVER_3_MONTHS}%
    des offres publiées proposent des contrats à durée déterminée</strong>, contre
    seulement {otherContractStrings}.
    </span>
}

class ContractTypeChart extends React.Component {
  static propTypes = {
    contractTypes: React.PropTypes.arrayOf(React.PropTypes.object),
    highlightedContract: React.PropTypes.string,
  }

  renderBar(number, name, isHighlighted) {
    const titleStyle = {
      color: isHighlighted ? Colors.SLATE : Colors.COOL_GREY,
      fontSize: 16,
      fontStyle: 'italic',
      fontWeight: isHighlighted ? 'bold' : 'normal',
      lineHeight: 1.19,
      marginBottom: 15,
      marginLeft: 10,
    }
    const barStyle = {
      backgroundColor: Colors.SILVER,
      color: '#fff',
      display: 'inline-block',
      height: 38,
      lineHeight: 1,
      marginTop: 5,
      maxWidth: 400,
    }
    const fillStyle = {
      backgroundColor: isHighlighted ? Colors.GREENISH_TEAL : Colors.SLATE,
      fontWeight: 'bold',
      height: 38,
      padding: 13,
      width: number * 4,
    }
    return <div style={{maxWidth: 600}} key={name}>
      <div style={barStyle}>
        <div style={fillStyle}>
          {Math.round(number)}%
        </div>
      </div>
      <span style={titleStyle}>
        {upperFirstLetter(contractTypeNames[name])}
      </span>
    </div>
  }

  render() {
    const {contractTypes, highlightedContract} = this.props

    // Sorting contract type
    contractTypes.sort((first, second) => {
      return second.percentage - first.percentage
    })
    const knownContractTypes = contractTypes.filter(el => el.employmentType in contractTypeNames)
    const barChart = knownContractTypes.map(
      element => this.renderBar(
        element.percentage, element.employmentType, element.employmentType === highlightedContract))

    // Creating the chart
    return <div style={{display: 'flex', flexDirection: 'column', marginTop: 0}}>
      {barChart}
    </div>
  }
}


class RecommendPageBase extends React.Component {
  static propTypes = {
    gender: React.PropTypes.string,
    project: React.PropTypes.object.isRequired,
  }

  renderDetailedAnalysis() {
    const {project} = this.props
    const employmentTypePercentages = project.localStats && project.localStats.imt &&
      project.localStats.imt.employmentTypePercentages || []

    return <div>
      <Section header="Opportunités proposées avec d'autres contrats">
        <p>
          Il y a plus de possibilité d'emploi avec un contrat en CDD longue durée
          pour {lowerFirstLetter(project.title)}. {renderStatisticsText(employmentTypePercentages)}
        </p>
        <ContractTypeChart
            contractTypes={employmentTypePercentages} highlightedContract="CDD_OVER_3_MONTHS" />
      </Section>
      <Section header="Conclusion">
        {this.renderConclusion()}
      </Section>
    </div>
  }

  renderConclusion() {
    return <div>
      <p><strong>Nous pensons que d'autres contrats et en particulier les CDD peuvent vous offrir
        plus d'opportunités.</strong></p>
      <p>
        Les offres en CDD longue durée sont plus nombreuses.
        Un CDD peut paraitre moins stable mais c'est en général une bonne passerelle vers un CDI.
      </p>
      <p>
        Pour vous guider dans cette démarche, nous vous accompagnerons pas à pas
        pour définir le meilleur contrat pour vous.
      </p>
    </div>
  }

  render() {
    const {gender, project, ...extraProps} = this.props
    const maybeE = gender === 'FEMININE' ? 'e' : ''
    return <AdvicePage
      {...extraProps} project={project}
      declineReasonTitle="Les CDD, même longue durée, ne vous conviennent pas&nbsp;?"
      declineReasonOptions={[
        "Les CDDs longue durée ne m'intéressent pas.",
        "J'ai déjà fait plusieurs CDDs longue durée.",
        'Je ne recherche que des CDIs.',
        `Les conseils de ${config.productName} ne m'ont pas convaincu${maybeE}.`,
      ]}
      summary={<div>
        <li>
          Les offres d'emploi en CDI dans votre métier sont peu nombreuses.
        </li>
        <li>
          Mais d'autres contrats semblent offrir plus d'opportunités.
        </li>
      </div>}>
      {this.renderDetailedAnalysis()}
    </AdvicePage>
  }
}
const RecommendPage =
  connect(({user}) => ({gender: user.profile.gender}))(RecommendPageBase)


export default {RecommendPage}
