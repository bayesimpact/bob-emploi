import type {TFunction} from 'i18next'
import React, {useCallback, useMemo} from 'react'

import {inCityPrefix, lowerFirstLetter} from 'store/french'
import isMobileVersion from 'store/mobile'

import AppearingList from 'components/appearing_list'
import GrowingNumber from 'components/growing_number'
import Trans from 'components/i18n_trans'
import {useRadium} from 'components/radium'
import Tag from 'components/tag'

import type {CardProps} from './base'
import {PercentageBoxes, useAdviceData} from './base'


interface CommuteCitySuggestionProps {
  city: bayes.bob.CommutingCity
  hasComplexTarget?: boolean
  isTargetCity?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  t: TFunction
  targetCity: bayes.bob.FrenchCity
}


const targetCityStyle: React.CSSProperties = {
  fontStyle: 'italic',
  fontWeight: 'bold',
  marginRight: 10,
}
const multiplierStyle: React.CSSProperties = {
  color: colors.LIME_GREEN,
  fontWeight: 'bold',
  marginRight: 0,
}


const CommuteCitySuggestionBase: React.FC<CommuteCitySuggestionProps> =
(props: CommuteCitySuggestionProps): React.ReactElement => {
  const {
    city: {distanceKm = 0, name, relativeOffersPerInhabitant = 0},
    isTargetCity, onClick, style, t, targetCity: {name: targetName},
  } = props
  const handleClick = useCallback((): void => {
    // TODO(cyrille): Add INSEE code to avoid sending user to an homonymous city.
    const searchOrigin = encodeURIComponent(`${targetName}, ${config.countryName}`)
    const searchTarget = encodeURIComponent(`${name}, ${config.countryName}`)
    window.open(`https://${config.googleTopLevelDomain}/maps/dir/${searchOrigin}/${searchTarget}`, '_blank')
    onClick?.()
  }, [onClick, name, targetName])

  const containerStyle = useMemo((): RadiumCSSProperties => ({
    ':hover': {
      backgroundColor: colors.LIGHT_GREY,
    },
    'alignItems': 'center',
    'backgroundColor': '#fff',
    'border': `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    'color': 'inherit',
    'display': 'flex',
    'fontSize': 13,
    'fontWeight': 'bold',
    'height': 50,
    'padding': '0 20px',
    'width': '100%',
    ...style,
  }), [style])

  const [radiumProps] = useRadium<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    {style: containerStyle})

  if (isTargetCity) {
    const {hasComplexTarget} = props
    const {prefix, cityName} = inCityPrefix(name || '', t)
    const hasSimpleLayout = !hasComplexTarget || isMobileVersion
    return <button style={containerStyle} onClick={handleClick} type="button">
      <span style={targetCityStyle}>
        {hasSimpleLayout ? t("Plus d'offres à\u00A0:") :
          t('{{cityName}}, votre ville', {cityName: name})}
      </span>
      <span style={{flex: 1}} />
      <span style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        {hasSimpleLayout ? null :
          t('Offres par habitant {{inCity}}\u00A0:', {inCity: prefix + cityName})}
      </span> {hasSimpleLayout ? null : <PercentageBoxes percentage={1} />}
    </button>
  }

  const roundedOffers = Math.round(relativeOffersPerInhabitant * 10) / 10

  const tagStyle = {
    backgroundColor: distanceKm > 20 ? colors.SQUASH : colors.GREENISH_TEAL,
  }

  return <button {...radiumProps} onClick={handleClick} type="button">
    <span style={{fontWeight: 'bold', marginRight: 10}}>
      {name}
    </span>
    <Tag style={tagStyle}>
      {` à ${Math.round(distanceKm)} km`}
    </Tag>
    <span style={{flex: 1}} />
    <span>
      {roundedOffers > 1.1 ? <span style={{alignItems: 'center', display: 'flex'}}>
        <span style={multiplierStyle}>
          {roundedOffers}x plus
        </span> {isMobileVersion ? null : <PercentageBoxes percentage={roundedOffers} />}</span> :
        null}
    </span>
  </button>
}
const CommuteCitySuggestion = React.memo(CommuteCitySuggestionBase)


const suggestionStyle = {marginTop: -1} as const


const Commute: React.FC<CardProps> = (props: CardProps): React.ReactElement|null => {
  const {
    handleExplore,
    project: {city: targetCity = {}, targetJob: {jobGroup: {name: jobGroupName = ''} = {}} = {}},
    t,
  } = props
  const {data: {cities = []}, loading} = useAdviceData<bayes.bob.CommutingCities>(props)

  const targetCityName = targetCity.name
  const otherCities = useMemo(
    () => cities.filter(({name}): boolean => name !== targetCityName).slice(0, 6),
    [cities, targetCityName],
  )
  const otherCitiesList = useMemo(
    () => otherCities.map((city, index): ReactStylableElement =>
      <CommuteCitySuggestion
        key={`city-${index}`}
        {...{city, t, targetCity}}
        style={suggestionStyle} onClick={handleExplore('city')} />),
    [otherCities, handleExplore, t, targetCity],
  )

  if (loading) {
    return loading
  }

  if (!otherCitiesList.length) {
    return null
  }

  const targetCityList: ReactStylableElement = <CommuteCitySuggestion
    key="target-city"
    city={targetCity}
    // If there are no informations on relative offers, avoid expressing it as a comparison.
    hasComplexTarget={!!otherCities[0].relativeOffersPerInhabitant}
    targetCity={targetCity}
    isTargetCity={true}
    t={t} />

  return <div>
    <Trans t={t} count={otherCitiesList.length}>
      Cette <GrowingNumber
        style={{fontWeight: 'bold'}} number={otherCitiesList.length} isSteady={true} />{' '}ville
      proche de chez vous a beaucoup embauché en <strong>
        {{jobGroupName: lowerFirstLetter(jobGroupName)}}
      </strong> ces deux dernières années&nbsp;:
    </Trans>
    <AppearingList style={{marginTop: 15}}>
      {[targetCityList, ...otherCitiesList]}
    </AppearingList>
  </div>
}
const ExpandedAdviceCardContent = React.memo(Commute)


export default {ExpandedAdviceCardContent, pictoName: 'suitcase' as const}
