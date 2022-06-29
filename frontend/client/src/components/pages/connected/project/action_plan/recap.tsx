import _groupBy from 'lodash/groupBy'
import _uniqueId from 'lodash/uniqueId'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {generatePath} from 'react-router'

import useFastForward from 'hooks/fast_forward'
import {finishActionPlanOnboarding, renameProjectActionPlan, useDispatch} from 'store/actions'
import {lowerFirstLetter} from 'store/french'

import Trans from 'components/i18n_trans'
import {FixedButtonNavigation} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement,
  QuestionBubble} from 'components/phylactery'
import {SmartLink} from 'components/radium'
import {Routes} from 'components/url'
import ValidateInput from 'components/validate_input'

import Page, {contentWidth, discussionStyle, navButtonStyle} from './base'

const nameStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  borderRadius: 100,
  marginBottom: 5,
  marginTop: 15,
}

const noNameLinkStyle: RadiumCSSProperties = {
  ':focus': {textDecoration: 'underline'},
  ':hover': {textDecoration: 'underline'},
  'color': colors.BOB_BLUE,
  'fontWeight': 'bold',
  'marginLeft': 3,
}
const noNameTextStyle: React.CSSProperties = {
  color: colors.GREY,
  marginTop: 8,
}
interface Props {
  project: bayes.bob.Project
}
const ActionPlanRecapPage = ({project}: Props) => {
  const {actionPlanName = '', actions: allActions, projectId = '', strategies} = project
  const {t} = useTranslation()

  const nameLabelId = useMemo(_uniqueId, [])
  const [name, setName] = useState(actionPlanName)
  const [hasNoDecidedNotToName, setHasNoDecidedNotToName] = useState(false)
  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const showButton = useCallback(() => setIsButtonVisible(true), [])

  const handleSetNoName = useCallback(() => {
    setHasNoDecidedNotToName(true)
  }, [])

  const actions = allActions?.filter(({status}) => status === 'ACTION_CURRENT') || []
  const actionCount = actions.length || 0

  const nextUrl = useMemo(
    () => actionCount ? generatePath(Routes.ACTION_PLAN_PLAN_PAGE, {projectId}) : {
      pathname: generatePath(Routes.ACTION_PLAN_STRAT_PATH, {projectId}),
      state: {isAlreadyRead: true},
    },
    [actionCount, projectId],
  )

  const dispatch = useDispatch()
  const finishOnboarding = useCallback(() => {
    if (!actionCount) {
      return
    }
    if (name && name !== (actionPlanName || '')) {
      dispatch(renameProjectActionPlan(project, name))
    }
    dispatch(finishActionPlanOnboarding(project))
  }, [actionPlanName, actionCount, dispatch, name, project])

  const [isFastForwarded, setFastForwarded] = useState(false)
  useFastForward(() => {
    if (!isFastForwarded) {
      setFastForwarded(true)
      return
    }
    finishOnboarding()
  }, [isFastForwarded, finishOnboarding], isFastForwarded ? nextUrl : undefined)
  const actionCountByStrategy = _groupBy(actions, 'acceptedFromStrategyId')
  const bubblesToRead = actionCount ? [
    <BubbleToRead key="intro-1"><Trans count={actionCount} parent={null}>
      Bravo&nbsp;! Vous avez choisi <strong>{{count: actionCount}} action</strong> pour accélérer
      votre recherche d'emploi
    </Trans></BubbleToRead>,
    <BubbleToRead key="intro-2">
      {t("Voici un petit récapitulatif de votre plan d'action\u00A0:")}
    </BubbleToRead>,
    ...strategies?.
      map(({strategyId = '', title = '', infinitiveTitle = title}) => ({
        count: actionCountByStrategy[strategyId]?.length || 0,
        infinitiveTitle,
        strategyId,
      })).
      filter(({count}) => !!count).
      map(({count, strategyId, infinitiveTitle}) => <BubbleToRead key={strategyId}>
        <Trans count={count} parent={null}>
          <strong>{{count}} action</strong> pour <strong>
            {{goal: lowerFirstLetter(infinitiveTitle)}}
          </strong>
        </Trans>
      </BubbleToRead>) || [],
    <BubbleToRead id={nameLabelId} key="name">
      {t("Et si vous donniez un petit nom à votre plan d'action\u00A0?")}
    </BubbleToRead>,
  ] : [
    <BubbleToRead key="intro-1"><Trans parent={null}>
      Vous n'avez sélectionné <strong>aucune action</strong> à ajouter à votre plan.
    </Trans></BubbleToRead>,
    <BubbleToRead key="intro-2">{t(
      'Pour que je puisse vous aider dans votre recherche, ' +
      'vous devez ajouter au moins une action à votre plan.',
    )}</BubbleToRead>,
    <BubbleToRead key="outro"><strong>
      {t('Je vous propose de revenir à la première stratégie pour trouver une action 🙂')}
    </strong></BubbleToRead>,
  ]
  return <Page title={t("Résumé de mon plan d'action")} page="recap">
    <Discussion style={discussionStyle} onDone={showButton} isFastForwarded={isFastForwarded}>
      <DiscussionBubble>
        {bubblesToRead}
      </DiscussionBubble>
      {actionCount ? <QuestionBubble isDone={!!name || hasNoDecidedNotToName}>
        <ValidateInput
          defaultValue={name} onChange={setName}
          name="action-plan-name"
          placeholder={t("Mon plan d'action")}
          style={nameStyle} shouldFocusOnMount={true} />
        <Trans parent="p" style={noNameTextStyle}>
          Si vous ne souhaitez pas ajouter de nom, vous pouvez passer cette étape. <SmartLink
            style={noNameLinkStyle} onClick={handleSetNoName}>Je souhaite passer cette étape.
          </SmartLink></Trans>
      </QuestionBubble> : null}
      {actionCount ? <BubbleToRead key="outro"><Trans count={actionCount} parent={null}>
        <strong>Dernière étape&nbsp;:</strong> définir quand vous voulez commencer cette
        action&nbsp;!
      </Trans></BubbleToRead> : null}
      <NoOpElement />
    </Discussion>
    <FixedButtonNavigation
      onClick={actionCount ? finishOnboarding : undefined} to={nextUrl}
      width={contentWidth} style={navButtonStyle(isButtonVisible)}>
      {actionCount ? t("Ajouter des échéances à mon plan d'action") :
        t("Ajouter des actions à mon plan d'action")}
    </FixedButtonNavigation>
  </Page>
}
export default React.memo(ActionPlanRecapPage)
