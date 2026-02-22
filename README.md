# Obe-Medical: Medical Consultation Platform

[باللغة العربية](#باللغة-العربية) | [English](#english)

---

## باللغة العربية

### عن المشروع
هذا المشروع هو منصة طبية متكاملة مصممة لتسهيل إدارة الاستشارات الطبية بين الأطباء والمساعدين. تتيح المنصة إمكانية إدارة المرضى، الحالات الطبية، وإنشاء تقارير مفصلة.

### المميزات الرئيسية
*   **نظام أدوار متقدم:** واجهات مخصصة لكل من الطبيب والمساعد.
*   **إدارة المرضى:** نظام كامل لإضافة وتعديل ومتابعة سجلات المرضى.
*   **إدارة الحالات الطبية:** سير عمل متكامل لمراجعة الحالات وإدارتها.
*   **إدارة القوالب (Catalogue):** تمكين الأطباء من إنشاء وتعديل نماذج الأسئلة الطبية.
*   **تقارير PDF:** إنشاء تقارير طبية احترافية تلقائياً.
*   **الأمان:** تشفير كلمات المرور وحماية المسارات باستخدام JWT.

### التقنيات المستخدمة
*   **Frontend:** React 19, Material UI (MUI), Vite, Axios.
*   **Backend:** Node.js, Express, MySQL.
*   **الأدوات:** JWT, Multer (رفع الملفات), PDFKit (التقارير).

---

## English

### About the Project
A comprehensive Medical Consultation Platform designed to streamline interactions between doctors and assistants. The platform manages patient records, medical cases, and generates professional PDF reports.

### Key Features
*   **Role-Based Access Control:** Separate portals for Doctors and Assistants.
*   **Patient Management:** Full CRUD operations for patient records.
*   **Medical Case Workflow:** Process for entering, reviewing, and closing medical cases.
*   **Catalogue Management:** Manage medical questionnaires and templates.
*   **PDF Generation:** Automated professional report generation.
*   **Security:** Password hashing (Bcrypt), JWT authentication, and Rate Limiting.

### Tech Stack
*   **Frontend:** React 19, Material UI (MUI), Vite, Axios.
*   **Backend:** Node.js, Express, MySQL.
*   **Infrastructure:** JWT, Multer (File Uploads), PDFKit.

---

## 🛠 Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   MySQL Database

### 1. Backend Configuration
1. Navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create a `.env` file based on your environment and add your database credentials.
4. Start the server:
    ```bash
    npm run dev
    ```

### 2. Frontend Configuration
1. Navigate to the `frontend` folder:
    ```bash
    cd frontend
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start the development server:
    ```bash
    npm run dev
    ```

---

## 📄 License
This project is licensed under the ISC License.