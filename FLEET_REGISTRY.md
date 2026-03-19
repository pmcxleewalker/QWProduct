# Quick Wing Fleet - Car Registry & QR Codes

## 🚗 Sample Fleet Created (5 Vehicles)

All vehicles are ready for immediate use with QR codes generated!

---

## Vehicle 1: Toyota Corolla
**Registration:** 21-KY-1234  
**Status:** Free  
**Car ID:** `1e1aad5c-c5be-45be-9e61-bfad17731dfe`

**QR Code Download:**  
https://brand-center-5.preview.emergentagent.com/api/cars/1e1aad5c-c5be-45be-9e61-bfad17731dfe/qr

**Direct Status Update Link:**  
https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing

---

## Vehicle 2: Ford Transit Van
**Registration:** 22-KY-5678  
**Status:** Free  
**Car ID:** `e5c92bc8-c69f-4f53-b532-1fe85a86b59a`

**QR Code Download:**  
https://brand-center-5.preview.emergentagent.com/api/cars/e5c92bc8-c69f-4f53-b532-1fe85a86b59a/qr

**Direct Status Update Link:**  
https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing

---

## Vehicle 3: Volkswagen Caddy
**Registration:** 20-WC-9012  
**Status:** Free  
**Car ID:** `6edbedac-575b-4447-bb9c-5fd5f4403225`

**QR Code Download:**  
https://brand-center-5.preview.emergentagent.com/api/cars/6edbedac-575b-4447-bb9c-5fd5f4403225/qr

**Direct Status Update Link:**  
https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing

---

## Vehicle 4: Nissan Qashqai
**Registration:** 23-KY-3456  
**Status:** Free  
**Car ID:** `87e963ce-9009-42e7-92a4-1a5764d768e3`

**QR Code Download:**  
https://brand-center-5.preview.emergentagent.com/api/cars/87e963ce-9009-42e7-92a4-1a5764d768e3/qr

**Direct Status Update Link:**  
https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing

---

## Vehicle 5: Renault Kangoo
**Registration:** 21-WC-7890  
**Status:** Free  
**Car ID:** `4792ed88-9fc6-48be-adfb-e17e21d843a0`

**QR Code Download:**  
https://brand-center-5.preview.emergentagent.com/api/cars/4792ed88-9fc6-48be-adfb-e17e21d843a0/qr

**Direct Status Update Link:**  
https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing

---

## 📱 How to Use QR Codes

### Option 1: Print QR Codes
1. Click each "QR Code Download" link above
2. Right-click the QR code image
3. Save as PNG file
4. Print and place in each vehicle

### Option 2: Test with Mobile
1. Open any "Direct Status Update Link" on your phone
2. Update the vehicle status
3. Check the dashboard to see real-time updates

### Option 3: Download from Admin Panel
1. Login at: https://brand-center-5.preview.emergentagent.com/login
2. Go to Admin Panel → Manage Cars
3. Click the "QR" button next to each vehicle
4. Download and print

---

## 🎯 Quick Test Instructions

### Test the System Right Now:

1. **View Dashboard:**
   - Login: https://brand-center-5.preview.emergentagent.com/login
   - Email: `admin@quickwing.com`
   - Password: `admin123`
   - You'll see all 5 vehicles on the dashboard

2. **Test Status Update (No Login Required):**
   - Open this link: https://brand-center-5.preview.emergentagent.com/status-update?car=quickwing
   - Change status to "In Use"
   - Add a note
   - Submit
   - Check dashboard - it updates in real-time!

3. **Test Booking:**
   - Login to the app
   - Go to Bookings page
   - Click "New Booking"
   - Select Toyota Corolla
   - Choose date/time
   - Submit

4. **Download QR Code:**
   - Login to Admin Panel
   - Go to Manage Cars
   - Click QR button next to any car
   - QR code downloads as PNG

---

## 📋 Adding More Vehicles

### Via Admin Panel (Recommended):
1. Login to app
2. Go to Admin Panel → Manage Cars
3. Click "Add Car"
4. Enter vehicle name and registration
5. Click "Create Car"
6. QR code is automatically generated!

### Via API (For Bulk Import):
```bash
TOKEN="your-jwt-token"

curl -X POST https://brand-center-5.preview.emergentagent.com/api/cars \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Car Name",
    "registration": "REG-NUMBER",
    "current_status": "Free"
  }'
```

---

## 🔄 Real Registration Numbers

**Current registrations are Kerry (KY) and West Cork (WC) format:**
- 21-KY-1234
- 22-KY-5678
- 20-WC-9012
- 23-KY-3456
- 21-WC-7890

**To update with your real fleet:**
1. Login to Admin Panel
2. Go to Manage Cars
3. Click "Edit" on each vehicle
4. Update with actual registration numbers
5. Save changes

---

## 🖨️ Printing QR Codes

### Recommended Format:
- **Size:** 5cm x 5cm (readable from 30cm distance)
- **Paper:** Laminated sticker paper (weather-resistant)
- **Placement:** Inside windscreen or on dashboard

### Label Template:
```
┌─────────────────────┐
│                     │
│   [QR CODE HERE]    │
│                     │
│  Toyota Corolla     │
│  21-KY-1234         │
│                     │
│  Scan to update     │
│  vehicle status     │
└─────────────────────┘
```

---

## 📊 Current Fleet Summary

| Vehicle | Registration | Status | QR Generated |
|---------|-------------|--------|--------------|
| Toyota Corolla | 21-KY-1234 | Free | ✅ |
| Ford Transit Van | 22-KY-5678 | Free | ✅ |
| Volkswagen Caddy | 20-WC-9012 | Free | ✅ |
| Nissan Qashqai | 23-KY-3456 | Free | ✅ |
| Renault Kangoo | 21-WC-7890 | Free | ✅ |

**Total Vehicles:** 5  
**All QR Codes:** Ready for download  
**Status:** Ready for immediate use

---

## ✅ Ready to Use!

Your Quick Wing fleet is now set up with 5 sample vehicles, all with QR codes ready to download and print!

**Next Steps:**
1. Login and view the dashboard
2. Download QR codes for each vehicle
3. Print and laminate
4. Place in vehicles
5. Start tracking status!
