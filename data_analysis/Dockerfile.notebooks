FROM jupyter/scipy-notebook:latest

USER root

RUN pip install --upgrade \
  airtable \
  brewer2mpl \
  distance \
  gensim \
  matplotlib-venn \
  nbformat \
  qgrid \
  runipy \
  sas7bdat \
  scrapy \
  termcolor \
  xlrd \
  xmltodict && \
  echo "fr_FR.UTF-8 UTF-8" >> /etc/locale.gen && \
  locale-gen && \
  su -c "/opt/conda/bin/ipython profile create" jovyan && \
  printf "\nc.InlineBackend.figure_format = 'retina'\nc.IPKernelApp.matplotlib = 'inline'\nc.InteractiveShellApp.matplotlib = 'inline'\n" >> /home/jovyan/.ipython/profile_default/ipython_kernel_config.py && \
  printf "\nimport os\nc.NotebookApp.custom_display_url = os.environ['CUSTOM_DISPLAY_URL']\n" >> /home/jovyan/.jupyter/jupyter_notebook_config.py
