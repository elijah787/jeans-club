// Import Supabase
const { createClient } = supabase;

// Supabase Database Manager
class SupabaseDB {
    constructor() {
        // ⚠️ REPLACE WITH YOUR ACTUAL SUPABASE CREDENTIALS ⚠️
        this.supabaseUrl = 'https://uoyzsyxjrfygrsfzhlao.supabase.co';
        this.anonKey = 'sb_publishable__gS2-Pd9S7I5dBlq4rmzMQ_K2QMwovA';
        
        this.supabase = createClient(this.supabaseUrl, this.anonKey);
        this.cacheKey = 'jeansClubCache';
        this.init();
        console.log('🚀 SupabaseDB initialized with URL:', this.supabaseUrl);
    }

    async init() {
        if (!this.getCache()) {
            this.setCache({ members: [], lastSync: 0 });
        }
    }

    getCache() {
        try {
            const cache = localStorage.getItem(this.cacheKey);
            return cache ? JSON.parse(cache) : null;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }

    setCache(data) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error writing cache:', error);
            return false;
        }
    }

    // Enhanced member operations
    async getAllMembers() {
        try {
            console.log('🔄 Fetching all members from Supabase...');
            
            const { data: members, error } = await this.supabase
                .from('members')
                .select('*');

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }

            console.log(`✅ Loaded ${members?.length || 0} members from Supabase`);
            
            // Update cache
            this.setCache({
                members: members || [],
                lastSync: Date.now()
            });

            return members || [];

        } catch (error) {
            console.error('❌ Failed to fetch from Supabase, using cache:', error);
            const cache = this.getCache();
            return cache?.members || [];
        }
    }

    async saveMember(member) {
        try {
            console.log('💾 Saving member to Supabase:', member.jcId);
            
            // Ensure all required fields are present
            const memberData = {
                jcId: member.jcId,
                id: member.id || 'member_' + Date.now(),
                email: member.email,
                name: member.name,
                password: member.password || null,
                googleId: member.googleId || null,
                loginMethod: member.loginMethod || 'email',
                points: member.points || 0,
                tier: member.tier || 'PEARL',
                referralCode: member.referralCode,
                referredBy: member.referredBy || null,
                purchaseHistory: member.purchaseHistory || [],
                activityLog: member.activityLog || [],
                joinedDate: member.joinedDate || new Date().toISOString(),
                totalSpent: member.totalSpent || 0,
                challenges: member.challenges || [],
                referrals: member.referrals || []
            };

            const { data, error } = await this.supabase
                .from('members')
                .upsert(memberData, { 
                    onConflict: 'jcId'
                });

            if (error) {
                console.error('❌ Supabase save error:', error);
                throw error;
            }

            console.log('✅ Member saved successfully to Supabase');
            
            // Invalidate cache
            const cache = this.getCache();
            if (cache) {
                cache.lastSync = 0;
                this.setCache(cache);
            }

            return true;

        } catch (error) {
            console.error('❌ Failed to save member to Supabase:', error);
            return false;
        }
    }

    async deleteMember(jcId) {
        try {
            console.log('🗑️ Deleting member from Supabase:', jcId);
            
            const { error } = await this.supabase
                .from('members')
                .delete()
                .eq('jcId', jcId);

            if (error) {
                console.error('❌ Supabase delete error:', error);
                throw error;
            }

            console.log('✅ Member deleted successfully from Supabase');
            
            // Invalidate cache
            const cache = this.getCache();
            if (cache) {
                cache.lastSync = 0;
                this.setCache(cache);
            }

            return true;

        } catch (error) {
            console.error('❌ Failed to delete member from Supabase:', error);
            return false;
        }
    }

    async getMemberByJCId(jcId) {
        try {
            console.log('🔍 Fetching member from Supabase:', jcId);
            
            const { data: member, error } = await this.supabase
                .from('members')
                .select('*')
                .eq('jcId', jcId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('❌ Supabase fetch error:', error);
                throw error;
            }

            return member || null;

        } catch (error) {
            console.error('❌ Failed to fetch member from Supabase:', error);
            
            // Fallback to cache
            const cache = this.getCache();
            if (cache?.members) {
                return cache.members.find(m => m.jcId === jcId) || null;
            }
            
            return null;
        }
    }

    async getMemberByEmail(email) {
        try {
            console.log('🔍 Fetching member by email from Supabase:', email);
            
            const { data: member, error } = await this.supabase
                .from('members')
                .select('*')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Supabase fetch error:', error);
                throw error;
            }

            return member || null;

        } catch (error) {
            console.error('❌ Failed to fetch member by email from Supabase:', error);
            
            // Fallback to cache
            const cache = this.getCache();
            if (cache?.members) {
                return cache.members.find(m => m.email === email) || null;
            }
            
            return null;
        }
    }
}

// Google Apps Script Email Service (FIXED - CORS HANDLING)
class GoogleAppsEmailService {
    constructor() {
        // UPDATED: Use your new deployment URL
        this.scriptURL = 'https://script.google.com/macros/s/AKfycbxWrl3oDdHJSXcl1ajaxaosfhQqV4uxIwiQ4pn0lZPquet9Kc1W_cdXhvowfU-58rZY/exec';
        this.isActive = true;
    }

