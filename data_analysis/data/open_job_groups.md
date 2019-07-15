# Open Job Groups

To produce Bob we gather a lot of data and content across multiple places. Some of it is
automatically imported, some of it has been built over the years by our content team. We are sharing
the final result as part as our Open Data policy under the name "Open Job Groups".

This dataset is organized by "job groups" and contain many pieces of information.

The exact documentation can be found in [the proto file](../../frontend/api/job.proto) describing
the data structure.

The generation of the data is done by an [import script](../importer/job_group_info.py) that we
run regularly so that Open Job Groups stays up to date.

The file itself is stored on AWS and can be
downloaded [here](https://bob-open-data.s3.eu-west-3.amazonaws.com/open-job-groups.json).

Note that you can check the date we last uploaded
it [here](https://bob-open-data.s3.eu-west-3.amazonaws.com/).
