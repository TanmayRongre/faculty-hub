# FacultyHub

**FacultyHub** is a modern academic management and portal system developed for **Dr. Panjabrao Deshmukh Polytechnic, Amravati** (Department of Computer Science - 5th Semester).

---

## 🏛️ Institution & Scope

- **Institution**: Dr. Panjabrao Deshmukh Polytechnic, Amravati
- **Department**: Computer Science (`CO`)
- **Semester**: 5th Semester
- **Active Subjects**:
  - `STE` (Software Testing - 22518)
  - `ACN` (Advanced Computer Network - 22520)
  - `OSY` (Operating System - 22516)
  - `SPI` (System Programming & Scripting - 22519)
  - `ITR` (Industrial Training - 22057)
  - `ENDS` (Environmental Studies - 22447)

---

## 🚀 Key Features

1. **Role-Based Access Control (RBAC)**: Secure access tailored for Administrators, Faculty, and Students.
2. **Google Sheets Live Sync**: Bidirectional synchronization of student profiles, marks, and attendance records with Google Sheets.
3. **Progressive Assessment (PA) Marks Engine**: Direct PA evaluation scored out of 30 (`0–30`) with bulk *Save All* capabilities.
4. **Attendance Matrix**: High-speed attendance marking table with Present-by-default toggle and automatic 75% defaulter threshold calculation.
5. **Smart Timetable & Lecture Scheduler**: Conflict detection across faculty, classrooms, and batches with automated holiday shift logic.
6. **Campus Notice Board**: Priority-based announcements (Urgent, Important, Normal) with attachments.
7. **Extracurricular Activity Gallery**: Student showcase for campus events, hackathons, and achievements with moderation workflow.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons, React Router
- **Backend**: Node.js, Express, Mongoose, Google APIs (Google Sheets v4)
- **Database**: MongoDB Atlas

---

## 🏁 Quick Start

### 1. Install Dependencies
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
ADMIN_SETUP_SECRET=your_admin_secret

# Google Sheets Configuration
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="your_private_key"
```

### 3. Run Development Server
Start both backend (Port 5000) and frontend (Vite) concurrently from the project root:
```bash
npm run dev
```

---

## 🧪 Running Tests

```bash
# Execute backend test suites
node backend/src/scripts/test_phase2_full.js
node backend/src/scripts/test_phase3.js
node backend/src/scripts/test_phase4.js
node backend/src/scripts/test_phase5.js
node backend/src/scripts/test_phase6.js
node backend/src/scripts/test_phase8.js
node backend/src/scripts/test_phase9.js
```

---

## 📄 License

Developed for **Dr. Panjabrao Deshmukh Polytechnic, Amravati**. All rights reserved.
