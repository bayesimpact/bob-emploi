import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {withRouter} from 'react-router'

import {modifyProject, productUpdatedPageIsShownAction} from 'store/actions'
import {isOldProject} from 'store/project'
import {youForUser} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {Modal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {Button} from 'components/theme'
import {NEW_PROJECT_ID, Routes} from 'components/url'
import newAdvisorScreenshot from 'images/screenshot-new-advisor.png'


class UpdatePageBase extends React.Component {
  static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: PropTypes.shape({
      push: PropTypes.func.isRequired,
    }).isRequired,
    oldProject: PropTypes.shape({
      isIncomplete: PropTypes.bool,
      projectId: PropTypes.string.isRequired,
    }),
    userYou: PropTypes.func.isRequired,
  }

  state = {
    isRequireProjectCheckModalShown: false,
  }

  skipPage = () => {
    const {dispatch, history, oldProject} = this.props
    dispatch(productUpdatedPageIsShownAction)
    if (!oldProject || oldProject.isIncomplete) {
      history.push(Routes.PROJECT_PAGE + '/' + NEW_PROJECT_ID)
    } else {
      this.setState({isRequireProjectCheckModalShown: true})
    }
  }

  handleConfirmProjectCheck = () => {
    const {dispatch, history, oldProject} = this.props
    this.setState({isRequireProjectCheckModalShown: false})
    dispatch(modifyProject(oldProject))
    history.push(Routes.ROOT)
  }

  renderRequireProjectCheckModal() {
    const {userYou} = this.props
    const noticeStyle = {
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: 1.33,
      margin: '35px 0 40px',
      maxWidth: 400,
    }
    return <Modal
      isShown={this.state.isRequireProjectCheckModalShown}
      style={{borderRadius: 10, margin: 10, padding: '0 50px 40px', textAlign: 'center'}}>
      <div style={noticeStyle}>
        Ça fait un bail&nbsp;!
        Commencons par vérifier que {userYou('ton', 'votre')} profil est bien à jour 🙂
      </div>
      <Button onClick={this.handleConfirmProjectCheck} isRound={true}>
        Continuer
      </Button>
    </Modal>
  }

  renderBackground() {
    const style = {
      backgroundColor: colors.DARK,
      boxShadow: `inset 0 1px 0 0 ${colors.SLATE}`,
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
    const {userYou} = this.props
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
      color: colors.MODAL_PROJECT_GREY,
      marginLeft: 0,
      marginTop: 15,
      width: 40,
    }
    const listStyle = {
      color: colors.DARK,
      fontSize: 13,
      lineHeight: 1.62,
      listStyleType: 'none',
      padding: 0,
    }
    return <PageWithNavigationBar
      page="update" isContentScrollable={true}
      style={{backgroundColor: '#fff', zIndex: 0}}>
      {this.renderRequireProjectCheckModal()}
      <FastForward onForward={this.skipPage} />
      {this.renderBackground()}
      <header style={headerStyle}>
        {config.productName} évolue&nbsp;!
      </header>

      <img
        style={imageStyle} src={newAdvisorScreenshot}
        alt={`Capture d'écran du nouveau ${config.productName}`} />

      <div style={{margin: '70px auto', maxWidth: 500}}>
        <div style={{color: colors.DARK_TWO, fontSize: 21, fontWeight: 'bold'}}>
          Grâce au nouveau {config.productName},
          {userYou(' tu peux', ' vous pouvez')}&nbsp;:
        </div>
        <hr style={horizontalRuleStyle} />

        <ol style={listStyle}>
          {this.renderListItem(
            1, colors.BOB_BLUE, 'Analyser.',
            `${config.productName} ${userYou('te', 'vous')} donne un
            diagnostic calculé en fonction de ${userYou('ton', 'votre')} profil
            et du marché de ${userYou('ton', 'votre')} métier`,
            {marginTop: 40})}
          {this.renderListItem(
            2, colors.GREENISH_TEAL, 'Explorer.',
            `${userYou('Tu choisis', 'Vous choisissez')} les conseils
            qui ${userYou("t'", 'vous ')}intéressent parmi une sélection de conseils
            personnalisés`,
            {marginTop: 40})}
          {this.renderListItem(
            3, colors.SUN_YELLOW, 'Avancer.',
            `${config.productName} ${userYou('te', 'vous')} donne des
            pistes concrètes pour aller plus loin sur les conseils
            que ${userYou('tu as', 'vous avez')} sélectionnés.`,
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
export default connect(({user}) => ({
  oldProject: user.projects && isOldProject(user.projects[0]) && user.projects[0] || undefined,
  userYou: youForUser(user),
}))(withRouter(UpdatePageBase))
