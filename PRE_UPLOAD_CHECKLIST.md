# Pre-Upload Checklist for EC2 Deployment

## ✅ Security Checks

### 1. Environment Files
- [x] `.gitignore` excludes all `.env` files
- [x] `.deployignore` excludes `envfiles/*.env`
- [x] No hardcoded credentials in source code
- [x] All secrets use environment variables

### 2. Hardcoded Values Fixed
- [x] Removed hardcoded IP addresses from `src/config/api.ts`
- [x] Removed hardcoded IP addresses from `src/App.tsx`
- [x] Now uses `VITE_API_URL` and `VITE_WS_URL` environment variables

## ✅ Build Configuration

### 1. Memory Settings
- [x] Build scripts use `NODE_OPTIONS=--max-old-space-size=2048` (2GB)
- [x] Compatible with your EC2 instance (1GB RAM + 2GB swap)
- [x] Uses `cross-env` for Windows/Linux compatibility

### 2. Postinstall Script
- [x] Disabled auto-build on `npm install` (prevents build failures before env setup)
- [x] Manual build required: `npm run build`

## ✅ Files to Exclude (Already in .deployignore)

- [x] `node_modules/` - Install on EC2
- [x] `dist/` - Build on EC2
- [x] `envfiles/*.env` - Create separately on EC2
- [x] `.git/` - Not needed on server
- [x] `.vscode/` - IDE files
- [x] `cookies.txt` - Temporary files
- [x] `ecosystem.config.cjs_old` - Old backup

## 📋 Deployment Steps on EC2

### 1. Upload Project
```bash
# Use rsync or scp, excluding files in .deployignore
rsync -avz --exclude-from='.deployignore' ./ user@ec2-ip:/path/to/app/
```

### 2. Install Dependencies
```bash
cd /path/to/app
npm install --production
```

### 3. Create Environment Files
```bash
# Create envfiles/prod.env with your production credentials
nano envfiles/prod.env
```

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `SESSION_SECRET` - Session encryption secret
- `AWS_ACCESS_KEY_ID` - AWS S3 access key
- `AWS_SECRET_ACCESS_KEY` - AWS S3 secret key
- `S3_BUCKET_NAME` - S3 bucket name
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis configuration (if using)

**Frontend Environment Variables (create `.env` file in root):**
- `VITE_API_URL` - Backend API URL (e.g., `http://your-ec2-ip:5000`)
- `VITE_WS_URL` - WebSocket URL (e.g., `http://your-ec2-ip:5000`)

### 4. Build Project
```bash
npm run build
```

### 5. Start Application
```bash
# Option 1: Direct start
npm start

# Option 2: Using PM2 (recommended)
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## ⚠️ Important Notes

1. **IP Addresses**: Update `VITE_API_URL` and `VITE_WS_URL` in `.env` file on EC2 with your actual EC2 IP/domain
2. **CORS**: Update `ALLOWED_ORIGINS` in `envfiles/prod.env` with your frontend URL
3. **Database**: Ensure your RDS database allows connections from EC2 security group
4. **Ports**: Ensure ports 5000 (backend) and 5173 (frontend) are open in EC2 security group
5. **Memory**: Your EC2 has 1GB RAM + 2GB swap, which should be sufficient for the build

## 🔍 Code Quality Checks

- [x] No hardcoded credentials
- [x] Environment variables properly used
- [x] Build scripts configured correctly
- [x] TypeScript configuration valid
- [x] All dependencies listed in package.json

## 📝 Files Modified for Deployment

1. `package.json` - Updated build scripts with memory limits and disabled postinstall
2. `src/config/api.ts` - Now uses `VITE_API_URL` environment variable
3. `src/App.tsx` - Now uses `VITE_WS_URL` environment variable
4. `src/vite-env.d.ts` - Added `VITE_WS_URL` type definition

## ✅ Ready to Upload!


