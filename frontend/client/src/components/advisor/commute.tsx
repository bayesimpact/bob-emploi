import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'

import {YouChooser, inCityPrefix, lowerFirstLetter} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {AppearingList, GrowingNumber, Tag} from 'components/theme'
import NewPicto from 'images/advices/picto-commute.svg'

import {CardProps, CardWithContentProps, PercentageBoxes, connectExpandedCardWithContent,
  makeTakeAwayFromAdviceData} from './base'


const maybeS = (count: number): string => count > 1 ? 's' : ''


class ExpandedAdviceCardContentBase
  extends React.PureComponent<CardWithContentProps<bayes.bob.CommutingCities>> {
  public static propTypes = {
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
    userYou: PropTypes.func.isRequired,
  }

  private getOtherCities(): bayes.bob.CommutingCity[] {
    const {adviceData: {cities = []}, project: {city: targetCity = {}}} = this.props

    return cities.filter(({name}): boolean => name !== targetCity.name).slice(0, 6)
  }

  private computeAllCities(): ReactStylableElement[] {
    const {handleExplore, project: {city: targetCity = {}}, userYou} = this.props
    const interestingCities = this.getOtherCities()

    const otherCitiesList = interestingCities.map((city, index): ReactStylableElement =>
      <CommuteCitySuggestion
        key={`city-${index}`}
        {...{city, targetCity, userYou}}
        style={{marginTop: -1}} onClick={handleExplore('city')} />)

    return otherCitiesList
  }

  public render(): React.ReactNode {
    const {project: {city = {}, targetJob = {}}, userYou} = this.props
    const otherCities = this.getOtherCities()
    const otherCitiesList = this.computeAllCities()

    if (!otherCitiesList.length) {
      return null
    }

    const targetCityList: ReactStylableElement = <CommuteCitySuggestion
      key="target-city"
      city={city}
      // If there are no informations on relative offers, avoid expressing it as a comparison.
      hasComplexTarget={!!otherCities[0].relativeOffersPerInhabitant}
      targetCity={city}
      isTargetCity={true}
      userYou={userYou} />

    return <div>
      <div>
        {(otherCitiesList.length > 1) ? 'Ces' : 'Cette'} <GrowingNumber
          style={{fontWeight: 'bold'}} number={otherCitiesList.length} isSteady={true} />{' '}ville
        {maybeS(otherCitiesList.length)} proche{maybeS(otherCitiesList.length)} de chez
        {userYou(' toi', ' vous')} {otherCitiesList.length > 1 ? 'ont' : 'a'} beaucoup
        embauché en <strong>
          {lowerFirstLetter(targetJob.jobGroup.name)}
        </strong> ces deux dernières années :
      </div>
      <AppearingList style={{marginTop: 15}}>
        {[targetCityList].concat(otherCitiesList)}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent =
  connectExpandedCardWithContent<{}, bayes.bob.CommutingCities, CardProps>()(
    ExpandedAdviceCardContentBase)


interface CommuteCitySuggestionProps {
  city: bayes.bob.CommutingCity
  hasComplexTarget?: boolean
  isTargetCity?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  targetCity: bayes.bob.FrenchCity
  userYou: YouChooser
}

class CommuteCitySuggestionBase extends React.Component<CommuteCitySuggestionProps> {
  public static propTypes = {
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
    userYou: PropTypes.func.isRequired,
  }

  private handleClick = (): void => {
    const {city: {name}, onClick, targetCity: {name: targetName}} = this.props
    // TODO(cyrille): Add INSEE code to avoid sending user to an homonymous city.
    const searchOrigin = encodeURIComponent(`${targetName}, france`)
    const searchTarget = encodeURIComponent(`${name}, france`)
    window.open(`https://www.google.fr/maps/dir/${searchOrigin}/${searchTarget}`, '_blank')
    onClick && onClick()
  }

  public renderTargetCity(style: React.CSSProperties): React.ReactNode {
    const {city: {name}, hasComplexTarget, userYou} = this.props
    const {prefix, cityName} = inCityPrefix(name)
    const hasSimpleLayout = !hasComplexTarget || isMobileVersion
    const targetCityStyle: React.CSSProperties = {
      fontStyle: 'italic',
      fontWeight: 'bold',
      marginRight: 10,
    }
    return <div style={style} onClick={this.handleClick}>
      <span style={targetCityStyle}>
        {hasSimpleLayout ? "Plus d'offres à\u00A0:" :
          `${name} ${userYou('ta', 'votre')} ville`}
      </span>
      <div style={{flex: 1}} />
      <div style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        {hasSimpleLayout ? null : `Offres par habitant ${prefix}${cityName}\u00A0:`}
      </div> {hasSimpleLayout ? null : <PercentageBoxes percentage={1} />}
    </div>
  }

  private renderOtherCity(style: React.CSSProperties): React.ReactNode {
    const {distanceKm, name, relativeOffersPerInhabitant} = this.props.city
    const multiplierStyle: React.CSSProperties = {
      color: colors.HOVER_GREEN,
      fontWeight: 'bold',
      marginRight: 0,
    }
    const roundedOffers = Math.round(relativeOffersPerInhabitant * 10) / 10

    const tagStyle = {
      backgroundColor: distanceKm > 20 ? colors.SQUASH : colors.GREENISH_TEAL,
    }

    return <div style={style} onClick={this.handleClick}>
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

  public render(): React.ReactNode {
    const {isTargetCity, style} = this.props
    const containerStyle: RadiumCSSProperties = {
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
    if (isTargetCity) {
      return this.renderTargetCity(containerStyle)
    }
    return this.renderOtherCity(containerStyle)
  }
}
const CommuteCitySuggestion = Radium(CommuteCitySuggestionBase)


const TakeAway = makeTakeAwayFromAdviceData(
  ({cities}: bayes.bob.CommutingCities): bayes.bob.CommutingCity[] => cities, 'ville', true)


export default {ExpandedAdviceCardContent, NewPicto, TakeAway}
