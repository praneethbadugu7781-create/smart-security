# 🎓 Smart Main Gate Entry-Exit & Campus Discipline System

A complete, production-ready, web-based college security system with real-time barcode scanning for student entry-exit tracking, roaming detection, and permission management.

## ✨ Features

### Core Functionality
- **Real-time Barcode Scanning** - ~0.2 second detection using camera
- **Zero Interaction Security** - Security just holds phone, system auto-detects and records
- **Auto Dashboard Updates** - Live feed refreshes automatically
- **Role-Based Access Control** - Security, Admin, HOD, Warden, Principal

### Student Management
- **Day Scholars** - Exit allowed only during breaks or with permission letter
- **Hostelers** - Curfew monitoring and violation tracking
- **Bus Students** - Flexible exit times

### Alert System
- **Roaming Detection** - Real-time alerts to HOD when student exits during class
- **Curfew Violations** - Automatic alerts to Warden
- **Escalation to Principal** - For critical/repeated violations

### Permission Letters
- **Photo Upload** - Security can upload permission letter photos
- **HOD Verification** - Pending permission queue for HOD review
- **Automatic Validation** - System checks for valid permission before exit

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express.js |
| Database | MySQL 8.0+ |
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Template Engine | EJS |
| Barcode Scanning | ZXing Library |
| Authentication | bcrypt + express-session |
| Camera | Browser MediaDevices API |

## 📁 Project Structure

```
college-smart-security/
├── app.js                  # Main Express application
├── package.json
├── .env.example            # Environment template
│
├── config/
│   ├── database.js         # MySQL connection pool
│   └── app.config.js       # Application settings
│
├── database/
│   └── schema.sql          # Complete MySQL schema
│
├── models/
│   ├── Student.js
│   ├── User.js
│   ├── EntryExitLog.js
│   ├── PermissionLetter.js
│   ├── RoamingLog.js
│   └── Alert.js
│
├── controllers/
│   ├── authController.js
│   ├── scanController.js
│   ├── dashboardController.js
│   ├── studentController.js
│   └── reportsController.js
│
├── middleware/
│   ├── auth.js             # Role-based authentication
│   ├── timeValidation.js   # Class hours, breaks, curfew
│   ├── auditLogger.js      # Action logging
│   └── errorHandler.js
│
├── routes/
│   ├── authRoutes.js
│   ├── scanRoutes.js
│   ├── dashboardRoutes.js
│   ├── studentRoutes.js
│   └── reportRoutes.js
│
├── views/
│   ├── layouts/main.ejs
│   ├── login.ejs
│   ├── scan.ejs            # Security scanning interface
│   ├── error.ejs
│   └── dashboard/
│       ├── admin.ejs
│       ├── hod.ejs
│       ├── warden.ejs
│       └── principal.ejs
│
├── public/
│   ├── css/
│   │   ├── main.css
│   │   ├── login.css
│   │   ├── scan.css
│   │   └── dashboard.css
│   └── js/
│       ├── scan.js         # Camera & barcode detection
│       ├── dashboard.js    # Live updates
│       └── utils.js
│
└── scripts/
    ├── setup-database.js
    └── seed-data.js
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0+
- MySQL 8.0+
- Modern browser with camera access

### Installation

1. **Clone and install dependencies**
```bash
cd "college smart security"
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

3. **Setup database**
```bash
npm run setup-db
```

4. **Add sample data (optional)**
```bash
npm run seed
```

5. **Start the server**
```bash
npm start
# or for development:
npm run dev
```

6. **Access the application**
```
http://localhost:3000
```

## 🔐 Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | password123 |
| Security | security1 | password123 |
| HOD (CSE) | hod_cse | password123 |
| Warden | warden_boys | password123 |
| Principal | principal | password123 |

⚠️ **Change all passwords in production!**

## 📱 Usage

### Security Guard Workflow
1. Login with security credentials
2. Grant camera permission
3. Select Entry/Exit mode
4. Point phone camera at student ID barcode
5. System auto-detects, verifies, and logs
6. Audio + visual feedback confirms action

### HOD Workflow
1. Login to HOD dashboard
2. View roaming incidents for department
3. Review and resolve incidents
4. Verify pending permission letters

### Warden Workflow
1. Monitor hostel students outside campus
2. Track curfew violations
3. View countdown to curfew time

### Principal Workflow
1. Overview of all departments and hostels
2. Handle escalated alerts
3. Access comprehensive reports

## ⏰ Business Rules

### Day Scholars
- **Normal exit**: Only during lunch break (12:30-13:30)
- **Class hours exit**: Requires uploaded permission letter
- **Late entry**: Flagged if after 9:00 AM

### Hostelers
- **Exit rules**: Same as day scholars
- **Curfew**: Must be inside by 9:00 PM (configurable)
- **Violations**: Auto-alert to warden if late

### Bus Students
- **Flexible exit**: Allowed after 4:30 PM
- **Bus timing exemption**: No permission needed for evening exit

### Roaming Detection
- Exit during class hours → Alert to HOD
- Repeated violations → Escalate to Principal
- All incidents logged for reports

## 🔧 Configuration

Edit `config/app.config.js` or use environment variables:

```javascript
module.exports = {
    collegeTimings: {
        startTime: '08:30',
        endTime: '17:00',
        lunchStart: '12:30',
        lunchEnd: '13:30'
    },
    hostel: {
        curfewTime: '21:00'
    },
    scan: {
        duplicateInterval: 30,  // seconds
        cooldownPeriod: 2       // seconds
    }
};
```

## 📊 Database Schema

Key tables:
- `students` - Student master data
- `users` - System users with roles
- `entry_exit_logs` - All scan events
- `permission_letters` - Uploaded permissions
- `roaming_logs` - Detected roaming incidents
- `alerts` - System alerts per role

## 🔒 Security Features

- Session-based authentication
- bcrypt password hashing
- Role-based access control
- Rate limiting
- Helmet security headers
- Input sanitization
- CSRF protection ready

## 📈 Reports

Available reports (Admin/Principal):
- Daily entry-exit summary
- Department-wise attendance
- Late entry report
- Roaming incident report
- Curfew violation report
- Student movement history

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📄 License

ISC License

## 🆘 Support

For issues or questions:
- Create a GitHub issue
- Contact: it-support@college.edu

---

**Built with ❤️ for campus security**
