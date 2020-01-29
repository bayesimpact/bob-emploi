import _partition from 'lodash/partition'
import ChevronRightIcon from 'mdi-react/ChevronRightIcon'
import PropTypes from 'prop-types'
import React, {useMemo} from 'react'
import {useTranslation} from 'react-i18next'
import {Link} from 'react-router-dom'

import {getAdviceGoal} from 'store/advice'
import {upperFirstLetter} from 'store/french'

import {isMobileVersion} from 'components/mobile'
import {RadiumDiv} from 'components/radium'


interface DiagnosticAdviceProps {
  advice: bayes.bob.Advice & {adviceId: string}
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
  teaser?: string
}


const AlphaTagBase = (props: {style?: React.CSSProperties}): React.ReactElement => {
  const containerStyle = useMemo((): React.CSSProperties => ({
    backgroundColor: colors.RED_PINK,
    borderRadius: 5,
    color: '#fff',
    padding: 5,
    ...props.style,
  }), [props.style])
  const {t} = useTranslation()
  return <div
    style={containerStyle}
    title={t("Ce conseil n'est donné qu'aux utilisateurs de la version alpha")}>
    α
  </div>
}
const AlphaTag = React.memo(AlphaTagBase)


const desktopCardStyle: RadiumCSSProperties = {
  ':hover': {
    border: `solid 1px ${colors.PINKISH_GREY}`,
  },
  'border': `solid 1px ${colors.MODAL_PROJECT_GREY}`,
}
const cardStyle: RadiumCSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 5,
  display: 'flex',
  padding: '11px 15px',
  position: 'relative',
  ...isMobileVersion ? {} : desktopCardStyle,
}
const bulletStyle: React.CSSProperties = {
  backgroundColor: colors.GREENISH_TEAL,
  borderRadius: 6,
  flexShrink: 0,
  height: 6,
  marginRight: 10,
  width: 6,
}
const chevronStyle: React.CSSProperties = {
  flexShrink: 0,
  marginRight: -7,
}


const DiagnosticAdviceBase = (props: DiagnosticAdviceProps): React.ReactElement => {
  const {advice: {adviceId, goal, isForAlphaOnly, status},
    makeAdviceLink, style, teaser} = props
  const isRead = status === 'ADVICE_READ'
  const containerStyle = useMemo((): React.CSSProperties => ({
    color: 'inherit',
    cursor: 'pointer',
    display: 'block',
    textDecoration: 'none',
    ...style,
  }), [style])
  const titleStyle = useMemo((): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: isRead ? 'normal' : 'bold',
  }), [isRead])
  const {t} = useTranslation()
  const shownTeaser = teaser || getAdviceGoal({adviceId: adviceId, goal: goal}, t)
  return <Link to={makeAdviceLink(adviceId)} key={adviceId} style={containerStyle}>
    <RadiumDiv style={cardStyle}>
      {isRead ? null : <div style={bulletStyle} />}
      <span style={titleStyle}>
        {upperFirstLetter(shownTeaser)}
      </span>
      <div style={{flex: 1}} />
      {isForAlphaOnly ? <AlphaTag /> : null}
      <ChevronRightIcon size={20} style={chevronStyle} />
    </RadiumDiv>
  </Link>
}
DiagnosticAdviceBase.propTypes = {
  advice: PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
    goal: PropTypes.string,
    isForAlphaOnly: PropTypes.bool,
    status: PropTypes.string,
  }).isRequired,
  makeAdviceLink: PropTypes.func.isRequired,
  style: PropTypes.object,
  teaser: PropTypes.string,
}
const DiagnosticAdvice = React.memo(DiagnosticAdviceBase)


function isAdviceWithId(a: bayes.bob.Advice): a is (bayes.bob.Advice & {adviceId: string}) {
  return !!a.adviceId
}


interface DiagnosticAdviceListProps {
  adviceStyle?: React.CSSProperties
  advices: bayes.bob.Advice[]
  children: React.ReactNode
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
}


const listHeaderStyle: React.CSSProperties = {
  fontWeight: 'bold',
  margin: '10px 0',
}
const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: isMobileVersion ? 'column' : 'initial',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
}


const DiagnosticAdviceListBase = (props: DiagnosticAdviceListProps): React.ReactElement|null => {
  const {adviceStyle, advices = [], children, makeAdviceLink, style} = props
  const adviceUpdatedStyle = useMemo((): React.CSSProperties => ({
    marginBottom: 10,
    [isMobileVersion ? 'maxWidth' : 'width']: 290,
    ...adviceStyle,
  }), [adviceStyle])
  if (!advices.length) {
    return null
  }
  return <div style={style}>
    <div style={listHeaderStyle}>{children}</div>
    <div style={listStyle}>
      {advices.filter(isAdviceWithId).
        map((advice: bayes.bob.Advice & {adviceId: string}): React.ReactNode =>
          <DiagnosticAdvice
            style={adviceUpdatedStyle} key={advice.adviceId}
            {...{advice, makeAdviceLink}} />)}
    </div>
  </div>
}
DiagnosticAdviceListBase.propTypes = {
  adviceStyle: PropTypes.object,
  advices: PropTypes.arrayOf(PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
    numStars: PropTypes.number,
  }).isRequired).isRequired,
  children: PropTypes.node,
  makeAdviceLink: PropTypes.func.isRequired,
  style: PropTypes.object,
}
const DiagnosticAdviceList = React.memo(DiagnosticAdviceListBase)


interface DiagnosticAdvicesProps {
  advices: bayes.bob.Advice[]
  makeAdviceLink: (adviceId: string) => string
  style?: React.CSSProperties
}


const DiagnosticAdvicesBase: React.FC<DiagnosticAdvicesProps> =
(props: DiagnosticAdvicesProps): React.ReactElement|null => {
  const {advices = [], makeAdviceLink, style} = props
  const containerStyle = useMemo((): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    ...style,
  }), [style])
  const {t} = useTranslation()
  if (!advices.length) {
    return null
  }
  const [mainAdvices, otherAdvices] = _partition(advices, ({numStars}): boolean => numStars === 3)
  return <div style={containerStyle}>
    <DiagnosticAdviceList
      advices={mainAdvices} style={{flex: 1}} {...{makeAdviceLink}}>
      {t('Commencez par')}
    </DiagnosticAdviceList>
    <DiagnosticAdviceList
      advices={otherAdvices} style={{flex: 1}}
      {...{makeAdviceLink}}>
      {mainAdvices.length ? t('Puis éventuellement') : t('Essayez de')}
    </DiagnosticAdviceList>
  </div>
}
DiagnosticAdvicesBase.propTypes = {
  advices: PropTypes.arrayOf(PropTypes.shape({
    adviceId: PropTypes.string.isRequired,
    numStars: PropTypes.number,
  }).isRequired),
  makeAdviceLink: PropTypes.func.isRequired,
  style: PropTypes.object,
}
const DiagnosticAdvices = React.memo(DiagnosticAdvicesBase)


export {AlphaTag, DiagnosticAdvice, DiagnosticAdvices}
