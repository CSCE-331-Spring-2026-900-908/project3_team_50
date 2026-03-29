# Boba POS Migration Guide 

Hey team! I’ve successfully migrated the Cashier Dashboard and the Menu Management panels to our new React/Express web application. The codebase now natively handles our custom "Boba Spot" Dark theme and standardizes how we interact with the PostgreSQL database.

We still have three panels to port over from Project 2. Here is a breakdown of how the new architecture works and exactly what you need to do for your assigned panel.

---

## 🏗 Understanding the New Architecture

Our web app splits the Project 2 Java code into two halves:

1. **Frontend (React)**: Lives in `myapp/client/src/components/`. This handles all the UI/UX, modals, and user clicks. It uses `axios` to fetch data from our Backend.
2. **Backend (Node/Express)**: Lives in `myapp/server/routes/`. This connects to our TAMU AWS database and runs all the SQL queries, returning JSON arrays to the frontend.

**To run the dev servers, simply open a terminal in `myapp` and run `./run.sh` (or `run.bat` on Windows).** Note: you MUST duplicate your `.env` file containing the Database credentials into `myapp/server/.env` or your app will crash!

---

## 🛠 Required Tasks for Each Panel

For whichever panel you claim, you must create three specific files mirroring my `MenuManagement` pattern:

#### 1. The Backend Router (`server/routes/<your-panel>.js`)
- Look at `server/routes/menu.js` for an example.
- Translate your Project 2 SQL queries into Express router endpoints (e.g., `router.get('/', ...)`, `router.post('/', ...)`).
- Import and mount your router inside `server/index.js` using `app.use('/api/<your-panel>', yourRouter)`.

#### 2. The Frontend Component (`client/src/components/<YourPanel>.js`)
- Look at `MenuManagement.js` for an example of how to make a CRUD table with Add/Edit modals.
- Use the `axios.get()` or `axios.post()` functions to fetch your new backend endpoints.
- We have a robust CSS variable system in `index.css` (things like `var(--clr-indigo)`, `var(--clr-lavender)`). 
- Use the class `<div className="glass-card">` to instantly give your containers our dark glass style.

#### 3. Update the App Navigation (`client/src/App.js`)
- Add a new `<NavLink>` to the `.nav-links` section so users can click your tab. Remember to wrap it in `{isManager && (...)}` so Cashiers can't cheat into your panel!
- Add a `<Route>` to the `.main-content` section at the bottom to render your component.

---

## 🧑‍💻 Assignments

### Person 1: Inventory Management 📦
- **Backend File**: `server/routes/inventory.js`
- **Frontend File**: `components/InventoryManagement.js`
- **Goal**: Translate the inventory grid, showing current stock levels, minimum stock thresholds, and the ability to update stock quantities and name/prices.
- **Reference**: `MenuManagement.js` to see how editing table rows works with modals.

### Person 2: Employee Management 👥
- **Backend File**: `server/routes/employees.js`
- **Frontend File**: `components/EmployeeManagement.js`
- **Goal**: Translate the employee CRUD table. Must be able to Add/Edit/Remove employees, assign them Roles (Cashier vs Manager), and set/change their PIN numbers.
- **Reference**: `MenuManagement.js` to see how Delete (`axios.delete`) buttons should confirm with the user before destroying data.

### Person 3: Reports Panel 📊
- **Backend File**: `server/routes/reports.js`
- **Frontend File**: `components/ReportsPanel.js`
- **Goal**: This is a read-only Heavy-SQL panel. Translate the Z-Report, X-Report, Sales History, Excess Report, and Product Usage complex SQL queries into different `/api/reports/...` endpoints. Return the arrays and cleanly display them in React tables.
- **Reference**: Since there's no CRUD, focus strictly on building clean `<table>` layouts or finding a simple React charting library if you're taking on extra features.
