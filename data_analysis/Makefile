all: public
#!/usr/bin/make
# A Makefile to simplify the download and preparation of public datasets.

public: geo imt dares rome crosswalks bmo stmt data/tous_benevoles.xml data/workup.json data/france-strategie/rapport_metiers_en_2022.pdf.txt

geo: data/geo/french_cities.csv data/geo/insee_france_cities.tsv data/geo/insee_france_departements.tsv data/geo/insee_france_regions.tsv data/geo/france_departements_bounds.csv data/geo/french_urban_entities.xls

imt: data/imt/market_score.csv data/imt/employment_type.csv data/imt/salaries.csv data/imt/application_modes.csv
data/imt: imt

# This is unofficial data, but contains a lot of rich fields like zipCode and
# population.
data/geo/french_cities.csv: data/geo/french_cities_arrondissements.csv
	mkdir -p $(dir $@)
	wget -O $@ 'http://sql.sh/ressources/sql-villes-france/villes_france.csv'
	cat $< >> $@


data/geo/departements-avec-outre-mer.geojson:
	mkdir -p $(dir $@)
	wget -O $@ 'https://github.com/gregoiredavid/france-geojson/blob/master/departements-avec-outre-mer.geojson?raw=true'

data/geo/france_departements_bounds.csv: data/geo/departements-avec-outre-mer.geojson
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/french_departements_bounds.py $@ $<

# Official data for French cities.
data/geo/insee_france_cities.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'https://www.insee.fr/fr/statistiques/fichier/2666684/france2017-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/France2017.txt" > $@
	rm "$(@D)/France2017.txt"

data/geo/insee_france_departements.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'https://www.insee.fr/fr/statistiques/fichier/2666684/depts2017-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/depts2017.txt" > $@
	rm "$(@D)/depts2017.txt"

data/geo/insee_france_regions.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'https://www.insee.fr/fr/statistiques/fichier/2666684/reg2017-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/reg2017.txt" > $@
	rm "$(@D)/reg2017.txt"

data/geo/french_urban_entities.xls:
	mkdir -p "$(@D)"
	wget -O "$@.zip" 'https://www.insee.fr/fr/statistiques/fichier/2115018/UU2010_au_01-01-2018.zip'
	unzip "$@.zip" -d "$(@D)"
	rm "$@.zip"
	mv "$(@D)/UU2010_au_01-01-2018.xls" "$@"

data/geo/french_urban_areas.xls:
	mkdir -p "$(@D)"
	wget -O "$@.zip" https://www.insee.fr/fr/statistiques/fichier/2115011/AU2010_au_01-01-2018_V2.zip
	unzip "$@.zip" -d "$(@D)"
	rm "$@.zip"
	mv "$(@D)/AU2010 au 01-01-2018_V2.xls" "$@"

rome: data/rome/ficheMetierXml/ficheMetierXml.zip data/rome/csv/unix_latest_utf8.csv

data/rome/ficheMetierXml/ficheMetierXml.zip:
	mkdir -p $(@D)
	wget -P $(@D)/ https://api.emploi-store.fr/api/docs/romeopen/FICHES_METIERS_XML/1/ficheMetierXml.zip
	unzip data/rome/ficheMetierXml/ficheMetierXml.zip -d data/rome/ficheMetierXml/

data/rome/RefRomeCsv.%.zip:
	mkdir -p $(@D)
	# Get the latest ROME from Emploi Store Dev or a versioned one from our own S3 bucket.
	if [ "$(@F)" == "RefRomeCsv.latest.zip" ]; then \
		wget 'https://api.emploi-store.fr/api/docs/romeopen/REF_ROME_CSV/1/RefRomeCsv.zip' -O $@; \
	else \
		wget 'http://rome-pole-emploi.s3-website.eu-west-3.amazonaws.com/RefRomeCsv.$(lastword $(subst RefRomeCsv.,,$(subst _, ,$(@F))))' -O $@; \
	fi
	ln -f -s $(@F) $(@D)/RefRomeCsv.zip

