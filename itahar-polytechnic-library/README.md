# ITAHAR GOVERNMENT POLYTECHNIC — College Library Management System

A production-ready, full-stack **College Library Management System** designed for **ITAHAR GOVERNMENT POLYTECHNIC**. Engineered with a dark cyberpunk/glassmorphism UI, real-time particle dynamics, Web Audio synthesizer effects, normalized MySQL 8.0+ relational database, and secure Node.js/Express REST APIs with JWT role-based access control.

---

## 🏛️ System Overview

- **Institution:** ITAHAR GOVERNMENT POLYTECHNIC
- **Backend:** Node.js & Express.js (v5 / v22 LTS compatible)
- **Database:** Normalized MySQL 8.0+ (with zero-config embedded SQLite test/offline engine)
- **Authentication:** JSON Web Tokens (JWT) + salted `bcrypt` password hashing
- **Authorization:** Role-Based Access Control (**Student**, **Librarian**, **Admin**)
- **Frontend:** Glassmorphism UI, Tailwind CSS, 3D VanillaTilt physics, Web Audio API sound feedback
- **Deployment:** Netlify (Frontend) + Render / Railway / VPS (Node.js API & MySQL)

---

## 🔑 Default Seed Credentials

All seed accounts use the default password: **`Password@123`**

| Role | Login Identifier / Email | Password | Privileges |
|---|---|---|---|
| **Administrator** | `admin@itaharpolytechnic.edu.in` | `Password@123` | Full system governance, approvals, staff appointments, settings, audit logs |
| **Chief Librarian** | `librarian@itaharpolytechnic.edu.in` | `Password@123` | Cataloguing, issue/return checkout, barcode management, request/reservation reviews |
| **Active Student** | `CS-2026-012` or `sarah.cs@itaharpolytechnic.edu.in` | `Password@123` | Borrowing history, active loan countdown, reservations, e-resources, requests |
| **Active Student** | `EE-2026-045` or `david.ee@itaharpolytechnic.edu.in` | `Password@123` | Overdue tracking, fine settlement, renewal limits |
| **Pending Student** | `CS-2026-155` or `rohan.pending@itaharpolytechnic.edu.in` | `Password@123` | Pending registration test account (requires admin approval before login) |

> 💡 **Quick Login:** The authentication modal contains a **"Demo Quick"** tab that lets you log in as any role with a single click.

---

## 🗄️ Database Architecture & Normalization

The database adheres to **Third Normal Form (3NF)** with strict primary keys, foreign key constraints (`ON DELETE RESTRICT` / `ON DELETE CASCADE`), unique keys, and composite indexes.

### Relational Schema Summary:

1. **`roles`**: System roles (`admin`, `librarian`, `student`).
2. **`users`**: Student profiles, librarians, and administrators with account states (`pending`, `active`, `suspended`, `rejected`), roll numbers, departments, and semesters.
3. **`categories`**: Academic departments and disciplines (Computer Science & Technology, Electrical Engineering, Electronics & Telecommunication, Mechanical, Civil, Mathematics, Physics, Humanities).
4. **`authors`**: Authors and academic authorities with biographies.
5. **`publishers`**: International and Indian academic publishing houses (McGraw-Hill, Pearson, S. Chand, Wiley, Oxford).
6. **`books`**: Core textbook titles, ISBN-13 identifiers, call numbers, editions, total copies, and real-time available copy counters.
7. **`book_copies`**: Physical volume copies with unique barcodes (e.g., `ITP-CS-00101`), stack locations (`Stack CS-101`), and condition status.
8. **`loans`**: Complete circulation history: issue date, due date, return date, issuing staff ID, returning staff ID, renewal counter, and loan status (`active`, `returned`, `overdue`).
9. **`reservations`**: Holds and reservation queues (`pending`, `ready_for_pickup`, `fulfilled`, `cancelled`).
10. **`book_requests`**: Student acquisition requests for new titles with admin remarks.
11. **`fines`**: Automated overdue fine calculation linked to circulation loans.
12. **`payments`**: Immutable ledger of fine settlements (`cash`, `online`, `upi`, `system_waived`).
13. **`e_resources`**: Peer-reviewed journals, IEEE Xplore, SpringerLink, ACM digital archives, and WBSCTE polytechnic syllabi.
14. **`notices`**: Campus library announcements and circulars with priority pin flags.
15. **`notifications`**: Personalized transaction notifications and due-date alerts.
16. **`activity_logs`**: Immutable security audit trail recording IP address, actor, action, and target entity.
17. **`system_settings`**: Configurable institutional parameters (max loan days, fine per day, max books per student).

---

## 🚀 Installation & Local Setup

### Prerequisites
- **Node.js** (v18.0.0 or higher, tested on Node v22 LTS)
- **MySQL Server** 8.0+ or **XAMPP / MariaDB** (Running on port 3306)

### Step 1: Install Dependencies
Open terminal or PowerShell in the project directory:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your MySQL credentials match your environment:
```ini
PORT=3000
DB_ADAPTER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=itahar_library
JWT_SECRET=your_super_secret_jwt_key_here
```

### Step 3: Initialize & Seed MySQL Database
Run the automated schema and seed scripts:
```bash
# 1. Create database and tables
npm run db:init

# 2. Seed with initial academic books, users, and holdings
npm run db:seed
```

