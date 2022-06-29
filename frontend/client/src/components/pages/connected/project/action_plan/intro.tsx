import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import useFastForward from 'hooks/fast_forward'

import {FixedButtonNavigation} from 'components/navigation'
import {BubbleToRead, Discussion, DiscussionBubble, NoOpElement} from 'components/phylactery'

import Page, {contentWidth, discussionStyle, navButtonStyle} from './base'



type BubbleToReadElement = React.ReactElement<React.ComponentPropsWithoutRef<typeof BubbleToRead>>


interface PageConfig {
  onDone: () => void
  strategies: readonly bayes.bob.Strategy[] | undefined
}

const ActionPlanIntroPage = ({onDone, strategies}: PageConfig): React.ReactElement => {
  const {t} = useTranslation()

  const [isButtonVisible, setIsButtonVisible] = useState(false)
  const showButton = useCallback(() => setIsButtonVisible(true), [])

  const [isFastForwarded, setIsFastForwarded] = useState(false)
  const onFastForward = useCallback((): void => {
    if (!isFastForwarded) {
      setIsFastForwarded(true)
      return
    }
    onDone()
  }, [isFastForwarded, onDone])
  useFastForward(onFastForward)

  const bubblesToRead = useMemo((): readonly BubbleToReadElement[] => [
    <BubbleToRead key="static-1">
      {t("J'ai examiné attentivement vos réponses et j'ai analysé votre situation\u00A0!")}
    </BubbleToRead>,
    <BubbleToRead key="static-2">
      {t(
        'Voici une liste de stratégies qui seront efficaces pour améliorer votre recherche ' +
        "d'emploi. Je vous les présente par priorité\u00A0:",
      )}
    </BubbleToRead>,
    ...(strategies || []).map((strategy: bayes.bob.Strategy, index: number):BubbleToReadElement =>
      <BubbleToRead key={`strat-${index}`}>
        {index + 1}. {strategy.infinitiveTitle || strategy.title}
      </BubbleToRead>,
    ),
    <BubbleToRead key="static-3" readingTimeMillisec={100}>
      {t(
        'Je vous présente ensuite des actions pour chaque priorité que vous pouvez ' +
        'planifier de faire quand cela vous convient — choisissez celles qui vous semblent ' +
        'les plus pertinentes\u00A0!',
      )}
    </BubbleToRead>,
  ], [strategies, t])

  return <Page page="intro">
    <Discussion style={discussionStyle} isFastForwarded={isFastForwarded} onDone={showButton}>
      <DiscussionBubble>
        {bubblesToRead}
      </DiscussionBubble>
      <NoOpElement />
    </Discussion>
    <FixedButtonNavigation
      onClick={onDone} style={navButtonStyle(isButtonVisible)} width={contentWidth}>
      {t("Créer mon plan d'action")}
    </FixedButtonNavigation>
  </Page>
}


export default React.memo(ActionPlanIntroPage)
