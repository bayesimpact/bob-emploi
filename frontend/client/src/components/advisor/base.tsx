import type {TFunction} from 'i18next'
import _uniqueId from 'lodash/uniqueId'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import React, {useCallback, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'

import useCachedData from 'hooks/cached_data'
import useMedia from 'hooks/media'
import useTooltip from 'hooks/tooltip'
import type {DispatchAllActions, RootState} from 'store/actions'
import {getExpandedCardContent} from 'store/actions'
import type {LocalizableString} from 'store/i18n'
import {prepareT, toLocaleString} from 'store/i18n'
import {getJobSearchURL} from 'store/job'
import isMobileVersion from 'store/mobile'
import {assetProps} from 'store/skills'
import {dataSourceYear} from 'store/statistics'

import AppearingList from 'components/appearing_list'
import CircularProgress from 'components/circular_progress'
import DataSource from 'components/data_source'
import ExternalLink from 'components/external_link'
import Trans from 'components/i18n_trans'
import Markdown from 'components/markdown'
import {RadiumExternalLink, SmartLink, useHoverAndFocus} from 'components/radium'
import Tag from 'components/tag'
import {SmoothTransitions} from 'components/theme'
import UpDownIcon from 'components/up_down_icon'


const emptyObject = {} as const

interface TagProps {
  color: string
  value: LocalizableString
}
// TODO: Find a better place for those tags if we don't need them elsewhere in this file.
const typeTags: {[type: string]: TagProps} = {
  'apply-to-offer': {
    color: colors.SQUASH,
    value: prepareT('candidature à une offre'),
  },
  'spontaneous-application': {
    color: colors.GREENISH_TEAL,
    value: prepareT('candidature spontanée'),
  },
}

const methodPadding = isMobileVersion ? 10 : 20
const tagStyle = (backgroundColor?: string): React.CSSProperties => ({
  backgroundColor,
  marginLeft: 10,
})

interface ExpandableActionProps {
  children: React.ReactElement<{onClick?: (e?: MouseEvent) => void; style?: React.CSSProperties}>
  contentName?: string
  isForYou?: boolean
  onContentShown?: () => void
  style?: RadiumCSSProperties
  tag?: TagProps
  title: React.ReactNode
  type?: 'apply-to-offer' | 'spontaneous-application'
}


const ExpandableActionTypeBase: React.FC<{type?: ExpandableActionProps['type']}> =
({type}: {type?: ExpandableActionProps['type']}): React.ReactElement|null => {
  const {t: translate} = useTranslation('advisor')
  if (isMobileVersion) {
    return null
  }
  const {color = undefined, value = undefined} = type && typeTags[type] || {}
  if (!value) {
    return null
  }
  const tagStyle = {
    backgroundColor: color,
    marginLeft: 10,
  }
  return <Tag style={tagStyle}>{translate(...value)}</Tag>
}
const ExpandableActionType = React.memo(ExpandableActionTypeBase)

const ExpandableActionBase: React.FC<ExpandableActionProps> =
(props: ExpandableActionProps): React.ReactElement => {
  const {t} = useTranslation('advisor')
  const {children, contentName = t('plus'),
    isForYou, onContentShown, style, title, tag, type} = props
  const isForPrint = useMedia() === 'print'
  const [isContentShown, setIsContentShown] = useState(isForPrint)
  const handleClick = useCallback((): void => {
    setIsContentShown(!isContentShown)
    if (!isContentShown) {
      onContentShown?.()
    }
  }, [isContentShown, onContentShown, setIsContentShown])
  const {isHovered, isFocused, ...radiumHandlers} = useHoverAndFocus<HTMLDivElement>()
  const isActive = isHovered || isFocused
  const headerStyle: React.CSSProperties = {
    ...style,
    alignItems: 'center',
    color: colors.CHARCOAL_GREY,
    cursor: 'pointer',
    display: 'flex',
    fontSize: 13,
    height: 50,
    ...isActive && style?.[':hover'],
  }
  const iconStyle: React.CSSProperties = {
    height: 20,
    lineHeight: '13px',
    marginLeft: 5,
    width: 20,
  }
  const hiddenContentStyle: React.CSSProperties = {
    marginBottom: 0,
    marginTop: 0,
    maxHeight: 0,
    opacity: 0,
    overflow: 'hidden',
    paddingBottom: 0,
    paddingTop: 0,
  }
  const childStyle = (childProps: {style?: React.CSSProperties}): React.CSSProperties => ({
    ...childProps.style,
    paddingBottom: 15,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 15,
    ...isContentShown ? {} : hiddenContentStyle,
    ...SmoothTransitions,
  })
  const seeContentStyle: React.CSSProperties = {
    color: colors.WARM_GREY,
    fontStyle: 'italic',
    fontWeight: 'normal',
    textAlign: 'right',
  }
  const expandSectionButtonStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    outline: 0,
  }
  const titleId = useMemo(_uniqueId, [])
  // TODO(guillaume): Print reason when the user mouseovers the tag.
  // Clicking on the header is equivalent to clicking on the linked title, it is a convenience added
  // for users that have a cursor.
  return <React.Fragment>
    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
    <div {...radiumHandlers} style={headerStyle} onClick={handleClick}>
      <strong id={titleId} style={(isForYou || tag || type) ? undefined : {flex: 1}}>
        {title}
      </strong>
      {isForYou ? <Tag style={tagStyle(colors.BOB_BLUE)}>
        {t('Selectionné pour vous')}
      </Tag> : null}
      {tag ? <Tag style={tagStyle(tag.color)}>
        {tag.value}
      </Tag> : null}
      <ExpandableActionType type={type} />
      {(isForYou || tag || type) ? <span style={{flex: 1}} /> : undefined}
      <SmartLink onClick={handleClick} aria-describedby={titleId} style={expandSectionButtonStyle}>
        {isMobileVersion || isForPrint ? null : <span style={seeContentStyle}>
          {isContentShown ? t('Voir moins') : t('Voir {{contentName}}', {contentName})}{' '}
        </span>}
        {isForPrint ? null : <UpDownIcon
          icon="chevron" isUp={isContentShown} style={iconStyle}
          aria-hidden={true} focusable={false} />}
      </SmartLink>
    </div>
    <div aria-hidden={!isContentShown} style={{cursor: 'auto', fontWeight: 'normal'}}>
      {React.cloneElement(children, {
        style: childStyle(children.props),
      })}
    </div>
  </React.Fragment>
}
const ExpandableAction: React.ComponentType<ExpandableActionProps> =
  React.memo(ExpandableActionBase)


