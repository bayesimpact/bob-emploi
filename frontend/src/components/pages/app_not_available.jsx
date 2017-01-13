import React from 'react'
import {browserHistory} from 'react-router'

import {StaticPage} from 'components/static'
import {Colors, RoundButton} from 'components/theme'
import {Routes} from 'components/url'

class AppNotAvailablePage extends React.Component {

  handleBackClick = () => {
    browserHistory.push(Routes.ROOT)
  }

  render() {
    const boxStyle = {
      alignItems: 'center',
      backgroundColor: '#fff',
      boxShadow: '0 0 25px 0 rgba(0, 0, 0, 0.04)',
      display: 'flex',
      flexDirection: 'column',
      margin: '90px auto',
      width: 945,
    }
    const titleStyle = {
      color: '#2c3449',
      fontSize: 23,
      fontWeight: 500,
      lineHeight: 1.6,
      marginTop: 40,
      textAlign: 'center',
    }
    const containerStyle = {
      color: Colors.CHARCOAL_GREY,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      lineHeight: 1.3,
      marginBottom: 215,
      marginTop: 150,
      textAlign: 'center',
      width: 440,
    }
    return <StaticPage page="app_not_available">
      <div style={boxStyle}>
        <div style={titleStyle}>Le service n'est pas encore disponible chez vous</div>
        <div style={containerStyle}>
          <p>
            Nous sommes en train de lancer ce service de façon progressive en France.
            Cela signifie que certains secteurs d'activité et certaines zones géographiques ne sont
            pas encore représentés.
          </p>
          <p>
            Malheureusement, ça a l'air d'être le cas pour vous pour le moment. Nous vous
            recontacterons par mail lorsque le service sera disponible chez vous !
          </p>
        </div>
        <div style={{display: 'flex', marginBottom: 40, marginTop: 70}}>
          <RoundButton type="validation" onClick={this.handleBackClick}>
            Retourner à la page d'accueil
          </RoundButton>
        </div>
      </div>
    </StaticPage>
  }
}

export {AppNotAvailablePage}
