import {TFunction} from 'i18next'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import {displayToasterMessage} from 'store/actions'
import {localizeOptions, prepareT} from 'store/i18n'
import {useSafeDispatch} from 'store/promise'

import Button from 'components/button'
import ExternalLink from 'components/external_link'
import RadioGroup from 'components/radio_group'
import {Routes} from 'components/url'

import {DispatchAllEvalActions, sendEmail} from '../store/actions'


interface PanelProps {
  coachingEmailFrequency: bayes.bob.EmailFrequency
  emailsSent: readonly bayes.bob.EmailSent[]
  onChangeFrequency: (coachingEmailFrequency: bayes.bob.EmailFrequency) => void
  user: bayes.bob.User
}


const millisecsPerDay = 86_400_000


const coachingOptions = [
  {name: prepareT('maximum'), value: 'EMAIL_MAXIMUM'},
  {name: prepareT('mensuel'), value: 'EMAIL_ONCE_A_MONTH'},
] as const


const computeDelta = (t: TFunction, date?: string): string => {
  if (!date) {
    return ''
  }
  const now = new Date()
  const futureDate = new Date(date)
  const deltaDays = Math.round((futureDate.getTime() - now.getTime()) / millisecsPerDay)
  return t('après {{count}} jour', {count: deltaDays})
}


interface CoachingEmailsSentRowProps {
  emailSent: bayes.bob.EmailSent
  user: bayes.bob.User
}


const CoachingEmailSentRowBase = (props: CoachingEmailsSentRowProps): React.ReactElement => {
  const {emailSent: {campaignId, sentAt, subject}, user} = props
  const {t} = useTranslation()
  const [isSending, setIsSending] = useState(false)
  const dispatch = useSafeDispatch<DispatchAllEvalActions>()
  const handleSendMail = useCallback(async (): Promise<void> => {
    if (!campaignId) {
      return
    }
    setIsSending(true)
    const emaillSent = await dispatch(sendEmail(user, campaignId))
    setIsSending(false)
    if (emaillSent) {
      dispatch(displayToasterMessage(t('Email envoyé')))
    }
  }, [campaignId, dispatch, t, user])
  const seeEmailLink = useMemo((): string => {
    const {profile, projects} = user
    const trimmedUser = {
      profile,
      projects: projects?.map(({
        advices: unusedAdvices,
        diagnostic: unusedDiagnostic,
        localStats: unusedLocalStats,
        strategies: unusedStrategies,
        ...project}) => project),
    }
    const userParam = encodeURIComponent(JSON.stringify(trimmedUser))
    const base = window.location.origin + Routes.ROOT
    return `${base}api/emails/content/${campaignId}?data=${userParam}`
  }, [campaignId, user])
  return <tr>
    <td style={firstCellStyle}>{campaignId}</td>
    <td style={cellStyle}>{subject}</td>
    <td title={sentAt} style={cellStyle}>{computeDelta(t, sentAt)}</td>
    <td style={cellStyle}>
      {campaignId ? <ExternalLink href={seeEmailLink} style={mailjetLinkStyle}>
        {t("Voir l'email")}
      </ExternalLink> : null}
    </td>
    <td style={cellStyle}>
      {campaignId ? <Button onClick={handleSendMail} isProgressShown={isSending}>
        {t('Envoyer')}
      </Button> : null}
    </td>
  </tr>
}
const CoachingEmailSentRow = React.memo(CoachingEmailSentRowBase)


const coachingDivStyle = {
  display: 'flex',
  padding: '10px 15px',
}

const radioGroupStyle = {
  display: 'flex',
}


const radioChildStyle = {
  marginLeft: 30,
}


const tableStyle = {
  borderSpacing: 0,
  textAlign: 'left',
  width: '100%',
} as const


const firstCellStyle = {
  borderBottom: `solid 2px ${colors.MODAL_PROJECT_GREY}`,
  padding: '10px 15px',
} as const


const cellStyle = {
  ...firstCellStyle,
  borderLeft: firstCellStyle.borderBottom,
}


const mailjetLinkStyle = {
  color: colors.COOL_GREY,
  fontStyle: 'italic',
}


const Coaching: React.FC<PanelProps> = (props: PanelProps): React.ReactElement|null => {
  const {coachingEmailFrequency, emailsSent, onChangeFrequency, user} = props
  const {t} = useTranslation()
  return <React.Fragment>
    <div style={coachingDivStyle}>
      <strong>{t('Intensité du coaching\u00A0:')}</strong> <RadioGroup<bayes.bob.EmailFrequency>
        style={radioGroupStyle}
        onChange={onChangeFrequency}
        options={localizeOptions(t, coachingOptions)} value={coachingEmailFrequency}
        childStyle={radioChildStyle} />
    </div>
    <table style={tableStyle}>
      <thead><tr>
        <th style={firstCellStyle}>{t('Email envoyé')}</th>
        <th style={cellStyle}>{t('Titre')}</th>
        <th style={cellStyle}>{t("Date d'envoi")}</th>
        <th style={cellStyle}>{t('Lien Mail')}</th>
        <th style={cellStyle} />
      </tr></thead>
      <tbody>
        {emailsSent.map((emailSent: bayes.bob.EmailSent, index: number): React.ReactNode =>
          <CoachingEmailSentRow key={index} {...{emailSent, user}} />)}
      </tbody>
    </table>
  </React.Fragment>
}


export default React.memo(Coaching)