export interface EmailTemplateProps extends Omit<ExpandableActionProps, 'children'> {
  content: string
  style?: React.CSSProperties
  tip?: string
  title: React.ReactNode
  whyForYou?: string
}


const EmailTemplateBase: React.FC<EmailTemplateProps> =
(props: EmailTemplateProps): React.ReactElement => {
  const {content, contentName, tip} = props
  const {t} = useTranslation('advisor')
  const contentStyle: React.CSSProperties = {
    borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
    color: colors.CHARCOAL_GREY,
    fontSize: 13,
    maxHeight: 600,
    overflow: 'hidden',
    paddingLeft: 15,
  }
  const tipStyle: React.CSSProperties = {
    fontSize: 13,
    opacity: 1,
    paddingBottom: 15,
    paddingLeft: 15,
  }
  return <ExpandableAction {...props} contentName={contentName || t("l'email")}>
    <div>
      <div style={contentStyle}>
        <Markdown content={content} />
      </div>
      {tip ? <div style={tipStyle}><strong>Astuce&nbsp;: </strong>{tip}</div> : null}
    </div>
  </ExpandableAction>
}
const EmailTemplate = React.memo(EmailTemplateBase)



interface ToolCardProps {
  children: React.ReactNode
  hasBorder?: boolean
  href: string
  imageSrc: string
  onClick?: () => void
  style?: React.CSSProperties
}


const ToolCardBase: React.FC<ToolCardProps> = (props: ToolCardProps): React.ReactElement => {
  const {children, hasBorder, href, imageSrc, onClick, style} = props
  const cardStyle: RadiumCSSProperties = {
    ':hover': {
      backgroundColor: colors.LIGHT_GREY,
    },
    'alignItems': 'center',
    'backgroundColor': '#fff',
    'color': 'inherit',
    'cursor': 'pointer',
    'display': 'flex',
    'textDecoration': 'none',
    ...(hasBorder && {
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      borderRadius: 4,
      padding: 10,
    }),
    ...SmoothTransitions,
    ...style,
  }
  const titleStyle: React.CSSProperties = {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
  }
  return <RadiumExternalLink style={cardStyle} onClick={onClick} href={href}>
    <span style={titleStyle}>
      <img src={imageSrc}
        style={{height: 55, width: 55}} alt="" />
      <span style={{paddingLeft: 20}}>{children}</span>
    </span>
    <ChevronRightIcon
      aria-hidden={true} focusable={false} style={{fill: colors.CHARCOAL_GREY, width: 20}} />
  </RadiumExternalLink>
}
const ToolCard = React.memo(ToolCardBase)

