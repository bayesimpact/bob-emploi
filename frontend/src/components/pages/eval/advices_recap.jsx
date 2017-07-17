import React from 'react'
import PropTypes from 'prop-types'
import _ from 'underscore'
import threeStarsImage from 'images/3-stars-picto.svg'
import twoStarsImage from 'images/2-stars-picto.svg'


class AdvicesRecap extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
  }

  render() {
    const {advices} = this.props
    const style = {
      backgroundColor: '#fff',
      marginTop: 10,
      padding: 10,
    }
    const adviceGroups = _.groupBy(advices, 'numStars')
    const groupKeys = Object.keys(adviceGroups).sort().reverse()
    return <div style={style}>
      {groupKeys.map((numStars, index) => (
        <AdvicesRecapSection key={index} advices={adviceGroups[numStars]} numStars={numStars} />
      ))}
    </div>
  }
}

const ADVICE_GROUP_PROPS = {
  '1': {
    title: 'À regarder',
  },
  '2': {
    image: twoStarsImage,
  },
  '3': {
    image: threeStarsImage,
  },
}

class AdvicesRecapSection extends React.Component {
  static propTypes = {
    advices: PropTypes.array.isRequired,
    numStars: PropTypes.oneOf(Object.keys(ADVICE_GROUP_PROPS)).isRequired,
  }

  render() {
    const {advices, numStars} = this.props
    const {image, title} = ADVICE_GROUP_PROPS[numStars]
    const headerStyle = {
      display: 'flex',
      justifyContent: 'center',
      'padding': '15px 0px',
    }
    return <div style={{minWidth: 600}}>
      <div style={headerStyle}>
        {image
          ? <img src={image} style={{height: 40, width: 40}} />
          : <span style={{fontWeight: 'bold'}}>{title}</span>
        }
      </div>
      {advices.map((advice, index) => (
        <div key={index} style={{padding: 5}}>{advice.adviceId}</div>
      ))}
    </div>
  }
}

export {AdvicesRecap}
