// Email Service - UPDATED FOR REAL EMAILS
class EmailService {
    constructor() {
        this.isActive = false;
        this.init();
    }

    async init() {
        try {
            if (typeof emailjs === 'undefined') {
                console.log('❌ EmailJS not loaded');
                return;
            }
            
            // Test initialization
            await emailjs.init("88iWYXs2nKomA_ul0");
            this.isActive = true;
            console.log('✅ EmailJS ready for real emails');
        } catch (error) {
            console.error('❌ EmailJS init failed:', error);
            this.isActive = false;
        }
    }

    async sendWelcomeEmail(email, memberData) {
        console.log('📧 Attempting to send REAL welcome email to:', email);
        
        if (!this.isActive) {
            console.log('❌ EmailJS not active, using fallback');
            return this.fallbackEmail(email, memberData, 'welcome');
        }

        try {
            const templateParams = {
                to_email: email,
                member_name: memberData.name,
                jc_id: memberData.jcId,
                member_tier: memberData.tier,
                member_points: memberData.points,
                referral_code: memberData.referralCode,
                total_spent: memberData.totalSpent || 0,
                subject: `🎉 Welcome to Jean's Club!`
            };

            const response = await emailjs.send(
                'service_dcbc45g',
                'template_5wvl5cb',
                templateParams
            );

            console.log('✅ REAL welcome email sent successfully to:', email);
            return { 
                success: true, 
                message: "Welcome email sent successfully!",
                fallback: false
            };
        } catch (error) {
            console.error('❌ Real email failed:', error);
            return this.fallbackEmail(email, memberData, 'welcome');
        }
    }

    async sendPurchaseEmail(email, memberData, purchaseData) {
        console.log('📧 Attempting to send REAL purchase email to:', email);
        
        if (!this.isActive) {
            return this.fallbackEmail(email, memberData, 'purchase', purchaseData);
        }

        try {
            const templateParams = {
                to_email: email,
                member_name: memberData.name,
                jc_id: memberData.jcId,
                member_tier: memberData.tier,
                member_points: memberData.points,
                purchase_amount: purchaseData.amount.toLocaleString(),
                purchase_description: purchaseData.description,
                points_earned: purchaseData.pointsEarned,
                subject: `🛍️ Purchase Recorded - ${purchaseData.description}`
            };

            await emailjs.send(
                'service_dcbc45g',
                'template_5wvl5cb',
                templateParams
            );

            console.log('✅ REAL purchase email sent successfully to:', email);
            return { success: true, message: "Purchase email sent!", fallback: false };
        } catch (error) {
            console.error('❌ Real purchase email failed:', error);
            return this.fallbackEmail(email, memberData, 'purchase', purchaseData);
        }
    }

    async sendDiscountEmail(email, memberData, discountData) {
        console.log('📧 Attempting to send REAL discount email to:', email);
        
        if (!this.isActive) {
            return this.fallbackEmail(email, memberData, 'discount', discountData);
        }

        try {
            const templateParams = {
                to_email: email,
                member_name: memberData.name,
                jc_id: memberData.jcId,
                discount_percentage: discountData.discountPercentage,
                points_used: discountData.pointsUsed,
                max_discount: discountData.maxPossibleDiscount,
                subject: `💰 ${discountData.discountPercentage}% Discount Voucher`
            };

            await emailjs.send(
                'service_dcbc45g',
                'template_5wvl5cb',
                templateParams
            );

            console.log('✅ REAL discount email sent successfully to:', email);
            return { success: true, message: "Discount email sent!", fallback: false };
        } catch (error) {
            console.error('❌ Real discount email failed:', error);
            return this.fallbackEmail(email, memberData, 'discount', discountData);
        }
    }