export interface WithAdvice {
  advice: bayes.bob.Advice & {adviceId: string}
  project: bayes.bob.Project
  strategyId?: string
}


export interface CardProps extends WithAdvice {
  backgroundColor?: string | number
  dispatch: DispatchAllActions
  handleExplore: (visualElement: string) => () => void
  profile: bayes.bob.UserProfile
  t: TFunction
}

const suspenseWaitingStyle: React.CSSProperties = {
  margin: 'auto',
}
const loadingData = <CircularProgress style={suspenseWaitingStyle} />

interface CachedAdviceData<AdviceDataType> {
  data: Partial<AdviceDataType>
  loading?: React.ReactElement
}
function useAdviceData<AdviceDataType>(props: CardProps): CachedAdviceData<AdviceDataType> {
  const {advice: {adviceId}, project} = props
  const action = useMemo(
    () => getExpandedCardContent<AdviceDataType>(project, adviceId),
    [adviceId, project],
  )
  const selector = ({app}: RootState): AdviceDataType|undefined =>
    project.projectId &&
    (app.adviceData[project.projectId] || {})[adviceId] as AdviceDataType ||
    undefined
  const {data, loading} = useCachedData<AdviceDataType>(selector, action)
  return {
    data: data || emptyObject,
    loading: loading && loadingData,
  }
}


// TODO(cyrille): Consider dropping this.
const MAX_SHOWN_TIPS = 4


const seeMoreButtonStyle: React.CSSProperties = {
  color: 'inherit',
  display: 'flex',
  width: '100%',
}


interface TipsSectionProps {
  gender?: bayes.bob.Gender
  handleExplore: (visualElement: string) => () => void
  id?: string
  style?: React.CSSProperties
  t: TFunction
  tips: readonly bayes.bob.ApplicationTip[]
  title: LocalizableString
}


const isSpecificToJob = ({filters = undefined}: bayes.bob.ApplicationTip): boolean =>
  (filters || []).some((f?: string): boolean => !!f?.startsWith('for-job-group'))



const TipsSectionBase: React.FC<TipsSectionProps> =
(props: TipsSectionProps): React.ReactElement => {
  const {gender, handleExplore, id, style, t, t: translate, tips, title} = props
  const isMasculine = gender === 'MASCULINE'
  const media = useMedia()
  const [areAllItemsShown, setAreAllItemsShown] = useState(media === 'print')
  const moreItemsClickHandler = useCallback(() => {
    setAreAllItemsShown(true)
    handleExplore(`more tips ${id}`)()
  }, [id, handleExplore, setAreAllItemsShown])
  const footer = (areAllItemsShown || tips.length <= MAX_SHOWN_TIPS) ? null :
    <button onClick={moreItemsClickHandler} style={seeMoreButtonStyle} type="button">
      <span style={{flex: 1}}>{t('Voir plus')}</span>
      <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
    </button>
  const tagStyle = {
    backgroundColor: colors.GREENISH_TEAL,
    marginLeft: 15,
  }
  return <MethodSuggestionList
    maxNumChildren={areAllItemsShown ? 0 : MAX_SHOWN_TIPS} isNotClickable={true}
    title={translate(...title)}
    style={style} footer={footer}>
    {tips.map((tip, index): ReactStylableElement => <div key={`tip-${id}-${index}`}>
      <Markdown content={isMasculine && tip.contentMasculine || tip.content} />
      {isSpecificToJob(tip) ?
        <Tag style={tagStyle}>{t('Pour votre métier')}</Tag> : null}
    </div>)}
  </MethodSuggestionList>
}
const TipsSection = React.memo(TipsSectionBase)


type BoxProps = {component: React.ReactElement} | {isTarget?: true; percentage: number}
const hasComponent = (b: BoxProps): b is {component: React.ReactElement} =>
  !!(b as {component: React.ReactElement}).component


type ApplicationTips = bayes.bob.InterviewTips | bayes.bob.ResumeTips
type ImproveApplicationTipsProps = CardProps & SectionsProps
interface SectionProps {
  data: keyof bayes.bob.InterviewTips | keyof bayes.bob.ResumeTips
  title: LocalizableString
}
interface SectionsProps {
  sections: readonly SectionProps[]
}


