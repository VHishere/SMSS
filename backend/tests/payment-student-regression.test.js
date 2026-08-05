const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const zalopayService = require("../src/services/zalopay.service");
const { zalopay } = require("../src/config/payment.config");

test("ZaloPay app_trans_id starts with the current Vietnam date", () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const expectedPrefix = `${String(parts.year).slice(-2)}${parts.month}${parts.day}_`;
  assert.match(zalopayService.generateAppTransId(), new RegExp(`^${expectedPrefix}\\d{14}$`));
});

test("ZaloPay order is signed and keeps the callback URL", () => {
  const order = zalopayService.buildOrder({
    appTransId: "260730_12345678901234",
    amount: 1_250_000,
    description: "Thanh toan hoc phi",
    feeAssignmentId: 10,
    userId: 7,
  });

  assert.equal(order.amount, 1_250_000);
  assert.equal(order.callback_url, zalopay.callbackUrl);
  assert.equal(typeof order.mac, "string");
  assert.equal(order.mac.length, 64);
});

test("ZaloPay callback MAC uses key2", () => {
  const data = JSON.stringify({
    app_id: Number(zalopay.appId),
    app_trans_id: "260730_12345678901234",
    amount: 1_250_000,
    zp_trans_id: 123,
  });
  const mac = crypto.createHmac("sha256", zalopay.key2).update(data).digest("hex");

  assert.equal(zalopayService.verifyCallbackMac(data, mac), true);
  assert.equal(zalopayService.verifyCallbackMac(data, `${mac.slice(0, -1)}0`), false);
});

test("Payment model follows the normalized DB and records payment atomically", () => {
  const source = read("src/models/payment.model.js");
  assert.doesNotMatch(source, /\bfee_type\b/);
  assert.doesNotMatch(source, /\bscope_ref_id\b/);
  assert.match(source, /provider_transaction_id/);
  assert.match(source, /SET status = 'SUCCESS'/);
  assert.match(source, /INSERT INTO fee_payment/);
  assert.ok(
    source.indexOf("SET status = 'SUCCESS'") < source.indexOf("INSERT INTO fee_payment"),
    "transaction must become SUCCESS before fee_payment trigger validation",
  );
  assert.doesNotMatch(source, /UPDATE\s+fee_assignment\s+SET\s+paid_amount/i);
});

test("Staff fee model does not write generated assignment columns", () => {
  const source = read("src/models/staff/fees.js");
  const insertStart = source.indexOf("INSERT INTO fee_assignment");
  assert.notEqual(insertStart, -1);
  const insertBlock = source.slice(insertStart, insertStart + 500);
  assert.doesNotMatch(insertBlock, /final_amount/i);
  assert.doesNotMatch(insertBlock, /paid_amount/i);
  assert.doesNotMatch(insertBlock, /\bstatus\b/i);
  assert.match(source, /fee_category_id/);
});

test("Parent student feedback route enforces ownership", () => {
  const source = read("src/routes/parents.route.js");
  const routeStart = source.indexOf('"/me/students/:studentId/feedback"');
  assert.notEqual(routeStart, -1);
  const routeBlock = source.slice(routeStart, routeStart + 240);
  assert.match(routeBlock, /ensureParentOwnsStudent/);
});

test("Student self profile update cannot change name or avatar", () => {
  const model = read("src/models/students.js");
  const start = model.indexOf("async function updateProfileByUserId");
  const end = model.indexOf("async function", start + 20);
  const block = model.slice(start, end === -1 ? start + 1600 : end);
  assert.doesNotMatch(block, /full_name/);
  assert.doesNotMatch(block, /avatar/);
  assert.match(block, /SET phone = \?/);
});

test("Student survey submission checks class eligibility", () => {
  const controller = read("src/controllers/student.controller.js");
  assert.match(controller, /canStudentSubmitSurvey/);
  const model = read("src/models/feedback.model.js");
  assert.match(model, /async function canStudentSubmitSurvey/);
  assert.match(model, /tc\.class_id = ce\.class_id/);
});

test("Admin fee category and rate writes match the current DB schema", () => {
  const source = read("src/models/admin/fees.js");
  assert.match(source, /INSERT INTO fee_category \(code, name, description, status, created_by\)/);
  assert.match(source, /scope_type, grade_id, class_id/);
  assert.match(source, /resolveRateScope/);
  assert.doesNotMatch(source, /fa\.status = 'OVERDUE'/);
  assert.match(source, /fp\.due_date < DATE\(UTC_TIMESTAMP\(\) \+ INTERVAL 7 HOUR\)/);
});

test("Student profile validates duplicate phones without changing the DB schema", () => {
  const model = read("src/models/students.js");
  const controller = read("src/controllers/student.controller.js");
  assert.match(model, /WHERE phone = \?/);
  assert.match(model, /user_id <> \?/);
  assert.match(controller, /\^0\\d\{9\}\$/);
  assert.match(controller, /isValidIsoDate/);
});
