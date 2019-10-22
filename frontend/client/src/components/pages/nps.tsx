import ExitToAppIcon from 'mdi-react/ExitToAppIcon'
import {parse} from 'query-string'
import React from 'react'
import ReactDOM from 'react-dom'

import logoProductImage from 'images/logo-bob-beta.svg'

import {isMobileVersion} from 'components/mobile'
import {ShareModal} from 'components/share'
import {Button, ExternalLink, MIN_CONTENT_PADDING, Textarea} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'

require('styles/App.css')

// TODO(cyrille): Report events to Amplitude.


interface PageParams {
  token?: string
  user?: string
}


interface PageState {
  comment?: string
  errorMessage?: string
  isFormSent: boolean
  isSendingUpdate: boolean
  isShareModalShown: boolean
  isValidated: boolean
  params: PageParams
  score: number
}


class NPSFeedbackPage extends React.PureComponent<{}, PageState> {
  private static getStateFromLocation({search}): Pick<PageState, 'params'|'score'> {
    const params = parse(search) || {}
    return {
      params,
      score: parseInt(params.score, 10) || 0,
    }
  }

  public state: PageState = {
    isFormSent: false,
    isSendingUpdate: false,
    isShareModalShown: false,
    isValidated: false,
    ...NPSFeedbackPage.getStateFromLocation(window.location),
  }

  private handleCancel(): void {
    window.location.href = '/'
  }

  private handleCommentChange = (comment: string): void => this.setState({comment})

  private handleUpdate = (): void => {
    const {comment, params} = this.state
    if (!comment) {
      this.setState({isValidated: true})
      return
    }
    const {token, user} = params
    this.setState({errorMessage: undefined, isSendingUpdate: true})
    fetch('/api/nps', {
      body: JSON.stringify({comment, userId: user}),
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      method: 'post',
    }).then(this.handleUpdateResponse)
  }

  private handleUpdateResponse = (response): void => {
    if (response.status >= 400 || response.status < 200) {
      response.text().then((errorMessage: string): void => {
        const page = document.createElement('html')
        page.innerHTML = errorMessage
        const content = page.getElementsByTagName('P') as HTMLCollectionOf<HTMLParagraphElement>
        this.setState({
          errorMessage: content.length && content[0].textContent || page.textContent ||
            errorMessage,
          isSendingUpdate: false,
        })
      })
      return
    }
    this.setState(({comment, score}):
    Pick<PageState, 'isFormSent'|'isSendingUpdate'|'isShareModalShown'> => ({
      isFormSent: true,
      isSendingUpdate: false,
      isShareModalShown: !!comment && score > 8,
    }))
  }

  private renderHeader(): React.ReactNode {
    const style: React.CSSProperties = {
      alignItems: 'center',
      backgroundColor: colors.BOB_BLUE,
      display: 'flex',
      height: 56,
      justifyContent: 'center',
      width: '100%',
    }
    return <header style={style}>
      <img
        style={{cursor: 'pointer', height: 40}} onClick={this.handleCancel}
        src={logoProductImage} alt={config.productName} />
    </header>
  }

  private renderThankYouText(): string {
    const prefix = 'Merci ! Pouvez-vous en dire plus sur ce qui vous a '
    const {score} = this.state
    if (score >= 8) {
      return prefix + 'plu ou aidé ?'
    }
    if (score >= 6) {
      return prefix + 'plu ? (ou ce que nous pourrions améliorer)'
    }
    return prefix + 'déplu ou ce que nous pourrions améliorer ?'
  }

  private renderAckFeedback(pageStyle: React.CSSProperties): React.ReactNode {
    const containerStyle: React.CSSProperties = {
      ...pageStyle,
      textAlign: 'center',
    }
    const {score} = this.state
    if (score >= 6) {
      return <div style={containerStyle}>
        <p>
          Merci d'avoir pris le temps de nous faire ce retour&nbsp;:
        </p>
        <p>
          c'est très précieux pour nous&nbsp;!
        </p>
      </div>
    }
    return <div style={containerStyle}>
      <p>
        Merci d'avoir pris le temps de nous faire ce retour&nbsp;!
      </p>
      <p>
        Nous l'étudierons avec soin afin de trouver des façons d'améliorer {config.productName}.
        Nous tâcherons de faire mieux dans le futur !
      </p>
    </div>
  }

  private renderShareModal(): React.ReactNode {
    const {isShareModalShown} = this.state
    return <ShareModal
      isShown={isShareModalShown} campaign="nps" visualElement="nps"
      title="Merci pour votre retour&nbsp;!"
      intro={<React.Fragment>
        Si vous pensez que {config.productName} peut aider une personne que vous
        connaissez, n'hésitez pas à lui <strong>partager ce lien</strong>&nbsp;:
      </React.Fragment>}
    >
      <div style={{marginBottom: isMobileVersion ? 25 : 40}}>
        Vous pouvez également partager votre avis sur {config.productName} en nous laissant une
        note sur l'Emploi Store&nbsp;:
      </div>

      <div style={{textAlign: 'center'}}>
        <ExternalLink
          href="http://www.emploi-store.fr/portail/services/bobEmploi"
          style={{textDecoration: 'none'}}>
          <Button type="validation" style={{display: 'flex', margin: 'auto'}}>
            Accéder à l'Emploi Store
            <ExitToAppIcon style={{fill: '#fff', height: 19, marginLeft: 10}} />
          </Button>
        </ExternalLink>
      </div>
    </ShareModal>
  }

  public render(): React.ReactNode {
    const {comment, errorMessage, isFormSent, isSendingUpdate, isShareModalShown,
      isValidated} = this.state
    const pageStyle: React.CSSProperties = {
      alignItems: 'center',
      color: colors.DARK_TWO,
      display: 'flex',
      flexDirection: 'column',
      fontSize: 15,
      fontWeight: 500,
      justifyContent: 'center',
      lineHeight: 1.5,
      minHeight: '100vh',
    }
    if (isFormSent && !isShareModalShown) {
      return this.renderAckFeedback(pageStyle)
    }
    const textareaStyle: React.CSSProperties = {
      minHeight: 200,
      width: '100%',
    }
    return <div style={pageStyle}>
      {this.renderHeader()}
      {this.renderShareModal()}
      <div
        style={{flex: 1, maxWidth: 500,
          padding: isMobileVersion ? `0px ${MIN_CONTENT_PADDING}px` : 'initial'}}>
        <div style={{fontSize: 16, margin: '40px 0 20px'}}>
          {this.renderThankYouText()}
        </div>
        <FieldSet
          isValidated={isValidated} isValid={!!comment}>
          <Textarea
            onChange={this.handleCommentChange}
            value={comment} style={textareaStyle} />
        </FieldSet>
        <div style={{textAlign: 'center'}}>
          <Button
            onClick={this.handleUpdate}
            isProgressShown={isSendingUpdate}>
            Envoyer
          </Button>
          {errorMessage ? <div style={{marginTop: 20}}>
            {errorMessage}
          </div> : null}
        </div>
      </div>
    </div>
  }
}


ReactDOM.render(<NPSFeedbackPage />, document.getElementById('app'))
