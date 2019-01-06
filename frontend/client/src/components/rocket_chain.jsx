import PropTypes from 'prop-types'
import React from 'react'

// TODO(pascal): Remove the eslint exceptions once
// https://github.com/benmosher/eslint-plugin-import/pull/1108 has shipped.
// eslint-disable-next-line import/no-duplicates
import rocketIcon from 'images/rocket.svg'
// eslint-disable-next-line import/no-duplicates
import blackRocketIcon from 'images/rocket.svg?fill=#000'

import {getRocketFromStars, MAX_NUMBER_ROCKETS} from 'store/advice'


class RocketChain extends React.Component {
  static propTypes = {
    areEmptyRocketsShown: PropTypes.bool,
    numRockets: PropTypes.number,
    numStars: PropTypes.number,
    rocketHeight: PropTypes.number,
  }

  renderRocketChain(numRockets, rocketIcon, rocketStyle, altText) {
    return <React.Fragment>{new Array(Math.floor(numRockets)).fill(undefined).map((unused, index) =>
      <img
        src={rocketIcon}
        style={rocketStyle}
        key={`rocket-${index}`}
        alt={altText}
      />
    )}</React.Fragment>
  }

  render() {
    const {areEmptyRocketsShown, numStars, numRockets, rocketHeight = 25} = this.props
    const numFilledRockets = numRockets || getRocketFromStars(numStars)

    return <React.Fragment>
      {this.renderRocketChain(numFilledRockets, rocketIcon, {height: rocketHeight}, '*')}
      {areEmptyRocketsShown ?
        this.renderRocketChain(
          MAX_NUMBER_ROCKETS - numFilledRockets, blackRocketIcon,
          {height: rocketHeight, opacity: 0.2}, '') : null
      }
    </React.Fragment>
  }
}

export {RocketChain}
