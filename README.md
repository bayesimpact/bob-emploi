# Bob Emploi
Bob Emploi is a data-driven companion for jobseekers.

It is a free web application that aims is to empower jobseekers by: a) using data to help them find better job search strategies and b) delivering them concrete, actionable actions every day in order to execute them. For more information, check out the website at http://www.bob-emploi.fr (French only for now).

Bob Emploi is developed and maintained by [Bayes Impact](http://www.bayesimpact.org), a non-profit organization whose purpose is to use technology and data to address social issues. It is currently being launched in France, where Bayes Impact works closely with the French National Unemployment Service (Pôle Emploi).

Bob Emploi is a React Single Page Application with a RESTful JSON API written in Python. The application is backed by a MongoDB which serves data that we pre-computed using the Python data science stack.

## Licensing

We believe algorithms that aim to serve the public interest should be auditable and transparent. In accordance with our mission of building a "citizen-led public service", most of the application will be open-source under a GPL v3 license.

## Open-Sourcing Status
### Core Application Code
As of mid-November 2016, most of the core application source code is yet to be opened. We are a small team and all our efforts are currently focused on application launch and follow-ups. The front-end, back-end, and application logic will be opened in the coming weeks as development stabilizes.

### Components
We have currently opened two of the components we built as part of Bob Emploi:
- **[JobSuggest](https://github.com/bayesimpact/french-job-suggest)**, an autocomplete component for suggesting and selecting French job titles. It is currently based on the ROME job taxonomy, which it enrichies by a) properly genderizing job titles and b) weighting job titles by frequency.
- **[PyEmploiStore](https://github.com/bayesimpact/python-emploi-store)**, a Python wrapper around Emploi Store Dev APIs, the platform managed by Pôle Emploi to share their public data.

### Data
We have opened some of the data analysis notebooks pertaining to the data sources used by the application. These are unedited and incomplete, but provide a first insight on the data our recommendations are based on. As these are critical to being able to assess the validity of Bob Emploi's recommendation, we will first focus our open-sourcing efforts on opening more notebooks.

In particular, some of our datasets contain private data, or belong to an external data partner), and as such notebooks analyzing them will be opened over time as we're able to individually vet them for any potential leakage of sensitive information. Below is a list of the main data sources used in the application along with a short description.

#### BMO ("Besoin en Main d'Oeuvre")
**Description**: The BMO is a yearly survey of employers' needs, used to collect different metrics on the labor market. In particular, it is used to estimate jobs whose openings are estimated by employers to be difficult to fill ("métiers en tension"). See the [official website](http://bmo.pole-emploi.org/) for more details.

**How it's used in Bob Emploi**: To provide labor market information on the jobs in the Discovery page, and to compute some metrics used when generating recommended Action Plans.

#### Pôle Emploi Administrative File
**Description**: An anonymized sample of jobseeker's registered with Pôle Emploi over the past 10 years, amounting to millions of individual trajectories. This is an extremely rich dataset but obviously one of the most sensitive.
**How it's used in Bob Emploi**: To compute a variety of metrics assessing the viability of a given job search strategy. Most notably, estimate the time to employment for a given job.


#### IMT ("Informations sur le marché du travail")
**Description**: A dataset compiled by Pôle Emploi summarizing supply and demand statistics for a given job and location.

**How it's used in Bob Emploi**: The IMT provides some of the basic information used in assessing the viability of a given job.

#### ROME  ("Répertoire Opérationnel des Métiers et Emplois")
**Description**: A taxonomy used by Pôle Emploi that describes and categorizes the existing jobs, and provides various information such as skills and activities involved for each skill. While this taxonomy has its limitations, it provides a useful starting point, especially as many useful datasets are indexed on it.

**How it's used in Bob Emploi**: When building an Action Plan for a given project, our users currently use a slightly enriched version of ROME as their entry point.

#### Job Postings
**Description**: A database of Job Postings collected by Pôle Emploi over several years. As of mid-November 2016, it unfortunately doesn't contain job postings collected from other job boards, but nonetheless provides extremely rich information on the characteristics of the labor market for each job.

**How it's used in Bob Emploi**: To extract valuable information on the best strategies for each job: performing data analysis on job postings allow us to gather more granular, data-driven information on each job (required skills, salary, etc.) that may not be found in the manually curated directories such as the ROME; it also allow us to estimate the effect of changes in job search strategy in terms of number of available job offers, such as changing one's salary expectations.
