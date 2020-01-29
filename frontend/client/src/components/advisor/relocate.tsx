import PropTypes from 'prop-types'
import React from 'react'

import {inDepartement, lowerFirstLetter, maybeContractPrefix} from 'store/french'

import {RadiumDiv} from 'components/radium'
import {AppearingList, GrowingNumber} from 'components/theme'
import Picto from 'images/advices/picto-relocate.svg'

import {CardProps, CardWithContentProps, PercentageBoxes,
  connectExpandedCardWithContent} from './base'


const maybeS = (count: number): string => count > 1 ? 's' : ''


class RelocateMethod extends React.PureComponent<CardWithContentProps<bayes.bob.RelocateData>> {
  public static propTypes = {
    adviceData: PropTypes.shape({
      departementScores: PropTypes.arrayOf(PropTypes.object.isRequired),
    }).isRequired,
    handleExplore: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
  }

  private computeAllDepartements(): React.ReactElement<SuggestionProps>[] {
    const {adviceData: {departementScores = []}, handleExplore} = this.props

    const otherDepartementsList = departementScores.map(
      (score, index): React.ReactElement<SuggestionProps> => <RelocateDepartmentSuggestion
        key={`dep-${index}`} onClick={handleExplore('departement')}
        departementScore={score}
        style={{marginTop: -1}} />)
    return otherDepartementsList
  }

  public render(): React.ReactNode {
    const {handleExplore, project: {
      city,
      targetJob: {jobGroup: {name = ''} = {}} = {},
    }} = this.props
    const inDepartementText = city && inDepartement(city) || 'dans votre département'
    const otherDepartements = this.computeAllDepartements()

    if (!otherDepartements.length) {
      return null
    }

    const targetDepList = <RelocateDepartmentSuggestion
      key="target-dep" onClick={handleExplore('target')}
      departementScore={{name: city && city.departementName || ''}}
      isTargetDepartment={true} />

    return <div>
      <div>
        Il y a plus d'offres par candidat en <strong>
          {lowerFirstLetter(name)} </strong>
        dans {(otherDepartements.length > 1) ? 'ces ' : 'ce '}
        <GrowingNumber
          style={{fontWeight: 'bold'}} number={otherDepartements.length} isSteady={true} />
        {' '}département{maybeS(otherDepartements.length)}
        {maybeContractPrefix(' que ', " qu'", inDepartementText)}&nbsp;:
      </div>
      <AppearingList style={{marginTop: 15}}>
        {[targetDepList].concat(otherDepartements)}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.RelocateData, CardProps>(RelocateMethod)


interface SuggestionProps {
  departementScore: bayes.bob.DepartementScore
  isTargetDepartment?: boolean
  onClick: () => void
  style?: React.CSSProperties
}


class RelocateDepartmentSuggestion extends React.PureComponent<SuggestionProps> {
  public static propTypes = {
    departementScore: PropTypes.object.isRequired,
    isTargetDepartment: PropTypes.bool,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  private handleClick = (): void => {
    const {departementScore, onClick} = this.props
    const searchTerm = encodeURIComponent(`${departementScore.name} département, france`)
    window.open(`https://www.google.fr/maps/search/${searchTerm}`, '_blank')
    onClick && onClick()
  }

  private renderTargetDepartment(style: RadiumCSSProperties): React.ReactNode {
    const {departementScore} = this.props
    const targetDepartmentStyle: React.CSSProperties = {
      fontStyle: 'italic',
      fontWeight: 'bold',
      marginRight: 10,
    }
    return <RadiumDiv style={style} onClick={this.handleClick}>
      <span style={targetDepartmentStyle}>
        {departementScore.name} (votre département, pour comparer)
      </span>
      <div style={{flex: 1}} />
      <div style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        Offres par candidat&nbsp;:
      </div> <PercentageBoxes percentage={1} />
    </RadiumDiv>
  }

  private renderOtherDepartement(style: RadiumCSSProperties): React.ReactNode {
    const {departementScore} = this.props
    const multiplierStyle: React.CSSProperties = {
      color: colors.HOVER_GREEN,
      fontWeight: 'bold',
      marginRight: 0,
    }
    const roundedOffers = Math.round((departementScore.offerRatio || 0) * 10) / 10

    return <RadiumDiv style={style} onClick={this.handleClick}>
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
    </RadiumDiv>
  }

  public render(): React.ReactNode {
    const {isTargetDepartment, style} = this.props
    const containerStyle: RadiumCSSProperties = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      'alignItems': 'center',
      'backgroundColor': '#fff',
      'border': `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      'cursor': 'pointer',
      'display': 'flex',
      'fontSize': 13,
      'fontWeight': 'bold',
      'height': 50,
      'padding': '0 20px',
      ...style,
    }
    if (isTargetDepartment) {
      return this.renderTargetDepartment(containerStyle)
    }
    return this.renderOtherDepartement(containerStyle)
  }
}


export default {ExpandedAdviceCardContent, Picto}
