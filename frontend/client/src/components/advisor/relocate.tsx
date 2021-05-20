import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'

import {lowerFirstLetter, thanInDepartement} from 'store/french'

import AppearingList from 'components/appearing_list'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {RadiumDiv} from 'components/radium'
import Picto from 'images/advices/picto-relocate.svg'

import {CardProps, PercentageBoxes, useAdviceData} from './base'


const emptyArray = [] as const


const RelocateMethod = (props: CardProps): React.ReactElement|null => {
  const {handleExplore, project: {
    city,
    targetJob: {jobGroup: {name = ''} = {}} = {},
  }, t} = props
  const {data: {departementScores = emptyArray}, loading} =
    useAdviceData<bayes.bob.RelocateData>(props)

  const otherDepartements = useMemo((): React.ReactElement<SuggestionProps>[] =>
    departementScores.map(
      (score, index): React.ReactElement<SuggestionProps> => <RelocateDepartmentSuggestion
        key={`dep-${index}`} onClick={handleExplore('departement')}
        departementScore={score}
        style={{marginTop: -1}} t={t} />),
  [departementScores, handleExplore, t])

  if (loading) {
    return loading
  }

  if (!otherDepartements.length) {
    return null
  }

  const thanInDepartementText =
    city && thanInDepartement(city, t) || t('que dans votre département')

  const targetDepList = <RelocateDepartmentSuggestion
    key="target-dep" onClick={handleExplore('target')}
    departementScore={{name: city && city.departementName || ''}}
    isTargetDepartment={true} t={t} />

  return <div>
    <Trans count={otherDepartements.length} t={t}>
      Il y a plus d'offres par candidat en <strong>
        {{jobGroupName: lowerFirstLetter(name)}}
      </strong> dans ce <GrowingNumber
        style={{fontWeight: 'bold'}} number={otherDepartements.length} isSteady={true} />
      {' '}département {{thanInDepartementText}}&nbsp;:
    </Trans>
    <AppearingList style={{marginTop: 15}}>
      {[targetDepList, ...otherDepartements]}
    </AppearingList>
  </div>
}
RelocateMethod.propTypes = {
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.object.isRequired,
}
const ExpandedAdviceCardContent = React.memo(RelocateMethod)


interface SuggestionProps {
  departementScore: bayes.bob.DepartementScore
  isTargetDepartment?: boolean
  onClick: () => void
  style?: React.CSSProperties
  t: TFunction
}


const RelocateDepartmentSuggestionBase = (props: SuggestionProps): React.ReactElement => {
  const {departementScore, isTargetDepartment, onClick, style, t} = props
  const handleClick = useCallback((): void => {
    const searchTerm = encodeURIComponent(
      `${departementScore.name} ${config.geoAdmin2Name}, ${config.countryName}`)
    window.open(`https://${config.googleTopLevelDomain}/maps/search/${searchTerm}`, '_blank')
    onClick && onClick()
  }, [departementScore, onClick])

  const containerStyle = useMemo((): RadiumCSSProperties => ({
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
  }), [style])

  if (isTargetDepartment) {
    const targetDepartmentStyle: React.CSSProperties = {
      fontStyle: 'italic',
      fontWeight: 'bold',
      marginRight: 10,
    }
    return <RadiumDiv style={containerStyle} onClick={handleClick}>
      <Trans t={t} style={targetDepartmentStyle} parent="span">
        {{departementName: departementScore.name}} (votre département, pour comparer)
      </Trans>
      <div style={{flex: 1}} />
      <Trans t={t} style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        Offres par candidat&nbsp;:
      </Trans> <PercentageBoxes percentage={1} />
    </RadiumDiv>
  }

  const multiplierStyle: React.CSSProperties = {
    color: colors.LIME_GREEN,
    fontWeight: 'bold',
    marginRight: 0,
  }
  const roundedOffers = Number.parseFloat((departementScore.offerRatio || 0).toPrecision(2))

  return <RadiumDiv style={containerStyle} onClick={handleClick}>
    <span style={{fontWeight: 'bold', marginRight: 10}}>
      {departementScore.name}
    </span>
    <div style={{flex: 1}} />
    <span>
      {roundedOffers > 1.1 ? <span style={{alignItems: 'center', display: 'flex'}}>
        <Trans style={multiplierStyle} t={t}>
          {{roundedOffers}}x plus
        </Trans> <PercentageBoxes percentage={roundedOffers} /></span> : null}
    </span>
  </RadiumDiv>
}
RelocateDepartmentSuggestionBase.propTypes = {
  departementScore: PropTypes.object.isRequired,
  isTargetDepartment: PropTypes.bool,
  onClick: PropTypes.func,
  style: PropTypes.object,
}
const RelocateDepartmentSuggestion = React.memo(RelocateDepartmentSuggestionBase)



export default {ExpandedAdviceCardContent, Picto}
