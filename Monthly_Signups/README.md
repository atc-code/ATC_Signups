# ATC Monthly Signups — Complete Setup & Documentation

This project provides a **fully automated, reusable volunteer signup system** for monthly ATC church events such as Sunday services or other special occasions.

It combines:
- Google Apps Script (for backend logic)
- Google Sheets (for data storage)
- GitHub Pages (for hosting a beautiful front-end form)
- Google Sign-In (for secure access)

---

## 🙏 Purpose
To make volunteer coordination simple and transparent for the **Atlanta Telugu Church (ATC)**, where members can securely sign up to serve on various Sundays and teams — all managed through a clean online signup portal.

---

## 🧩 Key Features

| Feature | Description |
|----------|--------------|
| **Google Sign-In (secure access)** | Only signed-in Google users can view or submit. |
| **Automatic Sunday generation (15 years)** | Automatically calculates and lists all Sundays for the next 15 years. |
| **Dynamic role management** | Volunteer roles (Setup, Announcements, Cleanup, etc.) are editable from the Google Sheet. |
| **Live RSVP status** | Displays real-time volunteer signups per team/date. |
| **Admin metrics** | Admins (`atc.noting@gmail.com`, `chakdom@gmail.com`) can view total views and submissions by each user. |
| **Automatic email confirmations** | Sends a personalized confirmation email to each volunteer with their role and service date. |
| **Mobile & desktop friendly** | Fully responsive interface styled for phones, tablets, and laptops. |
| **Role capacity enforcement** | Each role has a defined capacity (e.g., Setup = 6, Announcements = 2) — prevents over-signups. |
| **Duplicate prevention** | Stops users from signing up twice for the same team/date. |
| **Event closure** | After the service date passes, that week’s signup is automatically closed. |
| **Blocklist support** | You can restrict specific emails if needed via the `Blocklist` tab in Google Sheets. |

---

## ⚙️ How We Built It

1. **Google Sheet Template Created**  
   - Tabs: `Roles`, `Calendar`, `Signups`, `Blocklist`, `ViewLogs`  
   - Each tab stores data related to teams, event dates, and submissions.

2. **Apps Script Backend (`ATC_Monthly_Signups.gs`)**  
   - Verifies Google Sign-In token  
   - Reads/Writes to the Sheet  
   - Seeds all Sundays for 15 years  
   - Sends email confirmations  
   - Returns JSON data for the HTML page  
   - Provides admin metrics

3. **HTML Frontend (`ATC_Monthly_Signups.html`)**  
   - Displays signup form  
   - Uses Google Sign-In (Client ID: `180743986209-prt051o1bp6namb57ababodokq0eadfv.apps.googleusercontent.com`)  
   - Calls backend APIs securely  
   - Renders live roster and metrics  
   - Fully responsive and styled like the Thanksgiving signup

4. **GitHub Hosting**  
   - Frontend hosted in repo:  
     `https://github.com/atc-code/ATC_Signups/Monthly_Signups/`  
   - Publicly accessible via:  
     `https://atc-code.github.io/ATC_Signups/Monthly_Signups/ATC_Monthly_Signups.html`

5. **Deployment**  
   - Backend deployed via Google Apps Script → “New Deployment” → “Web App”  
   - Execute as: **Me**  
   - Access: **Anyone with Google Account**

---

## 📄 How to Set It Up (Step-by-Step)

### Step 1 — Create the Google Sheet
Create/Upload `ATC_Monthly_Signups.xlsx` to Google Drive and open it as a Google Sheet.  
You’ll see these tabs:
- **Roles** — define all volunteer roles and their capacities.
  Role	Cap	Active	Notes
- **Calendar** — will auto-populate all Sundays for 15 years.
  ServiceDate	Title	RolesFilter
- **Signups** — automatically logs every signup submission.
Timestamp	Month	ServiceDate	Role	FirstName	LastName	Email	Phone	Comments	ByEmail
- **Blocklist** — optional; add restricted emails.
email	notes	added_at
- **ViewLogs** — stores anonymous view metrics.
Timestamp	Email	Path	UserAgent

Copy the **Sheet ID** from the URL — it’s the long string between `/d/` and `/edit`.

---

**Step 2 — Setup Apps Script Backend**
1. Go to [https://script.google.com](https://script.google.com)  
2. Create a **new project** named `ATC Monthly Signups`
3. Add two files:
   - `ATC_Monthly_Signups.gs` (paste the backend code)
4. Replace:
   ```js
   const SHEET_ID = 'YOUR_SHEET_ID_HERE';

---

**Step 3 — Deploy the Script**

Click Deploy → New deployment → Web app
Set: Execute as: Me
Who has access: Anyone with Google Account
Copy the Web App URL that appears.

---

**Step 4 — Upload Frontend to GitHub**

Go to your GitHub repo:
https://github.com/atc-code/ATC_Signups
Navigate to /Monthly_Signups/
Upload ATC_Monthly_Signups.html
Commit changes.

---

**Step 5 — Enable GitHub Pages**

Go to Settings → Pages
Set Source: main branch → / (root) or /docs depending on your repo
Save.
Visit your live signup page at:
https://atc-code.github.io/ATC_Signups/Monthly_Signups/ATC_Monthly_Signups.html

---

**✉️ How to Submit a Monthly Signup Page**

When you create a new month’s form:
Open the same hosted link.
Choose Month (e.g., November 2025).
Select the Sunday date (auto-generated).
Enter Name, Email, Phone.
Choose your team(s) (e.g., Setup, Announcements).
Click Submit.
You’ll instantly get:
A confirmation email
Your name added to the Live RSVP Status table
Admin metrics updated automatically

---

**🔧 Maintenance Notes**

- To add new roles, update the Roles tab in the Google Sheet.
- To change capacities or deactivate a team, edit the same tab.
- To refresh the next year’s Sundays, run the function seedSundays15Years() from the Script Editor (once only).
- To block someone, add their email to the Blocklist tab.

---

**🙌 Acknowledgments**

Created for Atlanta Telugu Church (ATC) volunteers to serve God with joy and organization.
Developed by **Chakravarthy Maddi** with the help of ChatGPT for automation, structure, and user experience.
