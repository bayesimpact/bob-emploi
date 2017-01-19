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
      <ul style={{fontSize: 18, lineHeight: '26px'}}>
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
      fontSize: 18,
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
    numCandidates: React.PropTypes.number.isRequired,
    numOffers: React.PropTypes.number.isRequired,
  }

  render() {
    const {numCandidates, numOffers, ...extraProps} = this.props
    const arrayOfLength = length => new Array(length).fill(undefined)
    return <div {...extraProps}>
      <div>
        {arrayOfLength(numCandidates).map((unused, index) =>
          <img
              key={`candidate-${index}`} src={require('images/jobseeker.svg')}
              style={{marginRight: 10}} />)}
      </div>
      <div style={{marginTop: 10}}>
        {arrayOfLength(numOffers).map((unused, index) =>
          <img
              key={`offer-${index}`} src={require('images/offer.svg')}
              style={{marginLeft: 1, marginRight: 11}} />)}
      </div>
    </div>
  }
}


export {MarketStressChart, Section, TitleBox}
