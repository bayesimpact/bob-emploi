import {createProjectTitleComponents} from 'store/project'

export function getUseCaseTitle(title?: string, userData?: bayes.bob.User): string {
  if (title) {
    return title
  }
  const {profile: {gender = undefined} = {}, projects} = userData || {}
  if (!projects || !projects.length) {
    return ''
  }
  const project = projects[0]
  const {what, where} = createProjectTitleComponents(project, gender)
  return `${what} ${where}`
}
