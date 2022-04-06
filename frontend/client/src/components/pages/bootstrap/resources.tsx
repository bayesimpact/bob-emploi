import _groupBy from 'lodash/groupBy'
import _pick from 'lodash/pick'
import PrinterIcon from 'mdi-react/PrinterIcon'
import {stringify} from 'query-string'
import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useDispatch, useSelector} from 'react-redux'
import {Link} from 'react-router-dom'

import useMedia from 'hooks/media'
import type {BootstrapState, DispatchBootstrapActions} from 'store/actions'
import {computeAdvicesForProject} from 'store/actions'
import type {ValidAdvice} from 'store/advice'
import {getAdviceShortTitle, getAdviceTheme, getAdviceTitle, isValidAdvice,
  translatedResourceThemes} from 'store/advice'
import {parseQueryString} from 'store/parse'
import {useAsynceffect} from 'store/promise'

import type {ExpandedAdviceCardProps} from 'components/advisor'
import {AdvicePicto, AdviceCard as BaseAdviceCard} from 'components/advisor'
import CheckboxList from 'components/checkbox_list'
import LabeledToggle from 'components/labeled_toggle'
import {useModal} from 'components/modal'
import {StatisticsSections} from 'components/pages/connected/project/statistics'
import type {SelectOption} from 'components/select'
import CityInput from 'components/city_input'
import JobInput from 'components/job_input'
import {MAX_CONTENT_WIDTH} from 'components/theme'
import UpDownIcon from 'components/up_down_icon'
import {Routes} from 'components/url'
import logoProductWhiteImage from 'images/bob-logo.svg?fill=%23fff'

const DEFAULT_MODULES_TO_KEEP: ReadonlySet<string> = new Set([
  'all',
  '!network-application-good',
  '!network-application-medium',
  '!improve-resume',
  '!improve-interview',
])

// TODO(cyrille): Avoid the non-default export.
export const modulesFromURL = new Set(
  (parseQueryString(window.location.search).modules || '').split(',').filter(module => !!module))

