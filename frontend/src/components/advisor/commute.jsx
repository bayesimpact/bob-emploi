import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'
import {connect} from 'react-redux'

import {getCommutingCities} from 'store/actions'
import {inCityPrefix, lowerFirstLetter} from 'store/french'

import {AppearingList, Colors, GrowingNumber, PaddedOnMobile, StringJoiner,
  Styles, Tag} from 'components/theme'

import {PercentageBoxes} from './base'


const maybeS = count => count > 1 ? 's' : ''

class AdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
  }

  render() {
    const {advice, project} = this.props

    const {cities} = advice.commuteData
    if (!cities || !cities.length) {
      return null
    }

    return <div>
      <div style={{fontSize: 30}}>
        Et si demain vous travailliez <StringJoiner>
          {cities.slice(0, 3).map((name, index) => {
            const {cityName, prefix} = inCityPrefix(name)
            return <span key={`city-${index}`}>
              {prefix}<strong>{cityName}</strong>
            </span>
          })}
        </StringJoiner>&nbsp;?
        {cities.length > 1 ? ' Ces villes ont' : ' Cette ville a'} beaucoup
        embauché en <strong>
          {lowerFirstLetter(project.targetJob.jobGroup.name)}
        </strong> ces deux dernières années.
      </div>
    </div>
  }
}


class ExpandedAdviceCardContentBase extends React.Component {
  static propTypes = {
    cities: PropTypes.array.isRequired,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
  }

  componentWillMount() {
    const {cities, dispatch, project} = this.props
    if (!cities.length) {
      dispatch(getCommutingCities(project))
    }
  }

  computeAllCities() {
    const {cities, project} = this.props

    const interestingCities =
      cities.filter(({name}) => name !== project.mobility.city.name).slice(0, 6)
    interestingCities.sort(function(a, b) {
      return b.relativeOffersPerInhabitant - a.relativeOffersPerInhabitant
    })

    const otherCitiesList = interestingCities.map((city, index) => <CommuteCitySuggestion
      key={`city-${index}`}
      city={city}
      targetCity={project.mobility.city}
      style={{marginTop: -1}} />)

    return otherCitiesList
  }

  render() {
    const {project} = this.props
    const otherCities = this.computeAllCities()

    if (!otherCities.length) {
      return null
    }

    const targetCityList = <CommuteCitySuggestion
      key="target-city"
      city={project.mobility.city}
      targetCity={project.mobility.city}
      isTargetCity={true} />

    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        {(otherCities.length > 1) ? 'Ces' : 'Cette'} <GrowingNumber
          style={{fontWeight: 'bold'}} number={otherCities.length} isSteady={true} />{' '}ville
        {maybeS(otherCities.length)} proche{maybeS(otherCities.length)} de chez
        vous {otherCities.length > 1 ? 'ont' : 'a'} beaucoup
        embauché en <strong>
          {lowerFirstLetter(project.targetJob.jobGroup.name)}
        </strong> ces deux dernières années :
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {[targetCityList].concat(otherCities)}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => {
  const {cities} = (app.adviceData[project.projectId] || {}).commute || {}
  return {cities: cities || []}
})(ExpandedAdviceCardContentBase)


class CommuteCitySuggestionBase extends React.Component {
  static propTypes = {
    city: PropTypes.object.isRequired,
    isTargetCity: PropTypes.bool,
    style: PropTypes.object,
    targetCity: PropTypes.object.isRequired,
  }

  handleClick = () => {
    const {city, targetCity} = this.props
    const searchOrigin = encodeURIComponent(`${targetCity.name}, france`)
    const searchTarget = encodeURIComponent(`${city.name}, france`)
    window.open(`https://www.google.fr/maps/dir/${searchOrigin}/${searchTarget}`, '_blank')
  }

  renderTargetCity(style) {
    const {city} = this.props
    const {prefix, cityName} = inCityPrefix(city.name)
    const targetCityStyle = {
      fontStyle: 'italic',
      fontWeight: 'bold',
      marginRight: 10,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <div style={style} onClick={this.handleClick}>
      <span style={targetCityStyle}>
        {city.name} (votre ville)
      </span>
      <div style={{flex: 1}} />
      <div style={{fontStyle: 'italic', fontWeight: 'normal'}}>
        Offres par habitant {prefix}{cityName} :
      </div> <PercentageBoxes percentage={1} />
    </div>
  }

  renderOtherCity(style) {
    const {city} = this.props
    const multiplierStyle = {
      color: Colors.HOVER_GREEN,
      fontWeight: 'bold',
      marginRight: 0,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    const roundedOffers = Math.round(city.relativeOffersPerInhabitant * 10) / 10

    const tagStyle = {
      backgroundColor: city.distanceKm > 20 ? Colors.SQUASH : Colors.GREENISH_TEAL,
    }

    return <div style={style} onClick={this.handleClick}>
      <span style={{fontWeight: 'bold', marginRight: 10, ...Styles.CENTER_FONT_VERTICALLY}}>
        {city.name}
      </span>
      <Tag style={tagStyle}>
        {` à ${Math.round(city.distanceKm)} km`}
      </Tag>
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
    const {isTargetCity, style} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: Colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
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


export default {AdviceCard, ExpandedAdviceCardContent}
