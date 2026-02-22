# Deployment Guide & Environment Configuration

## 📦 How It Was Deployed Before

The project uses **Docker + Jenkins CI/CD** pipeline with the following architecture:

### Deployment Architecture

1. **CI/CD Pipeline (Jenkins)**
   - **Source**: GitHub repository
   - **Registry**: GitHub Container Registry (`ghcr.io/murugananthamb/supermarket/`)
   - **Images**: 
     - `backend:v3`
     - `frontend:v3`
   - **Pipeline Steps**:
     1. Checkout code
     2. SonarQube code quality scan
     3. Trivy security scans (filesystem + Docker image)
     4. Docker build
     5. Push to GHCR (main branch only)

2. **Production Deployment**
   - **Method**: Docker Compose (`docker-compose.prod.yml`)
   - **Backend**: Port 5000
   - **Frontend**: Port 3000 (Nginx serving built React app)
   - **Volumes**: 
     - `supermarket-item-img-volume` (for uploaded item images)
     - `supermarket_data` (for database, if using containerized MySQL)

3. **Alternative Deployments** (based on config files):
   - **Netlify**: Frontend can be deployed to Netlify (see `frontend/netlify.toml`)
   - **Render.com**: Backend can be deployed separately (referenced in netlify.toml)

---

## 🔐 Complete Environment Variables

### Backend `.env` (Project Root)

Create a `.env` file in the **project root** directory:

```env
# ============================================
# APPLICATION CONFIGURATION
# ============================================
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Local/Application Database (REQUIRED)
MYSQL_URL=mysql://username:password@host:port/database_name
# Example: mysql://root:StrongRoot@123@localhost:3306/Super_Market
# Example (remote): mysql://user:pass@192.168.1.100:3306/Super_Market
# Example (with SSL): mysql://user:pass@host:3306/db?ssl=true

# Global/Cloud Database (REQUIRED for Sync to Cloud feature)
MYSQL_GLOBAL_URL=mysql://username:password@host:port/global_database_name
# Example: mysql://root:GlobalPass@123@cloud-db.example.com:3306/Super_Market_Global
# Example (with SSL): mysql://user:pass@host:3306/global_db?ssl=true

# Database Connection Pool Settings (Optional)
MYSQL_POOL_LIMIT=10
MYSQL_POOL_MAX_IDLE=5
MYSQL_POOL_IDLE_TIMEOUT=60000

# Sequelize ORM Settings (Optional)
SEQUELIZE_POOL_MAX=10
SEQUELIZE_POOL_MIN=0
SEQUELIZE_POOL_IDLE=10000
SEQUELIZE_POOL_ACQUIRE=30000
SEQUELIZE_LOGGING=false
SEQUELIZE_SYNC_ALTER=false

# ============================================
# AUTHENTICATION & SECURITY
# ============================================
# JWT Secret (REQUIRED - Use a strong random string in production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRE=7d
# Options: 1h, 24h, 7d, 30d

# Password Hashing (Optional)
BCRYPT_ROUNDS=12
# Recommended: 10-12 for production

# ============================================
# EMAIL CONFIGURATION (Optional)
# ============================================
# Required if using password reset, OTP, or email notifications
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password
# Note: For Gmail, use App Password, not regular password
# Generate at: https://myaccount.google.com/apppasswords

# ============================================
# DOCKER CONFIGURATION (Optional)
# ============================================
# Only needed if running in Docker
DOCKER=false
MYSQL_ROOT_PASSWORD=StrongRoot@123
MYSQL_DATABASE=Super_Market
MYSQL_USER=supermarket_user
MYSQL_PASSWORD=supermarket_password
```

### Frontend `.env` (Inside `frontend/` directory)

Create a `.env` file in the **`frontend/`** directory:

```env
# ============================================
# BACKEND API URL
# ============================================
# Development
VITE_BACKEND_URL=http://localhost:5000

# Production (use your actual backend domain)
# VITE_BACKEND_URL=https://api.yourdomain.com
# VITE_BACKEND_URL=https://murugan-supermarket-backend.onrender.com

# Alternative: Can also use VITE_API_URL
# VITE_API_URL=https://api.yourdomain.com/api
```

