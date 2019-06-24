import _memoize from 'lodash/memoize'
import ChevronDownIcon from 'mdi-react/ChevronDownIcon'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import Radium from 'radium'
import React from 'react'
import {connect} from 'react-redux'

import {DispatchAllActions, RootState, getExpandedCardContent} from 'store/actions'
import {YouChooser} from 'store/french'
import {getIMTURL, getJobSearchURL} from 'store/job'
import {assetProps} from 'store/skills'

import {isMobileVersion} from 'components/mobile'
import {AppearingList, CircularProgress, ExternalLink, Markdown,
  PaddedOnMobile, SmoothTransitions, Tag, UpDownIcon} from 'components/theme'


interface TagProps {
  color: string
  value: string
}
// TODO: Find a better place for those tags if we don't need them elsewhere in this file.
const typeTags: {[type: string]: TagProps} = {
  'apply-to-offer': {
    color: colors.SQUASH,
    value: 'candidature à une offre',
  },
  'spontaneous-application': {
    color: colors.GREENISH_TEAL,
    value: 'candidature spontanée',
  },
}

const methodPadding = isMobileVersion ? 10 : 20

interface ExpandableActionProps {
  backgroundColor?: string
  children: React.ReactElement<{onClick?: (e?: MouseEvent) => void; style?: React.CSSProperties}>
  contentName?: string
  // TODO(cyrille): Make this the default.
  isMethodSuggestion?: boolean
  onContentShown?: () => void
  style?: React.CSSProperties
  tag?: TagProps
  title: React.ReactNode
  type?: 'apply-to-offer' | 'spontaneous-application'
  userYou: YouChooser
  // TODO(marielaure): Make this a classic tag.
  // TODO(cyrille): Make this a boolean.
  whyForYou?: string
}


