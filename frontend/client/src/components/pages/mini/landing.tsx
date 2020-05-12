import React, {useCallback, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import {useFastForward} from 'components/fast_forward'
import {ExternalLink, Input, LabeledToggle} from 'components/theme'
import {FieldSet} from 'components/pages/connected/form_utils'
import aliLogo from 'images/mini/logo-ali.svg'

import {GenericPage} from './page'
import {Button} from './theme'
import {DispatchActions, MiniRootState, OrgInfo, Routes} from './store'


const fullPageStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: 1,
  justifyContent: 'center',
  margin: '10vh 0 0px',
}
const formContainerStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  maxWidth: 500,
}
const titleStyle: React.CSSProperties = {
  alignSelf: 'center',
  color: colors.MINI_PEA,
  fontFamily: 'Fredoka One',
  fontSize: 20,
  fontWeight: 'normal',
  marginBottom: 0,
}

const descriptionStyle: React.CSSProperties = {
  fontSize: 14,
  marginBottom: 8,
  marginTop: 0,
}

const questionFontSize: React.CSSProperties = {
  fontSize: 13,
}

const questionStyle: React.CSSProperties = {
  marginBottom: 11,
  ...questionFontSize,
}

const additionalQuestiontyle: React.CSSProperties = {
  color: colors.CHARCOAL_GREY,
  maxWidth: 360,
  ...questionFontSize,
}
const logoStyle: React.CSSProperties = {
  marginRight: 100,
}
const specialLetterStyle: React.CSSProperties = {
  color: colors.MINI_MAGENTA,
}

const linkStyle: React.CSSProperties = {
  cursor: 'pointer',
}

const aliGuideURL = 'https://www.unml.info/assets/files/espace-docu-ml/A-Li/unml_a-li_guide_a4_def.pdf'

const LandingPageBase: React.FC<{}> = (): React.ReactElement => {
  const {orgInfo, isUserSupervised: wasUserSupervised} = useSelector(({app}: MiniRootState) => app)
  const {advisor, departement, email, milo} = orgInfo
  const dispatch = useDispatch<DispatchActions>()
  const [isUserSupervised, setIsUserSupervised] = useState(wasUserSupervised)
  const changeSupervision = useCallback(
    (): void => setIsUserSupervised(!isUserSupervised),
    [isUserSupervised],
  )
  const onChange = useCallback((field: keyof OrgInfo): ((value: string) => void) =>
    (value: string): void => {
      dispatch({
        orgInfo: {
          [field]: value,
        },
        type: 'MINI_UPDATE_ORG_INFO',
      })
    }, [dispatch])
  const fillForm = useCallback((): void => {
    if (!advisor) {
      onChange('advisor')('Pascal Corpet')
    }
    if (!email) {
      onChange('email')('pascal@example.com')
    }
    if (!milo) {
      onChange('milo')('Lyon Part-Dieu')
    }
    if (!departement) {
      onChange('departement')('69')
    }
  }, [advisor, departement, email, milo, onChange])
  const skipLanding = useCallback(
    (): void => void dispatch(
      {isUserSupervised: !!isUserSupervised, type: 'MINI_ONBOARDING_FINISH_LANDING'}),
    [dispatch, isUserSupervised])
  const isFormFull = advisor && milo && departement && email
  useFastForward(isFormFull ? skipLanding : fillForm, [], isFormFull ? Routes.HUB_PAGE : undefined)
  return <GenericPage bottomButton={
    <Button
      to={isUserSupervised ? Routes.HUB_PAGE : Routes.USER_LANDING_PAGE} onClick={skipLanding}>
      Commencez A-Li
    </Button>}>
    <div style={fullPageStyle}>
      <img src={aliLogo} alt="logo ali" style={logoStyle} />
      <div style={formContainerStyle}>
        <h1 style={titleStyle}>
          Le 1<sup>er</sup> outil d'<span style={specialLetterStyle}>A</span>uto-Diagnostic
          en <span style={specialLetterStyle}>Li</span>gne et de dialogue
          du jeune avec la mission locale
        </h1>
        <h2 style={descriptionStyle}>
          Professionnels de Missions Locales, faites le point
          avec le ou la jeune sur sa situation et ses priorités.
        </h2>
        <p style={descriptionStyle}>
          Pour en savoir plus&nbsp;: <ExternalLink style={linkStyle} href={aliGuideURL}>
            lire le guide A-LI
          </ExternalLink>
        </p>
        <p style={descriptionStyle}>Pour vous identifier&nbsp;:</p>
        <FieldSet label="Nom du conseiller" style={questionStyle}>
          <Input style={questionFontSize} value={advisor} onChange={onChange('advisor')} />
        </FieldSet>
        <FieldSet label="Adresse email du conseiller" style={questionStyle}>
          <Input style={questionFontSize} value={email} onChange={onChange('email')} />
        </FieldSet>
        <FieldSet label="Nom de la Mission Locale" style={questionStyle}>
          <Input style={questionFontSize} value={milo} onChange={onChange('milo')} />
        </FieldSet>
        <FieldSet label="Numéro du département" style={questionStyle}>
          {/* TODO(cyrille): Replace with an auto-suggest. */}
          <Input style={questionFontSize} value={departement} onChange={onChange('departement')} />
        </FieldSet>
        <LabeledToggle
          type="checkbox" isSelected={isUserSupervised} onClick={changeSupervision}
          style={additionalQuestiontyle}
          label="Je vais présenter A-Li et accompagner la passation avec chaque
          jeune à qui je le propose." />
      </div>
    </div>
  </GenericPage>
}
const LandingPage = React.memo(LandingPageBase)

export {LandingPage}
