import React from 'react'
import {browserHistory} from 'react-router'

import config from 'config'

import {StaticPage} from 'components/static'
import {Colors, Button} from 'components/theme'
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
      marginTop: 20,
      textAlign: 'center',
      width: 440,
    }
    return <StaticPage page="app_not_available">
      <div style={boxStyle}>
        <div style={titleStyle}>Le service n'est pas encore disponible pour votre profil</div>
        <div style={containerStyle}>
          <p>
            Nous sommes en train de lancer {config.productName} de façon progressive en
            France. Cela signifie que certains secteurs d'activité et certaines
            zones géographiques ne sont pas encore représentés.
            Malheureusement, cela a l'air d'être le cas pour vous pour le
            moment.
          </p>
          <p>
            Une combinaison de quatre bases de données différentes est
            nécessaire pour pouvoir établir des suggestions personnalisées pour
            votre profil. Nous ne pouvons pas vous préciser quelle est la
            variable bloquante pour chaque utilisateur de {config.productName}.
          </p>
          <p>
            Nous espérons en disposer rapidement pour pouvoir vous aider dans
            votre recherche d'emploi. Nous vous contacterons par email quand le
            service sera disponible pour vous.
          </p>
        </div>
        <div style={{display: 'flex', marginBottom: 40, marginTop: 10}}>
          <Button type="validation" onClick={this.handleBackClick}>
            Retourner à la page d'accueil
          </Button>
        </div>
      </div>
    </StaticPage>
  }
}

export {AppNotAvailablePage}