class ExpandableActionBase
  extends React.PureComponent<ExpandableActionProps, {isContentShown: boolean}> {

  public static defaultProps = {
    contentName: 'plus',
  }

  public state = {
    isContentShown: false,
  }

  private handleClick = (): void => {
    const {isContentShown} = this.state
    const {onContentShown} = this.props
    this.setState({isContentShown: !isContentShown})
    if (!isContentShown) {
      onContentShown && onContentShown()
    }
  }

  private preventParentClick = (event): void => {
    const {children: {props: {onClick = undefined} = {}} = {}} = this.props
    event.stopPropagation()
    onClick && onClick(event)
  }

  private renderType(): React.ReactNode {
    if (isMobileVersion) {
      return null
    }
    const {type} = this.props
    const {color = undefined, value = undefined} = typeTags[type] || {}
    if (!value) {
      return null
    }
    const tagStyle = {
      backgroundColor: color,
      marginLeft: 10,
    }
    return <Tag style={tagStyle}>{value}</Tag>
  }

  public render(): React.ReactNode {
    const {children, contentName, isMethodSuggestion, style, title, userYou,
      tag, whyForYou} = this.props
    const {isContentShown} = this.state
    const containerStyle: RadiumCSSProperties = {
      ...style,
      ':hover': {
        backgroundColor: isContentShown ? '#fff' : colors.LIGHT_GREY,
      },
      backgroundColor: '#fff',
    }
    if (!isMethodSuggestion) {
      containerStyle.border = `solid 1px ${colors.MODAL_PROJECT_GREY}`
      containerStyle.padding = isMobileVersion ? '0 15px' : '0 25px'
    } else {
      containerStyle.display = 'block'
    }
    const headerStyle: React.CSSProperties = {
      alignItems: 'center',
      color: colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
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
    const childStyle = (props): React.CSSProperties => ({
      cursor: 'initial',
      fontWeight: isMethodSuggestion ? 'normal' : 'initial',
      ...props.style || {},
      ...isContentShown ? {} : hiddenContentStyle,
      ...SmoothTransitions,
    })
    const seeContentStyle: React.CSSProperties = {
      color: colors.WARM_GREY,
      fontStyle: 'italic',
      fontWeight: 'normal',
    }
    const tagStyle = (backgroundColor): React.CSSProperties => ({
      backgroundColor,
      marginLeft: 10,
    })
    // TODO(guillaume): Print reason when the user mouseovers the tag.
    return <div style={containerStyle} onClick={this.handleClick}>
      <header style={headerStyle}>
        <strong>
          {title}
        </strong>
        {whyForYou ? <Tag style={tagStyle(colors.BOB_BLUE)}>
          {userYou('Selectionné pour toi', 'Selectionné pour vous')}
        </Tag> : null}
        {tag ? <Tag style={tagStyle(tag.color)}>
          {tag.value}
        </Tag> : null}
        {this.renderType()}
        <span style={{flex: 1}} />
        {isMobileVersion ? null : <span style={seeContentStyle}>
          Voir {isContentShown ? 'moins' : contentName}{' '}
        </span>}
        <UpDownIcon icon="chevron" isUp={isContentShown} style={iconStyle} />
      </header>
      {React.cloneElement(children, {
        onClick: this.preventParentClick,
        style: childStyle(children.props),
      })}
    </div>
  }
}
const ExpandableAction: React.ComponentType<ExpandableActionProps> = Radium(ExpandableActionBase)


interface EmailTemplateProps
  extends Pick<
  ExpandableActionProps, Exclude<keyof ExpandableActionProps, 'children'>> {
  content: string
  style?: React.CSSProperties
  tip?: string
  title: string
  userYou: YouChooser
  whyForYou?: string
}


class EmailTemplate extends React.PureComponent<EmailTemplateProps> {
  public static propTypes = {
    content: PropTypes.string.isRequired,
    contentName: PropTypes.string,
    isMethodSuggestion: PropTypes.bool,
    style: PropTypes.object,
    tip: PropTypes.string,
    title: PropTypes.node.isRequired,
    userYou: PropTypes.func.isRequired,
    whyForYou: PropTypes.string,
  }

  public render(): React.ReactNode {
    const {content, contentName, isMethodSuggestion, tip} = this.props
    const contentStyle: React.CSSProperties = {
      borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
      fontSize: 13,
      marginBottom: isMethodSuggestion ? 0 : tip ? 10 : 25,
      marginTop: isMethodSuggestion ? 0 : 25,
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
    return <ExpandableAction {...this.props} contentName={contentName || "l'email"}>
      <div>
        <div style={contentStyle}>
          <Markdown style={{}} content={content} />
        </div>
        {tip ? <div style={tipStyle}><strong>Astuce&nbsp;: </strong>{tip}</div> : null}
      </div>
    </ExpandableAction>
  }
}


interface ToolCardProps {
  children: React.ReactNode
  hasBorder?: boolean
  href: string
  imageSrc: string
  onClick?: () => void
  style?: React.CSSProperties
}


class ToolCardBase extends React.PureComponent<ToolCardProps> {
  public static propTypes = {
    children: PropTypes.node,
    hasBorder: PropTypes.bool,
    href: PropTypes.string.isRequired,
    imageSrc: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  private handleClick = (): void => {
    const {href, onClick} = this.props
    window.open(href, '_blank')
    onClick && onClick()
  }

  public render(): React.ReactNode {
    const {children, hasBorder, imageSrc, style} = this.props
    const cardStyle: RadiumCSSProperties = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      cursor: 'pointer',
      display: 'flex',
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
    return <div style={cardStyle} onClick={this.handleClick}>
      <div style={titleStyle}>
        <img src={imageSrc}
          style={{height: 55, width: 55}} alt="" />
        <div style={{paddingLeft: 20}}>{children}</div>
      </div>
      <ChevronRightIcon style={{fill: colors.CHARCOAL_GREY, width: 20}} />
    </div>
  }
}
const ToolCard = Radium(ToolCardBase)


export interface WithAdvice {
  advice: bayes.bob.Advice
  project: bayes.bob.Project
  strategyId?: string
}


export interface CardProps extends WithAdvice {
  backgroundColor?: string | number
  dispatch: DispatchAllActions
  handleExplore: (visualElement: string) => () => void
  profile: bayes.bob.UserProfile
  userYou: YouChooser
}


interface DispatchProp {
  dispatch: DispatchAllActions
}


interface AdviceDataProp<AdviceType> {
  adviceData: AdviceType
}


export type WithAdviceData<T> = DispatchProp & AdviceDataProp<T>


export type CardWithContentProps<T> = CardProps & WithAdviceData<T>


type connectFuncType<ConnectedProps, AdviceDataType, Config> =
  (Component: React.ComponentType<ConnectedProps & WithAdviceData<AdviceDataType> & Config>) =>
  React.ComponentType<Config>


// Extended version of redux' connect function (it should be used exactly the
// same way), but augment the wrapped component with: an extra prop called
// `adviceData` and a dispatch call just before the component is mounted to
// populate it.
const connectExpandedCardWithContent =
<ConnectedProps, AdviceDataType, Config extends WithAdvice>(
  reduceFunc?: (state: RootState, props: Config) => ConnectedProps):
connectFuncType<ConnectedProps, AdviceDataType, Config> =>
  (Component: React.ComponentType<ConnectedProps & WithAdviceData<AdviceDataType> & Config>):
  React.ComponentType<Config> => {
    class ExpandedCardWithContentBase
      extends React.PureComponent<ConnectedProps & WithAdviceData<AdviceDataType> & Config> {
      public componentDidMount(): void {
        const {advice, dispatch, project} = this.props
        dispatch(getExpandedCardContent(project, advice.adviceId))
      }

      public render(): React.ReactNode {
        return <Component {...this.props} />
      }
    }
    return connect(
      function({app}: RootState, {advice, project}: Config):
      ConnectedProps & AdviceDataProp<AdviceDataType> {
        const adviceData = (app.adviceData[project.projectId] || {})[advice.adviceId] || {}
        return {
          ...reduceFunc && reduceFunc.apply(this, arguments),
          adviceData,
        }
      }
    // TODO(pascal): Fix the type and remove this comment.
    // @ts-ignore
    )(ExpandedCardWithContentBase)
  }


// TODO(cyrille): Consider dropping this.
const MAX_SHOWN_TIPS = 4


interface TipsSectionProps {
  gender?: bayes.bob.Gender
  handleExplore: (visualElement: string) => () => void
  id?: string
  style?: React.CSSProperties
  tips: bayes.bob.ApplicationTip[]
  title?: string
  userYou: YouChooser
}


class TipsSection extends React.PureComponent<TipsSectionProps, {areAllItemsShown: boolean}> {
  public static propTypes = {
    gender: PropTypes.oneOf(['FEMININE', 'MASCULINE'] as const),
    handleExplore: PropTypes.func.isRequired,
    id: PropTypes.string,
    style: PropTypes.object,
    tips: PropTypes.arrayOf(PropTypes.shape({
      content: PropTypes.string.isRequired,
      contentMasculine: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.string.isRequired),
    })).isRequired,
    title: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public state = {
    areAllItemsShown: false,
  }

  private moreItemsClickHandler = (): void => {
    const {id, handleExplore} = this.props
    this.setState({areAllItemsShown: true})
    handleExplore(`more tips ${id}`)()
  }

  private renderTag(content, backgroundColor): React.ReactNode {
    const tagStyle = {
      backgroundColor,
      marginLeft: 15,
    }
    return <Tag style={tagStyle}>{content}</Tag>
  }

  public render(): React.ReactNode {
    const {gender, id, style, tips, title, userYou} = this.props
    const isMasculine = gender === 'MASCULINE'
    const {areAllItemsShown} = this.state
    const footer = (areAllItemsShown || tips.length <= MAX_SHOWN_TIPS) ? null :
      <div onClick={this.moreItemsClickHandler} style={{cursor: 'pointer', display: 'flex'}}>
        <span style={{flex: 1}}>Voir plus</span>
        <ChevronDownIcon style={{fill: colors.CHARCOAL_GREY, height: 20, width: 20}} />
      </div>
    const isSpecificToJob = ({filters = undefined}): boolean =>
      (filters || []).some((f): boolean => f.startsWith('for-job-group'))
    return <MethodSuggestionList
      maxNumChildren={areAllItemsShown ? 0 : MAX_SHOWN_TIPS} isNotClickable={true} title={title}
      style={style} footer={footer}>
      {tips.map((tip, index): ReactStylableElement => <div key={`tip-${id}-${index}`}>
        <Markdown content={isMasculine && tip.contentMasculine || tip.content} />
        {isSpecificToJob(tip) ?
          this.renderTag(
            userYou('Pour ton métier', 'Pour votre métier'),
            colors.GREENISH_TEAL,
          ) : null
        }
      </div>)}
    </MethodSuggestionList>
  }
}


interface SectionsProps {
  sections: {data: string; title: string}[]
}

type ApplicationTips = bayes.bob.InterviewTips | bayes.bob.ResumeTips
type ImproveApplicationTipsProps = CardWithContentProps<ApplicationTips> & SectionsProps


class ImproveApplicationTipsBase extends React.PureComponent<ImproveApplicationTipsProps> {
  public render(): React.ReactNode {
    const {adviceData, profile: {gender}, sections, ...otherProps} = this.props
    if (sections.some(({data}): boolean => !adviceData[data])) {
      return <CircularProgress style={{margin: 'auto'}} />
    }
    return <div>
      {sections.map(({data: id, title}, index): React.ReactNode => <TipsSection
        tips={adviceData[id]} key={`section-${id}`}
        {...{...otherProps, gender, id, title}} style={index ? {marginTop: 40} : {}} />)}
    </div>
  }
}
const ImproveApplicationTips =
  connectExpandedCardWithContent<{}, ApplicationTips, WithAdvice & SectionsProps>()(
    ImproveApplicationTipsBase)


class PercentageBoxes extends React.PureComponent<{percentage: number}> {
  // This class enables to represent a percentage in form of little boxes, for instance
  // 250% will be represented as 2.5 boxes
  // Percentages below 100% are not displayed.

  public static propTypes = {
    percentage: PropTypes.number,
  }

  private renderBox(percentage, isTarget, key): React.ReactNode {
    const boxStyle = {
      backgroundColor: isTarget ? colors.SLATE : colors.HOVER_GREEN,
      borderRadius: 2,
      marginLeft: 5,
      width: `${percentage * 22}px`,
    }
    return <div style={boxStyle} key={`box-${key}`} />
  }

  public render(): React.ReactNode {
    const {percentage} = this.props
    // Do not represent values below 1.
    if (percentage < 1) {
      return null
    }
    const maxBoxes = 8
    const nbBoxes = Math.floor(percentage)

    const boxes = []

    if (nbBoxes >= maxBoxes) {
      boxes.push({percentage: .5})
      new Array(maxBoxes / 2 - 1).fill(0).forEach((): void => {
        boxes.push({percentage: 1})
      })
      const dotsStyle: React.CSSProperties = {
        color: colors.HOVER_GREEN,
        fontWeight: 'bold',
        marginLeft: 5,
        marginTop: 8,
      }
      boxes.push({
        component: <div style={dotsStyle} key="dots">…</div>,
      })
      new Array(maxBoxes / 2 - 1).fill(0).forEach((): void => {
        boxes.push({percentage: 1})
      })
    } else {
      boxes.push({percentage: percentage - nbBoxes})
      new Array(nbBoxes - 1).fill(0).forEach((): void => {
        boxes.push({percentage: 1})
      })
    }
    boxes.push({isTarget: true, percentage: 1})

    return <div style={{display: 'flex', height: 22}}>
      {boxes.map(({component, isTarget, percentage}, index): React.ReactNode =>
        component || this.renderBox(percentage, isTarget, index))}
    </div>
  }
}


// TODO(cyrille): Drop once `theme` gets typed.
interface AppearingListProps {
  children: ReactStylableElement | ReactStylableElement[]
  maxNumChildren?: number
  style?: React.CSSProperties
}

interface AdviceSuggestionListProps extends AppearingListProps {
  isNotClickable?: boolean
}


// TODO(cyrille): Drop this one once transition to MethodSuggestionList is complete.
class AdviceSuggestionListBase extends React.PureComponent<AdviceSuggestionListProps> {
  public static propTypes = {
    children: PropTypes.arrayOf(PropTypes.node.isRequired),
    isNotClickable: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, isNotClickable, ...extraProps} = this.props
    const childStyle = (index, props): RadiumCSSProperties => ({
      ':hover': (isNotClickable || props.isNotClickable) ? {} : {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      cursor: (isNotClickable || props.isNotClickable) ? 'initial' : 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      marginTop: index ? -1 : 0,
      minHeight: 50,
      paddingLeft: methodPadding,
      paddingRight: methodPadding,
      ...SmoothTransitions,
      ...props.style,
    })
    return <AppearingList {...extraProps}>
      {React.Children.map(children, (child: ReactStylableElement, index): ReactStylableElement =>
        React.cloneElement(child, {style: childStyle(index, child.props)}))}
    </AppearingList>
  }
}
const AdviceSuggestionList = Radium(AdviceSuggestionListBase)


interface MethodSuggestionProps {
  children: ReactStylableElement
  isNotClickable?: boolean
  isTopLimitVisible?: boolean
  style?: RadiumCSSProperties
}

class MethodSuggestionBase extends React.PureComponent<MethodSuggestionProps> {
  public static propTypes = {
    children: PropTypes.element.isRequired,
    isNotClickable: PropTypes.bool,
    isTopLimitVisible: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, isNotClickable, isTopLimitVisible, style} = this.props
    const insideStyle = {
      ...children.props.style,
      ...style,
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
        ...children.props.style && children.props.style[':hover'],
        ...style && style[':hover'],
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      minHeight: 50,
      paddingBottom: 15,
      paddingLeft: methodPadding,
      paddingRight: methodPadding,
      paddingTop: 15,
    }
    if (!isNotClickable) {
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
}
const MethodSuggestion = Radium(MethodSuggestionBase)


interface MethodSectionProps {
  footer?: React.ReactNode
  headerContent?: React.ReactNode
  style?: React.CSSProperties
  subtitle?: string
  title?: React.ReactNode
}

class MethodSection extends React.PureComponent<MethodSectionProps & {children: React.ReactNode}> {
  public static propTypes = {
    children: PropTypes.node,
    footer: PropTypes.node,
    headerContent: PropTypes.node,
    style: PropTypes.object,
    subtitle: PropTypes.string,
    title: PropTypes.node,
  }

  public render(): React.ReactNode {
    const {children, footer, headerContent, style, subtitle, title} = this.props
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
        {subtitle ? <span style={subtitleStyle}>{subtitle}</span> : null}
        {headerContent}
      </header> : null}
      {children}
      {footer ? <footer style={footerStyle}>{footer}</footer> : null}
    </section>
  }
}

type MethodSuggestionListProps = AdviceSuggestionListProps & MethodSectionProps

class MethodSuggestionList extends React.PureComponent<MethodSuggestionListProps> {
  public static propTypes = {
    children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node.isRequired).isRequired,
      PropTypes.node.isRequired,
    ]).isRequired,
    footer: PropTypes.node,
    headerContent: PropTypes.node,
    isNotClickable: PropTypes.bool,
    style: PropTypes.object,
    subtitle: PropTypes.string,
    title: PropTypes.node,
  }

  // Add border radius on first or last element if there's no header/footer.
  private childSuggestionStyle = (index: number): React.CSSProperties => {
    const {children, footer, title} = this.props
    const lastChildIndex = React.Children.map(children, (child, index): number => child && index).
      filter((i): number => i).reverse()[0] || 0
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
  }

  public render(): React.ReactNode {
    const {children, footer, headerContent, isNotClickable, style, subtitle, title,
      ...otherProps} = this.props
    return <MethodSection {...{footer, headerContent, style, subtitle, title}}>
      <AppearingList {...otherProps}>
        {React.Children.map(children, (child: React.ReactElement, index): ReactStylableElement =>
          child ? <MethodSuggestion
            style={this.childSuggestionStyle(index)}
            isNotClickable={isNotClickable || child.props.isNotClickable}
            isTopLimitVisible={!!index || !!title}>{child}</MethodSuggestion> : null)}
      </AppearingList>
    </MethodSection>
  }
}


