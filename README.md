# Bob Emploi
Bob Emploi is a data-driven companion for jobseekers.

It is a free web application that aims to empower jobseekers by: a) using data to help them find better job search strategies and b) delivering to them concrete, actionable actions every day in order to execute them. For more information, check out the website at http://www.bob-emploi.fr (French only for now).

Bob Emploi is developed and maintained by [Bayes Impact](http://www.bayesimpact.org), a non-profit organization whose purpose is to use technology and data to address social issues. It is currently being launched in France, where Bayes Impact works closely with the French National Unemployment Service (Pôle Emploi).

Please subscribe to our [mailing list](https://groups.google.com/forum/#!forum/bob-emploi) in order to receive updates regarding the open sourcing of this project.

Bob Emploi is a React Single Page Application with a RESTful JSON API written in Python. The application is backed by a MongoDB which serves data that we pre-computed using the Python data science stack.

This repository is an automated export of our internal repository that we use for development.

## Licensing

We believe algorithms that aim to serve the public interest should be audit-able and transparent. In accordance with our mission of building a "citizen-led public service", most of the application will be open-source under a GPL v3 license.

## Documentation

### Repository Layout

This repository contains several components where each is located within a single folder on the root level. Currently existing folders are:

* `frontend`: Bob Emploi web application.
* `data_analysis`: Data analysis part of Bob Emploi.

Each folder contains a README file with further details regarding this application.

### Contributions

If you want to contribute to Bob Emploi with a bug fix or feature suggestion, please follow the Github contribution workflow described in [here](https://guides.github.com/activities/contributing-to-open-source/#contributing). At the current stage however, the main intention of the open source repository is to be transparent about the inner workings of Bob. In the future we hope  for, and will actively seek out for, contributions from the community. When we are ready for that, we will add detailed contribution instructions and suggestions of what to work on to this repository.

## Installation / Local Development

All components / applications are packaged in [Docker Containers](https://www.docker.com/), which makes it extremely portable and reduces the setup of your development environment to a few simple commands.

1. Install Docker: use [these detailed instructions](https://www.docker.com/products/overview#/install_the_platform) for installation
2. Run application-specific docker command. For example:
  * To _run_ and _build_ the frontend locally: `docker-compose up -d frontend-dev` (Will make the application available at `http://localhost:3000`)
  * To run the _tests_: `docker-compose run --no-deps frontend-dev-webpack npm test`
  * ...

You can find the full list of commands in the README of each folder.

### Short Links

We use a Bayes internal URL shortener that allows us to create links like http://go/bob-design-doc to conveniently link resources from within the source code or documentation. These links are only intended for internal usage and would not work on your computer. We are currently in a process to vet which documents can be made public and will in the future find a solution to replace the _go links_ in the code by publicly available URLs.

## Open-Sourcing Status

### Core Application Code

The core application source code is published in the `frontend` folder of this repository. It is still under very active development and even major features and interfaces are likely to change.

### Components
We have currently opened two of the components we built as part of Bob Emploi:
- **[JobSuggest](https://github.com/bayesimpact/french-job-suggest)**, an autocomplete component for suggesting and selecting French job titles. It is currently based on the [ROME job taxonomy](http://www.pole-emploi.org/informations/open-data-pole-emploi-@/25799/view-category-25799.html?), which it enriches by a) properly gendering job titles and b) weighting job titles by frequency.
- **[PyEmploiStore](https://github.com/bayesimpact/python-emploi-store)**, a Python wrapper around Emploi Store Dev APIs, the platform managed by Pôle Emploi to share their public data.

### Data

We have opened some of the data analysis notebooks (folder `data_analysis/notebooks`) pertaining to the data sources used by the application. These are incomplete, but provide a first insight on the data our recommendations are based on. As these are critical to being able to assess the validity of Bob Emploi's recommendation, we will first focus our open-sourcing efforts on opening more notebooks.

In particular, some of our datasets contain private data, or belong to an external data partner, and as such notebooks analyzing them will be opened over time as we are able to individually vet them for any potential leakage of sensitive information. The [data README](data_analysis/data/README.md) contains a list of the main data sources used in the application along with a short description.
