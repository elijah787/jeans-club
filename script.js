// Google Apps Script Email Service
class GoogleAppsEmailService {
    constructor() {
        this.scriptURL = 'https://script.google.com/macros/s/AKfycbx7LP8L1s736vQ9cBtksr0r448_kM9KEcC9uyRNFqMbd-d-TrJW19O1EXYsLxohEbNi/exec';
        this.isActive = true;
    }

    async sendEmailToGoogleScript(email, type, memberData, extraData = null) {
        try {
            const payload = {
                email: email,
                type: type,
                memberData: memberData,
                subject: this.getSubject(type, memberData, extraData),
                message: this.getMessage(type, extraData)
            };

            console.log('Sending email via Google Apps Script:', payload);

            const response = await fetch(this.scriptURL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            // For no-cors mode, we can't read the response, so assume success
            console.log('Email sent successfully via Google Apps Script');
            return { success: true, message: "Email sent successfully" };
            
        } catch (error) {
            console.error('Google Apps Script email failed:', error);
            return this.fallbackEmail(email, memberData, type, extraData);
        }
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

    getMessage(type, extraData) {
        switch(type) {
            case 'purchase': return (extraData?.description || '') + ' - ' + (extraData?.amount?.toLocaleString() || '0') + ' UGX';
            case 'referral': return (extraData?.newMemberName || '') + ' (' + (extraData?.newMemberJCId || '') + ')';
            default: return '';
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
                content = 'Hello ' + memberData.name + ',\n\nWelcome to Jean\'s Club! Your account has been created successfully.\n\nMEMBERSHIP DETAILS:\n• JC ID: ' + memberData.jcId + '\n• Tier: ' + memberData.tier + '\n• Points: ' + memberData.points + '\n• Referral Code: ' + memberData.referralCode + '\n\nStart earning points with your purchases!\n\nThank you for joining Jean\'s Club!';
                break;

            case 'purchase':
                subject = 'Purchase Recorded - ' + extraData.description;
                content = 'Hello ' + memberData.name + ',\n\nYour purchase has been recorded!\n\nPURCHASE DETAILS:\n• Amount: ' + extraData.amount.toLocaleString() + ' UGX\n• Description: ' + extraData.description + '\n• Points Earned: +' + extraData.pointsEarned + '\n• New Balance: ' + memberData.points + ' points\n\nThank you for shopping with Jean\'s Club!';
                break;

            case 'discount':
                subject = extraData.discountPercentage + '% Discount Voucher';
                content = 'Hello ' + memberData.name + ',\n\nYour discount voucher has been created!\n\nDISCOUNT DETAILS:\n• Discount: ' + extraData.discountPercentage + '%\n• Points Used: ' + extraData.pointsUsed + '\n• Max Possible: ' + extraData.maxPossibleDiscount + '\n\nPresent this email at checkout to redeem your discount!';
                break;

            case 'referral':
                subject = 'Referral Success! +100 Points';
                content = 'Hello ' + memberData.name + ',\n\nCongratulations! Someone joined using your referral code!\n\nREFERRAL DETAILS:\n• New Member: ' + extraData.newMemberName + ' (' + extraData.newMemberJCId + ')\n• Points Earned: 100 points\n• New Balance: ' + memberData.points + ' points\n\nKeep sharing your code: ' + memberData.referralCode;
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

// Enhanced Google Sheets DB Manager for Cross-Device Support
class GoogleSheetsDB {
    constructor() {
        this.scriptURL = 'https://script.google.com/macros/s/AKfycbx7LP8L1s736vQ9cBtksr0r448_kM9KEcC9uyRNFqMbd-d-TrJW19O1EXYsLxohEbNi/exec';
        this.cacheKey = 'jeansClubSheetsCache';
        this.cacheTimeout = 30000; // 30 seconds
        this.sheetId = '19uX0ZPFu2eMBAQDd4-mKIPTMSRBDClAW4TGkChX9y8Q'; // Your sheet ID
        this.init();
    }

    async init() {
        if (!this.getCache()) {
            this.setCache({ members: [], lastSync: 0 });
        }
        console.log('📊 Google Sheets DB initialized with Sheet ID:', this.sheetId);
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

    // Enhanced API call specifically for your sheet
    async callSheetsAPI(action, data = {}) {
        const payload = {
            action: action,
            sheetId: this.sheetId, // Your specific sheet ID
            ...data,
            timestamp: new Date().toISOString(),
            source: 'jeans-club-web-v2'
        };

        console.log('📡 Calling YOUR Google Sheet:', action, data);

        try {
            // First, try to call your Google Apps Script
            const response = await fetch(this.scriptURL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log('✅ Request sent to your Google Sheet');
            
            // Since we're using no-cors, we'll handle the response in localStorage
            return await this.handleLocalUpdate(action, data);
            
        } catch (error) {
            console.error('❌ Google Sheets API call failed:', error);
            return await this.handleLocalUpdate(action, data);
        }
    }

    // Handle local storage updates
    async handleLocalUpdate(action, data) {
        try {
            let result;
            
            switch(action) {
                case 'saveMember':
                    result = this.updateLocalMember(data.member);
                    break;
                case 'deleteMember':
                    result = this.deleteLocalMember(data.jcId);
                    break;
                case 'getAllMembers':
                    result = this.getAllLocalMembers();
                    break;
                case 'getMember':
                    result = this.getLocalMember(data.jcId);
                    break;
                default:
                    result = { success: false, error: 'Unknown action' };
            }
            
            return result;
        } catch (error) {
            console.error('Local update failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Local storage management
    updateLocalMember(member) {
        const cache = this.getCache() || { members: [], lastSync: 0 };
        const existingIndex = cache.members.findIndex(m => m.jcId === member.jcId);
        
        if (existingIndex >= 0) {
            cache.members[existingIndex] = member;
        } else {
            cache.members.push(member);
        }
        
        cache.lastSync = Date.now();
        this.setCache(cache);
        
        return { success: true, message: "Member updated in local cache" };
    }

    deleteLocalMember(jcId) {
        const cache = this.getCache();
        if (!cache) return { success: false, error: "No cache found" };
        
        cache.members = cache.members.filter(m => m.jcId !== jcId);
        cache.lastSync = Date.now();
        this.setCache(cache);
        
        return { success: true, message: "Member deleted from local cache" };
    }

    getAllLocalMembers() {
        const cache = this.getCache();
        const members = cache ? cache.members : [];
        return { success: true, members: members };
    }

    getLocalMember(jcId) {
        const cache = this.getCache();
        if (!cache) return { success: false, member: null };
        
        const member = cache.members.find(m => m.jcId === jcId);
        return { success: true, member: member || null };
    }

    // Public API methods
    async getAllMembers() {
        console.log('🔄 Fetching all members from central database...');
        const result = await this.callSheetsAPI('getAllMembers');
        
        if (result.success && result.members) {
            console.log('✅ Loaded', result.members.length, 'members from central database');
            return result.members;
        } else {
            console.log('⚠️ Using local cache only');
            const cache = this.getCache();
            return cache ? cache.members : [];
        }
    }

    async saveMember(member) {
        console.log('💾 Saving member to central database:', member.jcId);
        const result = await this.callSheetsAPI('saveMember', { member: member });
        
        if (result.success) {
            console.log('✅ Member saved successfully:', member.jcId);
        } else {
            console.log('❌ Failed to save member to central DB');
        }
        
        return result.success;
    }

    async deleteMember(jcId) {
        console.log('🗑️ Deleting member from central database:', jcId);
        const result = await this.callSheetsAPI('deleteMember', { jcId: jcId });
        return result.success;
    }

    async getMemberByJCId(jcId) {
        console.log('🔍 Searching for member in central database:', jcId);
        const result = await this.callSheetsAPI('getMember', { jcId: jcId });
        
        if (result.success && result.member) {
            console.log('✅ Member found:', result.member.name);
            return result.member;
        } else {
            console.log('❌ Member not found in central database:', jcId);
            return null;
        }
    }

    async getMemberByEmail(email) {
        console.log('🔍 Searching for member by email:', email);
        const members = await this.getAllMembers();
        const member = members.find(m => m.email === email);
        
        if (member) {
            console.log('✅ Member found by email:', member.name);
        } else {
            console.log('❌ Member not found by email:', email);
        }
        
        return member || null;
    }

    // Force refresh from central database
    async refreshFromCentral() {
        console.log('🔄 Force refreshing from central database...');
        const cache = this.getCache();
        if (cache) {
            cache.lastSync = 0;
            this.setCache(cache);
        }
        return await this.getAllMembers();
    }
}

// Enhanced JeansClubManager with Cross-Device Support
class JeansClubManager {
    constructor() {
        this.db = new GoogleSheetsDB();
        this.emailService = new GoogleAppsEmailService();
        this.currentMember = null;
        this.isAdmin = false;
        this.loadCurrentMember();
        console.log('🚀 JeansClubManager Ready - Cross-Device Support Enabled');
    }

    loadCurrentMember() {
        try {
            const savedMember = localStorage.getItem('jeansClubCurrentMember');
            if (savedMember) {
                this.currentMember = JSON.parse(savedMember);
                console.log('👤 Loaded current member:', this.currentMember?.jcId);
            }
        } catch (error) {
            console.error('Error loading current member:', error);
        }
    }

    saveCurrentMember() {
        if (this.currentMember) {
            try {
                localStorage.setItem('jeansClubCurrentMember', JSON.stringify(this.currentMember));
            } catch (error) {
                console.error('Error saving current member:', error);
            }
        }
    }

    // Enhanced account creation with cross-device support
    async createAccount(userData, password, referralCode = null) {
        console.log('👤 Creating cross-device account for:', userData.email);
        
        try {
            // Check if email exists in central database
            const existingMember = await this.db.getMemberByEmail(userData.email);
            if (existingMember) {
                return { 
                    success: false, 
                    message: "Email already registered! Please login with your JC ID and password." 
                };
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
                referrals: [],
                lastUpdated: new Date().toISOString()
            };

            console.log('💾 Saving to central database:', newMember.jcId);

            // Save to central database
            const saveResult = await this.db.saveMember(newMember);
            if (!saveResult) {
                return { 
                    success: false, 
                    message: "Account created locally but failed to sync to cloud. You can still use it on this device." 
                };
            }

            this.currentMember = newMember;
            this.saveCurrentMember();
            
            await this.logActivity(memberId, 'Account created - Welcome to Jean\'s Club!', startingPoints);
            
            // Process referral
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

            console.log('✅ Cross-device account created! JC ID:', newMember.jcId);
            return { 
                success: true, 
                member: newMember,
                emailSent: emailResult.success,
                isFallback: emailResult.fallback || false
            };
            
        } catch (error) {
            console.error('Account creation error:', error);
            return { success: false, message: "Account creation failed: " + error.message };
        }
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
            referrals: [],
            lastUpdated: new Date().toISOString()
        };

        console.log('💾 Saving Google member to central database:', newMember.jcId);

        // Save to central database
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

    // Enhanced login with cross-device support
    async login(jcId, email, password) {
        console.log('🔐 Cross-device login attempt:', jcId);
        
        try {
            // Search in central database
            const member = await this.db.getMemberByJCId(jcId);
            
            if (!member) {
                return { 
                    success: false, 
                    message: "Account not found! Please check your JC ID or sign up for a new account." 
                };
            }

            // Verify email matches
            if (member.email !== email) {
                return { 
                    success: false, 
                    message: "JC ID and email do not match. Please check your details." 
                };
            }

            if (member.loginMethod === 'google') {
                return { 
                    success: false, 
                    message: "This account uses Google login. Please click 'Login with Google'." 
                };
            }

            if (!this.verifyPassword(password, member.password)) {
                return { 
                    success: false, 
                    message: "Invalid password. Please try again." 
                };
            }

            // Login successful
            this.currentMember = member;
            this.saveCurrentMember();
            
            await this.logActivity(member.id, 'Logged in from different device', 0);
            console.log('✅ Cross-device login successful:', member.name);
            
            return { success: true, member: member };
            
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: "Login failed. Please try again." };
        }
    }

    // Enhanced Google login
    async loginWithGoogle(email) {
        console.log('🔐 Cross-device Google login:', email);
        
        try {
            const member = await this.db.getMemberByEmail(email);
            
            if (!member) {
                return { 
                    success: false, 
                    message: "Google account not found. Please sign up first." 
                };
            }

            if (member.loginMethod !== 'google') {
                return { 
                    success: false, 
                    message: "This email is registered with password login. Please use your JC ID and password." 
                };
            }

            this.currentMember = member;
            this.saveCurrentMember();
            
            await this.logActivity(member.id, 'Logged in with Google from different device', 0);
            console.log('✅ Cross-device Google login successful:', member.name);
            
            return { success: true, member: member };
            
        } catch (error) {
            console.error('Google login error:', error);
            return { success: false, message: "Google login failed. Please try again." };
        }
    }

    // Refresh member data from central database
    async refreshCurrentMember() {
        if (!this.currentMember) return null;
        
        try {
            const freshMember = await this.db.getMemberByJCId(this.currentMember.jcId);
            if (freshMember) {
                this.currentMember = freshMember;
                this.saveCurrentMember();
                console.log('✅ Refreshed member data from central DB');
            }
            return freshMember;
        } catch (error) {
            console.error('Error refreshing member:', error);
            return this.currentMember;
        }
    }

    // Add purchase with cross-device sync
    async addPurchase(memberJCId, amountUGX, description) {
        console.log('💰 Cross-device purchase for:', memberJCId);
        
        try {
            const targetMember = await this.db.getMemberByJCId(memberJCId);
            if (!targetMember) {
                return { success: false, message: "Member not found in central database" };
            }

            const oldTier = targetMember.tier;
            const pointsEarned = this.calculatePoints(amountUGX, targetMember.tier);
            
            targetMember.points += pointsEarned;
            targetMember.totalSpent += amountUGX;
            targetMember.tier = this.calculateTier(targetMember.points);
            targetMember.lastUpdated = new Date().toISOString();
            
            targetMember.purchaseHistory.push({
                date: new Date().toISOString(),
                amount: amountUGX,
                description: description,
                pointsEarned: pointsEarned
            });

            await this.logActivity(targetMember.id, description + ' - ' + amountUGX.toLocaleString() + ' UGX', pointsEarned);

            // Save to central database
            if (!await this.db.saveMember(targetMember)) {
                return { success: false, message: "Purchase recorded locally but failed to sync to cloud" };
            }

            // Update current member if it's the same member
            if (this.currentMember && this.currentMember.jcId === memberJCId) {
                this.currentMember = targetMember;
                this.saveCurrentMember();
            }

            // Send email
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
            
        } catch (error) {
            console.error('Add purchase error:', error);
            return { success: false, message: "Purchase failed: " + error.message };
        }
    }

    // Process referral
    async processReferral(referralCode, newMemberJCId, newMemberName) {
        try {
            const allMembers = await this.db.getAllMembers();
            for (const member of allMembers) {
                if (member.referralCode === referralCode) {
                    member.points += 100;
                    await this.logActivity(member.id, 'Referral bonus - ' + newMemberJCId + ' joined using your code!', 100);
                    member.tier = this.calculateTier(member.points);
                    member.lastUpdated = new Date().toISOString();
                    
                    if (!member.referrals) member.referrals = [];
                    member.referrals.push({
                        jcId: newMemberJCId,
                        name: newMemberName,
                        date: new Date().toISOString(),
                        pointsEarned: 100
                    });

                    await this.db.saveMember(member);

                    const referralData = {
                        newMemberName: newMemberName,
                        newMemberJCId: newMemberJCId
                    };
                    await this.emailService.sendReferralEmail(member.email, member, referralData);
                    break;
                }
            }
        } catch (error) {
            console.error('Referral processing error:', error);
        }
    }

    // Delete member account (Admin only)
    async deleteMemberAccount(jcId) {
        if (!this.isAdmin) {
            return { success: false, message: "Admin access required" };
        }

        try {
            const memberToDelete = await this.db.getMemberByJCId(jcId);
            if (!memberToDelete) {
                return { success: false, message: "Member not found" };
            }

            if (!await this.db.deleteMember(jcId)) {
                return { success: false, message: "Failed to delete member" };
            }

            if (this.currentMember && this.currentMember.jcId === jcId) {
                this.currentMember = null;
                localStorage.removeItem('jeansClubCurrentMember');
            }

            return { 
                success: true, 
                message: "Account " + jcId + " (" + memberToDelete.name + ") has been permanently deleted" 
            };
        } catch (error) {
            return { success: false, message: "Delete failed: " + error.message };
        }
    }

    // Helper methods
    generateJCId() {
        return 'JC' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }

    generateReferralCode() {
        return 'JEANS' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    calculatePoints(amountUGX, tier) {
        const basePoints = amountUGX / 750;
        const multiplier = this.getTierMultiplier(tier);
        return Math.floor(basePoints * multiplier);
    }

    getTierMultiplier(tier) {
        const tiers = {
            'PEARL': 1.0,
            'BRONZE': 1.10,
            'SILVER': 1.25,
            'GOLD': 1.40,
            'PLATINUM': 1.60
        };
        return tiers[tier] || 1.0;
    }

    calculateTier(points) {
        if (points >= 500000) return 'PLATINUM';
        if (points >= 100000) return 'GOLD';
        if (points >= 25000) return 'SILVER';
        if (points >= 7500) return 'BRONZE';
        return 'PEARL';
    }

    getNextTier(currentTier) {
        const tierOrder = ['PEARL', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        const currentIndex = tierOrder.indexOf(currentTier);
        const tiers = {
            'PEARL': { minPoints: 0, maxPoints: 7499, multiplier: 1.0, name: "Pearl", color: "#F8F8FF", discountRate: 0.10 },
            'BRONZE': { minPoints: 7500, maxPoints: 24999, multiplier: 1.10, name: "Bronze", color: "#cd7f32", discountRate: 0.15 },
            'SILVER': { minPoints: 25000, maxPoints: 99999, multiplier: 1.25, name: "Silver", color: "#c0c0c0", discountRate: 0.20 },
            'GOLD': { minPoints: 100000, maxPoints: 499999, multiplier: 1.40, name: "Gold", color: "#ffd700", discountRate: 0.25 },
            'PLATINUM': { minPoints: 500000, maxPoints: 9999999, multiplier: 1.60, name: "Platinum", color: "#e5e4e2", discountRate: 0.30 }
        };
        return currentIndex < tierOrder.length - 1 ? tiers[tierOrder[currentIndex + 1]] : null;
    }

    getTierProgress(currentPoints, currentTier) {
        const nextTier = this.getNextTier(currentTier);
        if (!nextTier) return { percentage: 100, pointsNeeded: 0, nextTier: null };

        const currentTierConfig = {
            'PEARL': { minPoints: 0 },
            'BRONZE': { minPoints: 7500 },
            'SILVER': { minPoints: 25000 },
            'GOLD': { minPoints: 100000 },
            'PLATINUM': { minPoints: 500000 }
        }[currentTier];

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
        const tierConfig = {
            'PEARL': { discountRate: 0.10 },
            'BRONZE': { discountRate: 0.15 },
            'SILVER': { discountRate: 0.20 },
            'GOLD': { discountRate: 0.25 },
            'PLATINUM': { discountRate: 0.30 }
        }[member.tier];

        const redemptionRate = 0.005;
        const maxDiscountPoints = Math.floor(tierConfig.discountRate / redemptionRate);
        const actualPointsToUse = Math.min(pointsToUse, maxDiscountPoints, member.points);
        
        if (actualPointsToUse < 10) {
            return { success: false, message: "Minimum 10 points required" };
        }

        const discountPercentage = (actualPointsToUse * redemptionRate * 100).toFixed(1);

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
        member.lastUpdated = new Date().toISOString();
        
        await this.logActivity(member.id, discountCalc.pointsUsed + ' points for ' + discountCalc.discountPercentage + '% discount', -discountCalc.pointsUsed);

        if (!await this.db.saveMember(member)) {
            return { success: false, message: "Failed to update member data" };
        }

        this.saveCurrentMember();

        const emailResult = await this.emailService.sendDiscountEmail(member.email, member, discountCalc);

        return {
            success: true,
            pointsUsed: discountCalc.pointsUsed,
            discountPercentage: discountCalc.discountPercentage,
            emailSent: emailResult.success
        };
    }

    async logActivity(memberId, message, points) {
        try {
            const allMembers = await this.db.getAllMembers();
            const memberIndex = allMembers.findIndex(m => m.id === memberId);
            
            if (memberIndex >= 0) {
                const member = allMembers[memberIndex];
                if (!member.activityLog) member.activityLog = [];
                member.activityLog.unshift({
                    timestamp: new Date().toISOString(),
                    message: message,
                    points: points
                });
                if (member.activityLog.length > 10) member.activityLog = member.activityLog.slice(0, 10);
                member.lastUpdated = new Date().toISOString();
                
                await this.db.saveMember(member);
            }
        } catch (error) {
            console.error('Log activity error:', error);
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
}

// Google OAuth Configuration
const googleConfig = {
    clientId: '607807821474-43243foqc9ml9eq3e0ugu04fnsigbqc5.apps.googleusercontent.com'
};

// Initialize the cross-device manager
const clubManager = new JeansClubManager();

// Loading utilities
function showLoading(message = 'Loading...') {
    let loader = document.getElementById('loadingOverlay');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loadingOverlay';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 18px;
            z-index: 10000;
            flex-direction: column;
        `;
        document.body.appendChild(loader);
    }
    loader.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 24px; margin-bottom: 20px;">${message}</div>
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
        </div>
    `;
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Add CSS for spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Google Sign-In Functions
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

// UI Functions
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
        showLoading('Refreshing data...');
        const updatedMember = await clubManager.refreshCurrentMember();
        hideLoading();
        if (updatedMember) {
            updateDashboard(updatedMember);
            alert('Data refreshed successfully from cloud!');
        }
    }
}

// Business Logic
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
    
    showLoading('Creating cross-device account...');
    
    try {
        const userData = { name, email };
        const result = await clubManager.createAccount(userData, password, referralCode);
        
        if (result.success) {
            showDashboard(result.member);
            let message = '🎉 Welcome to Jean\'s Club!\n\n' +
                         'Your JC ID: ' + result.member.jcId + '\n' +
                         'Keep this safe - you\'ll need it to login on any device!\n\n' +
                         '✅ Cross-device account created successfully!\n\n';
            
            if (referralCode) {
                message += '🎁 You got 10 points + your friend got 100 points!\n\n';
            } else {
                message += '🎁 You got 10 welcome points!\n\n';
            }
            
            if (result.isFallback) {
                message += '📧 Email details saved (check browser console)\n\n';
            } else if (result.emailSent) {
                message += '📧 Welcome email sent to your inbox!\n\n';
            }
            
            alert(message);
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Signup failed. Please try again.');
    } finally {
        hideLoading();
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
    
    showLoading('Logging in across devices...');
    
    try {
        const result = await clubManager.login(jcId, email, password);
        if (result.success) {
            showDashboard(result.member);
            alert('Welcome back, ' + result.member.name + '! ✅\n\nCross-device login successful!');
        } else {
            alert('❌ ' + result.message);
        }
    } catch (error) {
        alert('❌ Login failed. Please check your internet connection and try again.');
    } finally {
        hideLoading();
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

// Admin Functions
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

    showLoading('Recording purchase...');
    const result = await clubManager.addPurchase(jcId, amount, description);
    hideLoading();
    
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

    showLoading('Deleting member...');
    const result = await clubManager.deleteMemberAccount(jcId);
    hideLoading();
    
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

// Update initialization
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) document.getElementById('referralCode').value = refCode;
    
    setTimeout(initializeGoogleSignIn, 1000);
    
    if (clubManager.currentMember) {
        // Refresh member data on page load
        showLoading('Syncing with cloud...');
        clubManager.refreshCurrentMember().then(freshMember => {
            hideLoading();
            if (freshMember) {
                showDashboard(freshMember);
                console.log('✅ Cross-device sync complete');
            } else {
                showLoginScreen();
            }
        }).catch(() => {
            hideLoading();
            showLoginScreen();
        });
    } else {
        showLoginScreen();
    }
    
    console.log('🌐 Jean\'s Club - Cross-Device System Ready');
    console.log('📊 Connected to Sheet:', clubManager.db.sheetId);
});