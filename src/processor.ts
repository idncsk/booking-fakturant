import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';

export interface ProcessResult {
  success: boolean;
  message: string;
  bookingNumber?: string;
}

export interface Config {
  API_ENDPOINT: string;
  AUTH_HEADER: string;
  CONTENT_TYPE: string;
  CITY_TAX: string;
  VAT: string;
}

export interface Template {
  partner: {
    nazov_firmy: string;
    kod_krajiny: string;
    ulica: string;
    obec: string;
    psc: string;
  };
  doklad: {
    dodavatel: string;
    update_dokladu: boolean;
    datum_vystavenia: string;
    datum_dodania: string;
    datum_splatnosti: string;
    prijemka_vydajka: boolean;
    text_zaver: string;
    ceny_su_s_dph: boolean;
    vyhotovil: string;
    kontakt: string;
    polozky: Array<{
      poradove_cislo: number;
      nazov_karty: string;
      mnozstvo_hodnota: number;
      mnozstvo_jednotka: string;
      cena_spolu: number;
      dph_perc: number;
    }>;
  };
}

export async function processBookingData(
  fileName: string,
  config: any,
  template: any
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const filePath = path.join(__dirname, '../data/incoming', fileName);
  const processedDir = path.join(__dirname, '../data/processed');
  const payloadsDir = path.join(__dirname, '../data/payloads');

  // Ensure directories exist
  [processedDir, payloadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Read and parse CSV file
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = await new Promise<any[]>((resolve, reject) => {
    parse(fileContent, {
      delimiter: ';',
      columns: false,
      skip_empty_lines: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });

  // Validate column count
  if (records[0].length !== 27) {
    return [{
      success: false,
      message: `Invalid number of columns in file ${fileName}. Expected 27, got ${records[0].length}`
    }];
  }

  // Process each record
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    const [
      book_number,
      booked_by,
      ,
      check_in,
      check_out,
      ,
      ,
      ,
      people,
      adults,
      ,
      ,
      price,
      ,
      ,
      ,
      ,
      ,
      ,
      booker_country,
      ,
      ,
      ,
      duration,
      ,
      ,
      phone_number
    ] = record;

    // Skip invalid records
    if (!book_number || !/^\d+$/.test(book_number)) {
      continue;
    }

    try {
      // Clean up data
      const cleanPrice = price.replace(/ EUR/g, '').replace(/"/g, '').trim();
      const cleanPhone = `+${phone_number.replace(/["\+]/g, '').trim()}`;
      const cityTax = parseFloat(config.CITY_TAX);
      const cityTaxSubjects = parseInt(adults) || parseInt(people) || 1;
      const cityTaxSum = cityTax * parseFloat(duration) * cityTaxSubjects;
      const cityTaxText = `Miestny poplatok za ubytovanie ${cityTax} EUR/os/noc hradený v hotovosti.`;

      // Create payload
      const payload = {
        ...template,
        partner: {
          ...template.partner,
          nazov_firmy: booked_by.replace(/"/g, ''),
          kod_krajiny: booker_country.replace(/"/g, ''),
          ulica: cleanPhone
        },
        doklad: {
          ...template.doklad,
          datum_dodania: check_in.replace(/"/g, ''),
          datum_vystavenia: check_out.replace(/"/g, ''),
          datum_splatnosti: check_out.replace(/"/g, ''),
          text_zaver: cityTaxText,
          polozky: [{
            ...template.doklad.polozky[0],
            cena_spolu: parseFloat(cleanPrice),
            dph_perc: parseFloat(config.VAT),
            mnozstvo_hodnota: parseFloat(duration)
          }]
        }
      };

      // Save payload
      const payloadPath = path.join(payloadsDir, `${book_number}.json`);
      fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

      // Send to API
      const response = await fetch(config.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': config.AUTH_HEADER.split('=')[1].replace(/"/g, ''),
          'Content-Type': config.CONTENT_TYPE.split(': ')[1]
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 200) {
        results.push({
          success: true,
          message: `Successfully processed booking ${book_number}`,
          bookingNumber: book_number
        });
      } else {
        results.push({
          success: false,
          message: `Failed to process booking ${book_number}. Status: ${response.status}`,
          bookingNumber: book_number
        });
      }
    } catch (error) {
      results.push({
        success: false,
        message: `Error processing booking ${book_number}: ${error}`,
        bookingNumber: book_number
      });
    }
  }

  // Move processed file
  fs.renameSync(filePath, path.join(processedDir, fileName));

  return results;
}