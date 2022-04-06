import React, {useCallback, useState} from 'react'
import {useDispatch, useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'

import ExternalLink from 'components/external_link'
import {OneField} from 'components/field_set'
import Input from 'components/input'
import LabeledToggle from 'components/labeled_toggle'
import CityInput from 'components/city_input'
import {Styles} from 'components/theme'
import aliLogo from '../../images/logo-ali.svg'

import Button from '../button'
import GenericPage from '../page'
import type {DispatchActions, MiloCity, MiniRootState, OrgInfo} from '../../store'
import {Routes} from '../../store'


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
  color: colors.PEA,
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
  color: colors.MAGENTA,
}

const linkStyle: React.CSSProperties = {
  cursor: 'pointer',
}

const aliGuideURL = 'https://www.unml.info/assets/files/espace-docu-ml/A-Li/unml_a-li_guide_a4_def.pdf' // checkURL

const LandingPage = (): React.ReactElement => {
  const {orgInfo, isUserSupervised: wasUserSupervised} = useSelector(({app}: MiniRootState) => app)
  const {advisor, email, milo} = orgInfo
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
  const onMiloChange = useCallback((milo?: MiloCity): void => {
    if (!milo) {
      return
    }
    dispatch({
      orgInfo: {milo},
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
      onMiloChange({departementId: '69', name: 'Lyon Part-Dieu'})
    }
  }, [advisor, email, milo, onChange, onMiloChange])
  const skipLanding = useCallback(
    (): void => void dispatch(
      {isUserSupervised: !!isUserSupervised, type: 'MINI_ONBOARDING_FINISH_LANDING'}),
    [dispatch, isUserSupervised])
  const isFormFull = advisor && milo && email
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFastForward(isFormFull ? skipLanding : fillForm, [], isFormFull ? Routes.HUB_PAGE : undefined)
  // TODO(sil): Restrict milo search to a relevant subset.
  return <GenericPage hasLargeDecoration={true} bottomButton={
    <Button
      to={isUserSupervised ? Routes.HUB_PAGE : Routes.USER_LANDING_PAGE} onClick={skipLanding}
      disabled={!milo}>
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
        <OneField label="Nom du conseiller" style={questionStyle}>
          <Input
            style={questionFontSize} value={advisor} onChange={onChange('advisor')}
            name="name" autoComplete="name" />
        </OneField>
        <OneField label="Adresse email du conseiller" style={questionStyle}>
          <Input
            style={questionFontSize} value={email} onChange={onChange('email')}
            name="email" autoComplete="email" />
        </OneField>
        <OneField label="Nom de la Mission Locale" style={questionStyle} isValid={!!milo}>
          <CityInput
            algoliaIndex="milo"
            onChange={onMiloChange}
            style={{padding: 1, ...Styles.INPUT}}
            value={milo} />
        </OneField>
        <LabeledToggle
          type="checkbox" isSelected={isUserSupervised} onClick={changeSupervision}
          style={additionalQuestiontyle}
          label="Je vais présenter A-Li et accompagner la passation avec chaque
          jeune à qui je le propose." />
      </div>
    </div>
  </GenericPage>
}


export default React.memo(LandingPage)
