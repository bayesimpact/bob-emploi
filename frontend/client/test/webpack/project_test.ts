import {config, expect} from 'chai'
import {createProjectTitle, PROJECT_EMPLOYMENT_TYPE_OPTIONS, PROJECT_PASSIONATE_OPTIONS,
  PROJECT_EXPERIENCE_OPTIONS, PROJECT_KIND_OPTIONS,
  createProjectTitleComponents, newProject, flattenProject,
  TRAINING_FULFILLMENT_ESTIMATE_OPTIONS} from 'store/project'
// @ts-ignore
import {EmploymentType} from 'api/job'
import {PreviousJobSimilarity, ProjectKind, TrainingFulfillmentEstimate,
// @ts-ignore
  PassionateLevel} from 'api/project'

config.truncateThreshold = 0

const createNewProject = (): bayes.bob.Project => {
  return {
    areaType: 'CITY',
    city: {
      departementName: 'Sarthe',
      name: 'Rennes',
      regionName: 'Pays de la Loire',
    },
    kind: 'FIND_A_NEW_JOB',
    targetJob: {
      feminineName: 'Pâtissière',
      masculineName: 'Pâtissier',
      name: 'Pâtissier / Pâtissière',
    },
  }
}
const fakeT = (text: string): string => text

describe('createProjectTitle', (): void => {

  it('should include the job and the city when looking for a job with areaType CITY', (): void => {
    const title = createProjectTitle(createNewProject(), fakeT, 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should use a contracted form for the city if needed', (): void => {
    const newProject = createNewProject()
    const project = {
      ...newProject,
      city: {
        ...newProject.city,
        name: 'Le Mans',
      },
    }
    const title = createProjectTitle(project, fakeT, 'MASCULINE')
    expect(title).to.equal('Pâtissier au Mans')
  })

  it('should use a lowercase when the city starts with a prefix', (): void => {
    const newProject = createNewProject()
    const project = {
      ...newProject,
      city: {
        ...newProject.city,
        name: 'La Rochelle',
      },
    }
    const title = createProjectTitle(project, fakeT, 'MASCULINE')
    expect(title).to.equal('Pâtissier à la Rochelle')
  })

  it('nothing fancy even if the job starts with a vowel', (): void => {
    const newProject = createNewProject()
    const project = {
      ...newProject,
      targetJob: {
        ...newProject.targetJob,
        masculineName: 'Écrivain',
      },
    }
    const title = createProjectTitle(project, fakeT, 'MASCULINE')
    expect(title).to.equal('Écrivain à Rennes')
  })

  it('should include the job but not the departement when areaType is DEPARTEMENT', (): void => {
    const newProject: bayes.bob.Project = {
      ...createNewProject(),
      areaType: 'DEPARTEMENT',
    }
    const title = createProjectTitle(newProject, fakeT, 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should mention that they want to create their own company, if they are up for that',
    (): void => {
      const newProject: bayes.bob.Project = {
        ...createNewProject(),
        kind: 'CREATE_COMPANY',
        targetJob: undefined,
      }
      const title = createProjectTitle(newProject, fakeT, 'MASCULINE')
      expect(title).to.equal('Créer une entreprise à Rennes')
    })

  it('should mention that they want to take over a company, if they are up for that', (): void => {
    const newProject: bayes.bob.Project = {
      ...createNewProject(),
      kind: 'TAKE_OVER_COMPANY',
      targetJob: undefined,
    }
    const title = createProjectTitle(newProject, fakeT, 'MASCULINE')
    expect(title).to.equal('Reprendre une entreprise à Rennes')
  })

  it('should mention that they want to do a re-orientation, if they are up for that', (): void => {
    const newProject: bayes.bob.Project = {
      ...createNewProject(),
      kind: 'REORIENTATION',
      targetJob: undefined,
    }
    const title = createProjectTitle(newProject, fakeT, 'MASCULINE')
    expect(title).to.equal('Me réorienter à Rennes')
  })

  it("shouldn't fail if no target job is speciied", (): void => {
    const newProject: bayes.bob.Project = {
      ...createNewProject(),
      targetJob: undefined,
    }
    const title = createProjectTitle(newProject, fakeT, 'MASCULINE')
    expect(title).to.equal('Trouver un emploi à Rennes')
  })
})


const createNewPastryProject = (): bayes.bob.Project => {
  return {
    areaType: 'CITY',
    city: {
      departementName: 'Sarthe',
      name: 'Rennes',
      regionName: 'Pays de la Loire',
    },
    kind: 'FIND_A_NEW_JOB',
    seniority: 'INTERMEDIARY',
    targetJob: {
      feminineName: 'Pâtissière',
      masculineName: 'Pâtissier',
      name: 'Pâtissier / Pâtissière',
    },
  }
}


describe('createProjectTitleComponents', (): void => {
  it('should return components of a default project', (): void => {
    const components = createProjectTitleComponents(createNewPastryProject(), fakeT, 'MASCULINE')
    expect(components).to.eql({
      experience: "avec entre 2 et 5 ans d'expérience",
      what: 'Pâtissier',
      where: 'à Rennes',
    })
  })

  it('should return a decent experience text for internships', (): void => {
    const project: bayes.bob.Project = {
      ...createNewPastryProject(),
      seniority: 'INTERN',
    }
    const components = createProjectTitleComponents(project, fakeT, 'MASCULINE')
    expect(components).to.eql({
      experience: 'avec une expérience de stage',
      what: 'Pâtissier',
      where: 'à Rennes',
    })
  })
})


describe('PROJECT_EMPLOYMENT_TYPE_OPTIONS', (): void => {
  it('should contain identifiers in values, not in names', (): void => {
    PROJECT_EMPLOYMENT_TYPE_OPTIONS.forEach(({name, value}): void => {
      expect(EmploymentType).to.have.property(value)
      expect(name).not.to.match(/^[\dA-Z]*_[\dA-Z_]*$/)
    })
  })
})


// TODO(cyrille): Add test for all keys from proto to be present.
describe('TRAINING_FULFILLMENT_ESTIMATE_OPTIONS', (): void => {
  (['FEMININE', 'MASCULINE'] as const).forEach((gender): void => {
    it(`has proper values for ${gender}`, (): void => {
      expect(TRAINING_FULFILLMENT_ESTIMATE_OPTIONS).to.have.length.above(2)
      TRAINING_FULFILLMENT_ESTIMATE_OPTIONS.forEach((option): void => {
        expect(option).to.include.all.keys('name', 'value')
        const {name, value} = option
        expect(name).to.be.ok
        expect(value).to.be.ok
        expect(TrainingFulfillmentEstimate).to.include.all.keys(value)
      })
    })
  })
})


// TODO(cyrille): Add test for all keys from proto to be present.
describe('PROJECT_EXPERIENCE_OPTIONS', (): void => {
  expect(PROJECT_EXPERIENCE_OPTIONS).to.have.length.above(2)
  PROJECT_EXPERIENCE_OPTIONS.forEach((option): void => {
    expect(option).to.include.all.keys('name', 'value')
    const {name, value} = option
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(PreviousJobSimilarity).to.include.all.keys(value)
  })
})


describe('PROJECT_KIND_OPTIONS', (): void => {
  expect(PROJECT_KIND_OPTIONS).to.have.length.above(2)
  PROJECT_KIND_OPTIONS.forEach((option): void => {
    expect(option).to.include.all.keys('name', 'value')
    const {name, value} = option
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(ProjectKind).to.include.all.keys(value)
  })

  expect(PROJECT_KIND_OPTIONS.map(({value}): bayes.bob.ProjectKind => value)).to.have.all.members(
    Object.keys(ProjectKind).filter((key): boolean =>
      ProjectKind[key] && key !== 'CREATE_COMPANY' && key !== 'TAKE_OVER_COMPANY'),
  )
})


describe('PROJECT_PASSIONATE_OPTIONS', (): void => {
  expect(PROJECT_PASSIONATE_OPTIONS).to.have.length.above(2)
  PROJECT_PASSIONATE_OPTIONS.forEach((option): void => {
    expect(option).to.include.all.keys('name', 'value')
    const {name, value} = option
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(PassionateLevel).to.include.all.keys(value)
  })

  expect(PROJECT_PASSIONATE_OPTIONS.map(({value}): bayes.bob.PassionateLevel => value)).
    to.have.all.members(
      Object.keys(PassionateLevel).filter((key): boolean => !!PassionateLevel[key]),
    )
})

describe('flattenProject', (): void => {
  it('should make an incomplete project', (): void => {
    expect(flattenProject(createNewProject()).isIncomplete).to.be.true
  })

  it('should drop previous project ID', (): void => {
    const project = {
      ...createNewProject(),
      projectId: '0',
    }
    expect(!flattenProject(project).projectId).to.be.true
  })

  it('should drop previous creation date', (): void => {
    const project = {
      ...createNewProject(),
      createdAt: new Date().toISOString(),
    }
    expect(!flattenProject(project).createdAt).to.be.true
  })
})

describe('newProject', (): void => {

  const fakeT = (text: string): string => text

  it('should set a title to the project', (): void => {
    const project = newProject(createNewProject(), fakeT, 'MASCULINE')
    expect(project.title).not.to.be.empty
  })

  it('should update the title field when necessary.', (): void => {
    const project = createNewProject()
    const previous = newProject(project, fakeT, 'MASCULINE')
    const next = newProject(previous, fakeT, 'FEMININE')
    expect(next.title).not.to.equal(previous.title)
  })

  it('should set the status as current', (): void => {
    const project = newProject(createNewProject(), fakeT, 'MASCULINE')
    expect(project.status).to.equal('PROJECT_CURRENT')
  })

  it('should drop the isIncomplete flag', (): void => {
    const project = newProject(createNewProject(), fakeT, 'MASCULINE')
    expect(project.isIncomplete).to.be.undefined
  })

  it('should keep all other fields', (): void => {
    const project = createNewProject()
    const updated = newProject(project, fakeT, 'MASCULINE')
    const {
      isIncomplete: omittedProjectIncomplete,
      status: omittedProjectStatus,
      title: omittedProjectTitle,
      ...projectOtherFields
    } = project
    const {
      isIncomplete: omittedUpdatedIncomplete,
      status: omittedUpdatedStatus,
      title: omittedUpdatedTitle,
      ...updatedOtherFields
    } = updated
    expect(updatedOtherFields).to.deep.equal(projectOtherFields)
  })
})
