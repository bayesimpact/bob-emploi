import React, {useCallback, useEffect, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'
import {Redirect} from 'react-router'

import {DispatchAllActions, RootState, simulateFocusEmails} from 'store/actions'
import useKeyListener from 'hooks/key_listener'
import isMobileVersion from 'store/mobile'
import {useSafeDispatch} from 'store/promise'
import {useEmailsInProfile} from 'store/user'

import Button from 'components/button'
import {colorToAlpha} from 'components/colors'
import {Routes} from 'components/url'


type EmailSent = bayes.bob.EmailSent & {
  campaignId: string
  subject: string
}

const emptyArray = [] as const
const emptyEmail: EmailSent = {campaignId: '', subject: ''}

// TODO(sil): Maybe D.R.Y all of this with the profile's equivalent.

interface ItemProps {
  email: EmailSent
  onChange: (email: EmailSent) => void
  style: React.CSSProperties
}

const ListItemBase: React.FC<ItemProps> = (props: ItemProps): React.ReactElement => {
  const {email, onChange, style} = props
  const handleSelectEmail = useCallback((): void => onChange(email), [email, onChange])
  return <Button style={style} onClick={handleSelectEmail}>
    {email.subject}
  </Button>
}
const ListItem = React.memo(ListItemBase)


interface TabsProps {
  emailName?: string
  onChange: (email: EmailSent) => void
  style?: React.CSSProperties
  tabs: readonly EmailSent[]
}

// TODO(émilie): Handle the emails with no subject.
const isEmailShowable = (email: bayes.bob.EmailSent): email is EmailSent =>
  !!(email.campaignId && email.isCoaching && email.subject)

const tabStyle = (isSelected: boolean): RadiumCSSProperties => ({
  ':hover': isSelected ? {} : {
    backgroundColor: colorToAlpha(colors.BOB_BLUE, .1), boxShadow: 'initial'},
  'alignItems': 'center',
  'backgroundColor': isSelected ? colors.BOB_BLUE : '#fff',
  'borderRadius': 10,
  'boxShadow': 'initial',
  'color': isSelected ? '#fff' : 'inherit',
  'display': 'flex',
  'height': 50,
  'margin': '5px 0',
  'padding': '0 20px',
  'textAlign': 'initial',
  'width': '100%',
})
const iframeStyle: React.CSSProperties = {
  border: 'none',
  width: '100%',
}
const EmailListBase: React.FC<TabsProps> = (props: TabsProps): React.ReactElement => {
  const {emailName, onChange, style, tabs} = props
  const tabsStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 10,
    boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.1)',
    padding: 25,
    ...style,
  }
  return <div style={tabsStyle}>
    {tabs.map(({campaignId, subject}: EmailSent) => <ListItem
      key={campaignId} style={tabStyle(campaignId === emailName)} email={{campaignId, subject}}
      onChange={onChange} />)}
  </div>
}
const EmailList = React.memo(EmailListBase)


const listStyle = {
  backgroundColor: '#fff',
  borderRadius: 10,
  boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.1)',
  padding: isMobileVersion ? 30 : 40,
  width: isMobileVersion ? 'initial' : 600,
}

const EmailsPage = (): null|React.ReactElement => {
  const dispatch = useSafeDispatch<DispatchAllActions>()
  const user = useSelector(({user}: RootState) => user)
  const token = useSelector(({app: {authToken}}: RootState) => authToken)
  const {t} = useTranslation()

  const emailsSent = useSelector(({user: {emailsSent = emptyArray}}: RootState) => emailsSent)

  const [{campaignId, subject}, setSelectedEmail] = useState(emptyEmail)
  const [shownEmails, setShownEmails] = useState<readonly EmailSent[]>([])
  useEffect(() => setShownEmails(emailsSent.filter(isEmailShowable)), [emailsSent])

  const emailContentUrl = `/api/user/${user.userId}/emails/content/${campaignId}?token=${token}`
  const onLoad = useCallback(({currentTarget}: React.SyntheticEvent<HTMLIFrameElement>) => {
    currentTarget.height = currentTarget.contentWindow?.document.body.scrollHeight?.toString() || ''
  }, [])

  const handleForward = useCallback(() => {
    const prepareEmails = async (): Promise<void> => {
      const simulated = await dispatch(simulateFocusEmails(user))
      if (simulated && simulated.emailsSent) {
        setShownEmails(simulated.emailsSent.filter(isEmailShowable))
      }
    }
    prepareEmails()
  }, [dispatch, user])
  useKeyListener('KeyT', handleForward, {ctrl: true, shift: true})

  if (!useEmailsInProfile()) {
    return isMobileVersion ? null : <Redirect to={Routes.PROFILE_PAGE} />
  }
  return <div style={{alignItems: 'flex-start', display: 'flex', margin: '40px 20px 0'}}>
    {shownEmails.length ? <React.Fragment>
      <EmailList
        tabs={shownEmails} emailName={campaignId} onChange={setSelectedEmail}
        style={{marginRight: 40, minWidth: 360}} />
      {campaignId ? <div style={isMobileVersion ? {marginTop: -40} : listStyle}>
        {isMobileVersion ? null : <h3 style={{margin: '0 0 30px'}}>{subject}</h3>}
        <iframe onLoad={onLoad} style={iframeStyle} title={subject} src={emailContentUrl} />
      </div> : null}
    </React.Fragment> : <p>{t("Il n'y a pas d'email à afficher pour le moment.")}</p>}
  </div>
}
export default React.memo(EmailsPage)
