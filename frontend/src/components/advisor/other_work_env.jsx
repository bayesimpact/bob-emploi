import React from 'react'

import {Colors} from 'components/theme'

import {AdviceCard} from './base'


class FullAdviceCard extends React.Component {
  static propTypes = {
    advice: React.PropTypes.object.isRequired,
  }

  renderSection(kind, items) {
    if (items === null) {
      return null
    }
    // TODO(pascal): Factorize frame with other advice modules.
    const frameStyle = {
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      padding: '30px 0',
      textAlign: 'center',
    }
    const darkFrameStyle = {
      backgroundColor: Colors.LIGHT_GREY,
      border: `solid 1px ${Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      fontSize: 13,
      fontWeight: 500,
      lineHeight: 2.08,
      padding: '20px 15px 20px 35px',
    }
    return <div style={{flex: 1}}>
      <div style={frameStyle}>
        Votre métier peut s'exercer dans
        <div style={{fontSize: 30, marginTop: 10}}>
          <strong style={{color: Colors.GREENISH_TEAL, fontSize: 40}}>{items.length} </strong>
          {kind}{items.length > 1 ? 's' : null}
        </div>
      </div>

      <div style={{fontSize: 25, margin: 15, textAlign: 'center'}}>
        👇
      </div>

      <div style={darkFrameStyle}>
        {items.map((item, index) => <li key={`item-${index}`}>{item}</li>)}
      </div>
    </div>
  }

  getSectorsAndStructures() {
    const {otherWorkEnvAdviceData} = this.props.advice
    if (!otherWorkEnvAdviceData) {
      return {}
    }
    return otherWorkEnvAdviceData.workEnvironmentKeywords || {}
  }

  render() {
    const {sectors, structures} = this.getSectorsAndStructures()
    const areSectorsShown = (sectors || []).length > 1
    const areStructuresShown = (structures || []).length > 1
    return <AdviceCard
        title="Ne vous limitez pas aux entreprises que vous connaissez déjà"
        goal="trouver d'autres secteurs"
        {...this.props}>
      <div style={{display: 'flex'}}>
        {areSectorsShown ? this.renderSection('secteur', sectors) : null}
        {(areSectorsShown && areSectorsShown) ? <div style={{width: 35}} /> : null}
        {areStructuresShown ? this.renderSection('structure', structures) : null}
      </div>
    </AdviceCard>
  }
}


export default {FullAdviceCard}
