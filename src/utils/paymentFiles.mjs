import { unzip } from "fflate";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const isPaymentSheet = (name) => /\.(csv|xlsx)$/i.test(name);

export async function expandPaymentFiles(files) {
  const sheets = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const entries = await new Promise((resolve, reject) => {
        file.arrayBuffer().then((buffer) => {
          unzip(new Uint8Array(buffer), {
            filter: ({ name }) => isPaymentSheet(name) && !name.split("/").some((part) => part.startsWith(".") || part === "__MACOSX"),
          }, (error, result) => error ? reject(error) : resolve(result));
        }, reject);
      });
      if (!Object.keys(entries).length) {
        throw new Error(`${file.name} contains no CSV or XLSX payment sheets.`);
      }
      for (const [name, bytes] of Object.entries(entries)) {
        sheets.push(new File([bytes], name));
      }
    } else if (isPaymentSheet(file.name)) {
      sheets.push(file);
    } else {
      throw new Error(`Unsupported payment file: ${file.name}. Choose CSV, XLSX or ZIP.`);
    }
  }
  return sheets;
}

export async function readPaymentSheet(file) {
  if (/\.csv$/i.test(file.name)) {
    const result = Papa.parse(await file.text(), { header: true, skipEmptyLines: true });
    if (result.errors.length) throw new Error(`Unable to read ${file.name}: ${result.errors[0].message}`);
    return { payments: result.data, adsTotal: 0 };
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[1] || workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = rows[1] || rows[0] || [];
  const payments = rows.slice(rows[1] ? 2 : 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]]))
  );
  const adsSheet = workbook.Sheets[workbook.SheetNames[2]];
  const adsTotal = adsSheet
    ? XLSX.utils.sheet_to_json(adsSheet, { header: 1, defval: "" })
      .slice(1).reduce((total, row) => total + (parseFloat(row[7]) || 0), 0)
    : 0;
  return { payments, adsTotal };
}
