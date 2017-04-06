import React from 'react'
import VisibilitySensor from 'react-visibility-sensor'

import {Colors} from 'components/theme'

import {AdviceBox, AdviceCard, GrowingNumber, PaddedOnMobile, PersonalizationBoxes} from './base'


function getSectorsAndStructures({otherWorkEnvAdviceData}) {
  if (!otherWorkEnvAdviceData) {
    return {}
  }
  return otherWorkEnvAdviceData.workEnvironmentKeywords || {}
}


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
  }

  renderWhy(style) {
    const {sectors, structures} = getSectorsAndStructures(this.props.advice)
    const areSectorsShown = (sectors || []).length > 1
    const areStructuresShown = (structures || []).length > 1
    const sectionStyle = {
      alignItems: 'center',
      textAlign: 'center',
      ...style,
    }
    const explanationStyle = {
      flex: 1,
      fontSize: 16,
      lineHeight: '40px',
      marginTop: 15,
    }
    const strongStyle = {
      color: Colors.GREENISH_TEAL,
      fontSize: 40,
      fontWeight: 'bold',
    }
    return <section style={sectionStyle}>
      <div style={explanationStyle}>
        {areStructuresShown ? <span>
          <GrowingNumber style={strongStyle} number={structures.length} /> structures
        </span> : null}
        {(areStructuresShown && areSectorsShown) ? ' et ' : null}
        {areSectorsShown ? <span>
          <GrowingNumber style={strongStyle} number={sectors.length} /> secteurs
        </span> : null}
      </div>
      proposent <strong>des emplois</strong> pour votre métier
    </section>
  }

  render() {
    const reasons = ['LESS_THAN_15_OFFERS', 'NO_OFFERS', 'ATYPIC_PROFILE', 'NO_OFFER_ANSWERS']
    return <AdviceCard {...this.props} reasons={reasons}>
      {this.renderWhy()}
    </AdviceCard>
  }
}


const personalizations = [
  {
    filters: ['NO_OFFERS'],
    tip: "En élargissant votre recherche vous trouverez plus d'offres",
  },
  {
    filters: ['YOUNG_AGE'],
    tip: profile => `Vous n'êtes pas encore
      spécialisé${profile.gender === 'FEMININE' ? 'e' : ''} alors profitez-en et explorez`,
  },
  {
    filters: ['OLD_AGE'],
    tip: `Mettez en avant que vous pourrez transférer votre expérience et
      partager les méthodes que vous avez apprises dans un autre secteur`,
  },
]


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
  }
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const {sectors, structures} = getSectorsAndStructures(this.props.advice)
    const areSectorsShown = (sectors || []).length > 1
    const areStructuresShown = (structures || []).length > 1
    const style = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      position: 'relative',
    }
    const boxStyle = {
      flex: 1,
      maxWidth: 465,
    }
    return <div>
      <PaddedOnMobile>De belles opportunités s'offrent à vous !</PaddedOnMobile>
      <div style={style}>
        <Section kind="secteur" items={sectors} style={boxStyle} />
        {(areSectorsShown && areStructuresShown) ? <div style={{height: 20, width: 35}} /> : null}
        <Section kind="structure" items={structures} style={boxStyle} />
      </div>

      <PersonalizationBoxes
          {...this.props} style={{marginTop: 30}}
          personalizations={personalizations} />
    </div>
  }
}


class Section extends React.Component {
  static propTypes = {
    items: React.PropTypes.arrayOf(React.PropTypes.node.isRequired),
    kind: React.PropTypes.oneOf(['secteur', 'structure']).isRequired,
  }

  state = {
    isShown: false,
  }

  render() {
    const {items, kind, ...extraProps} = this.props
    const {isShown} = this.state
    if (!items) {
      return null
    }
    const itemStyle = index => ({
      opacity: isShown ? 1 : 0,
      transition: `opacity 300ms ease-in ${index * 700 / items.length}ms`,
    })
    return <div {...extraProps}>
      <AdviceBox
          {...extraProps} feature={`other-work-env-${kind}`}
          header={<div>
            Votre métier peut s'exercer dans
            <div style={{color: Colors.DARK_TWO, fontSize: 30, lineHeight: '40px'}}>
              <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>
                <GrowingNumber number={items.length} />
              </strong> {kind}{items.length > 1 ? 's' : null}
            </div>
          </div>}>
        <div style={{fontWeight: 500, lineHeight: 2.08, position: 'relative'}}>
          <VisibilitySensor
              active={!isShown} intervalDelay={250}
              onChange={isShown => this.setState({isShown})} />
          {items.map((item, index) => <li
              key={`item-${index}`} style={itemStyle(index)}>{item}</li>)}
        </div>
      </AdviceBox>
    </div>
  }
}


export default {AdvicePageContent, FullAdviceCard}
