# Notebooks

We use notebooks to tell a story and communicate results from one or several dataset. Please use the [Bayes Style Guide](https://docs.google.com/document/d/1g2ITZWGfgkmljutwP5QWJ7b31l4o2JrbodEWKY277X0/edit#) to ensure the uniformity and readability of your contributions.

## Folder Layout

The folder is organized according to the following scheme:

* `bob_emploi_usage`: Internal analytics of Bob Emploi user data.
* `datasets`: Investigation of the properties of a dataset. For example how complete it is, how to best read it into memory, what are some quirks or interesting features of the dataset.
* `research`: Topics to investigate which are not necessarily tied to a specific dataset. In here we would for example have one folder to investigate a _metric of job similarity_, which uses data from ROME, but also a vector space model derived from Wikipedia articles.
* `scraped_data`: Some data was not readily available for download, so we scraped it directly from the website. Notebooks in this folder investigate the quality of the scraped data, conclusions from the data would be drawn in the `research folder`.

Some of the folders are pretty empty at the moment, but more notebooks are going to come soon. 
