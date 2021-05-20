#!/bin/bash
# This is a script to download cover images from Airtable.

function list_all_job_group_and_urls() {
    local offset=""
    while true; do
        local data="$(curl -s "https://api.airtable.com/v0/app2xuIa0KpAWGJBV/SOC%202018?view=Pictures&offset=$offset" \
            -H "Authorization: Bearer $AIRTABLE_API_KEY")"
        jq -r '.records[]| .fields."O*NET-SOC Code", .fields."Picture"[0].url' <<< $data
        offset="$(jq -r '.offset' <<< $data)"
        if [ -z "$(jq -r '.records[]' <<< $data)" ]; then
            break
        fi
    done
}

while read job_group_id; do
    read url
    if [ ! -f "$job_group_id.jpg" ]; then
        curl -s "$url" -o "$job_group_id.jpg"
        echo $job_group_id
    fi
done < <(list_all_job_group_and_urls)
