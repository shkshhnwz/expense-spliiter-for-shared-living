# expense-spliiter-for-shared-living
Full-stack expense splitter app for shared living — automates bill sharing and debt tracking.


## 🏠 ExpenseCare: Shared Living Expense Splitter

**ExpenseCare** is a full-stack application designed to simplify shared living finances by providing a centralized platform for budget tracking, expense splitting, and detailed financial evaluation among housemates.

### ✨ Key Features

Our platform focuses on four main areas to ensure transparency and fairness in managing shared expenses:

### 1. 💰 Budget & Cash Flow Tracking

This module provides a clear overview of the household's financial boundaries and expectations for the month.

* **Monthly Income Submission:** Users can submit the **total collective monthly income** for accurate financial planning.
* **Dues Management:** Track all **incoming payments (receivables)** and **outgoing scheduled payments (dues)** that are expected for the current period, keeping cash flow predictable.

### 2. 🤝 Advanced Payment Sharing

The core function of the application, designed for flexibility and administrative control over group expenses.

* **Group Administration:** An **Admin** role has the authority to add and manage members (Name and Contact Number) within the expense group.
* **Expense Listing:** Members can easily **list the overall amount** for any shared item (e.g., utility bill, groceries, joint purchase).
* **Flexible Splitting:** While the default is an equal split, there is an essential option to specify an **unequal split** by listing the exact amount owed or paid by a particular member.
* **Admin Review & Finalization:** All splits are subject to **admin review and approval** before finalization.
* **Document Export:** An option to **download the complete split record** as a **PDF document** for offline record-keeping or sharing with non-app users.

### 3. 📅 Due Bills Monitoring

A dedicated and easily accessible section to ensure critical payments are never missed.

* **Dedicated View:** A specific section (accessible via the left menu bar) prominently displays all **pending due bills**.
* **Quick Details:** Each due bill is shown with its **name** (e.g., 'Electricity - Nov') and the **total amount** owed.

### 4. 📊 Financial Dashboard & Evaluation

The central hub providing a high-level summary of the group's financial performance and obligations.

* **Net Position Metrics:** Key indicators showing the **Amount to be Received** from members and the **Payments to Make** to external parties.
* **Bill Status Summary:** Tracks the **total number of bills to be paid** and the **cumulative amount** still due.
* **Monthly Flow Analysis:** Calculation and display of the **Total Influx** (money coming in) and **Total Deflux** (money going out) for the current month, giving a clear picture of the household's net flow.

---

### 💻 Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend UI** | HTML, CSS, **Bootstrap** | Structure, styling, and responsive design. |
| **Backend Logic** | **Node.js** & **Express.js** | Server-side runtime environment and API framework. |
| **Database** | **MongoDB** | Flexible NoSQL database for storing user, expense, and split data. |
| **Authentication** | **Firebase Auth** | Secure, scalable user registration and login management. |
| **Templating** | **EJS (Embedded JavaScript)** | Dynamic rendering of HTML views. |
