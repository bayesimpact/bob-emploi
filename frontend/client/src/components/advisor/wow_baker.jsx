import React from 'react'


import {AppearingList} from 'components/theme'
import Picto from 'images/advices/picto-specific-to-job.png'


class ExpandedAdviceCardContent extends React.Component {
  render() {
    const itemStyle = isFirst => ({
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      display: 'flex',
      marginTop: isFirst ? 0 : -1,
      minHeight: 50,
      padding: 20,
    })
    return <AppearingList>
      <div style={itemStyle(true)}>
        Se présenter aux boulangers entre 4h et 7h du matin.
      </div>
      <div style={itemStyle()}>
        Demander au vendeur / à la vendeuse à quelle heure arrive le chef le matin.
      </div>
      <div style={itemStyle()}>
        Contacter les fournisseurs de farine locaux : ils connaissent tous
        les boulangers du coin et sauront où il y a des embauches.
      </div>
    </AppearingList>
  }
}


export default {ExpandedAdviceCardContent, Picto}
