import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import * as XLSX from "xlsx";
import { expandPaymentFiles, readPaymentSheet } from "./paymentFiles.mjs";

function workbookFile(name, orderId, ads) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Overview"]]), "Overview");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Payment report"], ["Sub Order No", "Final Settlement Amount"], [orderId, 250],
  ]), "Payments");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Ads"], ["", "", "", "", "", "", "", ads],
  ]), "Ads");
  return new File([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], name);
}

test("mixed ZIP and direct sheets retain payments and sum all workbook ad costs", async () => {
  const first = workbookFile("first.XLSX", "order-1", -12);
  const second = workbookFile("second.xlsx", "order-2", -18);
  const archive = new File([zipSync({
    "nested/first.XLSX": new Uint8Array(await first.arrayBuffer()),
    "payments.CSV": strToU8("Sub Order No,Final Settlement Amount\norder-3,100\n"),
    "__MACOSX/._first.xlsx": strToU8("metadata"),
    "readme.txt": strToU8("ignored"),
  })], "payments.ZIP");
  const sheets = await expandPaymentFiles([archive, second]);
  assert.equal(sheets.length, 3);
  const results = await Promise.all(sheets.map(readPaymentSheet));
  assert.deepEqual(results.flatMap((result) => result.payments.map((row) => row["Sub Order No"])).sort(),
    ["order-1", "order-2", "order-3"]);
  assert.equal(results.reduce((total, result) => total + result.adsTotal, 0), -30);
});

test("ZIP without sheets and damaged ZIP both reject", async () => {
  await assert.rejects(expandPaymentFiles([
    new File([zipSync({ "readme.txt": strToU8("no sheets") })], "empty.zip"),
  ]), /contains no CSV or XLSX/);
  await assert.rejects(expandPaymentFiles([new File(["broken archive"], "broken.zip")]));
});

test("direct CSV and unsupported files", async () => {
  const csv = new File(["Sub Order No,Final Settlement Amount\norder-4,50\n"], "direct.csv");
  assert.deepEqual(await expandPaymentFiles([csv]), [csv]);
  assert.equal((await readPaymentSheet(csv)).payments[0]["Sub Order No"], "order-4");
  await assert.rejects(expandPaymentFiles([new File(["data"], "unsupported.pdf")]), /Unsupported payment file/);
});
