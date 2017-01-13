### Data

We are currently veting and cleaning our data sources for open sourcing and plan to finish this process until the end of January 2017. As soon as we are done we will add detailed instructions of how to run the notebooks to this folder of the repository.

Below is a list of the main data sources used in the application along with a short description.

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
