import {TFunction} from 'i18next'

import {createProjectTitleComponents} from 'store/project'

export function getUseCaseTitle(t: TFunction, title?: string, userData?: bayes.bob.User): string {
  if (title) {
    return title
  }
  const {profile: {gender = undefined} = {}, projects} = userData || {}
  if (!projects || !projects.length) {
    return ''
  }
  const project = projects[0]
  const {what, where} = createProjectTitleComponents(project, t, gender)
  return `${what} ${where}`
}
