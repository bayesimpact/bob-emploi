import React from 'react'

import {AdviceCard} from './base'


class FullAdviceCard extends React.Component {
  static contextTypes = {
    isMobileVersion: React.PropTypes.bool,
  }

  render() {
    const {isMobileVersion} = this.context
    const reasons = ['NO_OFFER_ANSWERS', 'RESUME']
    return <AdviceCard {...this.props} reasons={reasons}>
      <div style={{display: 'flex'}}>
        <div style={{flex: 1}}>
          <div style={{fontSize: 30, lineHeight: 1.03}}>
            Si vous n'aviez que <strong>30 secondes pour convaincre&nbsp;?</strong>
          </div>
          <div style={{fontSize: 16, lineHeight: 1.25, marginTop: 30}}>
            Les recruteurs prennent entre 30 et 60 secondes pour étudier une
            candidature; assurez-vous que l'essentiel est dans le corps du mail.
          </div>
        </div>

        {isMobileVersion ? null : <div style={{fontSize: 13}}>
          <div style={{fontWeight: 500, marginBottom: 20, textAlign: 'center'}}>
            Répartition du temps passé sur une candidature
          </div>
          <img src={require('images/improve-email-picto.svg')} />
        </div>}
      </div>
    </AdviceCard>
  }
}


// TODO(pascal): Implement the AdvicePageContent.


export default {FullAdviceCard}