const ImproveApplicationTipsBase: React.FC<ImproveApplicationTipsProps> =
(props: ImproveApplicationTipsProps): React.ReactElement => {
  const {data: adviceData = {}, loading} = useAdviceData<ApplicationTips>(props)
  const {profile: {gender}, sections, ...otherProps} = props
  if (loading) {
    return loading
  }
  if (sections.some(({data}: SectionProps): boolean => !adviceData[data as 'qualities'])) {
    return <CircularProgress style={{margin: 'auto'}} />
  }
  return <div>
    {sections.map(({data: id, title}: SectionProps, index: number): React.ReactNode => {
      const tips = adviceData[id as 'qualities']
      if (!tips) {
        return null
      }
      return <TipsSection
        tips={tips} key={`section-${id}`}
        {...{...otherProps, gender, id, title}} style={index ? {marginTop: 40} : {}} />
    })}
  </div>
}
const ImproveApplicationTips = React.memo(ImproveApplicationTipsBase)


const percentageBoxStyle = (percentage: number, isTarget?: true): React.CSSProperties => ({
  backgroundColor: isTarget ? colors.SLATE : colors.LIME_GREEN,
  borderRadius: 2,
  marginLeft: 5,
  width: `${percentage * 22}px`,
})
const dotsStyle: React.CSSProperties = {
  color: colors.LIME_GREEN,
  fontWeight: 'bold',
  marginLeft: 5,
  marginTop: 8,
}
// This component enables to represent a percentage in form of little boxes, for instance
// 250% will be represented as 2.5 boxes
// Percentages below 100% are not displayed.
// TODO(cyrille): Use better naming to make sure whether we're dealing with percentages or ratios.
const PercentageBoxes: React.FC<{percentage: number}> =
({percentage}: {percentage: number}): React.ReactElement|null => {
  // Do not represent values below 1.
  if (percentage < 1) {
    return null
  }
  const maxBoxes = 8
  const nbBoxes = Math.floor(percentage)

  const boxes: readonly BoxProps[] = nbBoxes >= maxBoxes ? [
    {percentage: .5},
    ...Array.from({length: maxBoxes / 2 - 1}).map(() => ({percentage: 1})),
    {component: <span style={dotsStyle} key="dots" aria-hidden={true}>…</span>},
    {isTarget: true, percentage: 1},
  ] : [
    {percentage: percentage - nbBoxes},
    ...Array.from({length: nbBoxes - 1}).map(() => ({percentage: 1})),
    {isTarget: true, percentage: 1},
  ]

  return <span style={{display: 'flex', height: 22}}>
    {boxes.map((box: BoxProps, index): React.ReactElement => hasComponent(box) ?
      box.component :
      <span style={percentageBoxStyle(box.percentage, box.isTarget)} key={`box-${index}`} />)}
  </span>
}


interface MethodSuggestionProps {
  children: ReactStylableElement
  isNotClickable?: boolean
  isTopLimitVisible?: boolean
  style?: RadiumCSSProperties
}

const MethodSuggestionBase: React.FC<MethodSuggestionProps> =
(props: MethodSuggestionProps): React.ReactElement => {
  const {children, isNotClickable, isTopLimitVisible, style} = props
  const insideStyle: RadiumCSSProperties = {
    'display': 'flex',
    ...children.props.style,
    ...style,
    ':hover': {
      backgroundColor: colors.LIGHT_GREY,
      ...children.props.style?.[':hover'],
      ...style?.[':hover'],
    },
    'alignItems': 'center',
    'backgroundColor': '#fff',
    'fontSize': 13,
    'fontWeight': 'bold',
    'minHeight': 50,
    'paddingBottom': 15,
    'paddingLeft': methodPadding,
    'paddingRight': methodPadding,
    'paddingTop': 15,
  }
  if (!isNotClickable && !insideStyle.cursor) {
    insideStyle.cursor = 'pointer'
  }
  const topLimitStyle = {
    backgroundColor: colors.MODAL_PROJECT_GREY,
    border: 0,
    height: 1,
    margin: `0 ${methodPadding}px`,
  }
  return <React.Fragment>
    {isTopLimitVisible ? <hr style={topLimitStyle} /> : null}
    {React.cloneElement(children, {style: insideStyle})}
  </React.Fragment>
}
const MethodSuggestion = React.memo(MethodSuggestionBase)


interface MethodSectionProps {
  footer?: React.ReactNode
  headerContent?: React.ReactNode
  style?: React.CSSProperties
  subtitle?: React.ReactNode
  title?: React.ReactNode
}