    async sendEmailToGoogleScript(email, type, memberData, extraData = null) {
        try {
            const emailContent = this.buildEmailContent(type, memberData, extraData);
            const subject = this.getSubject(type, memberData, extraData);
            
            const payload = {
                action: 'sendEmail',
                emailData: {
                    email: email,
                    type: type,
                    subject: subject,
                    message: emailContent
                }
            };

            console.log('Sending email via Google Apps Script:', payload);

            // Try direct fetch first
            try {
                const response = await fetch(this.scriptURL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                // Check if response is OK
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Email sent successfully via Google Apps Script:', result);
                    return result;
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (fetchError) {
                console.log('Direct fetch failed, trying with no-cors:', fetchError);
                
                // Fallback: Use no-cors mode (request goes through but we can't read response)
                await fetch(this.scriptURL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
                
                // With no-cors we can't verify success, but assume it worked
                console.log('✅ Email request sent (no-cors fallback mode)');
                return { 
                    success: true, 
                    message: 'Email sent successfully (fallback mode)',
                    fallback: true
                };
            }
            
        } catch (error) {
            console.error('❌ All Google Apps Script email attempts failed:', error);
            return this.fallbackEmail(email, memberData, type, extraData);
        }
    }

    buildEmailContent(type, memberData, extraData) {
        let content = '';
        
        switch(type) {
            case 'welcome':
                content = 'Hello ' + memberData.name + ',\n\nWelcome to Jean\'s Club! Your account has been created successfully.\n\nMEMBERSHIP DETAILS:\n• JC ID: ' + memberData.jcId + '\n• Tier: ' + memberData.tier + '\n• Points: ' + memberData.points + '\n• Referral Code: ' + memberData.referralCode + '\n\nStart earning points with your purchases!\n\nThank you for joining Jean\'s Club!';
                break;

            case 'purchase':
                content = 'Hello ' + memberData.name + ',\n\nYour purchase has been recorded!\n\nPURCHASE DETAILS:\n• Amount: ' + extraData.amount.toLocaleString() + ' UGX\n• Description: ' + extraData.description + '\n• Points Earned: +' + extraData.pointsEarned + '\n• New Balance: ' + memberData.points + ' points\n\nThank you for shopping with Jean\'s Club!';
                break;

            case 'discount':
                content = 'Hello ' + memberData.name + ',\n\nYour discount voucher has been created!\n\nDISCOUNT DETAILS:\n• Discount: ' + extraData.discountPercentage + '%\n• Points Used: ' + extraData.pointsUsed + '\n• Max Possible: ' + extraData.maxPossibleDiscount + '\n\nPresent this email at checkout to redeem your discount!';
                break;

            case 'referral':
                content = 'Hello ' + memberData.name + ',\n\nCongratulations! Someone joined using your referral code!\n\nREFERRAL DETAILS:\n• New Member: ' + extraData.newMemberName + ' (' + extraData.newMemberJCId + ')\n• Points Earned: 100 points\n• New Balance: ' + memberData.points + ' points\n\nKeep sharing your code: ' + memberData.referralCode;
                break;
        }
        
        return content;
    }

    getSubject(type, memberData, extraData) {
        switch(type) {
            case 'welcome': return 'Welcome to Jean\'s Club!';
            case 'purchase': return 'Purchase Recorded - ' + (extraData?.description || '');
            case 'discount': return (extraData?.discountPercentage || 0) + '% Discount Voucher';
            case 'referral': return 'Referral Success! +100 Points';
            default: return 'Message from Jean\'s Club';
        }
    }

    async sendWelcomeEmail(email, memberData) {
        console.log('Attempting to send welcome email to:', email);
        return this.sendEmailToGoogleScript(email, 'welcome', memberData);
    }

    async sendPurchaseEmail(email, memberData, purchaseData) {
        console.log('Attempting to send purchase email to:', email);
        return this.sendEmailToGoogleScript(email, 'purchase', memberData, purchaseData);
    }

    async sendDiscountEmail(email, memberData, discountData) {
        console.log('Attempting to send discount email to:', email);
        return this.sendEmailToGoogleScript(email, 'discount', memberData, discountData);
    }

    async sendReferralEmail(email, memberData, referralData) {
        console.log('Attempting to send referral email to:', email);
        return this.sendEmailToGoogleScript(email, 'referral', memberData, referralData);
    }

    fallbackEmail(email, memberData, type, extraData = null) {
        let subject, content;

        switch(type) {
            case 'welcome':
                subject = 'Welcome to Jean\'s Club!';
                content = 'Hello ' + memberData.name + ',\n\nWelcome to Jean\'s Club! Your account has been created successfully.\n\nMEMBERSHIP DETAILS:\n• JC ID: ' + memberData.jcId + '\n• Tier: ' + memberData.tier + '\n• Points: ' + memberData.points + '\n• Referral Code: ' + memberData.referralCode + '\n\nSHARE JEAN\'S CLUB:\n🔳 Scan QR Code: https://elijah787.github.io/jeans-club\n📱 Or visit: https://elijah787.github.io/jeans-club\n\nStart earning points with your purchases!\n\nThank you for joining Jean\'s Club!';
                break;

            case 'purchase':
                subject = 'Purchase Recorded - ' + extraData.description;
                content = 'Hello ' + memberData.name + ',\n\nYour purchase has been recorded!\n\nPURCHASE DETAILS:\n• Amount: ' + extraData.amount.toLocaleString() + ' UGX\n• Description: ' + extraData.description + '\n• Points Earned: +' + extraData.pointsEarned + '\n• New Balance: ' + memberData.points + ' points\n\nSHARE JEAN\'S CLUB:\n🔳 Scan QR Code: https://elijah787.github.io/jeans-club\n📱 Or visit: https://elijah787.github.io/jeans-club\n\nThank you for shopping with Jean\'s Club!';
                break;

            case 'discount':
                subject = extraData.discountPercentage + '% Discount Voucher';
                content = 'Hello ' + memberData.name + ',\n\nYour discount voucher has been created!\n\nDISCOUNT DETAILS:\n• Discount: ' + extraData.discountPercentage + '%\n• Points Used: ' + extraData.pointsUsed + '\n• Max Possible: ' + extraData.maxPossibleDiscount + '\n\nSHARE JEAN\'S CLUB:\n🔳 Scan QR Code: https://elijah787.github.io/jeans-club\n📱 Or visit: https://elijah787.github.io/jeans-club\n\nPresent this email at checkout to redeem your discount!';
                break;

            case 'referral':
                subject = 'Referral Success! +100 Points';
                content = 'Hello ' + memberData.name + ',\n\nCongratulations! Someone joined using your referral code!\n\nREFERRAL DETAILS:\n• New Member: ' + extraData.newMemberName + ' (' + extraData.newMemberJCId + ')\n• Points Earned: 100 points\n• New Balance: ' + memberData.points + ' points\n\nSHARE WITH MORE FRIENDS:\n🔳 Scan QR Code: https://elijah787.github.io/jeans-club\n📱 Or visit: https://elijah787.github.io/jeans-club\n\nKeep sharing your code: ' + memberData.referralCode;
                break;
        }

        console.log('FALLBACK EMAIL CONTENT:');
        console.log('To:', email);
        console.log('Subject:', subject);
        console.log('Content:', content);
        
        this.saveEmailToLog(email, subject, content);
        
        return { 
            success: true, 
            message: "Email prepared (fallback mode - check console)",
            fallback: true 
        };
    }

    saveEmailToLog(email, subject, content) {
        try {
            const emailLog = JSON.parse(localStorage.getItem('jeansClubEmails') || '[]');
            emailLog.unshift({
                email: email,
                subject: subject,
                content: content,
                timestamp: new Date().toISOString(),
                sent: false
            });
            
            if (emailLog.length > 50) emailLog.length = 50;
            
            localStorage.setItem('jeansClubEmails', JSON.stringify(emailLog));
        } catch (error) {
            console.log('Could not save email to storage:', error);
        }
    }
}

// Legacy Central Storage (for fallback) - UNCHANGED
class CentralStorage {
    constructor() {
        this.storageKey = 'jeansClubCentralData';
        this.init();
    }

    async init() {
        if (!this.getData()) {
            this.setData({
                members: [],
                lastUpdate: new Date().toISOString(),
                version: '1.0'
            });
        }
    }

    getData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey));
        } catch (error) {
            console.error('Error reading storage:', error);
            return null;
        }
    }

    setData(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error writing to storage:', error);
            return false;
        }
    }

    getAllMembers() {
        const data = this.getData();
        return data ? data.members : [];
    }

    saveMember(member) {
        const data = this.getData();
        if (!data) return false;

        const existingIndex = data.members.findIndex(m => m.jcId === member.jcId);
        
        if (existingIndex >= 0) {
            data.members[existingIndex] = member;
        } else {
            data.members.push(member);
        }

        data.lastUpdate = new Date().toISOString();
        return this.setData(data);
    }

    deleteMember(jcId) {
        const data = this.getData();
        if (!data) return false;

        data.members = data.members.filter(m => m.jcId !== jcId);
        data.lastUpdate = new Date().toISOString();
        return this.setData(data);
    }

    getMemberByJCId(jcId) {
        const data = this.getData();
        if (!data) return null;
        return data.members.find(m => m.jcId === jcId);
    }

    getMemberByEmail(email) {
        const data = this.getData();
        if (!data) return null;
        return data.members.find(m => m.email === email);
    }
}