# Special rule to download the ROME: if unix_latest_utf8.csv is used, it will get the latest version
# of the ROME from Emploi Store Dev. If a specific version is specified unix_foo_bar_v336_utf8.csv,
# this version will be downloaded from our ROME S3 bucket.
data/rome/csv/unix_%_utf8.csv: data/rome/RefRomeCsv.%.zip
	unzip -o data/rome/RefRomeCsv.zip -d data/rome/csv
	# Check that the "2 D" bug is still there.
	grep -q -r "2 D" data/rome/csv
	# Check that the "3 D" bug is still there.
	grep -q -r "3 D" data/rome/csv
	# Check that the "Administratreur" bug is still there.
	grep -q -r "Administratreur" data/rome/csv
	# Check that the "en ind" bug is still there.
	grep -q -r " en ind\"" data/rome/csv
	# TODO: Get rid of this once the ROME has been cleaned up.
	sed -i -e 's/2 D/2D/g;s/3 D/3D/g;s/Administratreur/Administrateur/g;s/ en ind"/ en industrie"/g' data/rome/csv/*.csv


data/dares/caracteristiques_des_personnes_en_emploi_2014.xls:
	mkdir -p $(@D)
	wget -O $@ http://dares.travail-emploi.gouv.fr/IMG/xls/b_-_caracteristiques_des_personnes_en_emploi-4.xls

dares: data/dares/caracteristiques_des_personnes_en_emploi_2014.xls

crosswalks: data/crosswalks/passage_fap2009_romev3.txt data/crosswalks/Correspondance_Rome_Formacode.csv data/intitule_fap2009.txt

data/crosswalks/passage_fap2009_romev3.txt:
	mkdir -p $(@D)
	wget -O "$@" http://dares.travail-emploi.gouv.fr/IMG/txt/passage_fap2009_romev3.txt
	sed -i -e 's/"L1509"        /"L1509","L1510"/' "$@"

data/crosswalks/Correspondance_Rome_Formacode.pdf:
	mkdir -p $(dir $@)
	wget -O $@ http://formacode.centre-inffo.fr/IMG/pdf/Correspondance_Rome_Formacode-2.pdf

data/crosswalks/Correspondance_Rome_Formacode.txt: data/crosswalks/Correspondance_Rome_Formacode.pdf
	pdf2txt -n -o $@ $^
	sed 's/• /\n&/g' -i $@

data/crosswalks/Correspondance_Rome_Formacode.csv: data/crosswalks/Correspondance_Rome_Formacode.txt
	# TODO: Investigate why this line appeared and fix the parser.
	sed -i '/Montage de produits électriques et électroniques H2604/d' $^
	python bob_emploi/data_analysis/parsers/formacode_parser.py $^ > $@

data/crosswalks/Correspondance_ROME_ISCO08.xlsx:
	mkdir -p $(dir $@)
	wget -O $@ http://www.pole-emploi.org/files/live/sites/peorg/files/documents/Statistiques-et-analyses/Open-data/ROME/Correspondance_ROME_ISCO08.xlsx

bmo: data/bmo/bmo_2015.csv data/bmo/bmo_2014.csv data/bmo/bmo_2016.csv data/bmo/bmo_2017.csv data/bmo/bmo_2018.csv

data/bmo/bmo_%.csv:
	mkdir -p $(@D)
	python bob_emploi/data_analysis/emploi_store_api/emploi_store_downloader.py bmo '.*$(subst data/bmo/bmo_,,$(subst .csv,,$@)).*' "$@"

data/pole-emploi-agencies.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/emploi_store_api/emploi_store_downloader.py agences "Agences.*" "$@"

data/intitule_fap2009.txt:
	mkdir -p $(@D)
	wget -O $@ 'http://dares.travail-emploi.gouv.fr/IMG/txt/intitule_fap2009.txt'

stmt: data/stmt/monthly_demand.xls data/stmt/annual_2014.xls data/stmt/annual_2013.xls data/stmt/rsa.xls data/stmt/job_posts.xls

data/stmt/monthly_demand.xls:
	mkdir -p data/stmt
	wget -O data/stmt/monthly_demand.xls 'http://www.pole-emploi.org/front/common/tools/load_file.jspz?galleryId=55742&galleryTitle=Demandes+d%27emploi+S%C3%A9ries+longues+CVS'

data/stmt/annual_2014.xls:
	mkdir -p data/stmt
	wget -O data/stmt/annual_2014.xls 'http://www.pole-emploi.org/front/common/tools/load_file.html?galleryId=47095&galleryTitle=Annuaires+stat+de+la+demande+d%27emploi+2014'

data/stmt/annual_2013.xls:
	mkdir -p data/stmt
	wget -O data/stmt/annual_2013.xls 'http://www.pole-emploi.org/front/common/tools/load_file.html?galleryId=41011&galleryTitle=Annuaires+stat+de+la+demande+d%27emploi+2013'

data/stmt/rsa.xls:
	mkdir -p data/stmt
	wget -O data/stmt/rsa.xls 'http://www.pole-emploi.org/front/common/tools/load_file.jspz?galleryId=52399&galleryTitle=S%C3%A9ries+RSA+mensuelles'

data/stmt/job_posts.xls:
	mkdir -p data/stmt
	wget -O data/stmt/job_posts.xls 'http://www.pole-emploi.org/front/common/tools/load_file.jspz?galleryId=55782&galleryTitle=Offres+d%27emploi+S%C3%A9ries+longues+CVS'

data/rome/sample_job_names.txt: data/rome/RefRomeCsv.zip
	mkdir -p $(@D)
	python bob_emploi/data_analysis/misc/sample_rome_jobs.py $(<D)/csv/*referentiel_appellation*.csv $@

data/job_offers/recent_job_offers.csv:
	mkdir -p $(@D)
	python bob_emploi/data_analysis/emploi_store_api/emploi_store_downloader.py offres Offres.*d.emploi $@

data/tous_benevoles.xml:
	wget http://www.tousbenevoles.org/linkedin_webservice/xml/linkedin.xml -O $@

data/workup.json:
	wget https://www.workuper.com/events/index_json.json -O $@

define get_imt_file
	mkdir -p $(@D)/$$(date +%Y-%m-%d)
	# Use s3 as a daily cache.
	if aws s3 ls rome-pole-emploi/imt/$$(date +%Y-%m-%d)/$(@F); then \
		aws s3 cp s3://rome-pole-emploi/imt/$$(date +%Y-%m-%d)/$(@F) "$(@D)/$$(date +%Y-%m-%d)/$(@F)"; \
	else \
		python bob_emploi/data_analysis/emploi_store_api/emploi_store_downloader.py imt $1 "$(@D)/$$(date +%Y-%m-%d)/$(@F)"; \
		aws s3 cp "$(@D)/$$(date +%Y-%m-%d)/$(@F)" s3://rome-pole-emploi/imt/$$(date +%Y-%m-%d)/$(@F); \
	fi
	ln -s $$(date +%Y-%m-%d)/$(@F) $@
endef

data/imt/application_modes.csv:
	$(call get_imt_file,"Canaux de reprise*")

# This may take several minutes.
data/imt/market_score.csv:
	$(call get_imt_file,"Statistiques offres et demandes")

# This may take several minutes.
data/imt/employment_type.csv:
	$(call get_imt_file,"Types de contrats*")

# This may take several minutes.
data/imt/salaries.csv:
	$(call get_imt_file,"Salaires*")

data/crosswalks/passage_pcs_romev3.csv:
	mkdir -p $(dir $@)
	wget -P $(@D)/ http://www.c2rp.fr/sites/default/files/atoms/files/c2rp_table_supra_def_fap_pcs_rome.xlsx
	python bob_emploi/data_analysis/misc/pcs_to_fap_mapping.py $@ "$(@D)/c2rp_table_supra_def_fap_pcs_rome.xlsx"
	rm $(@D)/c2rp_table_supra_def_fap_pcs_rome.xlsx

data/dpae-count.csv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'https://www.data.gouv.fr/s/resources/nombre-dembauches-par-code-ape-et-code-rome/20170704-100620/contrats_30j.zip'
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/contrats_30j.csv" "$@"
	rm "$@.zip"

data/naf-2008.xls:
	mkdir -p $(@D)
	wget -O "$@" 'https://www.insee.fr/fr/statistiques/fichier/2120875/naf2008_liste_n5.xls'

data/france-strategie/rapport_metiers_en_2022.pdf:
	mkdir -p $(@D)
	wget -O "$@" 'http://www.strategie.gouv.fr/sites/strategie.gouv.fr/files/atoms/files/fs_rapport_metiers_en_2022_27042015_final.pdf'

data/france-strategie/rapport_metiers_en_2022.pdf.txt: data/france-strategie/rapport_metiers_en_2022.pdf
	pdf2txt "$<" > "$@"

data/geo/ville-ideale-transports.html:
	mkdir -p "$(@D)"
	curl -XPOST https://www.ville-ideale.fr/scripts/ajaxclsst.php -d "chsens=ASC&nbh_tab2=> 0&crit=tra" > "$@"

data/pole_emploi/online-salons%.json:
	mkdir -p "$(@D)"
	python bob_emploi/data_analysis/emploi_store_api/online_events.py "$(@D)/online-salons-$$(date +%Y-%m-%d).json"

data/vae-2018.xls:
	mkdir -p $(@D)
	wget -O "$@" https://cache.media.education.gouv.fr/file/2018/37/8/depp-ni-2018-18.30-donnees_1039378.xls

data/esco:
	echo "- Go on https://ec.europa.eu/esco/portal/download
	echo "- Select Occupation and ISCO groups in Fr and En, as well as the "Broader relations" in CSV format
	echo "- download and unzip it and save the CSV in data-analytics/data/esco"
	exit 1

# Bob-US datasets
# The O*net database contains a rich set of variables that describe work and worker characteristics,
# including skill requirements.
# Note that this rule creates 35 files.
data/usa/onet_22_3 data/usa/onet_22_3/Occupation_Data.txt data/usa/onet_22_3/Career_Changers_Matrix.txt data/usa/onet_22_3/Education_Training_and_Experience.txt:
	mkdir -p "$(@D)"
	wget -O "$@.zip" "https://www.onetcenter.org/dl_files/database/db_22_3_text.zip"
	unzip "$@.zip" -d $(@D)
	cd $(@D)/db_22_3_text ; for file in * ; do mv "$$file" "$$(echo ../$$file | tr ' ' '_' | tr -d ',' )" ; done
	rm -rf "$@.zip" "$(@D)/db_22_3_text"

data/usa/job_requirements.json: data/usa/onet_22_3/Education_Training_and_Experience.txt
	mkdir -p "$(@D)"
	python bob_emploi/data_analysis/importer/deployments/usa/occupations_requirements.py \
	--soc_job_requirements_csv 'data/usa/onet_22_3/Education_Training_and_Experience.txt' \
	--to_json "$@"

# A list of US States with their name, USPS codes (NV, TX, CA, ...),
# and their FIPS codes (01, 02, 03, ...).
data/usa/states.txt:
	mkdir -p "$(@D)"
	wget -O "$@" "http://www2.census.gov/geo/docs/reference/state.txt?#"

# The Bureau of Labor Statistics (BLS) of the U.S. Department of Labor is the principal federal
# agency responsible for measuring labor market activity, working conditions,
# and price changes in the economy.
data/usa/national_occupational_projections.xls:
	mkdir -p "$(@D)"
	wget -O "$@" "https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx"

# The BLS of the U.S. provides unemployment info at the state level.
data/usa/state_unemployment.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@.zip" https://www.bls.gov/web/laus/ststdsadata.zip"
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/ststdsadata.xlsx" "$@"
	rm "$@.zip"

# The U.S. Department of Labor’s Employment and Training Administration funded Projections Central,
# a platform that provides long-term and short-term state occupational projections.
# The platform is only available within the U.S. so make sure you are located there to run this.
data/usa/employment_projections_short_term.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@" "http://projectionscentral.com/download/stprojections.xlsx"

# The BLS provides occupational data at the state level.
data/usa/occupational_employment_state_statistics.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@.zip" https://www.bls.gov/oes/special.requests/oesm19st.zip
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/oesm19st/state_M2019_dl.xlsx" "$@"
	rm "$@.zip"

# The BLS also provides occupational data at the national level.
data/usa/occupational_employment_national_statistics.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@.zip" https://www.bls.gov/oes/special.requests/oesm19nat.zip
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/oesm19nat/national_M2019_dl.xlsx" "$@"
	rm "$@.zip"

# The Unemployment Insurance is a joint state-federal program that provides cash benefits to
# eligible workers. They provide information on job seekers claiming for insurance.
data/usa/unemployment_insurance_claimants.csv:
	wget -O "$@" https://oui.doleta.gov/unemploy/csv/ar203.csv

# SOC (Standard Occupational Classification), the base for O*net
# DMTF (Direct Match Title File), a link from job titles to SOC classification
data/usa/soc/DMTF_2010.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.bls.gov/soc/2018/soc_2018_direct_match_title_file.xlsx

data/usa/soc/DMTF_2010.xls:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.bls.gov/soc/soc_2010_direct_match_title_file.xls

# SOC (Standard Occupational Classification), the base for O*net
# Structure, the hierarchy of 2018 SOC job groups.
data/usa/soc/soc_2018_structure.csv:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.onetcenter.org/taxonomy/2019/structure/SOC_Structure.csv?fmt=csv

# US SOC (Standard Occupational Classification) 2010 definitions and structures.
data/usa/soc/soc_%2010.xls data/usa/soc/soc_2010%.xls:
	mkdir -p "$(@D)"
	wget -O "$@" "https://www.bls.gov/soc/$(@F)"

define get_geonames_ppl
	mkdir -p "$(@D)"
	wget -O "$@.zip" "https://download.geonames.org/export/dump/$1.zip"
	unzip "$@.zip" $1.txt -d $(@D)
	rm "$@.zip"
	grep -P '\tP\tPPL' "$(@D)/$1.txt" > "$@"
	grep -P '\tA\tADM[1-$2]\t$1\t' "$(@D)/$1.txt" > "$(@D)/geonames_admin.txt"
	rm "$(@D)/$1.txt"
endef

data/usa/geonames.txt data/usa/geonames_admin.txt:
	$(call get_geonames_ppl,US,2)

# A list of US cities with their name, Zip codes (10020, 33133, …),
# their USPS codes (AK, AL, NY, …), and their county  FIPS codes (005, 061, …).
data/usa/cities_with_zip.txt:
	mkdir -p "$(@D)"
	wget -O "$@.zip" "https://download.geonames.org/export/zip/US.zip"
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/US.txt" "$@"
	rm "$@.zip"

# O*NET-SOC2019/SOC 2018 (Standard Occupational Classification) job groups definitions.
data/usa/soc/soc2018_definition.csv:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.onetcenter.org/taxonomy/2019/data_coll/Data_Collection_Plan.csv?fmt=csv

# SOC 2010 to SOC 2018/O*NET-SOC2019 crosswalk.
data/usa/soc/2010_to_2018_SOC_Crosswalk.csv:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.onetcenter.org/taxonomy/2010/soc2018/2010_to_2018_SOC_Crosswalk.csv?fmt=csv

# SOC 2010 to ISCO-08 crosswalk.
data/crosswalks/isco_us_soc2010_crosswalk.xls:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.bls.gov/soc/isco_soc_crosswalk.xls

# O*NET job zones (group of occupations similar in education, experience, on-the-job training for these jobs) definitions.
data/usa/onet_22_3/job_zones.tsv:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.onetcenter.org/dl_files/database/db_25_0_text/Job%20Zones.txt

# Automation risk, based on SOC 2010. This is the data used by Will Robots Take My Job wesite.
data/usa/future-of-employment.pdf:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.oxfordmartin.ox.ac.uk/downloads/academic/future-of-employment.pdf

data/usa/future-of-employment.txt: data/usa/future-of-employment.pdf
	pdf2txt.py -n -o $@ $^

data/usa/future-of-employment.csv: data/usa/future-of-employment.txt
	sed -E -e 's/([0-9]+)\.(0\.0*[0-9]?[1-9])([0-1]?)([0-9]{2}-[0-9]{4})/\n\1\t\2\t\3\t\4\t/g' "$^" | sed -e 's/^.*The Future of Employment.*/Rank\tProbability\tLabel\tsoccode\tOccupation/' | sed -e 's/77.*Oxford Martin Programme on Technology.*$$//' > "$@"