const MethodSectionBase: React.FC<MethodSectionProps & {children: React.ReactNode}> =
(props: MethodSectionProps & {children: React.ReactNode}): React.ReactElement => {
  const {children, footer, headerContent, style, subtitle, title} = props
  const sectionStyle: React.CSSProperties = {
    border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    borderRadius: 10,
    ...style,
  }
  if (title) {
    sectionStyle.paddingTop = methodPadding
  }
  if (footer) {
    sectionStyle.paddingBottom = methodPadding
  }
  const headerStyle: React.CSSProperties = {
    paddingBottom: methodPadding,
    paddingLeft: methodPadding,
    paddingRight: methodPadding,
  }
  const titleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 'bold',
    margin: '0 0 5px',
  }
  const subtitleStyle: React.CSSProperties = {
    color: colors.WARM_GREY,
    fontSize: 13,
    fontStyle: 'italic',
    margin: 0,
  }
  const footerStyle: React.CSSProperties = {
    borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    fontStyle: 'italic',
    margin: `0 ${methodPadding}px`,
    paddingTop: methodPadding,
  }
  return <section style={sectionStyle}>
    {title ? <header style={headerStyle}>
      <h4 style={titleStyle}>{title}</h4>
      {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
      {headerContent}
    </header> : null}
    {children}
    {footer ? <footer style={footerStyle}>{footer}</footer> : null}
  </section>
}
const MethodSection = React.memo(MethodSectionBase)


type MethodSuggestionListProps =
  Omit<React.ComponentProps<typeof AppearingList>, keyof MethodSectionProps> &
  MethodSectionProps & {
    isNotClickable?: boolean
  }

// Add border radius on first or last element if there's no header/footer.
const MethodSuggestionListBase: React.FC<MethodSuggestionListProps> =
(props: MethodSuggestionListProps): React.ReactElement => {
  const {children, footer, headerContent, isNotClickable, style, subtitle, title,
    ...otherProps} = props
  const itemStyle = useCallback((index: number): React.CSSProperties => {
    const lastChildIndex = React.Children.
      map(children, (child, index): number => child ? index : 0)?.
      filter((i): number => i)?.reverse()?.[0] || 0
    if ((title || index) && (footer || index < lastChildIndex)) {
      return {}
    }
    const forFirst = (title || index) ? {} : {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    }
    const forLast = (footer || index < lastChildIndex) ? {} : {
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
    }
    return {...forFirst, ...forLast}
  }, [children, footer, title])
  return <MethodSection {...{footer, headerContent, style, subtitle, title}}>
    <AppearingList {...otherProps}>
      {React.Children.
        map(children, (child: React.ReactElement|null, index: number): ReactStylableElement|null =>
          child ? <MethodSuggestion
            style={itemStyle(index)}
            isNotClickable={isNotClickable}
            isTopLimitVisible={!!index || !!title}>{child}</MethodSuggestion> : null)?.
        filter((e: ReactStylableElement|null): e is ReactStylableElement => !!e) || null}
    </AppearingList>
  </MethodSection>
}
const MethodSuggestionList = React.memo(MethodSuggestionListBase)


interface JobSuggestionJobProps {
  gender?: bayes.bob.Gender
  job?: bayes.bob.ReorientJob
  onClick?: () => void
  style?: React.CSSProperties
}

interface JobSuggestionProps extends JobSuggestionJobProps {
  isCaption?: boolean
}

const JobSuggestionCaption: React.FC<{style?: React.CSSProperties}> =
({style}: {style?: React.CSSProperties}): React.ReactElement => {
  const captionStyle: React.CSSProperties = {
    fontStyle: 'normal',
    margin: '0 10px 0 0',
  }
  const {t} = useTranslation('advisor')
  return <p style={style}>
    <span style={captionStyle}>
      {t('Offres par candidat par rapport à votre métier\u00A0:')}
    </span>
  </p>
}

