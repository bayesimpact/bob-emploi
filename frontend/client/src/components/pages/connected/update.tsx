import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'
import {RouteComponentProps, withRouter} from 'react-router'
import ReactRouterPropTypes from 'react-router-prop-types'

import {DispatchAllActions, RootState, modifyProject,
  productUpdatedPageIsShownAction} from 'store/actions'
import {YouChooser} from 'store/french'
import {isOldProject} from 'store/project'
import {youForUser} from 'store/user'

import {FastForward} from 'components/fast_forward'
import {Modal} from 'components/modal'
import {PageWithNavigationBar} from 'components/navigation'
import {Button} from 'components/theme'
import {NEW_PROJECT_ID, Routes} from 'components/url'
import newAdvisorScreenshot from 'images/screenshot-new-advisor.png'


interface PageConnectedProps {
  oldProject?: bayes.bob.Project | undefined
  userYou: YouChooser
}

interface PageProps extends PageConnectedProps, RouteComponentProps {
  dispatch: DispatchAllActions
}

interface PageState {
  isRequireProjectCheckModalShown: boolean
}

class UpdatePageBase extends React.PureComponent<PageProps, PageState> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
    history: ReactRouterPropTypes.history.isRequired,
    oldProject: PropTypes.shape({
      isIncomplete: PropTypes.bool,
      projectId: PropTypes.string.isRequired,
    }),
    userYou: PropTypes.func.isRequired,
  }

  public state: PageState = {
    isRequireProjectCheckModalShown: false,
  }

  private skipPage = (): void => {
    const {dispatch, history, oldProject} = this.props
    dispatch(productUpdatedPageIsShownAction)
    if (!oldProject || oldProject.isIncomplete) {
      history.push(Routes.PROJECT_PAGE + '/' + NEW_PROJECT_ID)
    } else {
      this.setState({isRequireProjectCheckModalShown: true})
    }
  }

  private handleConfirmProjectCheck = (): void => {
    const {dispatch, history, oldProject} = this.props
    this.setState({isRequireProjectCheckModalShown: false})
    if (oldProject) {
      dispatch(modifyProject(oldProject))
    }
    history.push(Routes.ROOT)
  }

  private renderRequireProjectCheckModal(): React.ReactNode {
    const {userYou} = this.props
    const noticeStyle: React.CSSProperties = {
      fontSize: 15,
      fontStyle: 'italic',
      lineHeight: 1.33,
      margin: '35px 0 40px',
      maxWidth: 400,
    }
    return <Modal
      isShown={this.state.isRequireProjectCheckModalShown}
      style={{margin: 10, padding: '0 50px 40px', textAlign: 'center'}}>
      <div style={noticeStyle}>
        Ça fait un bail&nbsp;!
        Commençons par vérifier que {userYou('ton', 'votre')} profil est bien à jour 🙂
      </div>
      <Button onClick={this.handleConfirmProjectCheck} isRound={true}>
        Continuer
      </Button>
    </Modal>
  }

  private renderBackground(): React.ReactNode {
    const style: React.CSSProperties = {
      backgroundColor: colors.BOB_BLUE,
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

  private renderListItem(
    number: number, color: string, title: string, description: string, style: React.CSSProperties
  ): React.ReactNode {
    const numberStyle: React.CSSProperties = {
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

  public render(): React.ReactNode {
    const {userYou} = this.props
    const headerStyle: React.CSSProperties = {
      color: '#fff',
      fontSize: 35,
      fontStyle: 'italic',
      fontWeight: 'bold',
      margin: '50px 20px',
      textAlign: 'center',
    }
    const imageStyle: React.CSSProperties = {
      boxShadow: '0 10px 30px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      display: 'block',
      margin: 'auto',
      maxWidth: 700,
    }
    const horizontalRuleStyle: React.CSSProperties = {
      border: 'solid 2px',
      color: colors.MODAL_PROJECT_GREY,
      marginLeft: 0,
      marginTop: 15,
      width: 40,
    }
    const listStyle: React.CSSProperties = {
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
        <div style={{fontSize: 21, fontWeight: 'bold'}}>
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
export default connect(({user}: RootState): PageConnectedProps => ({
  oldProject: user.projects && isOldProject(user.projects[0]) && user.projects[0] || undefined,
  userYou: youForUser(user),
}))(withRouter(UpdatePageBase))
