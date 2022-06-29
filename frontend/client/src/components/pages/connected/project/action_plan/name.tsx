import React, {useCallback, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useSelector} from 'react-redux'

import useFastForward from 'hooks/fast_forward'
import type {RootState} from 'store/actions'
import {goToFirstStrategy, renameProjectActionPlan, useDispatch} from 'store/actions'

import {FixedButtonNavigation} from 'components/navigation'
import ValidateInput from 'components/validate_input'

import Page, {contentWidth, discussionStyle, navButtonStyle} from './base'

const nameStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  borderRadius: 100,
  marginBottom: 5,
  marginTop: 15,
}

interface PageConfig {
  onDone: () => void
}

// TODO(émilie): Consider deleting this file as the action has been moved into recap.tsx.
const ActionPlanNamePage = ({onDone}: PageConfig): React.ReactElement => {
  const {t} = useTranslation()
  const dispatch = useDispatch()
  const project = useSelector(
    ({user: {projects}}: RootState): bayes.bob.Project => projects?.[0] || {},
  )
  const [name, setName] = useState(project?.actionPlanName)

  const handleSubmit = useCallback(() => {
    if (name && name !== (project?.actionPlanName || '')) {
      dispatch(renameProjectActionPlan(project, name))
    }
    dispatch(goToFirstStrategy)
    onDone()
  }, [dispatch, name, onDone, project])

  useFastForward(handleSubmit)

  return <Page page="name">
    <div style={discussionStyle}>{t(
      'Merci de nous faire confiance\u00A0! ' +
      "Et si vous donniez un petit nom à votre plan d'action\u00A0?")}
    </div>
    <ValidateInput
      defaultValue={name} onChange={setName}
      name="action-plan-name"
      placeholder={t("Mon plan d'action")}
      style={nameStyle} shouldFocusOnMount={true} />
    <FixedButtonNavigation
      onClick={handleSubmit} style={navButtonStyle()}
      width={contentWidth}>
      {t('Consulter la première stratégie')}
    </FixedButtonNavigation>
  </Page>
}


export default React.memo(ActionPlanNamePage)