const JobSuggestionJob: React.FC<JobSuggestionJobProps> =
({gender, job, onClick, style}: JobSuggestionJobProps): React.ReactElement|null => {
  const {t} = useTranslation('advisor')
  const searchURL = useMemo(() => getJobSearchURL(t, job, gender), [t, gender, job])
  const linkStyle = useMemo((): RadiumCSSProperties => ({
    color: 'inherit',
    textDecoration: 'none',
    ...style,
  }), [style])
  const multiplierStyle: React.CSSProperties = {
    color: colors.LIME_GREEN,
    flex: 1,
    fontWeight: 'bold',
    marginRight: 0,
  }
  const badMultiplierStyle: React.CSSProperties = {
    ...multiplierStyle,
    color: colors.RED_PINK,
  }
  const jobNameStyle: React.CSSProperties = {
    flex: isMobileVersion ? 4 : 1,
    fontWeight: 'bold',
    marginRight: isMobileVersion ? 10 : 'initial',
  }
  const chevronStyle: React.CSSProperties = {
    fill: colors.CHARCOAL_GREY,
  }
  const tagStyle = {
    backgroundColor: colors.SQUASH,
    marginLeft: 10,
    marginRight: 20,
  }

  if (!job) {
    return null
  }

  const stressPercentLoss =
    Number.parseFloat(((1 - 1 / ((job.offersPercentGain || 0) / 100 + 1)) * 100).toPrecision(2))

  return <RadiumExternalLink href={searchURL} style={linkStyle} onClick={onClick}>
    <span style={jobNameStyle}>
      {job.name}
    </span>
    <span>
      {job.isDiplomaStrictlyRequired ? <Tag style={tagStyle}>Diplôme obligatoire</Tag> : null}
    </span>
    <span style={{flex: 1}}>
      <span style={{alignItems: 'center', display: 'flex', justifyContent: 'flex-end'}}>
        {stressPercentLoss > 10 ? <Trans style={multiplierStyle} t={t} parent={null}>
          -{{percentLoss: toLocaleString(stressPercentLoss)}}% de concurrence
        </Trans> : stressPercentLoss < -10 ? <Trans style={badMultiplierStyle} t={t} parent={null}>
          +{{percentLoss: toLocaleString(-stressPercentLoss)}}% de concurrence
        </Trans> : null}
        <ChevronRightIcon style={chevronStyle} aria-hidden={true} focusable={false} />
      </span>
    </span>
  </RadiumExternalLink>
}

const JobSuggestionBase: React.FC<JobSuggestionProps> =
(props: JobSuggestionProps): React.ReactElement => {
  const {isCaption, style} = props
  if (isCaption) {
    return <JobSuggestionCaption style={style} />
  }
  return <JobSuggestionJob {...props} style={style} />
}
const JobSuggestion = React.memo(JobSuggestionBase)


interface MissionProps {
  aggregatorName?: string
  associationName?: React.ReactNode
  description?: string
  isAvailableEverywhere?: boolean
  link?: string
  onContentShown?: () => void
  style?: React.CSSProperties
  title?: string
}


const MissionBase: React.FC<MissionProps> = (props: MissionProps): React.ReactElement => {
  const {aggregatorName, associationName, description, isAvailableEverywhere,
    link, onContentShown, style, title} = props
  const {t} = useTranslation('advisor')
  const contentStyle: React.CSSProperties = {
    borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
    color: colors.CHARCOAL_GREY,
    fontSize: 13,
    lineHeight: 1.6,
    overflow: 'hidden',
    paddingLeft: 15,
    ...SmoothTransitions,
  }
  const tag = isAvailableEverywhere && !isMobileVersion &&
    {color: colors.GREENISH_TEAL, value: prepareT('depuis chez vous')} || undefined
  const aggregatorLink = useMemo((): readonly React.ReactElement[] => [
    // Content is automatically added by the Trans component when used.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <ExternalLink href={link} key="0" />,
  ], [link])
  return <ExpandableAction
    contentName={t('la mission')}
    onContentShown={onContentShown}
    style={style}
    tag={tag}
    title={associationName}>
    <div style={contentStyle}>
      <p style={{margin: '0 0 20px'}}>
        <Trans parent="strong" t={t}>Intitulé de la mission&nbsp;:</Trans><br />
        {title}
      </p>

      <p style={{margin: 0}}>
        <Trans parent="strong" t={t}>Description&nbsp;:</Trans><br />
        <Markdown content={description} />
      </p>

      {link ? <Trans
        style={{margin: '20px 0 0'}} t={t} parent="p"
        i18nKey="Lire la suite sur <0>{{aggregatorName}}</0>"
        values={{aggregatorName}}
        components={aggregatorLink} /> : null}
    </div>
  </ExpandableAction>
}
const Mission = React.memo(MissionBase)


interface StaticAdviceCardContentProps {
  expandedCardHeader?: string
  expandedCardItems?: readonly string[]
}


const StaticAdviceCardContentBase: React.FC<StaticAdviceCardContentProps> =
(props: StaticAdviceCardContentProps): React.ReactElement => {
  const {expandedCardHeader = '', expandedCardItems} = props
  // TODO(cyrille): Make nicer headers, with title and subtite.
  const title = expandedCardHeader.includes('\n') ? undefined :
    <Markdown isSingleLine={true} content={expandedCardHeader} />
  return <div>
    {title ? null : <Markdown content={expandedCardHeader} />}
    <MethodSuggestionList isNotClickable={true} title={title}>
      {(expandedCardItems || []).map((content, index): ReactStylableElement => <div
        key={`item-${index}`} style={{fontWeight: 'normal'}}>
        <Markdown content={content} />
      </div>)}
    </MethodSuggestionList>
  </div>
}
const StaticAdviceCardContent = React.memo(StaticAdviceCardContentBase)


