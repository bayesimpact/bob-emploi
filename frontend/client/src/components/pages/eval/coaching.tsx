import React from 'react'

import {ExternalLink, RadioGroup} from 'components/theme'


interface PanelProps {
  coachingEmailFrequency: bayes.bob.EmailFrequency
  emailsSent: readonly bayes.bob.EmailSent[]
  onChangeFrequency: (coachingEmailFrequency: bayes.bob.EmailFrequency) => void
  project: bayes.bob.Project
}


const millisecsPerDay = 86400000


const coachingOptions = [
  {name: 'maximum', value: 'EMAIL_MAXIMUM'},
  {name: 'mensuel', value: 'EMAIL_ONCE_A_MONTH'},
] as const


const computeDelta = (date?: string): string => {
  if (!date) {
    return ''
  }
  const now = new Date()
  const futureDate = new Date(date)
  const deltaDays = Math.round((futureDate.getTime() - now.getTime()) / millisecsPerDay)
  return `après ${deltaDays} jour${deltaDays > 1 ? 's' : ''}`
}


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


const CoachingPanel: React.FC<PanelProps> = (props: PanelProps): React.ReactElement|null => {
  const {coachingEmailFrequency, emailsSent, onChangeFrequency} = props
  return <React.Fragment>
    <div style={coachingDivStyle}>
      <strong>Intensité du coaching&nbsp;:</strong> <RadioGroup<bayes.bob.EmailFrequency>
        style={radioGroupStyle}
        onChange={onChangeFrequency}
        options={coachingOptions} value={coachingEmailFrequency}
        childStyle={radioChildStyle} />
    </div>
    <table style={tableStyle}>
      <thead><tr>
        <th style={firstCellStyle}>Email envoyé</th>
        <th style={cellStyle}>Titre</th>
        <th style={cellStyle}>Date d'envoi</th>
        <th style={cellStyle}>Lien Mailjet</th>
      </tr></thead>
      <tbody>
        {emailsSent.map((emailSent: bayes.bob.EmailSent, index: number): React.ReactNode =>
          <tr key={index}>
            <td style={firstCellStyle}>{emailSent.campaignId}</td>
            <td style={cellStyle}>{emailSent.subject}</td>
            <td title={emailSent.sentAt} style={cellStyle}>{computeDelta(emailSent.sentAt)}</td>
            <td style={cellStyle}><ExternalLink
              href={`https://app.mailjet.com/template/${emailSent.mailjetTemplate}/version-history`}
              style={mailjetLinkStyle}>
              Voir template
            </ExternalLink></td>
          </tr>)}
      </tbody>
    </table>
  </React.Fragment>
}
const Coaching = React.memo(CoachingPanel)


export {Coaching}
