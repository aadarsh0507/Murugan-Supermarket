# Fix MySQL Connection Error

## Problem
The application is trying to connect to MySQL at `192.168.101.47:3306` but the connection is being refused.

## Solutions

### Option 1: Use localhost (if MySQL is on the same machine)

Update your `.env` file in the root directory:

```env
MYSQL_URL=mysql://root:StrongRoot@123@localhost:3306/Super_Market
```

or

```env
MYSQL_URL=mysql://root:StrongRoot@123@127.0.0.1:3306/Super_Market
```

### Option 2: Verify MySQL Server is Running

1. **Check if MySQL is running:**
   ```bash
   # Windows
   net start MySQL
   
   # Or check services
   services.msc
   ```

2. **Test connection manually:**
   ```bash
   mysql -h 192.168.101.47 -P 3306 -u root -p
   ```

### Option 3: Configure MySQL for Remote Connections

If MySQL is on a different machine:

1. **Edit MySQL configuration file** (`my.cnf` or `my.ini`):
   ```
   bind-address = 0.0.0.0
   ```

2. **Grant remote access:**
   ```sql
   GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'StrongRoot@123';
   FLUSH PRIVILEGES;
   ```

3. **Check firewall:**
   - Ensure port 3306 is open
   - Windows Firewall should allow MySQL connections

### Option 4: Verify IP Address

If the IP `192.168.101.47` is incorrect:

1. Find the correct MySQL server IP
2. Update `.env` with the correct IP

## Quick Fix Command

Run this in PowerShell from the project root:

```powershell
# Backup current .env
Copy-Item .env .env.backup

# Update MYSQL_URL to use localhost
(Get-Content .env) -replace 'MYSQL_URL=mysql://root:StrongRoot@123@192\.168\.101\.47:3306/Super_Market', 'MYSQL_URL=mysql://root:StrongRoot@123@localhost:3306/Super_Market' | Set-Content .env
```

## After Fixing

1. Restart your backend server
2. The connection should work now

