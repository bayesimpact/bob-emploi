import PropTypes from 'prop-types'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, displayToasterMessage} from 'store/actions'

import {isMobileVersion} from 'components/mobile'
import {StaticPage} from 'components/static'
import {Button, MAX_CONTENT_WIDTH, Textarea} from 'components/theme'
import {Routes} from 'components/url'
import bookmarkletImage from 'images/bob-advices-bookmarklet.png'
import addingBookmarkletGif from '../../../import-from-imilo/adding-imilo-bookmarklet.gif'
import usingBookmarkletGif from '../../../import-from-imilo/import-from-imilo.gif'


class ImiloIntegrationPageBase
  extends React.PureComponent<{dispatch: DispatchAllActions}, {userJson: string}> {
  public static propTypes = {
    dispatch: PropTypes.func.isRequired,
  }

  public state = {
    userJson: JSON.stringify({
      profile: {
        familySituation: 'SINGLE_PARENT_SITUATION',
        frustrations: [
          'NO_OFFERS',
          'SELF_CONFIDENCE',
          'TIME_MANAGEMENT',
          'EXPERIENCE',
          'ATYPIC_PROFILE',
          'AGE_DISCRIMINATION',
          'SEX_DISCRIMINATION',
        ],
        gender: 'FEMININE',
        hasCarDrivingLicense: true,
        highestDegree: 'NO_DEGREE',
        lastName: 'Dupont',
        name: 'Angèle',
        yearOfBirth: 1999,
      },
      projects: [{
        areaType: 'CITY',
        city: {
          cityId: '32208',
          departementId: '32',
          departementName: 'Gers',
          name: 'Lectoure',
          postcodes: '32700',
          regionId: '76',
          regionName: 'Occitanie',
        },
        employmentTypes: ['CDI'],
        jobSearchLengthMonths: 11,
        kind: 'FIND_A_NEW_JOB',
        passionateLevel: 'ALIMENTARY_JOB',
        previousJobSimilarity: 'DONE_SIMILAR',
        targetJob: {
          codeOgr: '11573',
          feminineName: 'Boulangère',
          jobGroup: {
            name: 'Boulangerie - viennoiserie',
            romeId: 'D1102',
          },
        },
        totalInterviewCount: 13,
        trainingFulfillmentEstimate: 'ENOUGH_DIPLOMAS',
        weeklyApplicationsEstimate: 'SOME',
        weeklyOffersEstimate: 'DECENT_AMOUNT',
        workloads: ['FULL_TIME'],
      }],
    }, undefined, 2),
  }

  private removeExtraSpacesFromCode(codeString: string): string {
    // Convert multiple space in one: '   ' -> ' '
    return codeString.replace(/\s+/g, ' ')
  }

  private handleJsonChange = (userJson: string): void => this.setState({userJson})

  private getUserData(userJson: string): bayes.bob.User|null {
    try {
      return JSON.parse(userJson.replace(/ObjectId\(("[a-f0-9]+")\)/, '$1'))
    } catch (error) {
      this.props.dispatch(displayToasterMessage(error.toString()))
      return null
    }
  }

  private bootstrapAdvice = (): void => {
    const userData = this.getUserData(this.state.userJson || '')
    if (!userData) {
      return
    }
    const url = `${Routes.BOOTSTRAP_PAGE}#${encodeURIComponent(JSON.stringify(userData))}`
    window.open(url, '_blank')
  }

  public render(): React.ReactNode {
    const textStyle: React.CSSProperties = {
      color: colors.CHARCOAL_GREY,
      lineHeight: 1.63,
      marginBottom: 10,
      padding: isMobileVersion ? '0 20px' : '0 140px',
    }
    // TODO(florian): Make mobile friendly if necessary (not likely as i-milo is not
    // mobile friendly).
    const textSectionStyle: React.CSSProperties = {
      backgroundColor: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontSize: 16,
      lineHeight: 1.63,
      paddingBottom: 50,
    }
    const titleStyle: React.CSSProperties = {
      fontSize: 36,
      fontWeight: 'bold',
      lineHeight: 1,
      maxWidth: MAX_CONTENT_WIDTH,
      padding: '50px 0 40px',
      textAlign: 'center',
    }
    const sectionStyle: React.CSSProperties = {
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: MAX_CONTENT_WIDTH,
    }
    const imgStyle: React.CSSProperties = {
      border: '1px solid #000',
    }
    const imiloProductName = 'i-milo'
    const host = window.location.origin
    const bookmarkletCode = `
      !window.location.href.match(/^https:\\/\\/portail\\.i-milo\\.fr\\/dossier\\//) ?
      alert("Vous devez être sur le profil d'un jeune dans i-milo pour générer les conseils de Bob.
      Ex: https://portail.i-milo.fr/dossier/123456/consultation/identite") : (
      (typeof bob2imilo !== 'undefined') ? bob2imilo() : function() {
        var s = document.createElement('script');
        s.setAttribute('src', '${host}/assets/import-from-imilo.js');
        document.getElementsByTagName('head')[0].appendChild(s);
      }())`
    const encodedBookmarkletCode = encodeURIComponent(
      this.removeExtraSpacesFromCode(bookmarkletCode))
    const bookmarklet = `javascript:void(${encodedBookmarkletCode});`

    return <StaticPage page="imilo-integration" style={{backgroundColor: '#fff'}}>
      <div style={sectionStyle}>
        <div style={textSectionStyle}>
          <div style={titleStyle}>
            Comment obtenir des conseils de {config.productName} depuis {imiloProductName}
          </div>
          <div style={textStyle}>
            <h2 style={{fontWeight: 'bold', marginTop: 25}}>
              1. Installer le bouton 'Conseils de {config.productName}' dans votre navigateur
            </h2>
            {/* TODO(florian): add gif to show it works */}
            Faire glisser le bouton suivant dans la barre de favoris de votre navigateur&nbsp;:{' '}
            <a href={bookmarklet}>
              <img
                src={bookmarkletImage} alt={'Conseils de ' + config.productName}
                style={{verticalAlign: 'top'}} width="123" height="22" />
            </a><br />
            Démonstration&nbsp;:
            <img
              src={addingBookmarkletGif} alt="Démonstration de l'intégration" style={imgStyle}
              width="800" />
            (à faire une seule fois par navigateur)
            <h2 style={{fontWeight: 'bold', marginTop: 25}}>
              2. Cliquer sur le bouton 'Conseils de {config.productName}' depuis une page de{' '}
              profil jeune dans {imiloProductName}
            </h2>
            Démonstration&nbsp;:
            <img
              src={usingBookmarkletGif} alt="Démonstration de l'intégration" style={imgStyle}
              width="800" />
          </div>
        </div>
      </div>
      <div style={textSectionStyle}>
        <div style={titleStyle}>
          Tester l'interface
        </div>
        <Textarea
          value={this.state.userJson} onChange={this.handleJsonChange}
          style={{fontFamily: 'Monospace', fontSize: 12, height: 600, margin: 'auto', width: 800}}
        />
        <div style={{marginTop: 20, textAlign: 'center'}}>
          <Button onClick={this.bootstrapAdvice}>
            Trouver des conseils
          </Button>
        </div>
      </div>
    </StaticPage>
  }
}
const ImiloIntegrationPage = connect()(ImiloIntegrationPageBase)


export default ImiloIntegrationPage
