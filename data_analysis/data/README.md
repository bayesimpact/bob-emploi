# Data

We are currently only able to provide access to the public data sources we are using for data analysis. Private datasets, that we received from Pôle Emploi and other partners, might contain proprietery or sensitive information and we can't make them available publicly at this time. We will constantly try to make as much data available to the public as possible.

Further down you can find a list of the main data sources used in the application along with a short description.

## Getting the Data

Directly after checkout of the repository, this folder will contain hardly any data. To download and prepare the data run `docker-compose run --rm data-analysis-prepare make all`, which will populate the `data_analysis/data` subfolder by using a Makefile inside a
Docker container

Using _Make_ is a great way to handle dependencies robustly. Read Mike Bostock's piece at http://bost.ocks.org/mike/make/ to better understand why we are providing the data in this way.

## List of Data Sources

### `bmo:` BMO ("Besoin en Main d'Oeuvre")

The BMO is a yearly survey of employers' needs, used to collect different metrics on the labor market. In particular, it is used to estimate jobs whose openings are estimated by employers to be difficult to fill ("métiers en tension"). See the [official website](http://bmo.pole-emploi.org/) for more details.

**How it's used in Bob Emploi**: To provide labor market information on the jobs in the Discovery page, and to compute some metrics used when generating recommended Action Plans.

### `crosswalks:` Mappings Between Different Datasets

For example the the taxonomy of french jobs uses a ROME code to refer to a certain job, but the labor market statistics are organized by job groups and industry areas. A crosswalk file can help to connect the respective items from the two different datasets.

### `geo:` Geographical Information About France

We use these files for example know which cities are located within the same department or region.

### `requirements:` Job Requirements

By parsing the job description within ROME, we extract a more formalized representation of job requirements.

### `rome:` ROME - Répertoire Opérationnel des Métiers et Emplois

A taxonomy used by Pôle Emploi that describes and categorizes the existing jobs, and provides various information such as skills and activities involved for each skill. While this taxonomy has its limitations, it provides a useful starting point, especially as many useful datasets are indexed on it.

**How it's used in Bob Emploi**: When building an Action Plan for a given project, our users currently use a slightly enriched version of ROME as their entry point.

### `stmt`: STMT - Statistique du marché du travail

Statistics to get a better understanding of the french job market and unemployment situation.

## Other Data Sources

Which we are planning to publish in the future.

### Pôle Emploi Administrative File
**Description**: An anonymized sample of jobseeker's registered with Pôle Emploi over the past 10 years, amounting to millions of individual trajectories. This is an extremely rich dataset but obviously one of the most sensitive.
**How it's used in Bob Emploi**: To compute a variety of metrics assessing the viability of a given job search strategy. Most notably, estimate the time to employment for a given job.

### Job Postings
**Description**: A database of Job Postings collected by Pôle Emploi over several years. As of mid-November 2016, it unfortunately doesn't contain job postings collected from other job boards, but nonetheless provides extremely rich information on the characteristics of the labor market for each job.

**How it's used in Bob Emploi**: To extract valuable information on the best strategies for each job: performing data analysis on job postings allow us to gather more granular, data-driven information on each job (required skills, salary, etc.) that may not be found in the manually curated directories such as the ROME; it also allow us to estimate the effect of changes in job search strategy in terms of number of available job offers, such as changing one's salary expectations.

### IMT ("Informations sur le marché du travail")
**Description**: A dataset compiled by Pôle Emploi summarizing supply and demand statistics for a given job and location.

**How it's used in Bob Emploi**: The IMT provides some of the basic information used in assessing the viability of a given job.