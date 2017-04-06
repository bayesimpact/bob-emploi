# Notebooks

We use notebooks to tell a story and communicate results from one or several dataset. Please use the [Bayes Style Guide](https://goo.gl/lhK4JT) to ensure the uniformity and readability of your contributions.

## Folder Layout

The folder is organized according to the following scheme:

* `bob_emploi_usage`: Internal analytics of Bob Emploi user data.
* `datasets`: Investigation of the properties of a dataset. For example how complete it is, how to best read it into memory, what are some quirks or interesting features of the dataset.
* `research`: Topics to investigate which are not necessarily tied to a specific dataset. In here we would for example have one folder to investigate a _metric of job similarity_, which uses data from ROME, but also a vector space model derived from Wikipedia articles.
* `scraped_data`: Some data was not readily available for download, so we scraped it directly from the website. Notebooks in this folder investigate the quality of the scraped data, conclusions from the data would be drawn in the `research folder`.

Some of the folders are pretty empty at the moment, but more notebooks are going to come soon.

## Sample of useful notebooks

### Explaining Datasets

* [IMT](datasets/rome/work_environments.ipynb): regional statistics about different jobs.
* [ROME](datasets/rome/ROME_dataset.ipynb): taxonomy of jobs.

### Running Analyses

* [Contract types](research/contract_types/Contract_Recommendations.ipynb): proportion of each contract type for each job group.
* [Best job in group](research/best_job_in_group/from_job_offers.ipynb): trying to find which job is the best in each job group.
* [Spontaneous Applications](research/application_types/Apply_Spontaneously.ipynb): studying where the spontaneous applications are the most useful.
* [Work environements from ROME](datasets/rome/work_environments.ipynb): work environments from the ROME dataset.
* [Skills from ROME](datasets/rome/ROME_skills.ipynb): list of skills from the ROME dataset.
* [Salaries from FHS](notebooks/research/salaries/FHS_salaries.ipynb): study the salaries from the FHS dataset.
* [Unemployement duration from FHS](research/unemployment_duration/FHS_raw_duration_exploration.ipynb): study the unemployment duration from FHS dataset.

