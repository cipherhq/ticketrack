# Country Features Deployment Guide

This guide helps you deploy the country-based feature flag system for Ticketrack.

## 🚀 **Quick Deployment**

### **Option 1: Smart Migration (Recommended)**
Use this if you want to preserve any existing data:

```sql
-- In Supabase SQL Editor:
\i database/country_features_migration.sql
```

### **Option 2: Clean Setup (If migration fails)**
Use this for a fresh start:

```sql
-- In Supabase SQL Editor:
\i database/country_features_simple.sql
```

## 📋 **What Gets Created**

### **Tables:**
- `country_features` - Main feature flags by country
- `feature_categories` - Feature groupings (payments, events, etc.)
- `admin_feature_logs` - Audit trail for admin changes

### **Features by Country:**

| Feature | Nigeria | UK | US | Canada | Ghana |
|---------|---------|----|----|--------|-------|
| SMS Campaigns | ✅ | ❌ | ❌ | ❌ | ❌ |
| WhatsApp | ✅ | ❌ | ❌ | ❌ | ✅ |
| Apple Wallet | ❌ | ✅ | ✅ | ✅ | ❌ |
| KYC Required | ✅ | ❌ | ❌ | ❌ | ❌ |
| GDPR Compliance | ❌ | ✅ | ❌ | ❌ | ❌ |
| Tax Reporting | ❌ | ✅ | ✅ | ✅ | ❌ |
| IoT Integration | ✅ | ✅ | ✅ | ❌ | ❌ |
| API Access | ❌ | ✅ | ✅ | ❌ | ❌ |

*All countries have: Payments, Events, Tickets, Email, Mobile Check-in, Google Wallet*

## 🔧 **Using in Code**

### **Basic Usage:**
```javascript
import { useCountryFeatures } from '@/hooks/useCountryFeatures';

function MyComponent({ currency = 'NGN' }) {
  const { canSendSMS, canUseAppleWallet } = useCountryFeatures(currency);
  
  return (
    <div>
      {canSendSMS && <SMSButton />}
      {canUseAppleWallet && <AppleWalletButton />}
    </div>
  );
}
```

### **Component Wrapper:**
```javascript
import { FeatureGate } from '@/hooks/useCountryFeatures';

<FeatureGate feature="sms_campaigns" currency="NGN">
  <SMSCampaignManager />
</FeatureGate>
```

## 🎛️ **Admin Management**

### **Access the Interface:**
1. Login as admin
2. Navigate to **Admin → System → Country Features**
3. Select country and toggle features
4. Save changes (with audit trail)

### **Bulk Operations:**
- Enable bulk edit mode
- Select multiple features
- Apply changes to all at once

## 🔍 **Verification**

### **Check Setup:**
```sql
-- Count features by country
SELECT 
    country_code,
    COUNT(*) as total_features,
    COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled
FROM country_features
GROUP BY country_code;

-- Check categories
SELECT category, COUNT(*) as feature_count
FROM country_features
GROUP BY category
ORDER BY category;
```

### **Expected Results:**
- **5 countries** (NG, GB, US, CA, GH)
- **30 features** per country
- **8 categories** (payments, events, tickets, etc.)
- **~150 total** feature flags

## ⚠️ **Troubleshooting**

### **"Column feature_name does not exist" Error:**
1. Existing table has wrong structure
2. Use **Option 2** (Simple Setup) instead
3. This will drop and recreate all tables

### **"Permission denied" Error:**
1. Make sure you're logged in as admin in Supabase
2. Run scripts in the SQL Editor, not the database explorer

### **No countries found:**
1. Make sure your `countries` table has active countries
2. Check that `is_active = true` for your countries

### **Frontend not showing features:**
1. Verify the tables exist: `SELECT * FROM country_features LIMIT 5`
2. Check the feature flag context is wrapped around your app
3. Ensure currency/country code is being passed correctly

## 🔄 **Adding New Features**

### **Via Admin Interface:**
1. Go to **Admin → Country Features**
2. Use the interface to toggle existing features

### **Via Database (for new feature types):**
```sql
-- Add a new feature to all countries
INSERT INTO country_features (country_code, feature_name, is_enabled, description, category)
SELECT 
    code, 
    'new_feature_name', 
    true, 
    'Description of new feature',
    'appropriate_category'
FROM countries 
WHERE is_active = true;
```

## 🎯 **Integration Checklist**

- [ ] Database tables created successfully
- [ ] Admin interface accessible at `/admin/country-features`
- [ ] Feature flags working in frontend components
- [ ] Country-specific features showing correctly
- [ ] Audit logs recording admin changes
- [ ] Bulk operations working
- [ ] Search and filtering functional

## 📞 **Support**

If you encounter issues:
1. Check the verification queries above
2. Review the troubleshooting section
3. Try the simple setup if migration fails
4. Ensure proper admin permissions in Supabase

**The system is designed to be region-compliant and business-scalable!** 🌍