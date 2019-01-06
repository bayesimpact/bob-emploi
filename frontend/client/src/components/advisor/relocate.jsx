import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'

import {lowerFirstLetter} from 'store/french'

import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-relocate.png'

import {PercentageBoxes, connectExpandedCardWithContent} from './base'


const maybeS = count => count > 1 ? 's' : ''

class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    adviceData: PropTypes.shape({
      departementScores: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    onExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
  }

  computeAllDepartements() {
    const {adviceData: {departementScores = []}, onExplore} = this.props

    const otherDepartementsList = departementScores.map(
      (departementScore, index) => <RelocateDepartmentSuggestion
        key={`dep-${index}`} onClick={() => onExplore('departement')}
        departementScore={departementScore}
        style={{marginTop: -1}} />)
    return otherDepartementsList
  }

  render() {
    const {onExplore, project} = this.props
    const otherDepartements = this.computeAllDepartements()

    if (!otherDepartements.length) {
      return null
    }

    const targetDepList = <RelocateDepartmentSuggestion
      key="target-dep" onClick={() => onExplore('target')}
      departementScore={{name: project.city.departementName}}
      isTargetDepartment={true} />

    return <div>
      <div>
        {(otherDepartements.length > 1) ? 'Ces ' : 'Ce '}<GrowingNumber
          style={{fontWeight: 'bold'}} number={otherDepartements.length} isSteady={true} />
        {' '}département{maybeS(otherDepartements.length)}
        {otherDepartements.length > 1 ? ' ont' : ' a'} plus d'offres par candidats en <strong>
          {lowerFirstLetter(project.targetJob.jobGroup.name)}</strong>&nbsp;:
      </div>
      <AppearingList style={{marginTop: 15}}>
        {[targetDepList].concat(otherDepartements)}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent = connectExpandedCardWithContent()(ExpandedAdviceCardContentBase)


class RelocateDepartmentSuggestionBase extends React.Component {
  static propTypes = {
    departementScore: PropTypes.object.isRequired,
    isTargetDepartment: PropTypes.bool,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  handleClick = () => {
    const {departementScore, onClick} = this.props
    const searchTerm = encodeURIComponent(`${departementScore.name} département, france`)
    window.open(`https://www.google.fr/maps/search/${searchTerm}`, '_blank')
    onClick && onClick()
  }

  renderTargetDepartment(style) {
    const {departementScore} = this.props
    const targetDepartmentStyle = {
      fontStyle: 'italic',
      fontWeight: 'bold',
      marginRight: 10,
    }
    return <div style={style} onClick={this.handleClick}>
      <span style={targetDepartmentStyle}>
        {departementScore.name} (votre département)
      </span>
      <div style={{flex: 1}} />
      <div style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        Offres par habitant&nbsp;:
      </div> <PercentageBoxes percentage={1} />
    </div>
  }

  renderOtherDepartement(style) {
    const {departementScore} = this.props
    const multiplierStyle = {
      color: colors.HOVER_GREEN,
      fontWeight: 'bold',
      marginRight: 0,
    }
    const roundedOffers = Math.round(departementScore.offerRatio * 10) / 10

    return <div style={style} onClick={this.handleClick}>
      <span style={{fontWeight: 'bold', marginRight: 10}}>
        {departementScore.name}
      </span>
      <div style={{flex: 1}} />
      <span>
        {roundedOffers > 1.1 ? <span style={{alignItems: 'center', display: 'flex'}}>
          <div style={multiplierStyle}>
            {roundedOffers}x plus
          </div> <PercentageBoxes percentage={roundedOffers} /></span> : null}
      </span>
    </div>
  }

  render() {
    const {isTargetDepartment, style} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      height: 50,
      padding: '0 20px',
      ...style,
    }
    if (isTargetDepartment) {
      return this.renderTargetDepartment(containerStyle)
    }
    return this.renderOtherDepartement(containerStyle)
  }
}
const RelocateDepartmentSuggestion = Radium(RelocateDepartmentSuggestionBase)


export default {ExpandedAdviceCardContent, Picto}