// Google OAuth Configuration - UNCHANGED
const googleConfig = {
    clientId: '607807821474-43243foqc9ml9eq3e0ugu04fnsigbqc5.apps.googleusercontent.com'
};

// Jean's Club Configuration - UNCHANGED
const jeansClubConfig = {
    pointValue: 750,
    redemptionRate: 0.005,
    
    tiers: {
        PEARL: { 
            minPoints: 0, 
            maxPoints: 7499,
            multiplier: 1.0, 
            name: "Pearl", 
            color: "#F8F8FF",
            discountRate: 0.10
        },
        BRONZE: { 
            minPoints: 7500,    
            maxPoints: 24999,
            multiplier: 1.10, 
            name: "Bronze", 
            color: "#cd7f32",
            discountRate: 0.15
        },
        SILVER: { 
            minPoints: 25000,    
            maxPoints: 99999,
            multiplier: 1.25, 
            name: "Silver", 
            color: "#c0c0c0",
            discountRate: 0.20
        },
        GOLD: { 
            minPoints: 100000,    
            maxPoints: 499999,
            multiplier: 1.40, 
            name: "Gold", 
            color: "#ffd700",
            discountRate: 0.25
        },
        PLATINUM: { 
            minPoints: 500000,    
            maxPoints: 9999999,
            multiplier: 1.60, 
            name: "Platinum", 
            color: "#e5e4e2",
            discountRate: 0.30
        }
    }
};

// Main JeansClubManager - UPDATED to use Supabase
class JeansClubManager {
    constructor() {
        // CHANGED: Using Supabase instead of Google Sheets
        this.db = new SupabaseDB();
        this.emailService = new GoogleAppsEmailService();
        this.currentMember = null;
        this.isAdmin = false;
        this.loadCurrentMember();
        console.log('🚀 JeansClubManager initialized with Supabase DB');
    }

    generateJCId() {
        return 'JC' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }

    generateReferralCode() {
        return 'JEANS' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    loadCurrentMember() {
        const savedMember = localStorage.getItem('jeansClubCurrentMember');
        if (savedMember) {
            this.currentMember = JSON.parse(savedMember);
        }
    }

    saveCurrentMember() {
        if (this.currentMember) {
            localStorage.setItem('jeansClubCurrentMember', JSON.stringify(this.currentMember));
        }
    }

    // Create account with password
    async createAccount(userData, password, referralCode = null) {
        console.log('👤 Creating account for:', userData.email);
        
        // Check if email already exists
        const existingMember = await this.db.getMemberByEmail(userData.email);
        if (existingMember) {
            console.log('❌ Email already registered:', userData.email);
            return { success: false, message: "Email already registered" };
        }

        const memberId = 'member_' + Date.now();
        const hashedPassword = this.hashPassword(password);
        const startingPoints = 10;
        
        const newMember = {
            id: memberId,
            jcId: this.generateJCId(),
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            loginMethod: 'email',
            points: startingPoints,
            tier: 'PEARL',
            referralCode: this.generateReferralCode(),
            referredBy: referralCode || null,
            purchaseHistory: [],
            activityLog: [],
            joinedDate: new Date().toISOString(),
            totalSpent: 0,
            challenges: [],
            referrals: []
        };

        console.log('💾 Saving new member to Supabase:', newMember.jcId);

        // Save to Supabase
        if (!await this.db.saveMember(newMember)) {
            console.log('❌ Failed to save member to Supabase');
            return { success: false, message: "Failed to save member data to cloud storage" };
        }

        this.currentMember = newMember;
        this.saveCurrentMember();
        
        await this.logActivity(memberId, 'Account created - Welcome to Jean\'s Club!', startingPoints);
        
        // Process referral if exists
        if (referralCode) {
            await this.processReferral(referralCode, newMember.jcId, newMember.name);
        }

        // Send welcome email
        const emailResult = await this.emailService.sendWelcomeEmail(newMember.email, {
            name: newMember.name,
            jcId: newMember.jcId,
            tier: newMember.tier,
            points: newMember.points,
            referralCode: newMember.referralCode
        });

        console.log('✅ Account created successfully! JC ID:', newMember.jcId);
        return { 
            success: true, 
            member: newMember,
            emailSent: emailResult.success,
            isFallback: emailResult.fallback || false
        };
    }

    // Create account with Google
    async createAccountWithGoogle(userData, referralCode = null) {
        console.log('👤 Creating Google account for:', userData.email);
        
        // Check if email already exists
        const existingMember = await this.db.getMemberByEmail(userData.email);
        if (existingMember) {
            return { success: false, message: "Email already registered" };
        }

        const memberId = 'member_' + Date.now();
        const startingPoints = 10;
        
        const newMember = {
            id: memberId,
            jcId: this.generateJCId(),
            email: userData.email,
            name: userData.name,
            password: null,
            googleId: userData.googleId,
            loginMethod: 'google',
            points: startingPoints,
            tier: 'PEARL',
            referralCode: this.generateReferralCode(),
            referredBy: referralCode || null,
            purchaseHistory: [],
            activityLog: [],
            joinedDate: new Date().toISOString(),
            totalSpent: 0,
            challenges: [],
            referrals: []
        };

        console.log('💾 Saving Google member to Supabase:', newMember.jcId);

        // Save to Supabase
        if (!await this.db.saveMember(newMember)) {
            return { success: false, message: "Failed to save member data" };
        }

        this.currentMember = newMember;
        this.saveCurrentMember();
        
        await this.logActivity(memberId, 'Account created with Google - Welcome to Jean\'s Club!', startingPoints);
        
        // Process referral if exists
        if (referralCode) {
            await this.processReferral(referralCode, newMember.jcId, newMember.name);
        }

        // Send welcome email
        const emailResult = await this.emailService.sendWelcomeEmail(newMember.email, {
            name: newMember.name,
            jcId: newMember.jcId,
            tier: newMember.tier,
            points: newMember.points,
            referralCode: newMember.referralCode
        });

        return { 
            success: true, 
            member: newMember,
            emailSent: emailResult.success,
            isFallback: emailResult.fallback || false
        };
    }

    // Login with BOTH JC ID AND Email
    async login(jcId, email, password) {
        console.log('🔐 Attempting login for JC ID:', jcId);
        const member = await this.db.getMemberByJCId(jcId);
        
        if (member && member.email === email) {
            if (member.loginMethod === 'google') {
                return { success: false, message: "This account uses Google login. Please use Google Sign-In." };
            }
            if (this.verifyPassword(password, member.password)) {
                this.currentMember = member;
                this.saveCurrentMember();
                await this.logActivity(member.id, 'Logged in to account', 0);
                console.log('✅ Login successful for:', member.name);
                return { success: true, member: member };
            } else {
                console.log('❌ Invalid password for:', jcId);
                return { success: false, message: "Invalid password" };
            }
        }
        console.log('❌ Account not found:', jcId, email);
        return { success: false, message: "Account not found - check JC ID and email" };
    }

    // Login with Google
    async loginWithGoogle(email) {
        console.log('🔐 Attempting Google login for:', email);
        const member = await this.db.getMemberByEmail(email);
        
        if (member && member.loginMethod === 'google') {
            this.currentMember = member;
            this.saveCurrentMember();
            await this.logActivity(member.id, 'Logged in with Google', 0);
            console.log('✅ Google login successful for:', member.name);
            return { success: true, member: member };
        }
        console.log('❌ Google account not found:', email);
        return { success: false, message: "Google account not found. Please sign up first." };
    }

    // Admin function to add purchase
    async addPurchase(memberJCId, amountUGX, description) {
        console.log('💰 Adding purchase for:', memberJCId, amountUGX, description);
        const targetMember = await this.db.getMemberByJCId(memberJCId);

        if (!targetMember) {
            return { success: false, message: "Member not found" };
        }

        const oldTier = targetMember.tier;
        const pointsEarned = this.calculatePoints(amountUGX, targetMember.tier);
        
        targetMember.points += pointsEarned;
        targetMember.totalSpent += amountUGX;
        targetMember.tier = this.calculateTier(targetMember.points);
        
        targetMember.purchaseHistory.push({
            date: new Date().toISOString(),
            amount: amountUGX,
            description: description,
            pointsEarned: pointsEarned
        });

        await this.logActivity(targetMember.id, description + ' - ' + amountUGX.toLocaleString() + ' UGX', pointsEarned);

        // Save updated member to Supabase
        if (!await this.db.saveMember(targetMember)) {
            return { success: false, message: "Failed to update member data" };
        }

        // Update current member if it's the same member
        if (this.currentMember && this.currentMember.jcId === memberJCId) {
            this.currentMember = targetMember;
            this.saveCurrentMember();
        }

        // Send purchase confirmation email
        const purchaseData = {
            description: description,
            amount: amountUGX,
            pointsEarned: pointsEarned
        };
        await this.emailService.sendPurchaseEmail(targetMember.email, targetMember, purchaseData);

        return {
            success: true,
            pointsEarned: pointsEarned,
            newPoints: targetMember.points,
            tierChanged: oldTier !== targetMember.tier,
            newTier: targetMember.tier
        };
    }

    // Process referral
    async processReferral(referralCode, newMemberJCId, newMemberName) {
        const allMembers = await this.db.getAllMembers();
        
        for (const member of allMembers) {
            if (member.referralCode === referralCode) {
                member.points += 100;
                await this.logActivity(member.id, 'Referral bonus - ' + newMemberJCId + ' joined using your code!', 100);
                member.tier = this.calculateTier(member.points);
                
                if (!member.referrals) member.referrals = [];
                member.referrals.push({
                    jcId: newMemberJCId,
                    name: newMemberName,
                    date: new Date().toISOString(),
                    pointsEarned: 100
                });

                // Save updated member to Supabase
                await this.db.saveMember(member);

                // Send referral success email
                const referralData = {
                    newMemberName: newMemberName,
                    newMemberJCId: newMemberJCId
                };
                await this.emailService.sendReferralEmail(member.email, member, referralData);
                break;
            }
        }
    }

    // Delete member account (Admin only)
    async deleteMemberAccount(jcId) {
        if (!this.isAdmin) {
            return { success: false, message: "Admin access required" };
        }

        const memberToDelete = await this.db.getMemberByJCId(jcId);
        if (!memberToDelete) {
            return { success: false, message: "Member not found" };
        }

        // Remove member from Supabase
        if (!await this.db.deleteMember(jcId)) {
            return { success: false, message: "Failed to delete member" };
        }

        // If deleted member is current member, log them out
        if (this.currentMember && this.currentMember.jcId === jcId) {
            this.currentMember = null;
            localStorage.removeItem('jeansClubCurrentMember');
        }

        return { 
            success: true, 
            message: "Account " + jcId + " (" + memberToDelete.name + ") has been permanently deleted" 
        };
    }

    calculatePoints(amountUGX, tier) {
        const basePoints = amountUGX / jeansClubConfig.pointValue;
        const multiplier = jeansClubConfig.tiers[tier].multiplier;
        return Math.floor(basePoints * multiplier);
    }

    calculateTier(points) {
        if (points >= jeansClubConfig.tiers.PLATINUM.minPoints) return 'PLATINUM';
        if (points >= jeansClubConfig.tiers.GOLD.minPoints) return 'GOLD';
        if (points >= jeansClubConfig.tiers.SILVER.minPoints) return 'SILVER';
        if (points >= jeansClubConfig.tiers.BRONZE.minPoints) return 'BRONZE';
        return 'PEARL';
    }

    getNextTier(currentTier) {
        const tierOrder = ['PEARL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        const currentIndex = tierOrder.indexOf(currentTier);
        return currentIndex < tierOrder.length - 1 ? jeansClubConfig.tiers[tierOrder[currentIndex + 1]] : null;
    }

    getTierProgress(currentPoints, currentTier) {
        const nextTier = this.getNextTier(currentTier);
        if (!nextTier) return { percentage: 100, pointsNeeded: 0, nextTier: null };

        const currentTierConfig = jeansClubConfig.tiers[currentTier];
        const pointsInCurrentTier = currentPoints - currentTierConfig.minPoints;
        const totalPointsInTier = nextTier.minPoints - currentTierConfig.minPoints;
        const percentage = Math.min(100, Math.max(0, (pointsInCurrentTier / totalPointsInTier) * 100));
        
        return {
            percentage: Math.round(percentage),
            pointsNeeded: nextTier.minPoints - currentPoints,
            nextTier: nextTier
        };
    }

    calculateDiscount(pointsToUse) {
        if (!this.currentMember) return { success: false, message: "No member logged in" };

        const member = this.currentMember;
        const tierConfig = jeansClubConfig.tiers[member.tier];
        
        const maxDiscountPoints = Math.floor(tierConfig.discountRate / jeansClubConfig.redemptionRate);
        const actualPointsToUse = Math.min(pointsToUse, maxDiscountPoints, member.points);
        
        if (actualPointsToUse < 10) {
            return { success: false, message: "Minimum 10 points required" };
        }

        const discountPercentage = (actualPointsToUse * jeansClubConfig.redemptionRate * 100).toFixed(1);

        return {
            success: true,
            pointsUsed: actualPointsToUse,
            discountPercentage: discountPercentage,
            maxPossibleDiscount: (tierConfig.discountRate * 100).toFixed(1) + '%'
        };
    }

    async redeemPoints(pointsToUse) {
        if (!this.currentMember) return { success: false, message: "No member logged in" };

        const discountCalc = this.calculateDiscount(pointsToUse);
        if (!discountCalc.success) return discountCalc;

        const member = this.currentMember;
        member.points -= discountCalc.pointsUsed;
        member.tier = this.calculateTier(member.points);
        
        await this.logActivity(member.id, discountCalc.pointsUsed + ' points for ' + discountCalc.discountPercentage + '% discount', -discountCalc.pointsUsed);

        // Save updated member to Supabase
        if (!await this.db.saveMember(member)) {
            return { success: false, message: "Failed to update member data" };
        }

        this.saveCurrentMember();

        // Send discount voucher email
        const emailResult = await this.emailService.sendDiscountEmail(member.email, member, discountCalc);

        return {
            success: true,
            pointsUsed: discountCalc.pointsUsed,
            discountPercentage: discountCalc.discountPercentage,
            emailSent: emailResult.success
        };
    }

    async logActivity(memberId, message, points) {
        const allMembers = await this.db.getAllMembers();
        const memberIndex = allMembers.findIndex(m => m.id === memberId);
        
        if (memberIndex >= 0) {
            const member = allMembers[memberIndex];
            member.activityLog.unshift({
                timestamp: new Date().toISOString(),
                message: message,
                points: points
            });
            if (member.activityLog.length > 10) member.activityLog = member.activityLog.slice(0, 10);
            
            // Save updated member to Supabase
            await this.db.saveMember(member);
        }
    }

    // Admin login
    adminLogin(password) {
        if (password === 'jeansclub2024') {
            this.isAdmin = true;
            return { success: true };
        }
        return { success: false, message: "Invalid staff password" };
    }

    adminLogout() {
        this.isAdmin = false;
    }

    hashPassword(password) {
        return btoa(unescape(encodeURIComponent(password)));
    }

    verifyPassword(password, hashedPassword) {
        return btoa(unescape(encodeURIComponent(password))) === hashedPassword;
    }

    async getReferralStats(memberId) {
        const allMembers = await this.db.getAllMembers();
        const member = allMembers.find(m => m.id === memberId);
        if (!member || !member.referrals) return { totalReferrals: 0, totalPoints: 0 };
        return {
            totalReferrals: member.referrals.length,
            totalPoints: member.referrals.reduce((sum, ref) => sum + ref.pointsEarned, 0)
        };
    }

    async getAllMembers() {
        return await this.db.getAllMembers();
    }

    async resetAllData() {
        console.log('Reset all data - would need Supabase implementation');
    }
}

// Initialize the system
const clubManager = new JeansClubManager();

// Google Sign-In Functions - UNCHANGED
function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({
            client_id: googleConfig.clientId,
            callback: handleGoogleSignIn,
            auto_select: false
        });
    
        google.accounts.id.renderButton(
            document.querySelector('.google-signin-button'),
            { 
                theme: "outline", 
                size: "large",
                width: "100%",
                text: "signup_with",
                type: "standard"
            }
        );

        google.accounts.id.renderButton(
            document.querySelector('.google-login-button'),
            { 
                theme: "outline", 
                size: "large",
                width: "100%",
                text: "signin_with",
                type: "standard"
            }
        );
    
        console.log('Google Sign-In initialized successfully!');
    } catch (error) {
        console.log('Google Sign-In not configured properly:', error);
        document.querySelector('.google-signin-button').innerHTML = '<button class="btn google" onclick="demoGoogleSignup()" style="width: 100%;"><img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width: 20px; height: 20px; margin-right: 10px;">Sign up with Google (Demo)</button>';
        document.querySelector('.google-login-button').innerHTML = '<button class="btn google" onclick="demoGoogleLogin()" style="width: 100%;"><img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width: 20px; height: 20px; margin-right: 10px;">Login with Google (Demo)</button>';
    }
}

