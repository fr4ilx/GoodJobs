# Adding Collaborators to Firebase Project

## 🎯 Quick Steps

### 1. Add as Firebase Project Owner

1. Go to: https://console.firebase.google.com/project/goodjobs-5f53a/settings/iam
2. Click **"Add member"**
3. Enter their **Google email address**
4. Select role: **"Owner"**
5. Click **"Add member"**

### 2. Add Billing Permissions

1. Go to: https://console.cloud.google.com/billing
2. Select project: **goodjobs-5f53a**
3. Click **"Account management"** (left sidebar)
4. Click **"Add principal"**
5. Enter their **Google email address**
6. Select role: **"Billing Account Administrator"**
7. Click **"Save"**

## 📧 What Happens Next

Your collaborator will receive **2 emails**:
1. **Firebase invitation** - Accept to access Firebase Console
2. **Google Cloud billing invitation** - Accept to manage billing

They should accept both invitations.

## ✅ Verify Access

Have your collaborator check:
- [ ] Can access: https://console.firebase.google.com/project/goodjobs-5f53a
- [ ] Can see billing: Settings → Usage and billing → Modify plan
- [ ] Can add payment method

## 🔐 Permission Levels

### Owner (Full Access)
✅ Manage billing
✅ Add/remove team members
✅ Configure all Firebase services
✅ Delete project
✅ View all data

**Use for:** Co-founders, leads

### Editor (Development Access)
✅ Configure Firebase services
✅ Deploy code
✅ View data
❌ Manage billing
❌ Add/remove members

**Use for:** Developers, contributors

### Viewer (Read-Only)
✅ View configuration
✅ View analytics
❌ Make any changes
❌ Access billing

**Use for:** Stakeholders, clients

## 💳 Setting Up Billing (For New Owner)

Once they have access:

1. **Go to Firebase Console** → **Settings** → **Usage and billing**
2. Click **"Modify plan"**
3. Select **"Blaze Plan"** (Pay as you go)
4. Click **"Continue"**
5. Add payment method (credit/debit card)
6. Set budget alerts:
   - $5 - Early warning
   - $10 - Action needed
   - $25 - Emergency

## 📊 Expected Costs

### Free Tier (Spark Plan)
- Authentication: 50K monthly active users
- Firestore: 50K reads, 20K writes, 20K deletes per day
- Storage: 1GB, 10GB transfer per day

### Blaze Plan (Pay as you go)
Includes free tier, then:
- **Firestore**: ~$0.06 per 100K reads
- **Storage**: ~$0.026 per GB
- **Authentication**: Free for most use cases

**Typical monthly cost for small app**: $0-5

## 🚨 Important Notes

1. **Only add people you trust** as Owner - they can delete the project
2. **Set up budget alerts** immediately after adding billing
3. **Firebase client keys are public** - it's safe to share the config
4. **Security Rules protect your data** - not the API keys

## 🔄 Removing Access

If needed, you can remove access:

1. Go to: https://console.firebase.google.com/project/goodjobs-5f53a/settings/iam
2. Find the member
3. Click the three dots → **"Remove member"**

## 📚 Additional Resources

- Firebase IAM: https://firebase.google.com/docs/projects/iam/overview
- Billing docs: https://firebase.google.com/pricing
- Security best practices: https://firebase.google.com/docs/rules
