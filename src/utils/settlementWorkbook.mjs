import * as XLSX from "xlsx";

export function parseSettlementWorkbook(buffer) {
  const bytes = new Uint8Array(buffer);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte);
  if (!isZip && !isOle) throw new Error("This file is not an Excel workbook. Please choose a valid .xls or .xlsx file.");
  let workbook;
  try {
    workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  } catch {
    throw new Error("We couldn't read this workbook. Check that it opens in Excel and isn't password protected, then try again.");
  }
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    const rows = range ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: true }) : [];
    return {
      name,
      startRow: range?.s.r ?? 0,
      startColumn: range?.s.c ?? 0,
      rows: rows.some((row) => row.some((cell) => String(cell).trim())) ? rows : [],
      values: range ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: true }) : [],
    };
  });
  if (!sheets.some((sheet) => sheet.rows.some((row) => row.some((cell) => String(cell).trim())))) {
    throw new Error("This workbook is empty. Please upload a settlement sheet containing data.");
  }
  return sheets;
}

export function excelColumn(index) {
  return XLSX.utils.encode_col(index);
}
