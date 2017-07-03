import React from 'react'
import PropTypes from 'prop-types'
import Radium from 'radium'
import {connect} from 'react-redux'

import {getCommutingCities} from 'store/actions'
import {inCityPrefix} from 'store/french'

import {AppearingList, Colors, GrowingNumber, PaddedOnMobile, Styles, Tag} from 'components/theme'

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

    const cityNames = cities.slice(0, 3)
    const lastCity = cityNames.pop()

    // TODO(guillaume): Fix case where we have "à Les Ulis" ou "à Le Champex".
    // TODO(guillaume): Do the joining of city names with commas and "ou" in a separate component.
    return <div>
      <div style={{fontSize: 30}}>
        Et si demain vous travailliez à
        {cities.length <= 1 ? <span><strong> {lastCity}</strong> ?</span> : <span>
          <strong> {cityNames.join(', ')}</strong> ou <strong> {lastCity}</strong> ?</span>}
        {cities.length > 1 ? ' Ces villes ont' : ' Cette ville a'} beaucoup
        embauché en <strong>{project.targetJob.jobGroup.name}</strong> ces deux dernières années.
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

    const targetCityList = <CommuteCitySuggestion
      key="target-city"
      city={project.mobility.city}
      targetCity={project.mobility.city}
      isTargetCity={true} />

    const otherCitiesList = interestingCities.map((city, index) => <CommuteCitySuggestion
      key={`city-${index}`}
      city={city}
      targetCity={project.mobility.city}
      style={{marginTop: -1}} />)

    return [targetCityList].concat(otherCitiesList)
  }

  render() {
    const {cities, project} = this.props
    const allCities = this.computeAllCities()

    return <div>
      <PaddedOnMobile style={{fontSize: 21}}>
        Ces <GrowingNumber
          style={{fontWeight: 'bold'}} number={allCities.length - 1} isSteady={true} />{' '}ville
        {maybeS(cities.length)} proche de chez vous {cities.length > 1 ? 'ont' : 'a'} beaucoup
        embauché en <strong>{project.targetJob.jobGroup.name}</strong> ces deux dernières années :
      </PaddedOnMobile>
      <AppearingList style={{marginTop: 15}}>
        {allCities}
      </AppearingList>
    </div>
  }
}
const ExpandedAdviceCardContent = connect(({app}, {project}) => ({
  cities: app.commutingCities[project.projectId] || [],
}))(ExpandedAdviceCardContentBase)


class CommuteCitySuggestionBase extends React.Component {
  static propTypes = {
    city: PropTypes.object.isRequired,
    isTargetCity: PropTypes.object,
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
    // In French, "compared to" matches with inCityPrefix.
    const {prefix, cityName} = inCityPrefix(city.name)
    return <div style={style} onClick={this.handleClick}>
      <div style={{flex: 1}} />
      <div style={{fontWeight: 'normal', ...Styles.CENTER_FONT_VERTICALLY}}>
        Offres par habitant comparé {prefix}{cityName}
      </div>
    </div>
  }

  renderOtherCity(style) {
    const {city} = this.props
    const multiplierStyle = {
      color: Colors.HOVER_GREEN,
      fontWeight: 'bold',
      marginRight: 10,
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
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {roundedOffers > 1.1 ? <span style={multiplierStyle}>{roundedOffers}x plus</span> : null}
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
