import React from 'react'
import {browserHistory} from 'react-router'

import config from 'config'

import newAdvisorScreenshot from 'images/screenshot-new-advisor.png'
import {PageWithNavigationBar} from 'components/navigation'
import {ShortKey} from 'components/shortkey'
import {Button, Colors, Styles} from 'components/theme'
import {NEW_PROJECT_ID, Routes} from 'components/url'


class UpdatePage extends React.Component {
  skipPage() {
    browserHistory.push(Routes.PROJECT_PAGE + '/' + NEW_PROJECT_ID)
  }

  renderBackground() {
    const style = {
      backgroundColor: Colors.DARK,
      boxShadow: `inset 0 1px 0 0 ${Colors.SLATE}`,
      height: 260,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: -1,
    }
    return <div style={style} />
  }

  renderListItem(number, color, title, description, style) {
    const numberStyle = {
      alignItems: 'center',
      backgroundColor: color,
      border: 'solid 2px #fff',
      borderRadius: 100,
      boxShadow: '0 0 2px 0 rgba(0, 0, 0, 0.3)',
      color: '#fff',
      display: 'flex',
      fontSize: 20,
      fontWeight: 'bold',
      height: 36,
      justifyContent: 'center',
      marginRight: 30,
      width: 36,
      ...Styles.CENTER_FONT_VERTICALLY,
    }
    return <li style={{alignItems: 'center', display: 'flex', ...style}}>
      <div style={numberStyle}>
        {number}
      </div>
      <div style={{flex: 1}}>
        <strong>{title}</strong> {description}
      </div>
    </li>
  }

  render() {
    const headerStyle = {
      color: '#fff',
      fontSize: 35,
      fontStyle: 'italic',
      fontWeight: 'bold',
      margin: '50px 20px',
      textAlign: 'center',
    }
    const imageStyle = {
      boxShadow: '0 10px 30px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      display: 'block',
      margin: 'auto',
      maxWidth: 700,
    }
    const horizontalRuleStyle = {
      border: 'solid 2px',
      color: Colors.MODAL_PROJECT_GREY,
      marginLeft: 0,
      marginTop: 15,
      width: 40,
    }
    const listStyle = {
      color: Colors.DARK,
      fontSize: 13,
      lineHeight: 1.62,
      listStyleType: 'none',
      padding: 0,
    }
    return <PageWithNavigationBar
      page="update" isContentScrollable={true}
      style={{backgroundColor: '#fff', zIndex: 0}}>
      <ShortKey
        keyCode="KeyF" hasCtrlModifier={true} hasShiftModifier={true} onKeyPress={this.skipPage} />
      {this.renderBackground()}
      <header style={headerStyle}>
        {config.productName} évolue&nbsp;!
      </header>

      <img style={imageStyle} src={newAdvisorScreenshot} />

      <div style={{margin: '70px auto', maxWidth: 500}}>
        <div style={{color: Colors.DARK_TWO, fontSize: 21, fontWeight: 'bold'}}>
          Que fait le nouveau {config.productName}&nbsp;?
        </div>
        <hr style={horizontalRuleStyle} />

        <ol style={listStyle}>
          {this.renderListItem(
            1, Colors.SKY_BLUE, 'Un diagnostic personnalisé',
            'calculé en fonction de votre profil et du marché de votre métier.',
            {marginTop: 40})}
          {this.renderListItem(
            2, Colors.GREENISH_TEAL, 'Une analyse de favorabilité',
            'pour trouver, retrouver un emploi ou se réorienter en fonction du marché.',
            {marginTop: 40})}
          {this.renderListItem(
            // TODO(pascal): Name this custom color or get rid of it.
            3, '#f5d623', 'Des sujets priorisés',
            'pour augmenter vos chances en fonction de votre profil et de votre recherche.',
            {marginTop: 40})}
        </ol>

        <div style={{marginTop: 40, textAlign: 'center'}}>
          <Button type="validation" onClick={this.skipPage}>
            Accéder au nouveau {config.productName}
          </Button>
        </div>
      </div>
    </PageWithNavigationBar>
  }
}


export {UpdatePage}