---

## 📋 Environment Variables Checklist

### ✅ Required for Backend

- [ ] `NODE_ENV` - Environment mode (development/production)
- [ ] `PORT` - Backend server port (default: 5000)
- [ ] `MYSQL_URL` - Local database connection string
- [ ] `JWT_SECRET` - Secret key for JWT tokens
- [ ] `FRONTEND_URL` - Frontend domain for CORS

### ✅ Required for Sync to Cloud Feature

- [ ] `MYSQL_GLOBAL_URL` - Global/cloud database connection string

### ✅ Optional but Recommended

- [ ] `JWT_EXPIRE` - JWT token expiration (default: 24h)
- [ ] `BCRYPT_ROUNDS` - Password hashing rounds (default: 10)
- [ ] `EMAIL_USER` - Email for notifications (if using email features)
- [ ] `EMAIL_PASS` - Email password/app password

### ✅ Required for Frontend

- [ ] `VITE_BACKEND_URL` - Backend API URL

---

## 🚀 Deployment Steps

### Option 1: Docker Compose (Production)

1. **Prepare Environment**:
   ```bash
   # Create .env file in project root
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Create Docker Volumes** (if not exists):
   ```bash
   docker volume create supermarket-item-img-volume
   docker volume create supermarket_data
   ```

3. **Deploy**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Check Status**:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs -f
   ```

### Option 2: Separate Services

**Backend (Docker)**:
```bash
cd backend
docker build -f Dockerfile.backend -t supermarket-backend .
docker run -d \
  --name supermarket-backend \
  -p 5000:5000 \
  --env-file ../.env \
  -v supermarket-item-img-volume:/super_mart/uploads \
  supermarket-backend
```

**Frontend (Netlify/Render/Vercel)**:
- Build: `cd frontend && pnpm build`
- Deploy `dist/` folder
- Set `VITE_BACKEND_URL` in deployment platform's environment variables

---

## 🔍 Verification

### Check Backend Health
```bash
curl http://localhost:5000/api/health
```

### Check Database Connections
- Backend logs will show:
  - ✅ Connected to MySQL (database: Super_Market)
  - ✅ Connected to Global MySQL (MYSQL_GLOBAL_URL) (database: ...)

### Test Sync to Cloud
1. Login to frontend
2. Navigate to sidebar
3. Find "Sync to Global" button below Reports
4. Click and monitor progress

---

## ⚠️ Important Notes

1. **Security**:
   - Never commit `.env` files to Git
   - Use strong `JWT_SECRET` in production (min 32 characters)
   - Use SSL for database connections in production (`?ssl=true`)

2. **Database URLs Format**:
   ```
   mysql://username:password@host:port/database_name?ssl=true
   ```
   - URL encode special characters in password
   - Use `?ssl=true` for secure connections

3. **Sync Feature**:
   - Requires both `MYSQL_URL` and `MYSQL_GLOBAL_URL`
   - Global DB will auto-create tables from local schema
   - Sync is one-way: Local → Global (never modifies local DB)

4. **Docker Volumes**:
   - `supermarket-item-img-volume`: Stores uploaded item images
   - Must be created before deployment
   - Can be external volume or Docker-managed

---

## 🐛 Troubleshooting

### Database Connection Issues
- Verify MySQL server is running
- Check firewall rules (port 3306)
- Verify credentials in connection string
- Test connection: `mysql -h host -P port -u user -p`

### Sync Not Working
- Check `MYSQL_GLOBAL_URL` is set
- Verify global database is accessible
- Check backend logs for connection errors
- Ensure both databases have network connectivity

### Frontend Can't Connect to Backend
- Verify `VITE_BACKEND_URL` is correct
- Check CORS settings in backend
- Ensure backend is running and accessible
- Check browser console for errors

---

## 📞 Support

For deployment issues, check:
- Backend logs: `docker logs supermarket-backend-prod`
- Frontend logs: `docker logs supermarket-frontend-prod`
- Health endpoint: `http://your-backend/api/health`
- Metrics endpoint: `http://your-backend/api/metrics`

