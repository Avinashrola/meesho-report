import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { excelColumn, parseSettlementWorkbook } from "./settlementWorkbook.mjs";

for (const bookType of ["xls", "xlsx"]) {
  test(`${bookType} preserves worksheet names, displayed values and source row offsets`, () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
    const sheet = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.sheet_add_aoa(sheet, [["Order ID", "Settlement"], ["00123", 1234.5], [], ["00456", -25]], { origin: "C3" });
    sheet["!ref"] = "C3:D6";
    sheet.D4.z = '"₹"#,##0.00';
    XLSX.utils.book_append_sheet(workbook, sheet, "Settlements");
    const result = parseSettlementWorkbook(XLSX.write(workbook, { type: "array", bookType }));
    assert.deepEqual(result.map((item) => item.name), ["Empty", "Settlements"]);
    assert.equal(result[0].rows.length, 0);
    assert.equal(result[1].startRow, 2);
    assert.equal(result[1].startColumn, 2);
    assert.equal(result[1].rows[1][0], "00123");
    assert.equal(result[1].rows[1][1], "₹1,234.50");
    assert.deepEqual(result[1].rows[2], ["", ""]);
    assert.equal(result[1].rows[3][1], "-25");
  });
}

test("rejects disguised text, damaged and empty workbooks", () => {
  assert.throws(() => parseSettlementWorkbook(new TextEncoder().encode("order,amount\n123,12")), /not an Excel workbook/);
  assert.throws(() => parseSettlementWorkbook(new Uint8Array([0x50, 0x4b, 0, 0])), /couldn't read/);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
  assert.throws(() => parseSettlementWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" })), /empty/);
  assert.equal(excelColumn(26), "AA");
});
