all: public
# A Makefile to simplify the download and preparation of public datasets.

public: geo imt dares rome crosswalks bmo stmt data/tous_benevoles.xml data/workup.json data/france-strategie/rapport_metiers_en_2022.pdf.txt

geo: data/geo/french_cities.csv data/geo/insee_france_cities.tsv data/geo/insee_france_departements.tsv data/geo/insee_france_regions.tsv data/geo/france_departements_bounds.csv data/geo/french_urban_entities.xls

imt: data/imt/market_score.csv data/imt/employment_type.csv data/imt/salaries.csv data/imt/application_modes.csv

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
	wget -O "$@.zip" 'https://www.insee.fr/fr/statistiques/fichier/2115018/UU2010%20au%2001-01-2017.zip'
	unzip "$@.zip" -d "$(@D)"
	rm "$@.zip"
	mv "$(@D)/UU2010 au 01-01-2017.xls" "$@"

rome: data/rome/ficheMetierXml/ficheMetierXml.zip data/rome/RefRomeCsv.zip

data/rome/ficheMetierXml/ficheMetierXml.zip:
	mkdir -p $(@D)
	wget -P $(@D)/ https://api.emploi-store.fr/api/docs/romeopen/FICHES_METIERS_XML/1/ficheMetierXml.zip
	unzip data/rome/ficheMetierXml/ficheMetierXml.zip -d data/rome/ficheMetierXml/

data/rome/RefRomeCsv.zip:
	mkdir -p data/rome/csv
	wget -P data/rome/ 'https://api.emploi-store.fr/api/docs/romeopen/REF_ROME_CSV/1/RefRomeCsv.zip'
	unzip data/rome/RefRomeCsv.zip -d data/rome/csv
	# Check that the "trcie" bug is still there.
	grep -q -r trcie data/rome/csv
	# Check that the "2 D" bug is still there.
	grep -q -r "2 D" data/rome/csv
	# Check that the "3 D" bug is still there.
	grep -q -r "3 D" data/rome/csv
	# TODO: Get rid of this once the ROME has been cleaned up.
	sed -i -e "s/trcie/trice/g;s/2 D/2D/g;s/3 D/3D/g" data/rome/csv/*.csv

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

bmo: data/bmo/bmo_2015.csv data/bmo/bmo_2014.csv data/bmo/bmo_2016.csv

data/bmo/bmo_2014.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py bmo ".*2014.*" "$@"

data/bmo/bmo_2015.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py bmo ".*2015.*" "$@"

data/bmo/bmo_2016.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py bmo ".*2016.*" "$@"

data/bmo/bmo_2017.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py bmo ".*2017.*" "$@"

data/pole-emploi-agencies.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py agences "Agences.*" "$@"

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

data/recent_job_offers.csv:
	mkdir -p $(@D)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py offres Offres.*d.emploi $@

data/tous_benevoles.xml:
	wget http://www.tousbenevoles.org/linkedin_webservice/xml/linkedin.xml -O $@

data/workup.json:
	wget https://www.workuper.com/events/index_json.json -O $@

data/imt/application_modes.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py imt "Canaux de reprise*" "$@"

# This may take several minutes.
data/imt/market_score.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py imt "Statistiques offres et demandes" "$@"

# This may take several minutes.
data/imt/employment_type.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py imt "Types de contrats*" "$@"

# This may take several minutes.
data/imt/salaries.csv:
	mkdir -p $(dir $@)
	python bob_emploi/data_analysis/misc/emploi_store_downloader.py imt "Salaires*" "$@"

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

data/adie-evenements.html:
	mkdir -p "$(@D)"
	wget -O "$@" 'http://www.rdv-adie.org/evenements/'

data/geo/ville-ideale-transports.html:
	mkdir -p "$(@D)"
	curl -XPOST https://www.ville-ideale.fr/scripts/ajaxclsst.php -d "chsens=ASC&nbh_tab2=> 0&crit=tra" > "$@"