const modulesToKeep = modulesFromURL.size ? modulesFromURL : DEFAULT_MODULES_TO_KEEP
const shouldShowModule = ({adviceId}: {adviceId: string}): boolean => {
  if (modulesToKeep.has(adviceId)) {
    return true
  }
  if (modulesToKeep.has(`!${adviceId}`)) {
    return false
  }
  if (modulesToKeep.has('all')) {
    return true
  }
  return false
}
const themesContainerStyle: React.CSSProperties = {
  borderBottom: `3px solid ${colors.BACKGROUND_GREY}`,
  margin: 'auto',
  paddingBottom: 19,
}
const checkboxContainerStyle: React.CSSProperties = {
  display: 'flex',
  fontSize: 14,
  justifyContent: 'space-between',
}
const h2Style: React.CSSProperties = {
  fontSize: 24,
  marginTop: 35,
}
const methodStyle = {
  marginBottom: 30,
}
const selectedPictoStyle: React.CSSProperties = {
  marginRight: 5,
  width: 20,
}
const printButtonStyle: React.CSSProperties = {
  backgroundColor: colors.BOB_BLUE,
  borderRadius: 5,
  bottom: 25,
  boxShadow: '0 1px 4px 0 rgba(0, 0, 0, 0.1)',
  color: '#fff',
  display: 'flex',
  justifyContent: 'center',
  left: 25,
  padding: 15,
  position: 'absolute',
  right: 25,
  textDecoration: 'none',
}
const searchBarStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 5,
  display: 'flex',
  margin: 'auto',
  maxWidth: MAX_CONTENT_WIDTH,
  position: 'relative',
}
const statsPageLink: React.CSSProperties = {
  color: '#fff',
  padding: '5px 15px',
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translate(100%, -50%)',
}
const navStyle: React.CSSProperties = {
  backgroundColor: colors.BOB_BLUE,
  padding: '8px 90px',
  position: 'relative',
}
const logoStyle: React.CSSProperties = {
  height: 24,
  left: 20,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
}
const resourcesContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  margin: 'auto',
}
const ResourcesPage = (): React.ReactElement => {
  const {t} = useTranslation()
  const dispatch = useDispatch<DispatchBootstrapActions>()
  const resourceThemes = translatedResourceThemes(t)
  const themeOptions = useMemo(
    (): readonly SelectOption[] =>
      resourceThemes.map(({name, themeId}) => ({name, value: themeId})),
    [resourceThemes],
  )
  const themeNames = useMemo(
    (): Record<string, string> =>
      Object.fromEntries(resourceThemes.map(({name, themeId}) => [themeId, name])),
    [resourceThemes],
  )
  const user = useSelector(({user}: BootstrapState) => user)
  const selectedAdviceIds = useSelector(({adviceIds}: BootstrapState) => adviceIds)
  const project = user.projects && user.projects[0] || {}
  const {city, targetJob} = project
  const {cityId = undefined} = city || {}
  const {codeOgr: jobId = undefined} = targetJob || {}

  const [areStatsShown, showStatsPage, hideStatsPage] = useModal()

  const [adviceModules, setAdviceModules] = useState<readonly ValidAdvice[]>([])
  const allThemes = useMemo(
    () => translatedResourceThemes(t).map(({themeId}): string => themeId), [t])
  const [themes, setThemes] = useState(allThemes)
  const setOrderedThemes = useCallback((newThemes: readonly string[]) => {
    const themesSet = new Set(newThemes)
    setThemes(allThemes.filter(theme => themesSet.has(theme)))
  }, [allThemes])
  const methodGroups = _groupBy(
    adviceModules.filter(shouldShowModule).filter(({adviceId}): boolean =>
      !selectedAdviceIds.length || selectedAdviceIds.includes(adviceId)),
    (method) => getAdviceTheme(method, t))
  const isForPrint = useMedia() === 'print'
  const isDoneWaiting = useSelector(({asyncState: {isFetching}}: BootstrapState) => {
    const fetchingAdvice = _pick(
      isFetching, adviceModules.map(({adviceId}) => `get-advice-data-${adviceId}`))
    return !!Object.keys(fetchingAdvice).length &&
      Object.values(fetchingAdvice).every(waiting => !waiting)
  })
  useEffect((): (() => void) => {
    if (isForPrint && adviceModules.length && isDoneWaiting) {
      window.print()
      return (): void => void 0
    }
    if (isForPrint) {
      const timeout = window.setTimeout(window.print, 2000)
      return (): void => window.clearTimeout(timeout)
    }
    return (): void => void 0
  }, [adviceModules.length, isDoneWaiting, isForPrint])

  useEffect(() => {
    dispatch({features: {allModules: true}, type: 'SET_FEATURES'})
  }, [dispatch])

  useAsynceffect(async (checkIfCanceled) => {
    if (!cityId || !jobId) {
      return (): void => void 0
    }
    setAdviceModules([])
    const response = await dispatch(computeAdvicesForProject(user))
    if (response && response.advices && !checkIfCanceled()) {
      setAdviceModules(response.advices.filter(isValidAdvice))
    }
  }, [cityId, dispatch, jobId, user])

  const handleCityChange = useCallback((city?: bayes.bob.FrenchCity): void => {
    const {cityId: newCityId = undefined} = city || {}
    if (!newCityId || newCityId === cityId) {
      return
    }
    dispatch({city, type: 'SET_CITY'})
  }, [dispatch, cityId])

  const handleJobChange = useCallback((job?: bayes.bob.Job): void => {
    const {codeOgr: newJobId = undefined} = job || {}
    if (!newJobId || newJobId === jobId) {
      return
    }
    dispatch({job, type: 'SET_JOB'})
  }, [dispatch, jobId])
  const [selectedMethods, setSelectedMethods] = useState<readonly ValidAdvice[]>([])
  const onSelect = useCallback((advice: ValidAdvice, isSelected: boolean) => {
    if (isSelected) {
      setSelectedMethods(methods => [...methods, advice])
      return
    }
    setSelectedMethods(methods => methods.filter(({adviceId}) => adviceId !== advice.adviceId))
  }, [])
  const printRedirect = useMemo(() => ({
    hash: '#' + encodeURIComponent(JSON.stringify({
      adviceIds: selectedMethods.map(({adviceId}) => adviceId),
      user,
    } as bayes.bob.UserWithAdviceSelection)),
    pathname: Routes.RESOURCES_PAGE,
    search: '?' + stringify({media: 'print'}),
  }), [selectedMethods, user])

  const resourcesListStyle: React.CSSProperties = {
    width: isForPrint ? 'initial' : '60%',
  }
  const printContainerStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    backgroundColor: colors.PALE_GREY,
    border: `1px solid ${colors.MODAL_PROJECT_GREY}`,
    borderRadius: 5,
    margin: '20px 0 0 35px',
    maxWidth: 350,
    padding: '30px 25px 100px',
    position: 'relative',
  }
  const selectionHeaderStyle: React.CSSProperties = {
    fontSize: 19,
    marginTop: 0,
  }
  const pStyle: React.CSSProperties = {
    fontSize: 14,
  }
  const themeTitleStyle: React.CSSProperties = {
    fontSize: 14,
    margin: '50px 0 15px',
    textTransform: 'uppercase',
  }
  const printMethodStyle = {
    alignItems: 'center',
    borderBottom: `1px solid ${colors.SILVER}`,
    display: 'flex',
    padding: '15px 0',
  } as const
  const isUserDefined = !!(city && targetJob)
  return <React.Fragment>
    {isForPrint ? null : <nav style={navStyle}>
      <img src={logoProductWhiteImage} alt={config.productName} style={logoStyle} />
      <div style={searchBarStyle} className="no-hover no-focus">
        <JobInput value={targetJob} onChange={handleJobChange} placeholder={t('métier')} />
        <CityInput value={city} onChange={handleCityChange} placeholder={t('ville')} />
        {/* TODO(pascal): Check with John for a better UI. */}
        {isUserDefined ? <button
          style={statsPageLink} onClick={areStatsShown ? hideStatsPage : showStatsPage}
          type="button">
          {areStatsShown ? t('Voir les conseils') : t('Voir les stats')}
        </button> : null}
      </div>
    </nav>}
    {isUserDefined && areStatsShown ?
      <StatisticsSections project={project} /> :
      <div style={{margin: '0 auto', maxWidth: MAX_CONTENT_WIDTH, padding: '0 20px'}}>
        {isForPrint ? null : <div style={themesContainerStyle}>
          <h2 style={h2Style}>{t('Choisissez un ou plusieurs thèmes')}</h2>
          <CheckboxList
            options={themeOptions}
            values={themes}
            onChange={setOrderedThemes}
            style={checkboxContainerStyle} />
        </div>}
        <div style={resourcesContainerStyle}>
          <div style={resourcesListStyle}>
            <h2 style={h2Style}>
              {isForPrint ? t('Ressources sélectionnées') : t('Ressources disponibles')}
            </h2>
            {isUserDefined ?
              // TODO(cyrille): Show a placeholder while there's no result.
              themes.map(theme => methodGroups[theme]?.length ?
                <div key={theme}>
                  <h3 style={themeTitleStyle}>{themeNames[theme]}</h3>
                  {methodGroups[theme].map((advice: ValidAdvice) =>
                    <AdviceCard
                      style={methodStyle} project={project}
                      onSelect={onSelect}
                      isSelected={selectedMethods.includes(advice)}
                      key={advice.adviceId} advice={advice} />)}
                </div> : null) : null}
          </div>
          {isForPrint && !selectedMethods.length ? null : <div style={printContainerStyle}>
            <h2 style={selectionHeaderStyle}>{t('Ressources à imprimer')}</h2>
            <p style={pStyle}>{t('Sélectionnez les ressources dans la liste')}</p>
            {selectedMethods.map((method, index) => <div
              key={method.adviceId} style={index ? printMethodStyle :
                {...printMethodStyle, borderTop: printMethodStyle.borderBottom}}>
              <AdvicePicto style={selectedPictoStyle} adviceId={method.adviceId} />
              {getAdviceShortTitle(method, t)}
            </div>)}
            {selectedMethods.length ?
              <Link target="_blank" style={printButtonStyle} to={printRedirect}>
                <PrinterIcon /> {t('Imprimer')} ({selectedMethods.length})
              </Link> : null}
          </div>}
        </div>
      </div>}
  </React.Fragment>
}