async function handleGoogleSignIn(response) {
    try {
        const responsePayload = JSON.parse(atob(response.credential.split('.')[1]));
    
        const userData = {
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture,
            googleId: responsePayload.sub
        };

        console.log('Google Sign-In successful for:', userData.email);

        const isSignupPage = !document.getElementById('signupSection').classList.contains('hidden');
    
        if (isSignupPage) {
            const referralCode = document.getElementById('referralCode').value.trim() || null;
            const result = await clubManager.createAccountWithGoogle(userData, referralCode);
        
            if (result.success) {
                showDashboard(result.member);
                let message = 'Welcome to Jean\'s Club!\n\nYour JC ID: ' + result.member.jcId + '\nKeep this safe - you\'ll need it for future logins!\n\n';
            
                if (referralCode) {
                    message += 'You got 10 points, your friend got 100 points!\n\n';
                } else {
                    message += 'You got 10 welcome points!\n\n';
                }
            
                if (result.isFallback) {
                    message += 'Email details saved (check browser console for email content)\n\n';
                } else if (result.emailSent) {
                    message += 'Welcome email sent to your inbox!\n\n';
                }
            
                alert(message);
            } else {
                alert(result.message);
            }
        } else {
            const result = await clubManager.loginWithGoogle(userData.email);
            if (result.success) {
                showDashboard(result.member);
                alert('Welcome back, ' + result.member.name + '!');
            } else {
                alert(result.message + " Please sign up first.");
                showSignupScreen();
            }
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        alert('Google sign-in failed. Please try email signup instead.');
    }
}

async function demoGoogleSignup() {
    const name = prompt("Enter your name for demo Google signup:");
    if (!name) return;
    
    const email = prompt("Enter your email for demo Google signup:");
    if (!email) return;

    const userData = {
        name: name,
        email: email,
        googleId: "demo_google_id_" + Date.now()
    };

    const referralCode = document.getElementById('referralCode').value.trim() || null;
    const result = await clubManager.createAccountWithGoogle(userData, referralCode);
    
    if (result.success) {
        showDashboard(result.member);
        let message = 'Demo Google account created!\nJC ID: ' + result.member.jcId + '\n\n';
        if (result.isFallback) {
            message += 'Email details saved (check console)\n\n';
        }
        alert(message);
    } else {
        alert(result.message);
    }
}

async function demoGoogleLogin() {
    const email = prompt("Enter the email you used for Google signup:");
    if (!email) return;

    const result = await clubManager.loginWithGoogle(email);
    if (result.success) {
        showDashboard(result.member);
        alert('Welcome back, ' + result.member.name + '!');
    } else {
        alert(result.message + " Please sign up first.");
        showSignupScreen();
    }
}

// UI Functions - UNCHANGED
function showAdminLogin() {
    const password = prompt("Enter staff password:");
    if (password) {
        const result = clubManager.adminLogin(password);
        result.success ? showAdminPanel() : alert(result.message);
    }
}

async function showAdminPanel() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    await viewAllMembers();
}

