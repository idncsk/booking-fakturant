#!/bin/bash

# Directories
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
ROOT_DIR=$(dirname "$SCRIPT_DIR")
DATA_DIR="$ROOT_DIR/data"
LOG_DIR="$ROOT_DIR/logs"

# Runtime directories
DIR_INCOMING="$DATA_DIR/incoming"
DIR_PROCESSED="$DATA_DIR/processed"
DIR_PAYLOADS="$DATA_DIR/payloads"

# API endpoint and headers
PAYLOAD_TEMPLATE="$ROOT_DIR/config/payload-template.json"

# Load configuration
. "$ROOT_DIR/config/config.ini"

# Create directories if they don't exist
if [ ! -d "$LOG_DIR" ]; then mkdir -vp "$LOG_DIR"; fi;
if [ ! -d "$DATA_DIR" ]; then mkdir -vp "$DATA_DIR"; fi;
if [ ! -d "$DIR_INCOMING" ]; then mkdir -vp "$DIR_INCOMING"; fi;
if [ ! -d "$DIR_PROCESSED" ]; then mkdir -vp "$DIR_PROCESSED"; fi;
if [ ! -d "$DIR_PAYLOADS" ]; then mkdir -vp "$DIR_PAYLOADS"; fi;

LOG_FILE="$LOG_DIR/$(date +'%Y%m').log"

# Loop through all CSV files in DIR_INCOMING
for CSV_FILE in "$DIR_INCOMING"/*.csv; do
    [ -e "$CSV_FILE" ] || continue

    # Check for number of columns in CSV file
    if [ "$(head -n 1 "$CSV_FILE" | tr ';' '\n' | wc -l)" -ne 27 ]; then
        echo "[$(date +%Y%m%d-%H%M%S)] Error: Invalid number of columns in file $CSV_FILE" | tee -a "$LOG_FILE"
        exit 1
    fi

    echo "[$(date +%Y%m%d-%H%M%S)] Processing file $CSV_FILE" | tee -a "$LOG_FILE"

    while IFS=';' read -r \
        book_number \
        booked_by \
        guest_name \
        check_in \
        check_out \
        booked_on \
        status \
        rooms \
        people \
        adults \
        children \
        children_ages \
        price \
        commission_perc \
        commission_amount \
        payment_status \
        payment_method \
        remarks \
        booker_group \
        booker_country \
        travel_purpose \
        device \
        unit_type \
        duration \
        cancellation_date \
        address \
        phone_number; do

        # Skip header and lines not starting with a number
        if [[ "$book_number" == "\"Book Number\"" ]] || ! [[ "$book_number" =~ ^[0-9]+$ ]]; then
            continue
        fi

        # Data cleanup
        booked_by=${booked_by//\"/}
        check_in=${check_in//\"/}
        check_out=${check_out//\"/}
        price=$(echo "$price" | sed 's/ EUR//g' | sed 's/"//g' | tr -d ' ')
        booker_country=${booker_country//\"/}
        duration=${duration//\"/}
        duration_long="Ubytovania za obdobie $check_in - $check_out"
        phone_number="+$(echo "$phone_number" | sed 's/\"//g' | sed 's/+//g' | sed 's/\r//g')"
        city_tax=$CITY_TAX
        city_tax_subjects=${adults:-${people:-1}}
        city_tax_sum=$(echo "$duration * $city_tax * $city_tax_subjects" | bc)
        city_tax_text="Miestny poplatok za ubytovanie $city_tax EUR/os/noc hradený v hotovosti."

        # Start
        echo "[$(date +%Y%m%d-%H%M%S)] Generating invoice for booking $book_number" | tee -a "$LOG_FILE"

        # Create payload from template
        payload=$(jq \
            --arg book_number "$book_number" \
            --arg booked_by "$booked_by" \
            --arg check_in "$check_in" \
            --arg check_out "$check_out" \
            --arg price "$price" \
            --arg booker_country "$booker_country" \
            --arg duration "$duration" \
            --arg duration_long "$duration_long" \
            --arg phone_number "$phone_number" \
            --arg city_tax "$city_tax" \
            --arg city_tax_sum "$city_tax_sum" \
            --arg city_tax_text "$city_tax_text" \
            --arg vat "$VAT" \
            '.partner.nazov_firmy = $booked_by |
             .partner.ulica = $phone_number |
             .partner.kod_krajiny = $booker_country |
             .doklad.datum_dodania = $check_in |
             .doklad.datum_vystavenia = $check_out |
             .doklad.datum_splatnosti = $check_out |
             .doklad.text_zaver = $city_tax_text |
             .doklad.polozky[0].cena_spolu = $price |
             .doklad.polozky[0].dph_perc = $vat |
             .doklad.polozky[0].mnozstvo_hodnota = $duration' \
            $PAYLOAD_TEMPLATE)

        echo "Payload:"
        echo "$payload" | tee "$DIR_PAYLOADS/$book_number.json"

        # Send POST request to API endpoint with error handling
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_ENDPOINT" \
            -H "$AUTH_HEADER" \
            -H "$CONTENT_TYPE" \
            -d "$payload")

        if [ "$response" -ne 200 ]; then
            echo "[$(date +%Y%m%d-%H%M%S)] Error: Failed to send payload for booking $book_number. HTTP status code: $response" | tee -a "$LOG_FILE"
        else
            echo "[$(date +%Y%m%d-%H%M%S)] Successfully sent payload for booking $book_number" | tee -a "$LOG_FILE"
        fi

    done < "$CSV_FILE"

    # Move processed CSV file to DIR_PROCESSED
    mv "$CSV_FILE" "$DIR_PROCESSED"
done

