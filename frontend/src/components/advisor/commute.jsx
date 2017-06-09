import React from 'react'
import PropTypes from 'prop-types'

class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
  }

  render() {
    const {advice} = this.props

    // TODO(guillaume): Fill the better cities data.
    const {neighborCities, homeCity} = advice.commuteData || {
      homeCity: {name: 'Lyon'},
      neighborCities: [
        {name: 'Saint Étienne'},
        {name: 'Grenoble'},
      ],
    }
    if (!neighborCities || !homeCity || !neighborCities.length) {
      return null
    }
    const cityNames = neighborCities.map(city => city.name)
    const lastCity = cityNames.pop()
    const cityString = cityNames.length ? lastCity : `${cityNames.join(', ')} ou ${lastCity}`

    // TODO(guillaume): Fix case where we have "à Les Ulis" ou "à Le Champex".
    return <div>
      <div style={{fontSize: 30}}>
        Et si demain vous travailliez à {cityString} ?
      </div>
    </div>
  }
}

// TODO(guillaume): Advice Page.

export default {FullAdviceCard}