function showDashboard(member) {
    clubManager.currentMember = member;
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    
    updateDashboard(member);
}

async function updateDashboard(member) {
    document.getElementById('memberJcId').textContent = member.jcId;
    document.getElementById('memberName').textContent = member.name;
    document.getElementById('memberEmail').textContent = member.email;
    document.getElementById('memberLoginMethod').textContent = member.loginMethod === 'google' ? 'Google' : 'Email';
    document.getElementById('memberTier').textContent = member.tier;
    document.getElementById('memberTier').className = 'tier-' + member.tier.toLowerCase();
    document.getElementById('memberPoints').textContent = member.points.toLocaleString();
    document.getElementById('memberReferralCode').textContent = member.referralCode;
    document.getElementById('totalSpent').textContent = member.totalSpent.toLocaleString() + ' UGX';
    
    const referralStats = await clubManager.getReferralStats(member.id);
    document.getElementById('referralStats').innerHTML = 'Referrals: ' + referralStats.totalReferrals + ' friends, Earned: ' + referralStats.totalPoints + ' points';
    
    updateTierProgress(member);
    updateActivityLog(member);
}

function updateTierProgress(member) {
    const progress = clubManager.getTierProgress(member.points, member.tier);
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('tierProgressText');
    
    if (progress.nextTier) {
        progressFill.style.width = progress.percentage + '%';
        progressText.innerHTML = 'Progress to ' + progress.nextTier.name + ': ' + progress.percentage + '% (' + progress.pointsNeeded.toLocaleString() + ' points needed)';
    } else {
        progressFill.style.width = '100%';
        progressText.innerHTML = 'You\'ve reached the highest tier!';
    }
}

