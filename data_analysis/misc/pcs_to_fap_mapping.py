"""Script to compute the mapping between PCS and ROME classifications."""

import os
import sys

import pandas as pd


def main(output_csv, filename=None, data_folder='data'):
    """Compute the mapping between PCS and ROME classifications.

    Args:
        output_csv: the filename where to write the result or a file object itself.
        data_folder: the root folder of the data.
        filename: the filename of the XLSX file with pcs to fap and fap to rome mapping.
    """

    if not filename:
        filename = os.path.join(data_folder, 'crosswalks/c2rp_table_supra_def_fap_pcs_rome.xlsx')
    pcs_fap_rome_xlsx = pd.read_excel(filename, sheetname=None)

    if hasattr(output_csv, 'write'):
        output_file = output_csv
    else:
        output_file = open(output_csv, 'w')

    fap_to_pcs = pcs_fap_rome_xlsx['SUPRA-DEF-FAP-PCS'][['FAP', 'PCS']]
    fap_to_rome = pcs_fap_rome_xlsx['SUPRA-DEF-FAP-ROME'][['FAP', 'ROME']]
    fap_to_romeq = pcs_fap_rome_xlsx['SUPRA-DEF-FAP-ROMEQ']

    fap_to_romeq['ROME'] = fap_to_romeq.ROMEq.apply(lambda x: x[:5])
    complete_fap_rome = fap_to_rome.append(fap_to_romeq[['FAP', 'ROME']])
    fap_to_pcs_agg = fap_to_pcs.groupby('FAP').PCS.apply(list).to_frame()
    complete_fap_rome.set_index('FAP', inplace=True)
    complete_fap_rome['PCS'] = fap_to_pcs_agg.PCS
    complete_fap_rome.set_index('ROME', inplace=True)
    mapping = pd.DataFrame(
        [[i, x] for i, y in complete_fap_rome['PCS'].apply(list).iteritems() for x in y],
        columns=['ROME', 'PCS'])
    mapping_non_redundant = mapping.drop_duplicates().set_index('ROME')

    mapping_non_redundant.to_csv(output_file)


if __name__ == '__main__':
    main(*sys.argv[1:])  # pragma: no-cover; pylint: disable=no-value-for-parameter
