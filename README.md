<h1 align="center">🚀 Smart Civic Issue Reporting System</h1>

<p align="center">
An AI-powered web application for automated civic issue reporting and validation using Deep Learning.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white">
  <img src="https://img.shields.io/badge/MySQL-00758F?style=for-the-badge&logo=mysql&logoColor=white">
  <img src="https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white">
  <img src="https://img.shields.io/badge/MobileNetV2-Deep%20Learning-blue?style=for-the-badge">
</p>

---

# 📖 About

The **Smart Civic Issue Reporting System** is a full-stack AI-powered web application designed to simplify the reporting and management of civic issues such as garbage accumulation and potholes. Citizens can submit complaints with images and live location, while municipal officers can efficiently review and resolve them through dedicated dashboards.

A **MobileNetV2 Deep Learning model** validates uploaded images before complaints are processed, reducing false reports and improving municipal workflow efficiency.

---

# ✨ Features

- 🔐 Secure User Authentication
- 📍 Live Location-Based Complaint Reporting
- 🤖 AI-Powered Image Verification (MobileNetV2)
- 👥 Citizen Dashboard
- 🏛️ Municipal Officer Dashboard
- 👨‍💼 Admin Dashboard
- 📊 Complaint Status Tracking
- 🗂️ Complaint Management System
- 💾 MySQL Database Integration
- 📱 Responsive User Interface

---

# 🛠️ Tech Stack

| Category | Technologies |
|----------|--------------|
| **Frontend** | React.js, HTML5, CSS3, JavaScript |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL |
| **AI / ML** | TensorFlow, Keras, MobileNetV2 |
| **Tools** | Git, GitHub, VS Code |

---

# 🏗️ System Architecture

```
Citizen
    │
    ▼
React Frontend
    │
    ▼
Node.js + Express.js
    │
    ▼
MySQL Database
    │
    ▼
MobileNetV2 Deep Learning Model
```

---

# 📂 Project Structure

```
Smart-Civic-Issue-Reporting-System
│
├── admin/
├── user/
├── uploads/
├── database/
├── README.md
└── .gitignore
```

---

# ⚙️ Installation

### Clone the Repository

```bash
git clone https://github.com/TejaKatkam/SMART-CIVIC-ISSUES-REPORTING-SYSTEM.git
```

### Navigate to the Project

```bash
cd SMART-CIVIC-ISSUES-REPORTING-SYSTEM
```

### Install Dependencies

For the User Module

```bash
cd user
npm install
```

For the Admin Module

```bash
cd ../admin
npm install
```

### Configure Database

- Create a MySQL Database.
- Import the provided SQL file.
- Update your database credentials in the backend configuration.

### Run the Project

Start the User Module

```bash
npm start
```

Start the Admin Module

```bash
npm start
```

---

# 🧠 AI Model

The project integrates **MobileNetV2**, a Deep Learning image classification model, to validate uploaded civic issue images.

### Supported Detection

- 🗑️ Garbage
- ✅ Clean Area

The AI model minimizes false complaints and improves issue verification before municipal processing.

---

# 🎯 Future Enhancements

- 📱 Mobile Application
- ☁️ Cloud Deployment
- 📧 Email Notifications
- 📍 Google Maps Integration
- 🔔 Push Notifications
- 📊 Advanced Analytics Dashboard
- 🌐 Multi-language Support
- 🤖 Improved AI Model Accuracy

---

# 👨‍💻 Authors

<table>
<tr>

<td align="center" width="50%">

### Teja Katkam

📧 **Email**  
tejakatkam2005@gmail.com

💼 **LinkedIn**  
https://www.linkedin.com/in/teja-katkam

🌐 **GitHub**  
https://github.com/TejaKatkam

</td>

<td align="center" width="50%">

### Shria Varma

📧 **Email**  
varmashria7999@gmail.com

💼 **LinkedIn**  
https://www.linkedin.com/in/shria-varma/

</td>

</tr>
</table>

---

# 📜 License

This project is developed for educational and learning purposes.

---

<p align="center">

⭐ If you found this project helpful, consider giving it a star!

Made with ❤️ using React, Node.js, Express.js, MySQL & Deep Learning.

</p>
