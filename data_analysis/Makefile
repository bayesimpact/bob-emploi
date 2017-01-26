all: public
# A Makefile to simplify the download and preparation of public datasets.

public: requirements geo dares rome crosswalks bmo stmt

requirements: data/requirements/job_requirements_output.csv

data/requirements/job_requirements_input.csv: data/rome/ficheMetierXml/ficheMetierXml.zip
	mkdir -p $(dir $@)
	python bob_emploi/parsers/rome_parser/helpers.py data/rome/ficheMetierXml data/requirements/job_requirements_input.csv

data/requirements/job_requirements_output.csv: data/requirements/job_requirements_input.csv
	python bob_emploi/parsers/rome_parser/parse.py data/requirements/job_requirements_input.csv data/requirements/job_requirements_output

geo: data/geo/french_cities.csv data/geo/insee_france_cities.tsv data/geo/insee_france_departements.tsv data/geo/insee_france_regions.tsv

# This is unofficial data, but contains a lot of rich fields like zipCode and
# population.
data/geo/french_cities.csv: data/geo/french_cities_arrondissements.csv
	mkdir -p $(dir $@)
	wget -O $@ 'http://sql.sh/ressources/sql-villes-france/villes_france.csv'
	cat $< >> $@

# Official data for French cities.
data/geo/insee_france_cities.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'http://www.insee.fr/fr/statistiques/fichier/2114819/france2016-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/france2016.txt" > $@
	rm "$(@D)/france2016.txt"

data/geo/insee_france_departements.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'http://www.insee.fr/fr/statistiques/fichier/2114819/depts2016-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/depts2016.txt" > $@
	rm "$(@D)/depts2016.txt"

data/geo/insee_france_regions.tsv:
	mkdir -p $(@D)
	wget -O "$@.zip" 'http://www.insee.fr/fr/statistiques/fichier/2114819/reg2016-txt.zip'
	unzip "$@.zip" -d $(@D)
	rm "$@.zip"
	iconv -f windows-1252 -t utf-8 "$(@D)/reg2016.txt" > $@
	rm "$(@D)/reg2016.txt"

rome: data/rome/ficheMetierXml/ficheMetierXml.zip data/rome/RefRomeCsv.zip

data/rome/ficheMetierXml/ficheMetierXml.zip:
	mkdir -p $(@D)
	wget -P $(@D)/ https://api.emploi-store.fr/api/docs/romeopen/FICHES_METIERS_XML/1/ficheMetierXml.zip
	unzip data/rome/ficheMetierXml/ficheMetierXml.zip -d data/rome/ficheMetierXml/

data/rome/RefRomeCsv.zip:
	mkdir -p data/rome/csv
	wget -P data/rome/ 'https://api.emploi-store.fr/api/docs/romeopen/REF_ROME_CSV/1/RefRomeCsv.zip'
	unzip data/rome/RefRomeCsv.zip -d data/rome/csv
	# TODO: Get rid of this once the ROME has been cleaned up.
	sed -i -e "s/trcie/trice/" data/rome/csv/*.csv

data/dares/caracteristiques_des_personnes_en_emploi_2014.xls:
	mkdir -p $(@D)
	wget -O $@ http://dares.travail-emploi.gouv.fr/IMG/xls/b_-_caracteristiques_des_personnes_en_emploi-4.xls

dares: data/dares/caracteristiques_des_personnes_en_emploi_2014.xls

crosswalks: data/crosswalks/passage_fap2009_romev3.txt data/crosswalks/Correspondance_Rome_Formacode.csv data/intitule_fap2009.txt

data/crosswalks/passage_fap2009_romev3.txt:
	mkdir -p $(dir $@)
	wget -P data/crosswalks http://dares.travail-emploi.gouv.fr/IMG/txt/passage_fap2009_romev3.txt

data/crosswalks/Correspondance_Rome_Formacode.pdf:
	mkdir -p $(dir $@)
	wget -O $@ http://formacode.centre-inffo.fr/IMG/pdf/Correspondance_Rome_Formacode-2.pdf

data/crosswalks/Correspondance_Rome_Formacode.txt: data/crosswalks/Correspondance_Rome_Formacode.pdf
	pdf2txt -n -o $@ $^
	sed 's/• /\n&/g' -i $@

data/crosswalks/Correspondance_Rome_Formacode.csv: data/crosswalks/Correspondance_Rome_Formacode.txt
	# TODO: Investigate why this line appeared and fix the parser.
	sed -i '/Montage de produits électriques et électroniques H2604/d' $^
	python bob_emploi/parsers/formacode_parser.py $^ > $@

bmo: data/bmo/bmo_2015.csv data/bmo/bmo_2014.csv data/bmo/bmo_2016.csv

data/bmo/bmo_2014.csv:
	mkdir -p $(dir $@)
	python bob_emploi/emploi_store_downloader.py bmo ".*2014.*" "$@"

data/bmo/bmo_2015.csv:
	mkdir -p $(dir $@)
	python bob_emploi/emploi_store_downloader.py bmo ".*2015.*" "$@"

data/bmo/bmo_2016.csv:
	mkdir -p $(dir $@)
	python bob_emploi/emploi_store_downloader.py bmo ".*2016.*" "$@"

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
	python bob_emploi/sample_rome_jobs.py $(<D)/csv/*referentiel_appellation*.csv $@

data/recent_job_offers.csv:
	mkdir -p $(@D)
	python bob_emploi/emploi_store_downloader.py offres Offres.*d.emploi $@