    async sendReferralEmail(email, memberData, referralData) {
        console.log('📧 Attempting to send REAL referral email to:', email);
        
        if (!this.isActive) {
            return this.fallbackEmail(email, memberData, 'referral', referralData);
        }

        try {
            const templateParams = {
                to_email: email,
                member_name: memberData.name,
                jc_id: memberData.jcId,
                new_member_name: referralData.newMemberName,
                new_member_jc_id: referralData.newMemberJCId,
                points_earned: 100,
                subject: `👥 Referral Success! +100 Points`
            };

            await emailjs.send(
                'service_dcbc45g',
                'template_5wvl5cb',
                templateParams
            );

            console.log('✅ REAL referral email sent successfully to:', email);
            return { success: true, message: "Referral email sent!", fallback: false };
        } catch (error) {
            console.error('❌ Real referral email failed:', error);
            return this.fallbackEmail(email, memberData, 'referral', referralData);
        }
    }

    fallbackEmail(email, memberData, type, extraData = null) {
        let subject, content;

        switch(type) {
            case 'welcome':
                subject = `🎉 Welcome to Jean's Club!`;
                content = `
Hello ${memberData.name},

Welcome to Jean's Club! Your account has been created successfully.

MEMBERSHIP DETAILS:
• JC ID: ${memberData.jcId}
• Tier: ${memberData.tier}
• Points: ${memberData.points}
• Referral Code: ${memberData.referralCode}

Start earning points with your purchases!

Thank you for joining Jean's Club!
                `;
                break;

            case 'purchase':
                subject = `🛍️ Purchase Recorded - ${extraData.description}`;
                content = `
Hello ${memberData.name},

Your purchase has been recorded!

PURCHASE DETAILS:
• Amount: ${extraData.amount.toLocaleString()} UGX
• Description: ${extraData.description}
• Points Earned: +${extraData.pointsEarned}
• New Balance: ${memberData.points} points

Thank you for shopping with Jean's Club!
                `;
                break;

            case 'discount':
                subject = `💰 ${extraData.discountPercentage}% Discount Voucher`;
                content = `
Hello ${memberData.name},

Your discount voucher has been created!

DISCOUNT DETAILS:
• Discount: ${extraData.discountPercentage}%
• Points Used: ${extraData.pointsUsed}
• Max Possible: ${extraData.maxPossibleDiscount}

Present this email at checkout to redeem your discount!
                `;
                break;

            case 'referral':
                subject = `👥 Referral Success! +100 Points`;
                content = `
Hello ${memberData.name},

Congratulations! Someone joined using your referral code!

REFERRAL DETAILS:
• New Member: ${extraData.newMemberName} (${extraData.newMemberJCId})
• Points Earned: 100 points
• New Balance: ${memberData.points} points

Keep sharing your code: ${memberData.referralCode}
                `;
                break;
        }

        console.log('📧 FALLBACK EMAIL CONTENT:');
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

// Initialize email service
const emailService = new EmailService();

// Completely disable autofill and password saving
document.addEventListener('DOMContentLoaded', function() {
    // Method 1: Add hidden fake fields to confuse password managers
    const fakeForm = document.createElement('div');
    fakeForm.style.display = 'none';
    fakeForm.innerHTML = `
        <input type="text" name="fake-username" autocomplete="new-username">
        <input type="password" name="fake-password" autocomplete="new-password">
        <input type="email" name="fake-email" autocomplete="new-email">
    `;
    document.body.appendChild(fakeForm);
    
    // Method 2: Dynamically change input types and names
    const inputs = document.querySelectorAll('input[type="password"], input[type="email"], input[type="text"]');
    inputs.forEach(input => {
        // Store original type
        const originalType = input.type;
        
        // Change to text temporarily to confuse password managers
        setTimeout(() => {
            if (input.type === 'password') {
                input.type = 'text';
                setTimeout(() => {
                    input.type = 'password';
                }, 100);
            }
        }, 50);
        
        // Prevent context menu on inputs
        input.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Prevent drag and drop
        input.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
        
        // Prevent copy/paste for password fields
        if (input.type === 'password') {
            input.addEventListener('copy', function(e) {
                e.preventDefault();
                return false;
            });
            
            input.addEventListener('paste', function(e) {
                e.preventDefault();
                return false;
            });
            
            input.addEventListener('cut', function(e) {
                e.preventDefault();
                return false;
            });
        }
    });
    
    // Method 3: Clear inputs on page load
    setTimeout(() => {
        const clearableInputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
        clearableInputs.forEach(input => {
            if (!input.value && input.getAttribute('data-cleared') !== 'true') {
                input.value = '';
                input.setAttribute('data-cleared', 'true');
            }
        });
    }, 100);
});

// Google OAuth Configuration - REAL ID from Google Cloud
const googleConfig = {
    clientId: '607807821474-43243foqc9ml9eq3e0ugu04fnsigbqc5.apps.googleusercontent.com'
};

// Jean's Club Configuration
const jeansClubConfig = {
    pointValue: 750, // 1 point = 750 UGX spent
    redemptionRate: 0.005, // 0.5% discount per point
    
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

class JeansClubManager {
    constructor() {
        this.members = new Map();
        this.currentMember = null;
        this.isAdmin = false;
        this.loadFromStorage();
    }

    generateJCId() {
        return 'JC' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }

    generateReferralCode() {
        return 'JEANS' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // Create account with password
    async createAccount(userData, password, referralCode = null) {
        // Check if email already exists
        for (let [id, member] of this.members) {
            if (member.email === userData.email) {
                return { success: false, message: "Email already registered" };
            }
        }

        const memberId = 'member_' + Date.now();
        const hashedPassword = this.hashPassword(password);
        
        // New member gets 10 points
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
            challenges: []
        };

        this.members.set(memberId, newMember);
        this.currentMember = newMember;
        
        this.logActivity(memberId, `🎉 Account created - Welcome to Jean's Club!`, startingPoints);
        
        // Process referral if exists - REFERRER GETS 100 POINTS
        if (referralCode) {
            await this.processReferral(referralCode, newMember.jcId, newMember.name);
        }

        // Send welcome email using our email service
        const emailResult = await emailService.sendWelcomeEmail(newMember.email, newMember);

        this.saveToStorage();
        return { 
            success: true, 
            member: newMember,
            emailSent: emailResult.success,
            isFallback: emailResult.fallback || false
        };
    }

    // Create account with Google
    async createAccountWithGoogle(userData, referralCode = null) {
        // Check if email already exists
        for (let [id, member] of this.members) {
            if (member.email === userData.email) {
                return { success: false, message: "Email already registered" };
            }
        }

        const memberId = 'member_' + Date.now();
        
        // New member gets 10 points
        const startingPoints = 10;
        
        const newMember = {
            id: memberId,
            jcId: this.generateJCId(),
            email: userData.email,
            name: userData.name,
            password: null, // No password for Google users
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
            challenges: []
        };

        this.members.set(memberId, newMember);
        this.currentMember = newMember;
        
        this.logActivity(memberId, `🎉 Account created with Google - Welcome to Jean's Club!`, startingPoints);
        
        // Process referral if exists - REFERRER GETS 100 POINTS
        if (referralCode) {
            await this.processReferral(referralCode, newMember.jcId, newMember.name);
        }

        // Send welcome email
        const emailResult = await emailService.sendWelcomeEmail(newMember.email, newMember);

        this.saveToStorage();
        return { 
            success: true, 
            member: newMember,
            emailSent: emailResult.success,
            isFallback: emailResult.fallback || false
        };
    }

    // Login with BOTH JC ID AND Email
    login(jcId, email, password) {
        for (let [id, member] of this.members) {
            if (member.jcId === jcId && member.email === email) {
                if (member.loginMethod === 'google') {
                    return { success: false, message: "This account uses Google login. Please use Google Sign-In." };
                }
                if (this.verifyPassword(password, member.password)) {
                    this.currentMember = member;
                    this.logActivity(member.id, `🔐 Logged in to account`, 0);
                    return { success: true, member: member };
                } else {
                    return { success: false, message: "Invalid password" };
                }
            }
        }
        return { success: false, message: "Account not found - check JC ID and email" };
    }

    // Login with Google
    loginWithGoogle(email) {
        for (let [id, member] of this.members) {
            if (member.email === email && member.loginMethod === 'google') {
                this.currentMember = member;
                this.logActivity(member.id, `🔐 Logged in with Google`, 0);
                return { success: true, member: member };
            }
        }
        return { success: false, message: "Google account not found. Please sign up first." };
    }

    // Admin function to add purchase
    async addPurchase(memberJCId, amountUGX, description) {
        let targetMember = null;
        for (let [id, member] of this.members) {
            if (member.jcId === memberJCId) {
                targetMember = member;
                break;
            }
        }

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

        this.logActivity(targetMember.id, `🛍️ ${description} - ${amountUGX.toLocaleString()} UGX`, pointsEarned);

        // Send purchase confirmation email
        const purchaseData = {
            description: description,
            amount: amountUGX,
            pointsEarned: pointsEarned
        };
        await emailService.sendPurchaseEmail(targetMember.email, targetMember, purchaseData);

        this.saveToStorage();
        return {
            success: true,
            pointsEarned: pointsEarned,
            newPoints: targetMember.points,
            tierChanged: oldTier !== targetMember.tier,
            newTier: targetMember.tier
        };
    }

    // Process referral - REFERRER GETS 100 POINTS
    async processReferral(referralCode, newMemberJCId, newMemberName) {
        for (let [id, member] of this.members) {
            if (member.referralCode === referralCode) {
                // REFERRER GETS 100 POINTS
                member.points += 100;
                this.logActivity(member.id, `👥 Referral bonus - ${newMemberJCId} joined using your code!`, 100);
                member.tier = this.calculateTier(member.points);
                
                if (!member.referrals) member.referrals = [];
                member.referrals.push({
                    jcId: newMemberJCId,
                    name: newMemberName,
                    date: new Date().toISOString(),
                    pointsEarned: 100
                });

                // Send referral success email
                const referralData = {
                    newMemberName: newMemberName,
                    newMemberJCId: newMemberJCId
                };
                await emailService.sendReferralEmail(member.email, member, referralData);
                break;
            }
        }
        this.saveToStorage();
    }

    // Delete member account (Admin only)
    deleteMemberAccount(jcId) {
        if (!this.isAdmin) {
            return { success: false, message: "Admin access required" };
        }

        let memberToDelete = null;
        let memberIdToDelete = null;

        for (let [id, member] of this.members) {
            if (member.jcId === jcId) {
                memberToDelete = member;
                memberIdToDelete = id;
                break;
            }
        }

        if (!memberToDelete) {
            return { success: false, message: "Member not found" };
        }

        // Remove member from storage
        this.members.delete(memberIdToDelete);

        // If deleted member is current member, log them out
        if (this.currentMember && this.currentMember.jcId === jcId) {
            this.currentMember = null;
        }

        this.saveToStorage();
        return { 
            success: true, 
            message: `Account ${jcId} (${memberToDelete.name}) has been permanently deleted` 
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
        
        this.logActivity(member.id, `💰 ${discountCalc.pointsUsed} points for ${discountCalc.discountPercentage}% discount`, -discountCalc.pointsUsed);

        // Send discount voucher email
        const emailResult = await emailService.sendDiscountEmail(member.email, member, discountCalc);

        this.saveToStorage();
        return {
            success: true,
            pointsUsed: discountCalc.pointsUsed,
            discountPercentage: discountCalc.discountPercentage,
            emailSent: emailResult.success
        };
    }

    logActivity(memberId, message, points) {
        const member = this.members.get(memberId);
        if (member) {
            member.activityLog.unshift({
                timestamp: new Date().toISOString(),
                message: message,
                points: points
            });
            if (member.activityLog.length > 10) member.activityLog = member.activityLog.slice(0, 10);
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
        // Simple hashing for demo - in production use proper encryption
        return btoa(unescape(encodeURIComponent(password)));
    }

    verifyPassword(password, hashedPassword) {
        return btoa(unescape(encodeURIComponent(password))) === hashedPassword;
    }

    saveToStorage() {
        const data = {
            members: Array.from(this.members.entries()),
            currentMember: this.currentMember,
            isAdmin: this.isAdmin
        };
        localStorage.setItem('jeansClubData', JSON.stringify(data));
    }

    loadFromStorage() {
        const saved = localStorage.getItem('jeansClubData');
        if (saved) {
            const data = JSON.parse(saved);
            this.members = new Map(data.members);
            this.currentMember = data.currentMember;
            this.isAdmin = data.isAdmin || false;
        }
    }

    getReferralStats(memberId) {
        const member = this.members.get(memberId);
        if (!member || !member.referrals) return { totalReferrals: 0, totalPoints: 0 };
        return {
            totalReferrals: member.referrals.length,
            totalPoints: member.referrals.reduce((sum, ref) => sum + ref.pointsEarned, 0)
        };
    }

    getAllMembers() {
        return Array.from(this.members.values());
    }

    resetAllData() {
        this.members = new Map();
        this.currentMember = null;
        this.isAdmin = false;
        localStorage.removeItem('jeansClubData');
    }
}

// Initialize the system
const clubManager = new JeansClubManager();

// Google Sign-In Functions
function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({
            client_id: googleConfig.clientId,
            callback: handleGoogleSignIn,
            auto_select: false
        });
        
        // Render Google Sign-In button for signup
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

        // Render Google Sign-In button for login
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
        
        console.log('✅ Google Sign-In initialized successfully!');
    } catch (error) {
        console.log('❌ Google Sign-In not configured properly:', error);
        // Fallback buttons
        document.querySelector('.google-signin-button').innerHTML = `
            <button class="btn google" onclick="demoGoogleSignup()" style="width: 100%;">
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width: 20px; height: 20px; margin-right: 10px;">
                Sign up with Google (Demo)
            </button>
        `;
        document.querySelector('.google-login-button').innerHTML = `
            <button class="btn google" onclick="demoGoogleLogin()" style="width: 100%;">
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width: 20px; height: 20px; margin-right: 10px;">
                Login with Google (Demo)
            </button>
        `;
    }
}

// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    try {
        // Decode the credential response
        const responsePayload = JSON.parse(atob(response.credential.split('.')[1]));
        
        const userData = {
            name: responsePayload.name,
            email: responsePayload.email,
            picture: responsePayload.picture,
            googleId: responsePayload.sub
        };

        console.log('✅ Google Sign-In successful for:', userData.email);

        // Check if we're on signup or login page
        const isSignupPage = !document.getElementById('signupSection').classList.contains('hidden');
        
        if (isSignupPage) {
            // Signup flow
            const referralCode = document.getElementById('referralCode').value.trim() || null;
            const result = await clubManager.createAccountWithGoogle(userData, referralCode);
            
            if (result.success) {
                showDashboard(result.member);
                let message = `🎉 Welcome to Jean's Club!\n\nYour JC ID: ${result.member.jcId}\nKeep this safe - you'll need it for future logins!\n\n`;
                
                if (referralCode) {
                    message += `You got 10 points, your friend got 100 points!\n\n`;
                } else {
                    message += `You got 10 welcome points!\n\n`;
                }
                
                if (result.isFallback) {
                    message += `📧 Email details saved (check browser console for email content)\n\n`;
                } else if (result.emailSent) {
                    message += `📧 Welcome email sent to your inbox!\n\n`;
                }
                
                alert(message);
            } else {
                alert(result.message);
            }
        } else {
            // Login flow
            const result = clubManager.loginWithGoogle(userData.email);
            if (result.success) {
                showDashboard(result.member);
                alert(`Welcome back, ${result.member.name}!`);
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

// Demo Google functions for testing
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
        let message = `Demo Google account created!\nJC ID: ${result.member.jcId}\n\n`;
        if (result.isFallback) {
            message += `📧 Email details saved (check console)\n\n`;
        }
        alert(message);
    } else {
        alert(result.message);
    }
}

function demoGoogleLogin() {
    const email = prompt("Enter the email you used for Google signup:");
    if (!email) return;

    const result = clubManager.loginWithGoogle(email);
    if (result.success) {
        showDashboard(result.member);
        alert(`Welcome back, ${result.member.name}!`);
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

function showAdminPanel() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    viewAllMembers();
}

function showDashboard(member) {
    clubManager.currentMember = member;
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    
    // Update dashboard
    document.getElementById('memberJcId').textContent = member.jcId;
    document.getElementById('memberName').textContent = member.name;
    document.getElementById('memberEmail').textContent = member.email;
    document.getElementById('memberLoginMethod').textContent = member.loginMethod === 'google' ? 'Google' : 'Email';
    document.getElementById('memberTier').textContent = member.tier;
    document.getElementById('memberTier').className = `tier-${member.tier.toLowerCase()}`;
    document.getElementById('memberPoints').textContent = member.points.toLocaleString();
    document.getElementById('memberReferralCode').textContent = member.referralCode;
    document.getElementById('totalSpent').textContent = member.totalSpent.toLocaleString();
    
    const referralStats = clubManager.getReferralStats(member.id);
    document.getElementById('referralStats').innerHTML = `Referrals: ${referralStats.totalReferrals} friends, Earned: ${referralStats.totalPoints} points`;
    
    updateTierProgress(member);
    updateActivityLog(member);
}

function updateTierProgress(member) {
    const progress = clubManager.getTierProgress(member.points, member.tier);
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('tierProgressText');
    
    if (progress.nextTier) {
        progressFill.style.width = `${progress.percentage}%`;
        progressText.innerHTML = `Progress to ${progress.nextTier.name}: ${progress.percentage}% (${progress.pointsNeeded.toLocaleString()} points needed)`;
    } else {
        progressFill.style.width = '100%';
        progressText.innerHTML = `🎉 You've reached the highest tier!`;
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
        div.innerHTML = `<strong>${new Date(activity.timestamp).toLocaleDateString()}</strong><br>${activity.message} ${activity.points > 0 ? `+${activity.points} points` : activity.points < 0 ? `${activity.points} points` : ''}`;
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
}

function logout() {
    clubManager.currentMember = null;
    showLoginScreen();
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
    
    const userData = { name, email };
    const result = await clubManager.createAccount(userData, password, referralCode);
    
    if (result.success) {
        showDashboard(result.member);
        let message = `🎉 Welcome to Jean's Club!\n\nYour JC ID: ${result.member.jcId}\nKeep this safe - you'll need it to login!\n\n`;
        
        if (referralCode) {
            message += `You got 10 points, your friend got 100 points!\n\n`;
        } else {
            message += `You got 10 welcome points!\n\n`;
        }
        
        if (result.isFallback) {
            message += `📧 Email details saved (check browser console for full email content)\n\n`;
        } else if (result.emailSent) {
            message += `📧 Welcome email sent to your inbox!\n\n`;
        }
        
        alert(message);
    } else {
        alert(result.message);
    }
}

function loginWithCredentials() {
    const jcId = document.getElementById('loginJCId').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!jcId || !email || !password) {
        alert("Please enter JC ID, email and password");
        return;
    }
    
    const result = clubManager.login(jcId, email, password);
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
        discountResult.innerHTML = `Discount: ${result.discountPercentage}% (using ${result.pointsUsed} points)<br><small>Max discount for your tier: ${result.maxPossibleDiscount}</small>`;
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
        let message = `✅ ${result.discountPercentage}% discount voucher generated!\n\n`;
        message += result.emailSent 
            ? `📧 Voucher email sent to your inbox!`
            : `📧 Voucher details saved (check console for email content)`;
        
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
    const shareText = `Join Jean's Club Loyalty Program! 🎉\n\nUse my referral code when signing up: ${member.referralCode}\n\nWe both get bonus points:\n• You get 10 welcome points\n• I get 100 referral points\n\nSign up now and start earning rewards!`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('✅ Referral code copied to clipboard!\n\nShare it with friends via WhatsApp, SMS, or any messaging app!');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('✅ Referral code copied!\n\nShare it with friends via WhatsApp, SMS, or any messaging app!');
    }
}

// Admin Functions
function viewAllMembers() {
    const members = clubManager.getAllMembers();
    const adminContent = document.getElementById('adminContent');
    
    if (members.length === 0) {
        adminContent.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">
            <h3>No Members Yet</h3>
            <p>When customers sign up, they will appear here.</p>
        </div>`;
        return;
    }
    
    let html = `<h3>Total Members: ${members.length}</h3><div class="members-list">`;
    members.forEach(member => {
        const referralStats = clubManager.getReferralStats(member.id);
        html += `
            <div class="admin-card">
                <strong>${member.jcId}</strong> - ${member.name}<br>
                Email: ${member.email}<br>
                Login Method: ${member.loginMethod === 'google' ? 'Google' : 'Email'}<br>
                Tier: <span class="tier-${member.tier.toLowerCase()}">${member.tier}</span> | Points: ${member.points.toLocaleString()}<br>
                Spent: ${member.totalSpent.toLocaleString()} UGX<br>
                Referrals: ${referralStats.totalReferrals} friends<br>
                Referral Code: <code>${member.referralCode}</code><br>
                Joined: ${new Date(member.joinedDate).toLocaleDateString()}
            </div>
        `;
    });
    html += `</div>`;
    adminContent.innerHTML = html;
}

function adminAddPurchase() {
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

    clubManager.addPurchase(jcId, amount, description).then(result => {
        const purchaseResult = document.getElementById('purchaseResult');
        if (result.success) {
            purchaseResult.innerHTML = `<span style="color: green;">
                ✅ Purchase added!<br>
                • ${result.pointsEarned} points earned<br>
                • New balance: ${result.newPoints} points<br>
                ${result.tierChanged ? `• 🎉 Tier upgraded to ${result.newTier}!` : ''}
            </span>`;
            document.getElementById('purchaseJCId').value = '';
            document.getElementById('purchaseAmount').value = '';
            document.getElementById('purchaseDescription').value = '';
            setTimeout(viewAllMembers, 1000);
        } else {
            purchaseResult.innerHTML = `<span style="color: red;">❌ ${result.message}</span>`;
        }
    });
}

// Account Deletion Functions
function showDeleteMemberSection() {
    document.getElementById('deleteMemberSection').classList.remove('hidden');
    document.getElementById('deleteJCId').value = '';
    document.getElementById('deleteResult').innerHTML = '';
}

function confirmDeleteMember() {
    const jcId = document.getElementById('deleteJCId').value.trim();
    
    if (!jcId) {
        document.getElementById('deleteResult').innerHTML = '<span style="color: red;">Please enter a JC ID</span>';
        return;
    }

    if (!confirm(`⚠️ WARNING: This will permanently delete account ${jcId} and all associated data. This action cannot be undone!\n\nAre you sure you want to proceed?`)) {
        return;
    }

    const result = clubManager.deleteMemberAccount(jcId);
    const deleteResult = document.getElementById('deleteResult');
    
    if (result.success) {
        deleteResult.innerHTML = `<span style="color: green;">✅ ${result.message}</span>`;
        document.getElementById('deleteJCId').value = '';
        setTimeout(() => {
            viewAllMembers();
            document.getElementById('deleteMemberSection').classList.add('hidden');
        }, 2000);
    } else {
        deleteResult.innerHTML = `<span style="color: red;">❌ ${result.message}</span>`;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) document.getElementById('referralCode').value = refCode;
    
    // Initialize Google Sign-In
    setTimeout(initializeGoogleSignIn, 1000);
    
    if (clubManager.currentMember) {
        showDashboard(clubManager.currentMember);
    } else {
        showLoginScreen();
    }
});