# Automation data from https://www.brookings.edu/research/automation-and-artificial-intelligence-how-machines-affect-people-and-places/
data/usa/automation-risk.json:
	mkdir -p "$(@D)"
	wget -O "$@.js" https://c24215cec6c97b637db6-9c0895f07c3474f6636f95b6bf3db172.ssl.cf1.rackcdn.com/interactives/2019/metro-automation/app.js
	awk 'flag; /var occs =/{flag=1; next} /\]/{flag=0}' "$@.js" > "$@"
	rm "$@.js"

# Census data by zip code retrieved from census.gov API. You need to have an API KEY as an env variable.
# Documentation can be found here: https://www.census.gov/data/developers/data-sets/acs-5year.html
data/usa/population_by_zip_codes.txt:
ifndef CENSUS_API_KEY
	$(error CENSUS_API_KEY should be set. You can ask for one here: https://api.census.gov/data/key_signup.html)
endif
	mkdir -p "$(@D)"
	wget -O "$@" 'https://api.census.gov/data/2019/acs/acs5/subject?get=NAME,group(S0101)&for=zip%20code%20tabulation%20area:*&key=$(CENSUS_API_KEY)'

# Bob-UK datasets
data/uk/geonames.txt data/uk/geonames_admin.txt:
	$(call get_geonames_ppl,GB,3)

data/uk/local_authorities_2020.csv:
	wget -O "$@" https://opendata.arcgis.com/datasets/fe6bcee87d95476abc84e194fe088abb_0.csv

# A lookup between wards, local authority districts (LAD), counties, regions and countries as at 31 December 2016 in the UK.
# A more recent version exists (as of December 2018) but the market info we have is based on this one.
data/uk/wards_counties_regions_local_authorities_2016.csv:
	https://opendata.arcgis.com/datasets/e80726453fce4c4daee6d01646c5c039_0.csv

data/uk/local_authorities_2016.csv: data/uk/wards_counties_regions_local_authorities_2016.csv
	ln -s "$(notdir $<)" "$@"

# UK SOC job titles and job group classification (SOC2010 version).
data/uk/soc/soc2010.xls:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.ons.gov.uk/file?uri=/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2010/soc2010volume2thestructureandcodingindex/soc2010indexversion705june2018.xls

# UK SOC unit groups descriptions (SOC2010 version).
# This is the source of https://onsdigital.github.io/dp-classification-tools/standard-occupational-classification/ONS_SOC_occupation_coding_tool.html
data/uk/soc/socDB.js:
	mkdir -p "$(@D)"
	wget -O "$@" https://github.com/ONSdigital/dp-classification-tools/raw/develop/standard-occupational-classification/data/socDB.js

# UK SOC career changers matrix (based on the US O*NET one).
data/uk/soc/career_changers_matrix.csv:
	mkdir -p "$(@D)"
	python bob_emploi/data_analysis/importer/deployments/uk/career_changers.py --output-csv "$@"

# UK employment by occupation.
data/uk/employment_by_occupation_sept_2018.xls:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.ons.gov.uk/file?uri=%2femploymentandlabourmarket%2fpeopleinwork%2femploymentandemployeetypes%2fdatasets%2femploymentbyoccupationemp04%2fapriltojune2018/emp04sep2018.xls

# UK salaries by region from ONS. Annual files can be found here:
# https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/datasets/regionbyoccupation4digitsoc2010ashetable15
data/uk/salaries_by_region_2020.xlsx:
	mkdir -p "$(@D)"
	wget -O "$@.zip" https://www.ons.gov.uk/file?uri=%2femploymentandlabourmarket%2fpeopleinwork%2fearningsandworkinghours%2fdatasets%2fregionbyoccupation4digitsoc2010ashetable15%2f2020revised/table152020revised.zip
	unzip "$@.zip" -d $(@D)
	mv "$(@D)/Work Region Occupation SOC10 (4) Table 15.7a   Annual pay - Gross 2020.xls" "$@"
	rm "$@.zip"

# UK Probability of automation by occupation.
data/uk/automation_probability.xls:
	wget -O "$@" https://www.ons.gov.uk/file?uri=%2femploymentandlabourmarket%2fpeopleinwork%2femploymentandemployeetypes%2fdatasets%2fprobabilityofautomationinengland%2f2011and2017/automationreferencetables.xls

data/crosswalks/uk_SOC_2010_to_ISCO-08_mapping.xls:
	mkdir -p "$(@D)"
	wget -O "$@" https://www.ons.gov.uk/file?uri=/methodology/classificationsandstandards/standardoccupationalclassificationsoc/soc2010/ug201002soc2010toisco08v2_tcm77-283163.xls

# Instructions to generate the data:
# Download https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/143809/soi-cop-skilled-workers.pdf";
# Extract an excel version of the document, using tools like https://www.pdf2go.com/fr/pdf-en-excel";
# Copy/paste the needed data with the format soc - level - description in data/uk/diplomas.txt";
# Upload the file in the s3 bucket.
data/uk/diplomas.txt:
	mkdir -p $(@D)
	wget -O "$@" https://bob-open-data.s3.eu-west-3.amazonaws.com/uk/diplomas.txt

data/uk/job_requirements.json: data/uk/diplomas.txt data/uk/soc/socDB.js
	mkdir -p "$(@D)"
	python bob_emploi/data_analysis/importer/deployments/uk/occupations_requirements.py \
	--soc_job_requirements_csv 'data/uk/diplomas.txt' \
	--soc_descriptions_js 'data/uk/soc/socDB.js' \
	--to_json "$@"

# TODO(cyrille): Rename to frontend_monitoring.zip.
# TODO(cyrille): Use Bazel to include dependencies.
data/monitoring.zip: needs-aws-default
	mkdir -p "$(@D)"
	$(eval TMPDIR := $(shell mktemp -d))
	pip install --target "$(TMPDIR)" -r bob_emploi/data_analysis/monitoring/requirements.txt
	mkdir -p "$(TMPDIR)/bob_emploi/frontend/api"
	cp bob_emploi/frontend/api/monitoring_pb2.py "$(TMPDIR)/bob_emploi/frontend/api"
	touch "$(TMPDIR)/bob_emploi/frontend/api/__init__.py"
	cd "$(TMPDIR)" && zip -r "$(abspath $@)" ./*
	rm -r "$(TMPDIR)"
	cd bob_emploi/data_analysis/monitoring && zip -g "$(abspath $@)" ./*

fixtures/%.json:
	python bob_emploi/data_analysis/importer/import_status.py --run "$(basename $(@F))" --to_json="$@"

airtable_fixtures: \
	fixtures/action_templates.json \
	fixtures/adie_testimonials.json \
	fixtures/advice_modules.json \
	fixtures/application_tips.json \
	fixtures/associations.json \
	fixtures/banks_one_euro_driving_license.json \
	fixtures/challenge_actions.json \
	fixtures/contact_lead.json \
	fixtures/diagnostic_main_challenges.json \
	fixtures/diagnostic_overall.json \
	fixtures/diagnostic_responses.json \
	fixtures/focus_emails.json \
	fixtures/jobboards.json \
	fixtures/schools_one_euro_driving_license.json \
	fixtures/section_generators.json \
	fixtures/specific_to_job_advice.json \
	fixtures/strategy_advice_templates.json \
	fixtures/strategy_modules.json \
	fixtures/tip_templates.json
