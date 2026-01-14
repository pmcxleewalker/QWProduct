# Quick Wing Authentication Guide

## 🔐 Authentication System Overview

The Quick Wing Fleet Management App now includes a secure authentication system with role-based access control.

## User Roles

### **Admin Role**
- Full access to all features
- Can manage cars and assistance providers
- Can invite and manage users
- Can change user roles and status
- Can view all data

### **Staff Role**
- Access to Dashboard (view fleet status)
- Access to Bookings (create and view bookings)
- Access to Status Updates (via QR codes)
- Access to Assistance (view breakdown providers)
- **NO access** to Admin Panel

## Default Credentials

**First-time login:**
- Email: `admin@quickwing.com`
- Password: `admin123`

**⚠️ IMPORTANT:** Change this password after first login for security!

## How It Works

### For Administrators

#### 1. **Login**
Visit: `https://quickwing-fleet.preview.emergentagent.com/login`
- Enter your email and password
- Click "Sign In"

#### 2. **Invite New Users (Staff or Admins)**
1. Go to Admin Panel
2. Click "Manage Users" tab
3. Click "Invite User" button
4. Enter user's email address
5. Select role (Staff or Admin)
6. Click "Send Invitation"
7. **Copy the invite link** and send it to the user via email

#### 3. **Manage Users**
- **Change Role**: Use dropdown to switch between Staff/Admin
- **Deactivate**: Temporarily disable user access
- **Activate**: Re-enable inactive users
- **Delete**: Permanently deactivate a user

### For New Staff Members

#### 1. **Receive Invitation**
- Admin will send you an invite link
- Link format: `https://quickwing-fleet.preview.emergentagent.com/register?token=...`

#### 2. **Register**
1. Click the invite link
2. Enter your email address (must match the invitation)
3. Create a password (minimum 6 characters)
4. Confirm your password
5. Click "Create Account"

#### 3. **Login**
- Visit: `https://quickwing-fleet.preview.emergentagent.com/login`
- Use your email and password
- You'll be redirected to the dashboard

## Access Control Matrix

| Feature | Public | Staff | Admin |
|---------|--------|-------|-------|
| Login Page | ✅ | ✅ | ✅ |
| Registration (with invite) | ✅ | ✅ | ✅ |
| Status Update (QR code) | ✅ | ✅ | ✅ |
| Dashboard | ❌ | ✅ | ✅ |
| Bookings | ❌ | ✅ | ✅ |
| Assistance | ❌ | ✅ | ✅ |
| Admin Panel - Cars | ❌ | ❌ | ✅ |
| Admin Panel - Providers | ❌ | ❌ | ✅ |
| Admin Panel - Users | ❌ | ❌ | ✅ |

## Security Features

### ✅ **Implemented**
- JWT-based authentication (7-day token expiry)
- Password hashing with bcrypt
- Role-based access control
- Protected API endpoints
- Invite-only registration
- Session management
- Secure token storage

### 🔒 **Best Practices**
1. Change default admin password immediately
2. Use strong passwords (8+ characters, mixed case, numbers)
3. Don't share login credentials
4. Deactivate users who leave the organization
5. Regularly review user access levels

## Authentication Flow

### **Login Flow**
```
1. User enters email & password
2. Backend verifies credentials
3. JWT token generated (valid 7 days)
4. Token stored in browser localStorage
5. All API requests include token in header
6. User redirected to dashboard
```

### **Registration Flow**
```
1. Admin creates invite with email & role
2. Unique invite token generated
3. Invite URL shared with user
4. User clicks link & registers
5. Token validated (one-time use)
6. Account created with specified role
7. User logged in automatically
```

### **Protected Route Flow**
```
1. User navigates to protected page
2. App checks for valid JWT token
3. If no token → redirect to login
4. If invalid/expired → redirect to login
5. If valid → fetch user data
6. Check role permissions
7. Grant or deny access
```

## API Authentication

### **Public Endpoints** (No auth required)
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/status` (QR code status updates)
- `GET /api/cars/{id}` (for QR code info)
- `GET /api/cars/{id}/qr` (QR code image)

### **Authenticated Endpoints** (Requires login)
- `GET /api/auth/me`
- `GET /api/cars`
- `GET /api/status/live`
- `GET /api/status/history/{car_id}`
- `GET /api/bookings`
- `POST /api/bookings`
- `DELETE /api/bookings/{id}`
- `GET /api/assistance`

### **Admin-Only Endpoints**
- `POST /api/admin/users/invite`
- `GET /api/admin/users`
- `PUT /api/admin/users/{id}`
- `DELETE /api/admin/users/{id}`
- `POST /api/cars`
- `PUT /api/cars/{id}`
- `DELETE /api/cars/{id}`
- `POST /api/assistance`
- `PUT /api/assistance/{id}`
- `DELETE /api/assistance/{id}`

## Troubleshooting

### **"Invalid or expired invite token"**
- Token can only be used once
- Request a new invite from admin

### **"Incorrect email or password"**
- Check for typos
- Email is case-sensitive
- Contact admin to reset account

### **"User account is inactive"**
- Account has been deactivated
- Contact admin to reactivate

### **"Not enough permissions"**
- Your role doesn't allow this action
- Contact admin to upgrade role

### **Session expired**
- JWT tokens expire after 7 days
- Simply log in again

## User Management for Admins

### **Inviting Multiple Users**
1. Create a spreadsheet with emails
2. Invite users one by one
3. Send invite links via email
4. Track who has registered

### **Onboarding New Staff**
1. Create invite with "staff" role
2. Send invite link + welcome instructions
3. User registers with link
4. User can immediately access app
5. Monitor first login in User Management

### **Offboarding Staff**
1. Go to Admin Panel → Manage Users
2. Find user in list
3. Click "Deactivate" or delete icon
4. User immediately loses access

### **Promoting Staff to Admin**
1. Go to Admin Panel → Manage Users
2. Find staff user
3. Change role dropdown to "Admin"
4. User gains admin privileges immediately

## Mobile Access

- All authentication works on mobile devices
- QR code status updates don't require login
- Staff can access dashboard, bookings, assistance on mobile
- Login page is mobile-optimized
- Session persists across mobile browser sessions

## Tips for Your 30-Person Team

### **Recommended Setup**
- **5 Admins** - Full access, can manage everything
- **25 Staff** - Can view/update status, make bookings, access assistance

### **Organization**
1. Create admin accounts first (5 people)
2. Have each admin invite 5 staff members
3. Track invitations in a spreadsheet
4. Set up onboarding process for new staff
5. Regularly review user access in Admin Panel

### **Security Policy**
- Mandate password changes every 90 days
- Deactivate accounts for absent employees
- Use strong passwords
- Don't share credentials
- Report suspicious activity to admins

## Next Steps

1. **Change default admin password** ✅
2. **Invite your first admin users**
3. **Admins invite their teams**
4. **Test with a few staff members**
5. **Roll out to full team**

---

**Need Help?**
- Test with default admin account first
- Check this guide for common issues
- Verify invite links are not expired
- Ensure users are using correct email
