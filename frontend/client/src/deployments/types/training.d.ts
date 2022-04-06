import type React from 'react'

import type {CardProps, EmailTemplate, EmailTemplateProps} from 'components/advisor/base'

interface GetTipsProps extends Pick<CardProps, 'project'|'profile'|'t'> {
  commonTips: {
    coach: React.ReactElement<EmailTemplateProps, typeof EmailTemplate>
    friend: React.ReactElement<EmailTemplateProps, typeof EmailTemplate>
    recruiter: React.ReactElement<EmailTemplateProps, typeof EmailTemplate>
  }
  data: bayes.bob.Trainings
  onContentShown: () => void
}

interface Tips {
  isOrdered?: boolean
  tips: ReactStylableElement[]
}

interface Website {
  logo: string
  name: string
  url: string
}

declare const getTips: (props: GetTipsProps) => Tips

declare const websites: readonly Website[]
