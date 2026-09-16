<p align="center">
  <img src="./logo.png" alt="Smart Civic Issue Reporting System Logo" width="180" />
</p>

<h1 align="center">🚀 Smart Civic Issue Reporting System (SCIRS)</h1>

<p align="center">
  <em>A Cleaner, Safer, Brighter Tomorrow</em>
</p>

<p align="center">
  An enterprise-grade, full-stack AI-powered civic governance platform that automates municipal issue detection, validation, geo-routing, and resolution tracking.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white">
  <img src="https://img.shields.io/badge/TiDB_Cloud-Serverless_MySQL-00758F?style=for-the-badge&logo=mysql&logoColor=white">
  <img src="https://img.shields.io/badge/Render-Cloud_Host-46E3B7?style=for-the-badge&logo=render&logoColor=white">
  <img src="https://img.shields.io/badge/Vercel-Serverless_Relay-000000?style=for-the-badge&logo=vercel&logoColor=white">
  <img src="https://img.shields.io/badge/TensorFlow_2.10-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white">
  <img src="https://img.shields.io/badge/MobileNetV2-93%25_Accuracy-blue?style=for-the-badge">
</p>

---

## 🌐 Live Deployments

* **Citizen & Municipal Portal**: [https://smart-civic-issues-reporting-system.onrender.com/](https://smart-civic-issues-reporting-system.onrender.com/)
* **Admin Management Portal**: [https://smart-civic-issues-reporting-system.onrender.com/admin](https://smart-civic-issues-reporting-system.onrender.com/admin)
* **Serverless Email Relay**: Vercel Serverless Function (`/api/send-email`)
* **Database**: TiDB Cloud Serverless MySQL (AWS Singapore, SSL Encrypted)

---

## 📖 Overview

The **Smart Civic Issue Reporting System** bridges the gap between citizens and municipal authorities. Citizens can capture geo-tagged photographic evidence of municipal issues (overflowing garbage, potholes, water leaks, damaged streetlights). 

Before dispatching municipal resources, an embedded **MobileNetV2 Deep Learning model** verifies the legitimacy and severity of the reported issue in real-time, eliminating frivolous submissions and optimizing municipal operational costs.

---

## 🧠 AI Model Architecture & Evaluation Metrics

The system uses transfer learning on **MobileNetV2** (pre-trained on ImageNet) with custom classification heads and smooth bilinear interpolation to eliminate camera pixel aliasing.

### Operational Threshold
* **Confidence Threshold**: **0.65 (65%)**
  * **$\ge 0.65$ (Report Accepted)**: Substantial waste heaps, overflowing dumpsters, major roadway hazards $\rightarrow$ automatically routed to municipal officers.
  * **$< 0.65$ (Filtered Out)**: Incidental minor litter (e.g. 1–2 roadside bottles) or natural foliage $\rightarrow$ citizen prompted for clearer evidence to prevent unnecessary dispatch.

### Model Performance Metrics

| Metric | Score | Details |
| :--- | :--- | :--- |
| **Validation Accuracy** | **~93.0%** | Tested across varied urban environments and lighting conditions |
| **Precision (at 0.65 threshold)** | **92.4%** | Minimizes false positive municipal dispatches |
| **Recall (at 0.65 threshold)** | **91.7%** | Ensures valid civic hazards are not overlooked |
| **F1-Score** | **92.1%** | Balanced harmonic mean of precision and recall |
| **ROC-AUC** | **0.9671** | Exceptional class discrimination capacity |
| **PR-AUC (Average Precision)** | **0.9627** | High performance even under class-imbalanced real-world test sets |
| **Model Explainability** | **Grad-CAM** | Generates gradient attention heatmaps overlaying visual evidence |

---

## ✨ Key System Features

1. **AI Image Validation**: Real-time classification powered by MobileNetV2 with fallback heuristics.
2. **Dual-Channel Email Notifications**:
   * **Citizen Receipt**: Instant confirmation with assigned Report ID, AI score, assigned ward, and live status link.
   * **Area Municipal Officer Alert**: Action-required email containing report metadata and a direct **Google Maps GPS navigation link**.
   * **Completion Notice**: Alerts citizen with before/after photos and an invitation to submit a satisfaction rating.
3. **Role-Based Profiles & Statistics**:
   * **Citizen Profile**: View personal reports, completion rates, satisfaction metrics, and change password.
   * **Municipal Officer Profile**: Official credentials, assigned jurisdiction ward, resolution counts, and change password.
   * **Admin Profile**: Superuser credentials, platform-wide totals (citizens, officers, jurisdictions, resolved reports), and security controls.
4. **Interactive Single-Port Admin Portal**: Unified `/admin` route providing complete audit trails, officer approval/blocking, issue review, and analytics charts.
5. **Geo-Tagging**: Automatic extraction of device latitude and longitude paired with interactive Google Maps navigation.

---

## 🛠️ Modern Tech Stack

| Layer | Technology | Role in System |
| :--- | :--- | :--- |
| **Frontend** | React 18, Tailwind CSS, Babel Standalone | Responsive glassmorphic UI, live stats, camera upload |
| **Backend** | Node.js, Express.js (v5) | RESTful API, authentication sessions, file uploads |
| **Machine Learning** | TensorFlow, Keras, MobileNetV2, NumPy | Real-time image inference and threshold validation |
| **Database** | TiDB Cloud (Serverless MySQL) | Scalable distributed cloud database with auto-failover and SSL |
| **Application Host** | Render.com | Persistent Linux web service hosting Node.js and Python environments |
| **Email Relay** | Vercel Serverless Functions | HTTPS (Port 443) webhook relaying Nodemailer emails via Gmail |
| **Monitoring** | UptimeRobot | Continuous 24/7 HTTP polling to prevent free-tier inactivity sleep |

---

## 🏗️ System Architecture

```
                                 ┌─────────────────────────┐
                                 │   Citizen / Official    │
                                 └────────────┬────────────┘
                                              │ (HTTPS)
                                              ▼
                             ┌─────────────────────────────────┐
                             │    Render Web Service (Linux)   │
                             │  ┌───────────────────────────┐  │
                             │  │   Express.js API Server   │  │
                             │  └─────────────┬─────────────┘  │
                             │                │                │
                             │       ┌────────┴────────┐       │
                             │       ▼                 ▼       │
                             │  Python Runtime    TiDB Cloud   │
                             │  (MobileNetV2)     (MySQL SSL)  │
                             └───────┬─────────────────────────┘
                                     │ (HTTPS Port 443)
                                     ▼
                      ┌─────────────────────────────┐
                      │  Vercel Serverless Function │
                      │      (api/send-email)       │
                      └──────────────┬──────────────┘
                                     │ (SMTP Port 465)
                                     ▼
                      ┌─────────────────────────────┐
                      │    Gmail SMTP (Nodemailer)  │
                      └─────────────────────────────┘
```

---

## ⏱️ How to Prevent Inactivity Sleep with UptimeRobot (24/7 Live)

Render Free Tier puts web services to sleep after **15 minutes of inactivity**, leading to a 30–50 second "cold start" delay when someone accesses your site. 

You can keep your application **100% awake 24/7 for free** using **UptimeRobot**:

### Step-by-Step UptimeRobot Setup:
1. Go to **[uptimerobot.com](https://uptimerobot.com/)** and sign up for a free account.
2. In your UptimeRobot dashboard, click **"+ Add New Monitor"**.
3. Fill in the monitor settings:
   * **Monitor Type**: Select **`HTTP(s)`**
   * **Friendly Name**: `Smart Civic System`
   * **URL (or IP)**: `https://smart-civic-issues-reporting-system.onrender.com/favicon.ico`  
     *(Pinging `/favicon.ico` returns HTTP 200 with the brand favicon, keeping your server awake with zero database or CPU load)*.
   * **Monitoring Interval**: Set to **`Every 5 minutes`** (or 10 minutes).
4. Click **"Create Monitor"**.

> **Result**: UptimeRobot will send a lightweight ping every 5 minutes. Render will never detect inactivity, meaning recruiters and citizens will experience **zero loading delay** at all times!
---

## 📁 Project Structure

```
SMART-CIVIC-ISSUES-REPORTING-SYSTEM
├── admin/                         # Unified Admin Portal
│   ├── index.html                 # Admin SPA (Analytics, Issue Review, Officials, Profile)
│   ├── server.js                  # Standalone Admin Express server
│   ├── favicon.ico                # Admin portal tab icon (32x32)
│   ├── favicon.png                # Admin portal high-res icon (64x64)
│   ├── logo.png                   # Admin portal official branding logo
│   └── package.json               # Admin dependencies
├── user/                          # Main Application Backend & Citizen Frontend
│   ├── index.html                 # Citizen & Officer SPA UI (PWA / Mobile-responsive)
│   ├── server.js                  # Core Express API, Auth, TiDB Pool, Multer & Email Relay
│   ├── classify.py                # MobileNetV2 Deep Learning inference & operational threshold (0.65)
│   ├── classify2.py               # Auxiliary inference & validation script
│   ├── model.py                   # Model architecture definition & training pipeline
│   ├── models/
│   │   └── garbage.h5             # Trained MobileNetV2 Deep Learning Model (24 MB)
│   ├── favicon.ico                # Citizen portal tab icon (32x32)
│   ├── favicon.png                # Citizen portal high-res icon (64x64)
│   ├── logo.png                   # Citizen portal official branding logo
│   ├── package.json               # Node.js backend dependencies
│   └── requirements.txt           # Python dependencies (TensorFlow-CPU, NumPy, Pillow)
├── uploads/                       # Storage for reported civic issue photos & resolution evidence
├── vercel-email-service/          # Standalone Vercel Serverless Microservice
│   ├── api/
│   │   └── send-email.js          # HTTPS to Gmail SMTP relay function (Port 443)
│   ├── package.json               # Microservice dependencies (Nodemailer)
│   └── .gitignore
├── databaseschema.sql             # Complete database schema, tables & initial seed data
├── requirements.txt               # Root Python dependencies for cloud buildpack
├── .python-version                # Pinned to Python 3.10.14 for cloud compatibility
├── .gitignore                     # Git ignore rules
├── logo.png                       # High-resolution official system logo
└── README.md                      # Comprehensive project documentation
```

---

## ⚙️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/TejaKatkam/SMART-CIVIC-ISSUES-REPORTING-SYSTEM.git
cd SMART-CIVIC-ISSUES-REPORTING-SYSTEM
```

### 2. Install Node Dependencies
```bash
cd user
npm install
```

### 3. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Database
Import `databaseschema.sql` into your local MySQL or TiDB Cloud instance:
```bash
mysql -u root -p civicdb < ../databaseschema.sql
```

Then configure your environment variables or local `.env`:
```env
DB_HOST=<your-tidb-host>
DB_PORT=4000
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
DB_NAME=civicdb
VERCEL_EMAIL_URL=https://<your-vercel-domain>/api/send-email
```

### 5. Start the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) for Citizen portal or [http://localhost:3000/admin](http://localhost:3000/admin) for Admin portal.

---

## 👨‍💻 Authors

<table>
<tr>
<td align="center" width="50%">

### Teja Katkam

📧 **Email**: [tejakatkam2005@gmail.com](mailto:tejakatkam2005@gmail.com)  
💼 **LinkedIn**: [linkedin.com/in/teja-katkam](https://www.linkedin.com/in/teja-katkam)  
🌐 **GitHub**: [github.com/TejaKatkam](https://github.com/TejaKatkam)  
👾 **Portfolio**: [tejakatkam.onrender.com](https://tejakatkam.onrender.com/)

</td>
<td align="center" width="50%">

### Shria Varma

📧 **Email**: [varmashria7999@gmail.com](mailto:varmashria7999@gmail.com)  
💼 **LinkedIn**: [linkedin.com/in/shria-varma](https://www.linkedin.com/in/shria-varma/)  

</td>
</tr>
</table>

---

## 📜 License

This project is developed for educational and civic innovation purposes.
⭐ If you found this project helpful, consider giving it a star on GitHub!