*(Alternatively, import `database/schema.sql` followed by `database/seed.sql` directly into phpMyAdmin or MySQL Workbench).*

### Step 4: Start the Server
```bash
npm start
```
Or double-click **`run.bat`** on Windows.

Visit **`http://localhost:3000`** in your browser.

> ⚡ **Smart Fallback Engine:** If MySQL server is temporarily offline during development, the application seamlessly activates its embedded SQLite engine (`library.db`) with identical normalized tables, so testing never crashes!

---

## 🧪 Automated Testing

Execute the end-to-end integration test runner:
```bash
npm test
```
The test suite validates:
- System Health Check
- Student registration & admin approval flow
- Pending student login restriction (403 Forbidden)
- Admin authentication & live database statistics
- Admin account approval
- Active student authentication & profile retrieval
- Dynamic catalog query & ISBN search
- Book reservation queue
- Librarian catalog indexing & barcode generation
- Book issue & loan checkout
- Due date tracking & active loan listing
- Student acquisition requests
- Book check-in return & fine calculation
- E-Resources and campus notices
- Real-time notification delivery

---

## 📡 REST API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register student (sets status to `pending`) |
| `POST` | `/api/auth/login` | Public | Authenticates credentials, returns JWT |
| `GET` | `/api/auth/me` | Authenticated | Current user profile, stats & active loans |
| `PUT` | `/api/auth/profile` | Authenticated | Update phone, semester, or change password |

### Books Catalog (`/api/books`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/books` | Public | Search books by title, author, category, ISBN |
| `GET` | `/api/books/:id` | Public | Book details with physical copies and barcodes |
| `POST` | `/api/books` | Librarian/Admin | Add book and auto-generate copy barcodes |
| `PUT` | `/api/books/:id` | Librarian/Admin | Update book metadata |
| `DELETE` | `/api/books/:id` | Librarian/Admin | Remove book from catalog |

### Circulation & Loans (`/api/loans`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/loans/issue` | Librarian/Admin | Check out book copy to student roll |
| `POST` | `/api/loans/return` | Librarian/Admin | Check in book copy, calculates overdue fine |
| `POST` | `/api/loans/renew/:id` | Authenticated | Renew book loan by 14 days |
| `GET` | `/api/loans/my-loans` | Student | Active and returned loans of current student |
| `GET` | `/api/loans/all` | Librarian/Admin | List all circulation records with filters |
| `GET` | `/api/loans/overdue` | Librarian/Admin | Track overdue holdings and active fines |

### Reservations & Requests
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/reservations` | Student | Place hold/reserve book copy |
| `GET` | `/api/reservations/my` | Student | Current student reservations |
| `GET` | `/api/reservations/all` | Librarian/Admin | View all active holds |
| `PUT` | `/api/reservations/:id/status`| Librarian/Admin | Mark ready for pickup or fulfill |
| `POST` | `/api/requests` | Student | Request new book acquisition |
| `GET` | `/api/requests/all` | Librarian/Admin | View purchase requests queue |
| `PUT` | `/api/requests/:id` | Librarian/Admin | Approve or reject purchase request |

### Fines & Payments (`/api/fines`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/fines/my` | Student | Student's fine summary and ledger |
| `GET` | `/api/fines/all` | Librarian/Admin | View all fines across college |
| `POST` | `/api/fines/pay/:id` | Authenticated | Settle fine (online simulation or cash) |
| `POST` | `/api/fines/waive/:id` | Admin/Librarian | Waive fine with recorded justification |

### Students Management (`/api/students`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/students` | Librarian/Admin | List students with status & department filters |
| `GET` | `/api/students/:id` | Librarian/Admin | Complete student file (loans, history, fines) |
| `PUT` | `/api/students/:id/status` | Librarian/Admin | Approve, activate, or suspend student account |

### Admin & Governance (`/api/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/dashboard-stats`| Admin/Librarian | Real-time live MySQL statistics |
| `GET` | `/api/admin/analytics` | Admin/Librarian | Department circulation breakdown & top books |
| `GET` | `/api/admin/activity-logs` | Admin | Full audit trail with IP address and actions |
| `GET` | `/api/admin/settings` | Admin/Librarian | Read system circulation parameters |
| `PUT` | `/api/admin/settings` | Admin | Update loan duration, fine rates, limits |
| `POST` | `/api/admin/staff` | Admin | Appoint new Librarian or Administrator |

---

## 🌐 Deployment Instructions

### 1. Deploy Frontend to Netlify
1. Connect this repository or upload the project folder to [Netlify](https://www.netlify.com/).
2. The project includes `netlify.toml` and `public/_redirects` configured out of the box.
3. Build Settings:
   - **Publish directory:** `public`
   - **Build command:** *(leave empty or `echo "Built"`)*
4. If deploying the backend on a separate host (e.g. Render, Railway), update `netlify.toml`:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-backend-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```

### 2. Deploy Backend & MySQL (Render / Railway / VPS)
1. Provision a MySQL database instance (e.g. AWS RDS, Railway MySQL, PlanetScale, Aiven).
2. Run `npm run db:init` and `npm run db:seed` against the remote MySQL instance by setting `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in your deployment environment variables.
3. Set `JWT_SECRET` to a strong random 64-character string.
4. Set `PORT=3000` and start command `npm start`.

---

## 📄 License
This system is custom-built for **ITAHAR GOVERNMENT POLYTECHNIC**. Released under the MIT License.