interface TipProps {
  style?: React.CSSProperties
  tip: string
}


class TipBase extends React.PureComponent<TipProps> {
  public static propTypes = {
    style: PropTypes.object,
    tip: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {tip, style} = this.props
    const tipStyle = {
      fontStyle: 'italic',
      marginRight: 10,
      ...style,
    }
    return <div style={tipStyle} >
      {tip}
    </div>
  }
}
const Tip = Radium(TipBase)


interface JobSuggestionProps {
  city?: bayes.bob.FrenchCity
  gender?: bayes.bob.Gender
  isCaption?: boolean
  // TODO(cyrille): Make this the default.
  isMethodSuggestion?: boolean
  // NOTE: this is not consumed by the JobSuggestion component but by the AdviceSuggestionList that
  // it might be embedded into.
  isNotClickable?: boolean
  job?: bayes.bob.ReorientJob
  onClick?: () => void
  style?: React.CSSProperties
}


class JobSuggestionBase extends React.PureComponent<JobSuggestionProps> {
  public static propTypes = {
    city: PropTypes.object,
    gender: PropTypes.oneOf(['FEMININE', 'MASCULINE'] as const),
    isCaption: PropTypes.bool,
    isMethodSuggestion: PropTypes.bool,
    job: PropTypes.object,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  private handleClick = (): void => {
    const {city, gender, job, onClick} = this.props
    window.open(getIMTURL(job, city) || getJobSearchURL(job, gender), '_blank')
    onClick && onClick()
  }

  private renderCaption(style: React.CSSProperties): React.ReactNode {
    const captionStyle: React.CSSProperties = {
      fontStyle: 'normal',
      marginRight: 10,
    }
    return <div style={style}>
      <span style={captionStyle}>
        Offres par candidat par rapport à votre métier&nbsp;:
      </span>
    </div>
  }

  private renderJob(style: React.CSSProperties): React.ReactNode {
    const {job} = this.props
    const multiplierStyle: React.CSSProperties = {
      color: colors.HOVER_GREEN,
      flex: 1,
      fontWeight: 'bold',
      marginRight: 0,
    }
    const jobNameStyle: React.CSSProperties = {
      flex: isMobileVersion ? 4 : 1,
      fontWeight: 'bold',
      marginRight: isMobileVersion ? 10 : 'initial',
    }
    const chevronStyle: React.CSSProperties = {
      fill: colors.CHARCOAL_GREY,
    }

    if (!job) {
      return null
    }

    const stressPercentLoss = Math.round((1 - 1 / (job.offersPercentGain / 100 + 1)) * 1000) / 10

    return <div style={style} onClick={this.handleClick}>
      <div style={jobNameStyle}>
        {job.name}
      </div>
      <div style={{flex: 1}}>
        <span style={{alignItems: 'center', display: 'flex'}}>
          {stressPercentLoss > 10 ? <div style={multiplierStyle}>
            -{stressPercentLoss.toLocaleString('fr-FR')}% de concurrence
          </div> : null}
          {isMobileVersion ? null : <div>Découvrir ce métier</div>}
          <ChevronRightIcon style={chevronStyle} />
        </span>
      </div>
    </div>
  }

  public render(): React.ReactNode {
    const {isCaption, isMethodSuggestion, style} = this.props
    const containerStyle: RadiumCSSProperties = isMethodSuggestion ? style : {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      fontWeight: 'bold',
      minHeight: isMobileVersion ? 'initial' : 50,
      ...style,
    }
    if (isCaption) {
      return this.renderCaption(containerStyle)
    }
    return this.renderJob(containerStyle)
  }
}
const JobSuggestion = Radium(JobSuggestionBase)


interface MissionProps {
  aggregatorName?: string
  associationName?: React.ReactNode
  description?: string
  isAvailableEverywhere?: boolean
  link?: string
  onContentShown?: () => void
  style?: React.CSSProperties
  title?: string
  userYou: YouChooser
}


class MissionBase extends React.PureComponent<MissionProps> {
  public static propTypes = {
    aggregatorName: PropTypes.string,
    associationName: PropTypes.node,
    description: PropTypes.node,
    isAvailableEverywhere: PropTypes.bool,
    link: PropTypes.string,
    onContentShown: PropTypes.func,
    style: PropTypes.object,
    title: PropTypes.string,
    userYou: PropTypes.func.isRequired,
  }

