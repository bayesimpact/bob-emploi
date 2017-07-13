import {config, expect} from 'chai'
import {createProjectTitle, PROJECT_EMPLOYMENT_TYPE_OPTIONS,
  PROJECT_EXPERIENCE_OPTIONS, createProjectTitleComponents, getEmploymentZone,
  getTrainingFulfillmentEstimateOptions} from 'store/project'
import {EmploymentType} from 'api/job'
import {PreviousJobSimilarity, TrainingFulfillmentEstimate} from 'api/project'

config.truncateThreshold = 0

describe('createProjectTitle', () => {

  const createNewProject = () => {
    return {
      areaType: 'CITY',
      city: {
        departementName: 'Sarthe',
        name: 'Rennes',
        regionName: 'Pays de la Loire',
      },
      kind: 'FIND_JOB',
      targetJob: {
        feminineName: 'Pâtissière',
        masculineName: 'Pâtissier',
        name: 'Pâtissier / Pâtissière',
      },
    }
  }

  it('should include the job and the city when looking for a job with areaType CITY', () => {
    const title = createProjectTitle(createNewProject(), 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should use a contracted form for the city if needed', () => {
    const newProject = createNewProject()
    newProject.city.name = 'Le Mans'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier au Mans')
  })

  it('should use a lowercase when the city starts with a prefix', () => {
    const newProject = createNewProject()
    newProject.city.name = 'La Rochelle'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier à la Rochelle')
  })

  it('nothing fancy even if the job starts with a vowel', () => {
    const newProject = createNewProject()
    newProject.targetJob.masculineName = 'Écrivain'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Écrivain à Rennes')
  })

  it('should include the job but not the departement when areaType is DEPARTEMENT', () => {
    const newProject = createNewProject()
    newProject.areaType = 'DEPARTEMENT'
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Pâtissier à Rennes')
  })

  it('should mention that they want to create their own company, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'CREATE_COMPANY'
    newProject.targetJob = undefined
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Créer une entreprise à Rennes')
  })

  it('should mention that they want to take over a company, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'TAKE_OVER_COMPANY'
    newProject.targetJob = undefined
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Reprendre une entreprise à Rennes')
  })

  it('should mention that they want to do a re-orientation, if they are up for that', () => {
    const newProject = createNewProject()
    newProject.kind = 'REORIENTATION'
    newProject.targetJob = undefined
    const title = createProjectTitle(newProject, 'MASCULINE')
    expect(title).to.equal('Me réorienter à Rennes')
  })
})


describe('createProjectTitleComponents', () => {
  const createNewProject = () => {
    return {
      areaType: 'CITY',
      city: {
        departementName: 'Sarthe',
        name: 'Rennes',
        regionName: 'Pays de la Loire',
      },
      kind: 'FIND_JOB',
      seniority: 'INTERMEDIARY',
      targetJob: {
        feminineName: 'Pâtissière',
        masculineName: 'Pâtissier',
        name: 'Pâtissier / Pâtissière',
      },
    }
  }

  it('should return components of a default project', () => {
    const components = createProjectTitleComponents(createNewProject(), 'MASCULINE')
    expect(components).to.deep.eql({
      experience: "avec entre 2 et 5 ans d'expérience",
      what: 'Pâtissier',
      where: 'à Rennes',
    })
  })

  it('should return a decent experience text for internships', () => {
    const project = {
      ...createNewProject(),
      seniority: 'INTERNSHIP',
    }
    const components = createProjectTitleComponents(project, 'MASCULINE')
    expect(components).to.deep.eql({
      experience: 'avec une expérience de stage',
      what: 'Pâtissier',
      where: 'à Rennes',
    })
  })
})


describe('PROJECT_EMPLOYMENT_TYPE_OPTIONS', () => {
  it('should contain identifiers in values, not in names', () => {
    PROJECT_EMPLOYMENT_TYPE_OPTIONS.forEach(({name, value}) => {
      expect(EmploymentType).to.have.property(value)
      expect(name).not.to.match(/^[A-Z0-9]*_[A-Z0-9_]*$/)
    })
  })
})


describe('employment zone', () => {
  it('should return the city name when there are no area type in mobility', () => {
    const mobility = {city: {name: 'Paris'}}
    const result = getEmploymentZone(mobility)
    expect(result).to.equal('Paris')
  })

  it('should return the city when the city area is chosen in mobility', () => {
    const mobility = {areaType: 'CITY', city: {name: 'Lectoure', regionName: 'Rhône-Alpes'}}
    const result = getEmploymentZone(mobility)
    expect(result).to.equal('Lectoure')
  })

  it('should return the departement when the departement area is chosen in mobility ', () => {
    const mobility = {areaType: 'DEPARTEMENT', city: {departementName: 'Rhône', name: 'Lyon'}}
    const result = getEmploymentZone(mobility)
    expect(result).to.equal('Rhône')
  })

  it('should return the region when the region area is chosen in mobility', () => {
    const mobility = {areaType: 'REGION', city: {name: 'Lyon', regionName: 'Rhône-Alpes'}}
    const result = getEmploymentZone(mobility)
    expect(result).to.equal('Rhône-Alpes')
  })

  it('should return "partout en France" when country area is chosen in mobility', () => {
    const mobility = {areaType: 'COUNTRY', city: {name: 'Lyon', regionName: 'Rhône'}}
    const result = getEmploymentZone(mobility)
    expect(result).to.equal('partout en France')
  })
})


describe('getTrainingFulfillmentEstimateOptions', () => {
  ['FEMININE', 'MASCULINE'].forEach(gender => it(`has proper values for ${gender}`, () => {
    const options = getTrainingFulfillmentEstimateOptions(gender)
    expect(options).to.have.length.above(2)
    options.forEach(option => {
      expect(option).to.contain.all.keys('name', 'value')
      const {name, value} = option
      expect(name).to.be.ok
      expect(value).to.be.ok
      expect(TrainingFulfillmentEstimate).to.include.key(value)
    })
  }))
})


describe('PROJECT_EXPERIENCE_OPTIONS', () => {
  expect(PROJECT_EXPERIENCE_OPTIONS).to.have.length.above(2)
  PROJECT_EXPERIENCE_OPTIONS.forEach(option => {
    expect(option).to.contain.all.keys('name', 'value')
    const {name, value} = option
    expect(name).to.be.ok
    expect(value).to.be.ok
    expect(PreviousJobSimilarity).to.include.key(value)
  })
})