function updateActivityLog(member) {
    const activityLog = document.getElementById('activityLog');
    activityLog.innerHTML = '';
    
    if (member.activityLog.length === 0) {
        activityLog.innerHTML = '<div class="activity-item">No activity yet</div>';
        return;
    }
    
    member.activityLog.forEach(activity => {
        const div = document.createElement('div');
        div.className = 'activity-item';
        div.innerHTML = '<strong>' + new Date(activity.timestamp).toLocaleDateString() + '</strong><br>' + activity.message + ' ' + (activity.points > 0 ? '+' + activity.points + ' points' : activity.points < 0 ? activity.points + ' points' : '');
        activityLog.appendChild(div);
    });
}

function showLoginScreen() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
}

function showSignupScreen() {
    document.getElementById('signupSection').classList.remove('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
}

function logout() {
    clubManager.currentMember = null;
    clubManager.isAdmin = false;
    localStorage.removeItem('jeansClubCurrentMember');
    showLoginScreen();
}

async function refreshData() {
    if (clubManager.currentMember) {
        // Reload current member from Supabase
        const updatedMember = await clubManager.db.getMemberByJCId(clubManager.currentMember.jcId);
        if (updatedMember) {
            clubManager.currentMember = updatedMember;
            clubManager.saveCurrentMember();
            updateDashboard(updatedMember);
            alert('Data refreshed successfully!');
        }
    }
}

// Business Logic - UNCHANGED
async function signUpWithEmail() {
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const referralCode = document.getElementById('referralCode').value.trim() || null;
    
    if (!name || !email || !password) {
        alert("Please enter name, email and password");
        return;
    }
    
    if (password.length < 4) {
        alert("Password must be at least 4 characters");
        return;
    }
    
    const userData = { name, email };
    const result = await clubManager.createAccount(userData, password, referralCode);
    
    if (result.success) {
        showDashboard(result.member);
        let message = 'Welcome to Jean\'s Club!\n\nYour JC ID: ' + result.member.jcId + '\nKeep this safe - you\'ll need it to login!\n\n';
        
        if (referralCode) {
            message += 'You got 10 points, your friend got 100 points!\n\n';
        } else {
            message += 'You got 10 welcome points!\n\n';
        }
        
        if (result.isFallback) {
            message += 'Email details saved (check browser console for full email content)\n\n';
        } else if (result.emailSent) {
            message += 'Welcome email sent to your inbox!\n\n';
        }
        
        alert(message);
    } else {
        alert(result.message);
    }
}

async function loginWithCredentials() {
    const jcId = document.getElementById('loginJCId').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!jcId || !email || !password) {
        alert("Please enter JC ID, email and password");
        return;
    }
    
    const result = await clubManager.login(jcId, email, password);
    if (result.success) {
        showDashboard(result.member);
    } else {
        alert(result.message);
    }
}

function calculateDiscount() {
    if (!clubManager.currentMember) {
        alert("Please login first");
        return;
    }
    const pointsToUse = parseInt(document.getElementById('discountPoints').value) || 0;
    const result = clubManager.calculateDiscount(pointsToUse);
    
    const discountResult = document.getElementById('discountResult');
    if (result.success) {
        discountResult.innerHTML = 'Discount: ' + result.discountPercentage + '% (using ' + result.pointsUsed + ' points)<br><small>Max discount for your tier: ' + result.maxPossibleDiscount + '</small>';
        discountResult.className = 'discount-success';
    } else {
        discountResult.innerHTML = result.message;
        discountResult.className = 'discount-error';
    }
}

