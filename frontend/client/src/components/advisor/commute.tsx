import {TFunction} from 'i18next'
import PropTypes from 'prop-types'
import React, {useCallback, useMemo} from 'react'
import {useTranslation} from 'react-i18next'

import {inCityPrefix, lowerFirstLetter} from 'store/french'

import {Trans} from 'components/i18n'
import {isMobileVersion} from 'components/mobile'
import {useRadium} from 'components/radium'
import {AppearingList, GrowingNumber, Tag} from 'components/theme'
import Picto from 'images/advices/picto-commute.svg'

import {CardProps, CardWithContentProps, PercentageBoxes,
  connectExpandedCardWithContent} from './base'


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
  color: colors.HOVER_GREEN,
  fontWeight: 'bold',
  marginRight: 0,
}


const CommuteCitySuggestionBase: React.FC<CommuteCitySuggestionProps> =
(props: CommuteCitySuggestionProps): React.ReactElement => {
  const {city: {name}, isTargetCity, onClick, style, targetCity: {name: targetName}} = props
  const handleClick = useCallback((): void => {
    // TODO(cyrille): Add INSEE code to avoid sending user to an homonymous city.
    const searchOrigin = encodeURIComponent(`${targetName}, france`)
    const searchTarget = encodeURIComponent(`${name}, france`)
    window.open(`https://www.google.fr/maps/dir/${searchOrigin}/${searchTarget}`, '_blank')
    onClick?.()
  }, [onClick, name, targetName])

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

  const {t} = useTranslation()

  const [radiumProps] = useRadium<HTMLDivElement>({style: containerStyle})

  if (isTargetCity) {
    const {hasComplexTarget} = props
    const {prefix, cityName} = inCityPrefix(name || '')
    const hasSimpleLayout = !hasComplexTarget || isMobileVersion
    return <div style={containerStyle} onClick={handleClick}>
      <span style={targetCityStyle}>
        {hasSimpleLayout ? t("Plus d'offres à\u00A0:") :
          t('{{cityName}}, votre ville', {cityName: name})}
      </span>
      <div style={{flex: 1}} />
      <div style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        {hasSimpleLayout ? null :
          t('Offres par habitant {{inCity}}\u00A0:', {inCity: prefix + cityName})}
      </div> {hasSimpleLayout ? null : <PercentageBoxes percentage={1} />}
    </div>
  }

  const {distanceKm = 0, relativeOffersPerInhabitant = 0} = props.city
  const roundedOffers = Math.round(relativeOffersPerInhabitant * 10) / 10

  const tagStyle = {
    backgroundColor: distanceKm > 20 ? colors.SQUASH : colors.GREENISH_TEAL,
  }

  return <div {...radiumProps} onClick={handleClick}>
    <span style={{fontWeight: 'bold', marginRight: 10}}>
      {name}
    </span>
    <Tag style={tagStyle}>
      {` à ${Math.round(distanceKm)} km`}
    </Tag>
    <div style={{flex: 1}} />
    <span>
      {roundedOffers > 1.1 ? <span style={{alignItems: 'center', display: 'flex'}}>
        <div style={multiplierStyle}>
          {roundedOffers}x plus
        </div> {isMobileVersion ? null : <PercentageBoxes percentage={roundedOffers} />}</span> :
        null}
    </span>
  </div>
}
CommuteCitySuggestionBase.propTypes = {
  city: PropTypes.shape({
    distanceKm: PropTypes.number,
    name: PropTypes.string.isRequired,
    relativeOffersPerInhabitant: PropTypes.number,
  }).isRequired,
  hasComplexTarget: PropTypes.bool,
  isTargetCity: PropTypes.bool,
  onClick: PropTypes.func,
  style: PropTypes.object,
  targetCity: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }).isRequired,
}
const CommuteCitySuggestion = React.memo(CommuteCitySuggestionBase)


type CommuteProps = CardWithContentProps<bayes.bob.CommutingCities>


const suggestionStyle = {marginTop: -1} as const


const Commute: React.FC<CommuteProps> = (props: CommuteProps): React.ReactElement|null => {
  const {
    adviceData: {cities = []},
    handleExplore,
    project: {city: targetCity = {}, targetJob: {jobGroup: {name: jobGroupName = ''} = {}} = {}},
    t,
  } = props

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
      {[targetCityList].concat(otherCitiesList)}
    </AppearingList>
  </div>
}
Commute.propTypes = {
  adviceData: PropTypes.shape({
    cities: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      relativeOffersPerInhabitant: PropTypes.number,
    })),
  }).isRequired,
  handleExplore: PropTypes.func.isRequired,
  project: PropTypes.shape({
    city: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
    targetJob: PropTypes.shape({
      jobGroup: PropTypes.shape({
        name: PropTypes.string.isRequired,
      }).isRequired,
    }),
  }).isRequired,
  t: PropTypes.func.isRequired,
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<bayes.bob.CommutingCities, CardProps>(React.memo(Commute))


export default {ExpandedAdviceCardContent, Picto}