interface HandyLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'ref'> {
  children: string
  linkIntro?: string
}

const HandyLinkBase: React.FC<HandyLinkProps> = (props: HandyLinkProps): React.ReactElement => {
  const {children, linkIntro, style, ...otherProps} = props
  const linkStyle = {
    color: colors.BOB_BLUE,
    textDecoration: 'none',
  }
  return <div style={{fontWeight: 'bold', ...style}}>
    <span style={{marginRight: 10}} aria-hidden={true}>👉 </span>
    {linkIntro ? <span>{linkIntro} </span> : null}
    <ExternalLink style={linkStyle} {...otherProps}>{children}</ExternalLink>
  </div>
}
const HandyLink = React.memo(HandyLinkBase)


interface SkillAssetProps {
  asset: string
  style?: React.CSSProperties
}

const SkillAssetBase: React.FC<SkillAssetProps> = (props: SkillAssetProps):
React.ReactElement|null => {
  const {asset, style} = props
  const {isShown: isToolTipShown, containerProps, tooltipProps, triggerProps} = useTooltip()
  const {t: translate} = useTranslation()
  const {icon = undefined, name = undefined} = assetProps[asset] || {}
  const tooltipStyle = useMemo((): React.CSSProperties => ({
    alignItems: 'center',
    bottom: 'calc(100% + 5px)',
    display: 'flex',
    flexDirection: 'column',
    left: '50%',
    opacity: isToolTipShown ? 1 : 0,
    position: 'absolute',
    transform: 'translateX(-50%)',
    ...SmoothTransitions,
  }), [isToolTipShown])
  if (!name) {
    return null
  }
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    ...style,
  }
  const imageStyle: React.CSSProperties = {
    height: 20,
    width: 20,
  }
  const nameStyle: React.CSSProperties = {
    backgroundColor: colors.DARK_TWO,
    borderRadius: 2,
    color: '#fff',
    fontStyle: 'italic',
    padding: '8px 16px 8px 14px',
    textAlign: 'center',
  }
  const tooltipTailStyle: React.CSSProperties = {
    borderLeft: '10px solid transparent',
    borderRight: '10px solid transparent',
    borderTop: `5px solid ${colors.DARK_TWO}`,
    height: 0,
    width: 0,
  }
  return <div style={containerStyle} {...containerProps}>
    <img
      src={icon} style={imageStyle} alt={translate(...name)}
      {...triggerProps} />
    <div style={tooltipStyle} {...tooltipProps}>
      <div style={nameStyle}>{translate(...name)}</div>
      <div style={tooltipTailStyle} />
    </div>
  </div>
}
const SkillAsset = React.memo(SkillAssetBase)


interface ActionWithHandyLinkProps {
  children?: React.ReactNode
  description?: string
  discoverUrl?: string
  linkIntro?: string
  linkName?: string
  onClick: () => void
  style?: RadiumCSSProperties
}

const ActionWithHandyLinkBase: React.FC<ActionWithHandyLinkProps> =
(props: ActionWithHandyLinkProps): React.ReactElement => {
  const {children, description, discoverUrl, linkIntro, linkName, onClick, style} = props
  const descriptionStyle: React.CSSProperties = {
    color: colors.WARM_GREY,
    fontStyle: 'italic',
    fontWeight: 'normal',
    marginRight: 75,
  }
  return <div style={{...style, display: 'block', paddingBottom: 20}}>
    {children}
    {description ? <div style={descriptionStyle}>
      {description}
    </div> : null}
    { // TODO(cyrille): Add a qualification for the link (video, podcast, lesson, ...).
      discoverUrl ? <HandyLink
        linkIntro={linkIntro}
        style={{marginTop: 15}} href={discoverUrl} onClick={onClick}>
        {linkName || ''}
      </HandyLink> : null}
  </div>
}
const ActionWithHandyLink = React.memo(ActionWithHandyLinkBase)


interface SkillProps extends bayes.bob.Skill {
  handleExplore: (visualElement: string) => () => void
  isRecommended?: boolean
  style?: React.CSSProperties
}

