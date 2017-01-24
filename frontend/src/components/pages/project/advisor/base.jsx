import React from 'react'

import {Colors} from 'components/theme'


class TitleBox extends React.Component {
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    project: React.PropTypes.object.isRequired,
  }

  render() {
    const {project, children} = this.props
    const style = {
      backgroundColor: '#fff',
      boxShadow: '0 2px 4px 0 #d6d9e3',
      color: Colors.DARK,
      margin: '30px 0',
      padding: '40px 50px',
    }
    const headerStyle = {
      borderBottom: 'solid 3px ' + Colors.BACKGROUND_GREY,
      fontSize: 30,
      fontWeight: 'bold',
      marginBottom: 40,
      paddingBottom: 30,
      textTransform: 'uppercase',
    }
    const subTitleStyle = {
      fontSize: 14,
      fontWeight: 'bold',
      letterSpacing: .8,
      marginBottom: 13,
      textTransform: 'uppercase',
    }
    return <div style={style}>
      <header style={headerStyle}>
        {project.title}
      </header>
      <div style={subTitleStyle}>
        Notre diagnostic
      </div>
      <ul style={{fontSize: 18, lineHeight: '26px', marginBottom: 0}}>
        {children}
      </ul>
    </div>
  }
}


class Section extends React.Component{
  static propTypes = {
    children: React.PropTypes.node.isRequired,
    header: React.PropTypes.node.isRequired,
    style: React.PropTypes.object,
  }

  render() {
    const {children, header, style} = this.props
    const sectionStyle = {
      color: Colors.DARK_TWO,
      fontSize: 16,
      lineHeight: '26px',
      padding: '30px 0',
      ...style,
    }
    const sectionHeaderStyle = {
      fontSize: 20,
      fontWeight: 'bold',
    }
    return <section style={sectionStyle}>
      <header style={sectionHeaderStyle}>{header}</header>
      {children}
    </section>
  }
}

// TODO(pascal): Move to a base module to be reused in multiple Advice Components.
class MarketStressChart extends React.Component {
  static propTypes = {
    maxNumOffersShown: React.PropTypes.number,
    numCandidates: React.PropTypes.number.isRequired,
    numOffers: React.PropTypes.number.isRequired,
  }

  static defaultProps = {
    maxNumOffersShown: 18,
  }

  render() {
    const {numCandidates, numOffers, maxNumOffersShown, ...extraProps} = this.props
    const numOffersToShow = Math.min(numOffers, maxNumOffersShown)
    const arrayOfLength = length => new Array(length).fill(undefined)
    let offerImage
    if (numCandidates > 0 && numOffers/numCandidates > .7) {
      offerImage = require('images/offer-green.svg')
    } else if (numCandidates > 0 && numOffers/numCandidates > .4) {
      offerImage = require('images/offer-orange.svg')
    } else {
      offerImage = require('images/offer-red.svg')
    }
    const additionalOffers = numOffersToShow < numOffers ? '+' + (numOffers - numOffersToShow) : ''
    const additionalOffersStyle = {
      fontWeight: 'bold',
      lineHeight: '27px',
      marginTop: 15,
      verticalAlign: 'middle',
    }

    return <div {...extraProps}>
      <div>
        {arrayOfLength(numCandidates).map((unused, index) =>
          <img
              key={`candidate-${index}`} src={require('images/jobseeker.svg')}
              style={{marginRight: 10}} />)}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', maxWidth: 360}}>
        {arrayOfLength(numOffersToShow).map((unused, index) =>
          <img
              key={`offer-${index}`} src={offerImage}
              style={{marginLeft: 1, marginRight: 11, marginTop: 10}} />)}
        <span style={additionalOffersStyle}>{additionalOffers}</span>
      </div>
    </div>
  }
}


export {MarketStressChart, Section, TitleBox}
