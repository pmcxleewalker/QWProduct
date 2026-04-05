# Quick Wing Feature Tiers Reference

## Plan Pricing
| Plan | Price | Vehicles | Users | Credits/mo |
|------|-------|----------|-------|------------|
| Standard | €179/mo | 10 | 15 | 1 |
| Essential | €299/mo | 25 | 35 | 2 |
| Professional | €499/mo | 50 | 50 | 4 |

---

## Feature Matrix

### Core Features (All Plans)
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Vehicle Booking | ✅ | ✅ | ✅ | Included |
| Fleet Compliance | ✅ | ✅ | ✅ | Included |
| Basic Reports | ✅ | ✅ | ✅ | Included |
| Staff Calendars | ✅ | ✅ | ✅ | Included |
| Admin All Cars Calendar | ✅ | ✅ | ✅ | Included |
| Email Support | ✅ | ✅ | ✅ | Included |
| Standard Onboarding | ✅ | ✅ | ✅ | Included |

### Booking Features
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Enhanced Booking Visibility | ❌ | ✅ | ✅ | €19/mo |
| Admin Booking Control | ❌ | ✅ | ✅ | €25/mo |
| Recurring Bookings | ❌ | ✅ | ✅ | €25/mo |

### Reports & Analytics
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Enhanced Reports | ❌ | ✅ | ✅ | €29/mo |
| Cost Analytics | ❌ | ✅ | ✅ | €39/mo |
| Detailed Reports | ❌ | ❌ | ✅ | €49/mo |
| Custom Exports | ❌ | ❌ | ✅ | €25/mo |
| Daily Timeline View | ❌ | ❌ | ✅ | €29/mo |

### Fleet Management
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| QR Codes | ❌ | ✅ | ✅ | €15/mo |
| Block/Unblock Vehicles | ❌ | ✅ | ✅ | €10/mo |
| Live Status Updates | ❌ | ✅ | ✅ | €19/mo |
| Status History | ❌ | ❌ | ✅ | €19/mo |

### Compliance & Tracking
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Compliance Oversight | ❌ | ✅ | ✅ | €35/mo |
| Mileage Tracking | ❌ | ❌ | ✅ | €25/mo |

### Administration
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Multi-Site Oversight | ❌ | ❌ | ✅ | €59/mo |
| Advanced Permissions | ❌ | ❌ | ✅ | €35/mo |
| User Management | ❌ | ❌ | ✅ | €29/mo |

### Support
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Faster Support (24hr) | ❌ | ✅ | ✅ | €15/mo |
| Priority Support (4hr) | ❌ | ❌ | ✅ | €45/mo |

### Communication
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| Announcements | ❌ | ❌ | ✅ | €15/mo |

### Integrations
| Feature | Standard | Essential | Professional | Addon Price |
|---------|----------|-----------|--------------|-------------|
| API Access | ❌ | ❌ | ✅ | €99/mo |

---

## How to Manage Features

### Via Franchise Command Centre
1. Go to **Subscriptions** tab
2. Scroll to **Manage Franchise Plans & Features**
3. Click on any franchise card
4. In the modal:
   - Change their subscription plan
   - Override max vehicles/users limits
   - Toggle individual features on/off
   - Use/reset customization credits

### Feature Override Rules
- Overrides are highlighted in **blue**
- Features "Not in plan" show an **orange** tag
- Addon prices shown in **green**
- Toggles save when you click **Save Changes**

### API Endpoints
- `GET /api/platform/feature-registry` - Get all features with metadata
- `GET /api/platform/tenants/{id}/features` - Get tenant's effective features
- `PUT /api/platform/tenants/{id}/features` - Update feature overrides

---

## Database Schema

### Tenant Feature Storage
```json
{
  "id": "tenant-uuid",
  "plan": "standard",
  "feature_overrides": {
    "enhanced_reports": true,    // Addon enabled
    "recurring_bookings": true   // Addon enabled
  },
  "max_vehicles": 15,           // Override from plan default
  "max_users": 20               // Override from plan default
}
```

### Feature Registry Structure
```json
{
  "feature_key": {
    "name": "Display Name",
    "description": "What this feature does",
    "category": "reports|bookings|fleet|admin|support|core",
    "default_plans": ["standard", "essential", "professional"],
    "sellable": true,
    "addon_price": 29
  }
}
```

---

*Last Updated: March 2026*
