# 🚀 Proxycurl Setup - SO MUCH EASIER!

## ✅ **Why Proxycurl is Better:**

| Feature | PhantomBuster | Proxycurl |
|---------|---------------|-----------|
| Setup | ❌ Create agents, manage cookies | ✅ Just API key |
| Speed | 30-60 seconds | **5-10 seconds** |
| Maintenance | ❌ Cookies expire every 30 days | ✅ Zero maintenance |
| API Calls | Multiple (launch, poll, fetch) | ✅ **ONE call** |
| Free Tier | Limited | ✅ **10 credits/month FREE** |
| Reliability | ❌ Cookie issues | ✅ Very reliable |

---

## 🎯 **Setup Steps (5 minutes):**

### **Step 1: Get Free API Key**

1. Go to: **https://nubela.co/proxycurl/**
2. Click **"Get Started Free"** or **"Sign Up"**
3. Create account (email + password)
4. Verify your email
5. Go to dashboard
6. Copy your **API Key** (looks like: `abc123...`)

**Free tier: 10 credits/month** (perfect for testing!)

---

### **Step 2: Add API Key to Your App**

Edit `/backend/.env`:

```bash
# Proxycurl API (simpler LinkedIn scraping)
PROXYCURL_API_KEY=YOUR_API_KEY_HERE
```

Paste your actual API key from step 1.

---

### **Step 3: Restart Backend**

```bash
cd /Users/vartikapandey/Desktop/Hackathon/backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

---

### **Step 4: Test It!**

1. Open: http://localhost:5173
2. Go to any prospect → Outreach tab
3. Enter LinkedIn URL: `https://www.linkedin.com/in/sukanya-patil-41b720134/`
4. Click **"Fetch Data"**
5. **Wait 5-10 seconds** (not 30-60!)
6. **Data auto-populates!** ✨

---

## 🎉 **That's It!**

No agents to create ✅  
No cookies to manage ✅  
No 30-day maintenance ✅  
Just works! ✅  

---

## 💰 **Pricing:**

- **Free:** 10 credits/month
- **Starter:** $79/month - 100 credits
- **Pro:** $299/month - 500 credits
- **Enterprise:** Custom pricing

**1 credit = 1 profile scrape**

**For your use case:**
- Testing: FREE tier is perfect
- Light use: 10 prospects/month
- Heavy use: Upgrade as needed

---

## 🔍 **What You Get:**

Proxycurl returns EVERYTHING:
- ✅ Full name
- ✅ Headline
- ✅ Summary/Bio
- ✅ Current position
- ✅ Work experience (all jobs)
- ✅ Education
- ✅ Skills
- ✅ Languages
- ✅ Connections count
- ✅ Follower count
- ✅ Activities (posts)
- ✅ **Even personal email/phone** (if available)
- ✅ Social profiles (Twitter, GitHub, etc.)

**Way more data than PhantomBuster!**

---

## 🧪 **Test Your API Key:**

```bash
curl -X GET \
  "https://nubela.co/proxycurl/api/v2/linkedin?url=https://www.linkedin.com/in/williamhgates" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

Should return Bill Gates' LinkedIn profile in JSON!

---

## 🐛 **Troubleshooting:**

### **"PROXYCURL_API_KEY not set"**
→ Make sure you edited `/backend/.env` and added your key

### **"Invalid API key"**
→ Check you copied the full key from Proxycurl dashboard

### **"Rate limit exceeded"**
→ You used all 10 free credits. Wait for next month or upgrade.

### **"Profile not found"**
→ The LinkedIn profile is private or the URL is wrong

---

## 📊 **Comparison: Before vs After**

### **PhantomBuster (OLD):**
```
1. Create PhantomBuster account
2. Create "LinkedIn Profile Scraper" agent
3. Configure agent with cookie
4. Get cookie from browser
5. Add cookie to agent
6. Get agent ID
7. Update code with agent ID
8. Launch agent via API
9. Wait 30-60 seconds
10. Poll for completion
11. Fetch results
12. Manage cookie expiration every 30 days

Total: 30-60 seconds + maintenance
```

### **Proxycurl (NEW):**
```
1. Get API key from Proxycurl
2. Add to .env
3. One API call
4. Get data back in 5-10 seconds

Total: 5-10 seconds + ZERO maintenance
```

---

## ✨ **Ready to Go!**

1. Get API key: https://nubela.co/proxycurl/
2. Add to `.env`
3. Restart backend
4. **IT JUST WORKS!** 🎉

**No agents, no cookies, no hassle!** 🚀

---

## 📚 **Resources:**

- **Docs:** https://nubela.co/proxycurl/docs
- **Pricing:** https://nubela.co/proxycurl/pricing
- **Dashboard:** https://nubela.co/proxycurl/dashboard

---

**Questions? Just ask!** 🎊