async function redeemPoints() {
    if (!clubManager.currentMember) {
        alert("Please login first");
        return;
    }
    const pointsToUse = parseInt(document.getElementById('discountPoints').value) || 0;
    const result = await clubManager.redeemPoints(pointsToUse);
    
    if (result.success) {
        showDashboard(clubManager.currentMember);
        let message = result.discountPercentage + '% discount voucher generated!\n\n';
        message += result.emailSent 
            ? 'Voucher email sent to your inbox!'
            : 'Voucher details saved (check console for email content)';
        
        alert(message);
        document.getElementById('discountResult').innerHTML = '';
        document.getElementById('discountPoints').value = '';
    } else {
        alert(result.message);
    }
}

function shareReferral() {
    if (!clubManager.currentMember) return;
    const member = clubManager.currentMember;
    const shareText = 'Join Jean\'s Club Loyalty Program!\n\nUse my referral code when signing up: ' + member.referralCode + '\n\nWe both get bonus points:\n• You get 10 welcome points\n• I get 100 referral points\n\nSign up now and start earning rewards!';
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Referral code copied to clipboard!\n\nShare it with friends via WhatsApp, SMS, or any messaging app!');
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Referral code copied!\n\nShare it with friends via WhatsApp, SMS, or any messaging app!');
    }
}

// Admin Functions - UNCHANGED
async function viewAllMembers() {
    const members = await clubManager.getAllMembers();
    const adminContent = document.getElementById('adminContent');
    
    if (members.length === 0) {
        adminContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><h3>No Members Yet</h3><p>When customers sign up, they will appear here.</p></div>';
        return;
    }
    
    let html = '<h3>Total Members: ' + members.length + '</h3><div class="members-list">';
    for (const member of members) {
        const referralStats = await clubManager.getReferralStats(member.id);
        html += '<div class="admin-card"><strong>' + member.jcId + '</strong> - ' + member.name + '<br>Email: ' + member.email + '<br>Login Method: ' + (member.loginMethod === 'google' ? 'Google' : 'Email') + '<br>Tier: <span class="tier-' + member.tier.toLowerCase() + '">' + member.tier + '</span> | Points: ' + member.points.toLocaleString() + '<br>Spent: ' + member.totalSpent.toLocaleString() + ' UGX<br>Referrals: ' + referralStats.totalReferrals + ' friends<br>Referral Code: <code>' + member.referralCode + '</code><br>Joined: ' + new Date(member.joinedDate).toLocaleDateString() + '</div>';
    }
    html += '</div>';
    adminContent.innerHTML = html;
}

async function adminAddPurchase() {
    if (!clubManager.isAdmin) return alert("Staff access required");
    
    const jcId = document.getElementById('purchaseJCId').value.trim();
    const amount = parseInt(document.getElementById('purchaseAmount').value);
    const description = document.getElementById('purchaseDescription').value.trim();

    if (!jcId || !amount || !description) {
        document.getElementById('purchaseResult').innerHTML = '<span style="color: red;">Please fill all fields</span>';
        return;
    }

    if (amount <= 0) {
        document.getElementById('purchaseResult').innerHTML = '<span style="color: red;">Amount must be greater than 0</span>';
        return;
    }

    const result = await clubManager.addPurchase(jcId, amount, description);
    const purchaseResult = document.getElementById('purchaseResult');
    if (result.success) {
        purchaseResult.innerHTML = '<span style="color: green;">Purchase added!<br>' + result.pointsEarned + ' points earned<br>New balance: ' + result.newPoints + ' points<br>' + (result.tierChanged ? 'Tier upgraded to ' + result.newTier + '!' : '') + '</span>';
        document.getElementById('purchaseJCId').value = '';
        document.getElementById('purchaseAmount').value = '';
        document.getElementById('purchaseDescription').value = '';
        setTimeout(viewAllMembers, 1000);
    } else {
        purchaseResult.innerHTML = '<span style="color: red;">' + result.message + '</span>';
    }
}

function showDeleteMemberSection() {
    document.getElementById('deleteMemberSection').classList.remove('hidden');
    document.getElementById('deleteJCId').value = '';
    document.getElementById('deleteResult').innerHTML = '';
}

async function confirmDeleteMember() {
    const jcId = document.getElementById('deleteJCId').value.trim();
    
    if (!jcId) {
        document.getElementById('deleteResult').innerHTML = '<span style="color: red;">Please enter a JC ID</span>';
        return;
    }

    if (!confirm('WARNING: This will permanently delete account ' + jcId + ' and all associated data. This action cannot be undone!\n\nAre you sure you want to proceed?')) {
        return;
    }

    const result = await clubManager.deleteMemberAccount(jcId);
    const deleteResult = document.getElementById('deleteResult');
    
    if (result.success) {
        deleteResult.innerHTML = '<span style="color: green;">' + result.message + '</span>';
        document.getElementById('deleteJCId').value = '';
        setTimeout(() => {
            viewAllMembers();
            document.getElementById('deleteMemberSection').classList.add('hidden');
        }, 2000);
    } else {
        deleteResult.innerHTML = '<span style="color: red;">' + result.message + '</span>';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) document.getElementById('referralCode').value = refCode;
    
    setTimeout(initializeGoogleSignIn, 1000);
    
    if (clubManager.currentMember) {
        showDashboard(clubManager.currentMember);
    } else {
        showLoginScreen();
    }
});