interface CardProps extends ExpandedAdviceCardProps {
  isSelected?: boolean
  onSelect: (advice: ValidAdvice, isSelected: boolean) => void
}
const AdviceCardBase = (props: CardProps): React.ReactElement => {
  const {advice, isSelected, onSelect, style, ...cardContentProps} = props
  const {t} = useTranslation()
  const containerStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    display: 'flex',
    ...style,
  }), [style])
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 5,
    boxShadow: '0 5px 20px 0 rgba(0, 0, 0, 0.15)',
    flex: 1,
    fontSize: 13,
    padding: 12,
  }
  const isForPrint = useMedia() === 'print'
  const [isExpanded, setExpanded] = useState(isForPrint)
  const toggleExpanded = useCallback(
    (): void => setExpanded((wasExpanded: boolean) => !wasExpanded),
    [])
  const toggleSelected = useCallback(
    (): void => onSelect(advice, !isSelected),
    [advice, isSelected, onSelect],
  )
  const checkboxStyle = useMemo((): React.CSSProperties => ({
    color: isSelected ? colors.BOB_BLUE : colors.COOL_GREY,
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 20,
  }), [isSelected])
  const headerStyle: React.CSSProperties = {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    marginBottom: isExpanded ? 10 : 0,
  }
  // TODO(pascal): Display only resources instead of full advice (e.g. drop
  // the extra text introducing the resources in each card).
  return <div style={containerStyle}>
    <section style={cardStyle}>
      {/* The header is clickable even without a mouse because it contains a button. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
      <header style={headerStyle} onClick={toggleExpanded}>
        <AdvicePicto adviceId={advice.adviceId} style={{height: 48, marginRight: 12}} />
        <div>
          <h3 style={{margin: '0 0 3px'}}>{getAdviceShortTitle(advice, t)}</h3>
          {getAdviceTitle(advice, t)}
        </div>
        {isForPrint ? null : <React.Fragment>
          <div style={{flex: 1}} />
          <button style={{flex: 'none', fontWeight: 'bold'}} type="button">{t('Voir plus')}</button>
          <UpDownIcon size={24} icon="chevron" isUp={isExpanded} style={{flex: 'none'}} />
        </React.Fragment>}
      </header>
      {isExpanded ? <BaseAdviceCard
        aria-live="polite" advice={advice} {...cardContentProps} /> : null}
    </section>
    {isForPrint ? null : <LabeledToggle
      type="checkbox" label={t('Imprimer')} style={checkboxStyle}
      isSelected={isSelected} onClick={toggleSelected} />}
  </div>
}
const AdviceCard = React.memo(AdviceCardBase)

export default React.memo(ResourcesPage)