  public render(): React.ReactNode {
    const {aggregatorName, associationName, description, isAvailableEverywhere,
      link, onContentShown, style, title, userYou} = this.props
    const contentStyle: React.CSSProperties = {
      borderLeft: `solid 4px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
      fontSize: 13,
      lineHeight: 1.6,
      margin: '25px 0',
      overflow: 'hidden',
      paddingLeft: 15,
      ...SmoothTransitions,
    }
    const tag = isAvailableEverywhere && !isMobileVersion &&
      {color: colors.GREENISH_TEAL, value: 'depuis chez vous'} || null
    return <ExpandableAction
      contentName="la mission"
      isMethodSuggestion={true}
      onContentShown={onContentShown}
      style={style}
      tag={tag}
      title={associationName}
      userYou={userYou}>
      <div style={contentStyle}>
        <div style={{marginBottom: 20}}>
          <strong>Intitulé de la mission&nbsp;:</strong><br />
          {title}
        </div>

        <div>
          <strong>Description&nbsp;:</strong><br />
          <Markdown content={description} />
        </div>

        {link ? <div style={{marginTop: 20}}>
        Lire la suite sur <ExternalLink href={link}>{aggregatorName}</ExternalLink>
        </div> : null}
      </div>
    </ExpandableAction>
  }
}
const Mission = Radium(MissionBase)


interface MoreMissionsLinkProps {
  altLogo?: string
  children: React.ReactNode
  logo?: string
  style?: React.CSSProperties
}


// TODO(marielaure): Remove when migration to methods' UI is done.
class MoreMissionsLinkBase extends React.PureComponent<MoreMissionsLinkProps> {
  public static propTypes = {
    altLogo: PropTypes.string,
    children: PropTypes.node,
    logo: PropTypes.string,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {altLogo, children, logo, style, ...extraProps} = this.props
    const containerStyle = {
      ':hover': {
        backgroundColor: colors.LIGHT_GREY,
      },
      alignItems: 'center',
      backgroundColor: '#fff',
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      color: colors.CHARCOAL_GREY,
      cursor: 'pointer',
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: '0 25px',
      ...style,
    }
    const chevronStyle = {
      fill: colors.CHARCOAL_GREY,
      height: 20,
      lineHeight: '13px',
      marginLeft: 5,
      width: 20,
    }
    return <div style={containerStyle} {...extraProps}>
      <strong>
        {children}
      </strong>
      <span style={{flex: 1}} />
      <img src={logo} style={{height: 25}} alt={altLogo} />
      <ChevronRightIcon style={chevronStyle} />
    </div>
  }
}
const MoreMissionsLink = Radium(MoreMissionsLinkBase)


interface ListItemProps {
  children: React.ReactNode
  hasBorder?: boolean
  style?: React.CSSProperties
}


class ListItemBase extends React.PureComponent<ListItemProps> {
  public static propTypes = {
    children: PropTypes.node,
    hasBorder: PropTypes.bool,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, hasBorder, style, ...extraProps} = this.props
    const insideSpacing = '0 25px'
    const containerStyle = {
      alignItems: 'center',
      color: colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: 13,
      height: 50,
      padding: insideSpacing,
      ...style,
    }
    const borderStyle = {
      borderTop: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      margin: insideSpacing,
    }
    return <React.Fragment>
      {hasBorder ? <div style={borderStyle} /> : null}
      <div style={containerStyle} {...extraProps}>
        {children}
      </div>
    </React.Fragment>
  }
}
const ListItem = Radium(ListItemBase)


interface DataSoureProps {
  children: React.ReactNode
  style?: React.CSSProperties
}


class DataSource extends React.PureComponent<DataSoureProps> {
  public static propTypes = {
    children: PropTypes.node,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, style} = this.props
    const sourceStyle = {
      color: colors.COOL_GREY,
      fontSize: 13,
      fontStyle: 'italic',
      margin: '15px 0',
      ...style,
    }

    return <PaddedOnMobile style={sourceStyle}>
      *Source&nbsp;: {children}
    </PaddedOnMobile>
  }
}


interface StaticAdviceCardContentProps {
  expandedCardHeader?: string
  expandedCardItems?: string[]
}


class StaticAdviceCardContent extends React.PureComponent<StaticAdviceCardContentProps> {
  public static propTypes = {
    expandedCardHeader: PropTypes.string,
    expandedCardItems: PropTypes.arrayOf(PropTypes.string.isRequired),
  }

  public render(): React.ReactNode {
    const {expandedCardHeader, expandedCardItems} = this.props
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
}


type Omit<T, Keys> = Pick<T, Exclude<keyof T, Keys>>


interface HandyLinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'ref'> {
  children: string
  linkIntro?: string
}

class HandyLink extends React.PureComponent<HandyLinkProps> {
  public static propTypes = {
    children: PropTypes.string.isRequired,
    href: PropTypes.string.isRequired,
    linkIntro: PropTypes.string,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, linkIntro, style, ...otherProps} = this.props
    const linkStyle = {
      color: colors.BOB_BLUE,
      textDecoration: 'none',
    }
    return <div style={{fontWeight: 'bold', ...style}}>
      <span style={{marginRight: 10}} role="img" aria-label="main pointant à droite">👉 </span>
      {linkIntro ? <span>{linkIntro} </span> : null}
      <ExternalLink style={linkStyle} {...otherProps}>{children}</ExternalLink>
    </div>
  }
}

interface SkillAssetProps {
  asset: string
  style?: React.CSSProperties
}


class SkillAsset extends React.PureComponent<SkillAssetProps, {isHovered: boolean}> {
  public static propTypes = {
    asset: PropTypes.string.isRequired,
    style: PropTypes.object,
  }

  public state = {
    isHovered: false,
  }

  private handleHover = _memoize((isHovered: boolean): (() => void) =>
    (): void => this.setState({isHovered}))

  public render(): React.ReactNode {
    const {asset, style} = this.props
    const {isHovered} = this.state
    const {icon = undefined, name = undefined} = assetProps[asset] || {}
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
    const tooltipStyle: React.CSSProperties = {
      alignItems: 'center',
      bottom: 'calc(100% + 5px)',
      display: 'flex',
      flexDirection: 'column',
      left: '50%',
      opacity: isHovered ? 1 : 0,
      position: 'absolute',
      transform: 'translateX(-50%)',
      ...SmoothTransitions,
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
    return <div style={containerStyle}>
      <img
        onMouseOver={this.handleHover(true)} onMouseLeave={this.handleHover(false)}
        src={icon} style={imageStyle} alt={name} />
      <div style={tooltipStyle}>
        <div style={nameStyle}>{name}</div>
        <div style={tooltipTailStyle} />
      </div>
    </div>
  }
}


interface ActionWithHandyLinkProps {
  description?: string
  discoverUrl?: string
  isNotClickable?: boolean
  linkIntro?: string
  linkName?: string
  onClick: () => void
  style?: RadiumCSSProperties
}

class ActionWithHandyLink extends React.PureComponent<ActionWithHandyLinkProps> {
  public static propTypes = {
    children: PropTypes.node.isRequired,
    description: PropTypes.string,
    discoverUrl: PropTypes.string,
    linkIntro: PropTypes.string,
    linkName: PropTypes.string,
    onClick: PropTypes.func,
    style: PropTypes.object,
  }

  public render(): React.ReactNode {
    const {children, description, discoverUrl, linkIntro, linkName, onClick, style} = this.props
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
          {linkName}
        </HandyLink> : null}
    </div>
  }
}


interface SkillProps extends bayes.bob.Skill {
  handleExplore: (visualElement: string) => () => void
  isRecommended?: boolean
  style?: React.CSSProperties
  userYou: YouChooser
}


class Skill extends React.PureComponent<SkillProps> {
  public static propTypes = {
    assets: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
    description: PropTypes.string.isRequired,
    discoverUrl: PropTypes.string,
    handleExplore: PropTypes.func.isRequired,
    isRecommended: PropTypes.bool,
    name: PropTypes.string.isRequired,
    style: PropTypes.object,
    userYou: PropTypes.func.isRequired,
  }

  private renderTag(): React.ReactNode {
    if (!this.props.isRecommended) {
      return null
    }
    return <Tag style={{backgroundColor: colors.GREENISH_TEAL, marginLeft: 10}}>
      Recommandée
    </Tag>
  }

  public render(): React.ReactNode {
    const {assets = [], description, discoverUrl, handleExplore, name, style, userYou} = this.props
    return <ActionWithHandyLink
      onClick={handleExplore('link-skill')} linkIntro="Découvrir cette" linkName="compétence"
      {...{description, discoverUrl, style}}>
      <div style={{alignItems: 'center', display: 'flex', marginBottom: 15}}>
        <span style={{flex: 1}}>{name}</span>
        {assets.map((asset): React.ReactNode => <SkillAsset
          key={`${name}-${asset}`} {...{asset, userYou}} style={{marginLeft: 5}} />)}
      </div>
    </ActionWithHandyLink>
  }
}


interface TakeAwayTemplateProps {
  found: string
  isFeminine?: boolean
  list: {length: number}
}


class TakeAwayTemplate extends React.PureComponent<TakeAwayTemplateProps> {
  public static propTypes = {
    found: PropTypes.string.isRequired,
    isFeminine: PropTypes.bool,
    list: PropTypes.array,
  }

  public render(): React.ReactNode {
    const {found, isFeminine, list = []} = this.props
    const count = list.length
    if (!count) {
      return ''
    }
    const maybeS = count > 1 ? 's' : ''
    const maybeE = isFeminine ? 'e' : ''
    return `${count} ${found}${maybeS} trouvé${maybeE}${maybeS}`
  }
}


interface CardWithImageProps {
  description?: string
  image: string
  style?: React.CSSProperties
  title?: string
  url: string
}

class CardWithImage extends React.PureComponent<CardWithImageProps> {
  public static propTypes = {
    description: PropTypes.string,
    image: PropTypes.string.isRequired,
    style: PropTypes.object,
    title: PropTypes.string,
    url: PropTypes.string.isRequired,
  }

  public render(): React.ReactNode {
    const {description, image, style, title, url} = this.props
    const notALinkStyle: React.CSSProperties = {
      color: 'inherit',
      textDecoration: 'none',
    }
    const cardStyle: React.CSSProperties = {
      border: `solid 1px ${colors.MODAL_PROJECT_GREY}`,
      borderRadius: 10,
      overflow: 'hidden',
      width: 250,
      ...style,
    }
    return <div key={url} style={cardStyle}>
      <ExternalLink href={url}><img style={{width: '100%'}} src={image} alt="" /></ExternalLink>
      <div style={{padding: 15}}>
        {title ? <div style={{fontWeight: 'bold', marginTop: 10}}>
          <ExternalLink href={url} style={notALinkStyle}>
            {title}
          </ExternalLink>
        </div> : null}
        {description ? <div style={{color: colors.WARM_GREY, marginTop: 7, minHeight: 48}}>
          <ExternalLink href={url} style={notALinkStyle}>
            {description}
          </ExternalLink>
        </div> : null}
      </div>
    </div>
  }
}


function makeTakeAwayFromAdviceData<AdviceDataType extends {}, ListType extends {length: number}>(
  dataToList: (adviceData: AdviceDataType) => ListType, found: string, isFeminine?: boolean):
  React.ComponentType<WithAdvice> {

  class TakeAwayBase extends React.PureComponent<WithAdviceData<AdviceDataType> & WithAdvice> {
    public render(): React.ReactNode {
      const {adviceData} = this.props
      return <TakeAwayTemplate list={dataToList(adviceData)} {...{found, isFeminine}} />
    }
  }

  return connectExpandedCardWithContent<{}, AdviceDataType, WithAdvice>()(TakeAwayBase)
}


export {ToolCard, EmailTemplate, ImproveApplicationTips, AdviceSuggestionList, Skill,
  StaticAdviceCardContent, Tip, PercentageBoxes, connectExpandedCardWithContent, JobSuggestion,
  ExpandableAction, Mission, MoreMissionsLink, DataSource, TakeAwayTemplate, MethodSection,
  makeTakeAwayFromAdviceData, ListItem, MethodSuggestionList, CardWithImage, ActionWithHandyLink}
