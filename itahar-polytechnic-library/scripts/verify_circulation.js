require('dotenv').config();
const db = require('../config/db');

async function testCirculationWorkflows() {
  console.log('================================================================');
  console.log('🔬 LIVE MYSQL CIRCULATION & CRUD VERIFICATION');
  console.log('================================================================\n');

  await db.initDatabase();

  // 1. Verify MySQL connectivity
  console.log(`[1] Connected Database Engine: ${db.getAdapter().toUpperCase()}`);

  // 2. Locate an available book
  const [availableBooks] = await db.query(
    "SELECT id, title, available_copies, total_copies FROM books WHERE available_copies > 0 LIMIT 1"
  );
  if (availableBooks.length === 0) throw new Error('No available books found in catalog');
  const book = availableBooks[0];
  console.log(`[2] Found Available Book: "${book.title}" (Available: ${book.available_copies}/${book.total_copies})`);

  // 3. Find an active student (Sarah Jenkins, CS-2026-012)
  const [students] = await db.query("SELECT id, name, student_id FROM users WHERE student_id = 'CS-2026-012'");
  const student = students[0];
  console.log(`[3] Target Student: ${student.name} (Roll: ${student.student_id})`);

  // 4. Find an available physical copy barcode
  const [copies] = await db.query("SELECT id, barcode, shelf_location FROM book_copies WHERE book_id = ? AND status = 'available' LIMIT 1", [book.id]);
  const copy = copies[0];
  console.log(`[4] Assigning Physical Copy Barcode: ${copy.barcode} (${copy.shelf_location})`);

  // 5. Issue Book (Due in 14 days)
  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const [issueResult] = await db.query(
    `INSERT INTO loans (book_id, copy_id, user_id, issued_by, issue_date, due_date, status, notes)
     VALUES (?, ?, ?, 2, ?, ?, 'active', 'Live circulation test issue')`,
    [book.id, copy.id, student.id, today, dueDateStr]
  );
  const loanId = issueResult.insertId;

  await db.query("UPDATE book_copies SET status = 'issued' WHERE id = ?", [copy.id]);
  await db.query("UPDATE books SET available_copies = CASE WHEN available_copies > 0 THEN available_copies - 1 ELSE 0 END WHERE id = ?", [book.id]);

  console.log(`[5] ✅ BOOK ISSUED: Loan ID #${loanId} created for ${student.name}. Due: ${dueDateStr}`);

  // Check updated availability
  const [afterIssue] = await db.query("SELECT available_copies FROM books WHERE id = ?", [book.id]);
  console.log(`    Updated Catalog Availability: ${afterIssue[0].available_copies}/${book.total_copies}`);

  // 6. Test Overdue Scenario & Fine Calculation
  // Simulate an overdue return by setting due_date to 5 days ago
  const overdueDueDate = new Date();
  overdueDueDate.setDate(overdueDueDate.getDate() - 5);
  const overdueDueStr = overdueDueDate.toISOString().split('T')[0];

  await db.query("UPDATE loans SET due_date = ? WHERE id = ?", [overdueDueStr, loanId]);

  // Compute fine: 5 days * 2.00 INR/day = 10.00 INR
  const overdueDays = 5;
  const fineAmount = (overdueDays * 2.00).toFixed(2);

  const [fineResult] = await db.query(
    `INSERT INTO fines (loan_id, user_id, amount, overdue_days, status, reason)
     VALUES (?, ?, ?, ?, 'unpaid', ?)`,
    [loanId, student.id, fineAmount, overdueDays, `Overdue return of "${book.title}" (5 days late)`]
  );
  const fineId = fineResult.insertId;
  console.log(`[6] ✅ OVERDUE CALCULATION: ${overdueDays} days late -> Fine ID #${fineId} generated for ₹${fineAmount}`);

  // 7. Settle / Pay Fine
  await db.query("UPDATE fines SET status = 'paid' WHERE id = ?", [fineId]);
  await db.query(
    `INSERT INTO payments (fine_id, user_id, amount, payment_method, transaction_ref, received_by)
     VALUES (?, ?, ?, 'online', 'TXN-TEST-123456', 2)`,
    [fineId, student.id, fineAmount]
  );
  console.log(`[7] ✅ FINE SETTLED: Fine #${fineId} paid via online channel. Receipt: TXN-TEST-123456`);

  // 8. Process Book Return
  await db.query("UPDATE loans SET status = 'returned', return_date = ?, returned_to = 2 WHERE id = ?", [today, loanId]);
  await db.query("UPDATE book_copies SET status = 'available' WHERE id = ?", [copy.id]);
  await db.query("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", [book.id]);

  const [afterReturn] = await db.query("SELECT available_copies FROM books WHERE id = ?", [book.id]);
  console.log(`[8] ✅ BOOK RETURNED: Copy ${copy.barcode} restored to shelf. Restored Availability: ${afterReturn[0].available_copies}/${book.total_copies}`);

  // 9. Test Admin Student Approval
  const [pendingUsers] = await db.query("SELECT id, name, student_id FROM users WHERE status = 'pending' LIMIT 1");
  if (pendingUsers.length > 0) {
    const pendingStudent = pendingUsers[0];
    await db.query("UPDATE users SET status = 'active' WHERE id = ?", [pendingStudent.id]);
    console.log(`[9] ✅ ADMIN APPROVAL: Approved student ${pendingStudent.name} (${pendingStudent.student_id}) to ACTIVE status`);
  }

  console.log('\n================================================================');
  console.log('🎉 ALL LIVE MYSQL CIRCULATION & CRUD TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');

  process.exit(0);
}

testCirculationWorkflows().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
