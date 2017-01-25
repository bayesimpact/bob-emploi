# Data Analysis

This component of the repository mostly consists of a collection of datasets, notebooks of data analysis results and Python 3 code to crunch the numbers and ease the access to the underlying data.

## Repository Layout

The data analysis component is organized into several subfolders, with some of them containing a specialized README with more detailed information.

* `data`: Public data sources used for Bob.
* `bob_emploi`: Data processing Python modules.
* `notebooks`: Data analysis reports in the form of [Jupyter Notebooks](https://jupyter.org/).
* `tests`: Tests of Python code and notebooks.
* `tools`: Small applications to help with data analysis.

## Data Analysis Notebooks

We use [Jupyiter Notebooks](https://jupyter.org/) for data analysis. If you want to run them and modify them, see below the Docker section. An easy solution for only viewing the notebooks, is using Github, which automatically renders them in the browser. Simply visit https://github.com/bayesimpact/bob-emploi/tree/master/notebooks and click on one of the Notebook files.

## Getting started

### Data

To download and prepare the data run `docker-compose run data-analysis-prepare make all`, which will populate the `data_analysis/data` subfolder by using a Makefile inside a
Docker container. More information on the data sources used can be found in the [data README](data/README.md).

### Notebooks

We use the notebooks to tell a story and communicate results from one or several dataset. We use the [Bayes Notebook Styleguide](https://docs.google.com/document/d/1g2ITZWGfgkmljutwP5QWJ7b31l4o2JrbodEWKY277X0/edit#) to ensure the uniformity of our notebooks. Most notebooks depend on data that has to be downloaded first, as described in the paragraph above.

#### Docker

Simply run

```sh
docker-compose up -d data-analysis-notebook
```

then you can access Jupyter from your browser on [localhost:8888](http://localhost:8888/).
If a token is required, it can be retrieved with:

```sh
docker exec bobemploi_data-analysis-notebook_1 jupyter notebook list
```