const SkillBase: React.FC<SkillProps> = (props: SkillProps): React.ReactElement => {
  const {assets = [], description, discoverUrl, handleExplore, name, style} = props
  const {t} = useTranslation('advisor')
  return <ActionWithHandyLink
    onClick={handleExplore('link-skill')} linkIntro={t('Découvrir cette')}
    linkName={t('compétence')}
    {...{description, discoverUrl, style}}>
    <div style={{alignItems: 'center', display: 'flex', marginBottom: 15}}>
      <span style={{flex: 1}}>{name}</span>
      {assets.map((asset): React.ReactNode => <SkillAsset
        key={`${name}-${asset}`} {...{asset}} style={{marginLeft: 5}} />)}
    </div>
  </ActionWithHandyLink>
}
const Skill = React.memo(SkillBase)


interface CardWithImageProps {
  description?: string
  image: string
  style?: React.CSSProperties
  title: string
  url: string
}

const cardLinkStyle: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
}
const cardImageStyle: React.CSSProperties = {
  borderRadius: '10px 10px 0 0',
  width: '100%',
}
const cardDescriptionStyle: React.CSSProperties = {
  color: colors.GREYISH_BROWN,
  display: 'block',
  marginTop: 7,
  minHeight: 48,
}

const CardWithImageBase: React.FC<CardWithImageProps> =
(props: CardWithImageProps): React.ReactElement => {
  const {description, image, style, title, url} = props
  const cardStyle = useMemo((): React.CSSProperties => ({
    border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
    borderRadius: 10,
    display: 'flex',
    width: 250,
    ...style,
  }), [style])
  return <li key={url} style={cardStyle}><ExternalLink href={url} style={cardLinkStyle}>
    <img style={cardImageStyle} src={image} alt="" />
    <span style={{display: 'block', padding: 15}}>
      <span style={{fontWeight: 'bold', marginTop: 10}}>
        {title}
      </span>
      {description ? <span style={cardDescriptionStyle}>
        {description}
      </span> : null}
    </span>
  </ExternalLink></li>
}
const CardWithImage = React.memo(CardWithImageBase)


interface ReorientSectionProps extends Omit<MethodSuggestionListProps, 'children'> {
  items: React.ReactElement<JobSuggestionProps>[]
  profile: bayes.bob.UserProfile
}
const ReorientSectionBase = (props: ReorientSectionProps): React.ReactElement | null => {
  const {footer, items, profile, ...otherProps} = props
  if (!items.length) {
    return null
  }
  const footerContent = footer || <DataSource style={{margin: 0}}>
    {config.dataSourceLMI.replace('{{dataSourceYear}}', `${dataSourceYear}`)}
  </DataSource>

  return <React.Fragment>
    <MethodSuggestionList {...otherProps} footer={footerContent}>
      {items}
    </MethodSuggestionList>
    <HandicapSuggestionWarning hasHandicap={!!profile.hasHandicap} />
  </React.Fragment>
}
const ReorientSection = React.memo(ReorientSectionBase)


const linkStyle: RadiumCSSProperties = {
  ':focus': {
    textDecoration: 'underline',
  },
  ':hover': {
    textDecoration: 'underline',
  },
  'color': colors.BOB_BLUE,
  'fontWeight': 'bold',
  'textDecoration': 'none',
}

interface HandicapSuggestionWarningProps {
  hasHandicap: boolean
  style?: React.CSSProperties
  types?: string
}

const HandicapSuggestionWarningBase =
  (props: HandicapSuggestionWarningProps): React.ReactElement|null => {
    const {hasHandicap, types, style} = props
    const {t} = useTranslation('advisor')
    const containerStyle = useMemo((): React.CSSProperties => ({
      ...style,
    }), [style])
    if (!config.handicapCounselorUrl || !hasHandicap) {
      return null
    }
    const jobsOrWorkEnvironments = types || t('métiers')
    return <Trans style={containerStyle} t={t} parent="p">
      Pour certains {{jobsOrWorkEnvironments}}, un réaménagement de poste de travail pourrait être
      nécessaire. Parlez-en à <RadiumExternalLink
        href={config.handicapCounselorUrl} style={linkStyle}>votre conseiller</RadiumExternalLink>.
    </Trans>
  }
const HandicapSuggestionWarning = React.memo(HandicapSuggestionWarningBase)

export {ToolCard, EmailTemplate, ImproveApplicationTips, Skill,
  StaticAdviceCardContent, PercentageBoxes, JobSuggestion, ExpandableAction, Mission,
  MethodSection, HandyLink, MethodSuggestionList, CardWithImage, ActionWithHandyLink,
  useAdviceData, ReorientSection, HandicapSuggestionWarning}
