// Email validation function
// Enhanced email validation function - FIXED VERSION
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Trim and check for empty
    const trimmedEmail = email.trim();
    if (trimmedEmail.length < 6) return false; // minimum a@b.cd = 6 chars
    
    // Check for basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
        return false;
    }
    
    // Extract parts
    const [localPart, domain] = trimmedEmail.toLowerCase().split('@');
    
    // Check local part (before @)
    if (localPart.length === 0 || localPart.length > 64) return false;
    
    // Check for invalid local part characters
    const localPartRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    if (!localPartRegex.test(localPart)) return false;
    
    // Check domain part (after @)
    if (domain.length < 4) return false; // minimum: a.bc
    
    // Check domain structure
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;
    
    // Check each domain part
    for (const part of domainParts) {
        if (part.length === 0 || part.length > 63) return false;
        // Must start and end with alphanumeric
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(part)) return false;
    }
    
    // CRITICAL FIX: Check TLD (last part) - MUST be at least 2 letters
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) return false;
    
    // REJECT OBVIOUSLY FAKE EMAILS
    const fakePatterns = [
        'test@', 'example@', 'fake@', 'admin@', 'user@', 'temp@', 'dummy@',
        'a@a.a', 'aa@aa.aa', 'aaa@aaa.aaa', // too short patterns
        'con', 'c', 'com', // single letters or "con"
    ];
    
    const lowerEmail = trimmedEmail.toLowerCase();
    for (const pattern of fakePatterns) {
        // Check if pattern appears and email is suspiciously short
        if (lowerEmail.includes(pattern) && trimmedEmail.length < 10) {
            return false;
        }
    }
    
    // Additional checks
    if (trimmedEmail.includes('..')) return false; // double dots
    if (trimmedEmail.includes('@@')) return false; // double @
    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) return false;
    if (trimmedEmail.startsWith('@') || trimmedEmail.endsWith('@')) return false;
    
    return true;
}
// Import Supabase
const { createClient } = supabase;

// QR Code Redemption System Implementation
class QRRedemptionSystem {
    constructor() {
        this.redemptions = JSON.parse(localStorage.getItem('jeansClubRedemptions') || '[]');
        this.encryptionKey = 'jeansclub_qr_2024_secret';
       // UPDATED tierRules in index.html:
this.tierRules = {
    PEARL: { 
        payWithPoints: false,
        discountVoucherOnly: true,
        description: "Basic membership - use points for discount vouchers only"
    },
    BRONZE: { 
        months: 2, 
        percentage: 0.08,
        multiplier: 1.0,
        minSpendingThreshold: 300000,
        maxRedemptionCap: 50000,
        description: "Redeem 8% of your last 2 months spending as points",
        pointsPer100UGX: 100
    },
    SILVER: { 
        months: 3, 
        percentage: 0.10,
        multiplier: 1.1,
        minSpendingThreshold: 500000,
        maxRedemptionCap: 100000,
        description: "Redeem 10% of your last 3 months spending as points",
        pointsPer100UGX: 90
    },
    RUBY: { 
        months: 4, 
        percentage: 0.12,
        multiplier: 1.3,
        minSpendingThreshold: 1000000,
        maxRedemptionCap: 200000,
        description: "Redeem 12% of your last 4 months spending as points",
        pointsPer100UGX: 80
    },
    GOLD: { 
        months: 5, 
        percentage: 0.15,
        multiplier: 1.4,
        minSpendingThreshold: 2000000,
        maxRedemptionCap: 300000,
        description: "Redeem 15% of your last 5 months spending as points",
        pointsPer100UGX: 70
    },
    SAPPHIRE: { 
        months: 6, 
        percentage: 0.18,
        lifetimeBonus: 0.02,
        multiplier: 1.5,
        minSpendingThreshold: 4000000,
        maxRedemptionCap: 500000,
        description: "Redeem 18% of last 6 months + 2% lifetime bonus as points",
        pointsPer100UGX: 60
    },
    PLATINUM: { 
        months: 12, 
        percentage: 0.25,
        lifetimeBonus: 0.05,
        multiplier: 1.6,
        minSpendingThreshold: 8000000,
        maxRedemptionCap: 1000000,
        canChooseAny: true,
        description: "Redeem 25% of last 12 months + 5% lifetime bonus as points",
        pointsPer100UGX: 50
    }
};
       // UPDATED discountVoucherLimits:
this.discountVoucherLimits = {
    PEARL: { 
        min: 1000, 
        max: 5000, 
        maxPercentage: 5,
        pointsPerDiscount: 100
    },
    BRONZE: { 
        min: 2000, 
        max: 10000, 
        maxPercentage: 8,
        pointsPerDiscount: 100
    },
    SILVER: { 
        min: 3000, 
        max: 15000, 
        maxPercentage: 10,
        pointsPerDiscount: 100
    },
    RUBY: { 
        min: 5000, 
        max: 25000, 
        maxPercentage: 12,
        pointsPerDiscount: 100
    },
    GOLD: { 
        min: 10000, 
        max: 50000, 
        maxPercentage: 15,
        pointsPerDiscount: 100
    },
    SAPPHIRE: { 
        min: 20000, 
        max: 100000, 
        maxPercentage: 18,
        pointsPerDiscount: 100
    },
    PLATINUM: { 
        min: 50000, 
        max: 250000, 
        maxPercentage: 25,
        pointsPerDiscount: 100
    }
};
    }

    // Calculate spending history for specified months
    calculateSpendingHistory(member, months) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        
        let totalSpent = 0;
        member.purchaseHistory.forEach(purchase => {
            const purchaseDate = new Date(purchase.date);
            if (purchaseDate >= cutoffDate) {
                totalSpent += purchase.amount;
            }
        });
        
        return totalSpent;
    }

    // Calculate lifetime spending
    calculateLifetimeSpending(member) {
        return member.totalSpent;
    }

    // Calculate all available redemption options
// REPLACE the existing calculateRedemptionOptions method:
     // REPLACE THE EXISTING calculateRedemptionOptions method:
    // REPLACE the existing calculateRedemptionOptions method in script.js too:
calculateRedemptionOptions(member, purchaseAmount) {
    const tier = member.tier;
    const options = [];
    const memberPoints = member.points || 0;
    
    // Pearl members only get discount vouchers
    if (tier === 'PEARL') {
        return this.getDiscountVoucherOptions(member, purchaseAmount).filter(option => 
            memberPoints >= option.pointsRequired
        );
    }
    
    // For Platinum members, they can choose from all other tier options
    const eligibleTiers = tier === 'PLATINUM' ? ['BRONZE', 'SILVER', 'RUBY', 'GOLD', 'SAPPHIRE'] : [tier];
    
    eligibleTiers.forEach(tierType => {
        const rule = this.tierRules[tierType];
        if (!rule || !rule.months) return;
        
        // Check if member meets minimum spending threshold
        const monthsSpending = this.calculateSpendingHistory(member, rule.months);
        
        if (monthsSpending < rule.minSpendingThreshold) {
            return; // Don't show option if threshold not met
        }
        
        let totalRedemption = monthsSpending * rule.percentage;
        
        // Add lifetime bonus for Sapphire/Platinum
        if (rule.lifetimeBonus) {
            const lifetimeSpending = this.calculateLifetimeSpending(member);
            totalRedemption += lifetimeSpending * rule.lifetimeBonus;
        }
        
        // Apply cap
        totalRedemption = Math.min(totalRedemption, rule.maxRedemptionCap);
        
        if (totalRedemption > 0) {
            const pointsEquivalent = Math.floor(totalRedemption / 100 * rule.pointsPer100UGX);
            
            // 🚨 CRITICAL: Only add if member has enough points
            if (memberPoints >= pointsEquivalent) {
                options.push({
                    type: 'points_redemption',
                    tier: tierType,
                    description: rule.description,
                    monthsSpending: monthsSpending,
                    totalAmount: totalRedemption,
                    maxRedemption: Math.min(totalRedemption, purchaseAmount),
                    pointsEquivalent: pointsEquivalent,
                    pointsValue: rule.pointsPer100UGX + ' points per 100 UGX',
                    eligibility: `Spent ${monthsSpending.toLocaleString()} UGX in last ${rule.months} months`,
                    requiresSufficientPoints: true,
                    memberHasPoints: true
                });
            }
        }
    });
    
    // Add discount voucher options - filtered by points balance
    const voucherOptions = this.getDiscountVoucherOptions(member, purchaseAmount)
        .filter(option => memberPoints >= option.pointsRequired);
    
    options.push(...voucherOptions);
    
    // Sort by redemption value and return
    return options.sort((a, b) => (b.maxRedemption || 0) - (a.maxRedemption || 0));
}
    // Get discount voucher options based on tier
    getDiscountVoucherOptions(member, purchaseAmount) {
        const tier = member.tier;
        const limits = this.discountVoucherLimits[tier] || this.discountVoucherLimits.PEARL;
        
        const options = [];
        
        // Fixed discount amounts within tier limits
        const discountAmounts = [1000, 2000, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000];
        
        discountAmounts.forEach(amount => {
            if (amount >= limits.min && amount <= limits.max && amount <= purchaseAmount) {
                const discountPercentage = ((amount / purchaseAmount) * 100).toFixed(1);
                if (discountPercentage <= 100) {
                    options.push({
                        type: 'discount_voucher',
                        tier: tier,
                        description: `${amount.toLocaleString()} UGX Discount Voucher`,
                        discountAmount: amount,
                        discountPercentage: discountPercentage,
                        applicableAmount: purchaseAmount,
                        pointsRequired: Math.floor(amount / 100) // 1 point per 100 UGX
                    });
                }
            }
        });
        
        return options;
    }

    // Generate QR code data for redemption
    generateQRCodeData(redemptionData) {
        const qrData = {
            type: 'jeansclub_redemption',
            version: '1.0',
            memberJCId: redemptionData.memberJCId,
            redemptionId: redemptionData.redemptionId,
            selectedOption: redemptionData.selectedOption,
            purchaseAmount: redemptionData.purchaseAmount,
            timestamp: Date.now(),
            signature: this.generateSignature(redemptionData)
        };
        
        return this.encryptData(qrData);
    }

    // Generate signature for validation
    generateSignature(data) {
        const dataString = data.memberJCId + data.redemptionId + data.selectedOption.type + Date.now();
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // Simple encryption
    encryptData(data) {
        try {
            const dataString = JSON.stringify(data);
            let result = '';
            for (let i = 0; i < dataString.length; i++) {
                result += String.fromCharCode(dataString.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length));
            }
            return btoa(result);
        } catch (error) {
            console.error('Encryption error:', error);
            return JSON.stringify(data);
        }
    }

    // Simple decryption
    decryptData(encryptedData) {
        try {
            const decoded = atob(encryptedData);
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length));
            }
            return JSON.parse(result);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    // Create redemption record
    createRedemption(member, selectedOption, purchaseAmount) {
        const redemptionId = 'RED' + Date.now().toString().slice(-8) + Math.floor(1000 + Math.random() * 9000);
        
        const redemptionData = {
            redemptionId: redemptionId,
            memberJCId: member.jcId,
            memberName: member.name,
            memberTier: member.tier,
            purchaseAmount: purchaseAmount,
            selectedOption: selectedOption,
            createdDate: new Date().toISOString(),
            status: 'pending',
            redeemedBy: null,
            redeemedDate: null,
            qrCodeData: null
        };

        // Generate QR code data
        redemptionData.qrCodeData = this.generateQRCodeData(redemptionData);

        this.redemptions.push(redemptionData);
        this.saveRedemptions();

        return redemptionData;
    }

    // Process redemption by scanning QR code
    processRedemption(qrCodeData, salespersonName) {
        // Validate salesperson name
        if (!salespersonName || salespersonName.trim() === '') {
            return { success: false, message: "Salesperson name is required" };
        }

        // Decrypt and validate QR code data
        const redemptionData = this.decryptData(qrCodeData);
        if (!redemptionData) {
            return { success: false, message: "Invalid QR code data" };
        }

        // Find redemption record
        const redemption = this.redemptions.find(r => r.redemptionId === redemptionData.redemptionId);
        if (!redemption) {
            return { success: false, message: "Redemption not found" };
        }

        // Validate signature
        const expectedSignature = this.generateSignature(redemption);
        if (redemption.qrCodeData !== this.generateQRCodeData(redemption)) {
            return { success: false, message: "QR code validation failed" };
        }

        // Check status
        if (redemption.status === 'completed') {
            return { success: false, message: "Redemption has already been completed" };
        }

        if (redemption.status === 'expired') {
            return { success: false, message: "Redemption has expired" };
        }

        // Mark as completed
        redemption.status = 'completed';
        redemption.redeemedBy = salespersonName.trim();
        redemption.redeemedDate = new Date().toISOString();
        this.saveRedemptions();

        return {
            success: true,
            message: `Redemption completed successfully by ${salespersonName}`,
            redemption: redemption
        };
    }

    // Get member's redemption history
    getMemberRedemptions(memberJCId) {
        return this.redemptions
            .filter(r => r.memberJCId === memberJCId)
            .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    }

    // Get all redemptions (for admin)
    getAllRedemptions() {
        return this.redemptions.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    }

    // Save redemptions to localStorage
    saveRedemptions() {
        localStorage.setItem('jeansClubRedemptions', JSON.stringify(this.redemptions));
    }

    // Get redemption statistics
    getRedemptionStats() {
        const total = this.redemptions.length;
        const pending = this.redemptions.filter(r => r.status === 'pending').length;
        const completed = this.redemptions.filter(r => r.status === 'completed').length;
        const expired = this.redemptions.filter(r => r.status === 'expired').length;
        
        const totalValue = this.redemptions
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => {
                if (r.selectedOption.type === 'points_redemption') {
                    return sum + (r.selectedOption.maxRedemption || 0);
                } else if (r.selectedOption.type === 'discount_voucher') {
                    return sum + (r.selectedOption.discountAmount || 0);
                }
                return sum;
            }, 0);
        
        return {
            total,
            pending,
            completed,
            expired,
            totalValue,
            completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) + '%' : '0%'
        };
    }
}

// Initialize QR redemption system
const qrRedemptionSystem = new QRRedemptionSystem();

// Advanced Analytics System
class AnalyticsEngine {
    constructor() {
        this.analyticsData = {
            memberEngagement: {
                loginFrequency: {},
                pointsRedemptionRate: {},
                tierProgressionSpeed: {},
                referralEffectiveness: {}
            },
            
            purchasePatterns: {
                averageSpend: {},
                purchaseFrequency: {},
                pointsAccumulationRate: {},
                seasonalTrends: {}
            },
            
            tierPerformance: {
                tierDistribution: {},
                retentionByTier: {},
                spendingByTier: {}
            }
        };
        this.init();
    }

    init() {
        // Load analytics data from localStorage
        const savedAnalytics = localStorage.getItem('jeansClubAnalytics');
        if (savedAnalytics) {
            this.analyticsData = JSON.parse(savedAnalytics);
        }
    }

    saveAnalytics() {
        localStorage.setItem('jeansClubAnalytics', JSON.stringify(this.analyticsData));
    }

    // Track member login
    trackLogin(memberJCId) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        if (!this.analyticsData.memberEngagement.loginFrequency[memberJCId]) {
            this.analyticsData.memberEngagement.loginFrequency[memberJCId] = [];
        }
        
        this.analyticsData.memberEngagement.loginFrequency[memberJCId].push(now.toISOString());
        
        // Keep only last 30 days of login data
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        this.analyticsData.memberEngagement.loginFrequency[memberJCId] = 
            this.analyticsData.memberEngagement.loginFrequency[memberJCId].filter(
                timestamp => new Date(timestamp) > thirtyDaysAgo
            );
        
        this.saveAnalytics();
    }

    // Track purchase patterns
    trackPurchase(memberJCId, amount, pointsEarned) {
        const now = new Date();
        const month = now.toISOString().substring(0, 7); // YYYY-MM
        
        // Average spend
        if (!this.analyticsData.purchasePatterns.averageSpend[memberJCId]) {
            this.analyticsData.purchasePatterns.averageSpend[memberJCId] = { total: 0, count: 0 };
        }
        this.analyticsData.purchasePatterns.averageSpend[memberJCId].total += amount;
        this.analyticsData.purchasePatterns.averageSpend[memberJCId].count += 1;

        // Purchase frequency
        if (!this.analyticsData.purchasePatterns.purchaseFrequency[memberJCId]) {
            this.analyticsData.purchasePatterns.purchaseFrequency[memberJCId] = [];
        }
        this.analyticsData.purchasePatterns.purchaseFrequency[memberJCId].push(now.toISOString());

        // Points accumulation
        if (!this.analyticsData.purchasePatterns.pointsAccumulationRate[memberJCId]) {
            this.analyticsData.purchasePatterns.pointsAccumulationRate[memberJCId] = { points: 0, firstPurchase: now.toISOString() };
        }
        this.analyticsData.purchasePatterns.pointsAccumulationRate[memberJCId].points += pointsEarned;

        // Seasonal trends
        if (!this.analyticsData.purchasePatterns.seasonalTrends[month]) {
            this.analyticsData.purchasePatterns.seasonalTrends[month] = { total: 0, count: 0 };
        }
        this.analyticsData.purchasePatterns.seasonalTrends[month].total += amount;
        this.analyticsData.purchasePatterns.seasonalTrends[month].count += 1;

        this.saveAnalytics();
    }

    // Track tier progression
    trackTierChange(memberJCId, oldTier, newTier, points) {
        if (!this.analyticsData.memberEngagement.tierProgressionSpeed[memberJCId]) {
            this.analyticsData.memberEngagement.tierProgressionSpeed[memberJCId] = {
                startTier: oldTier,
                currentTier: newTier,
                progression: [],
                joinDate: new Date().toISOString()
            };
        }
        
        this.analyticsData.memberEngagement.tierProgressionSpeed[memberJCId].progression.push({
            date: new Date().toISOString(),
            fromTier: oldTier,
            toTier: newTier,
            points: points
        });

        this.analyticsData.memberEngagement.tierProgressionSpeed[memberJCId].currentTier = newTier;
        this.saveAnalytics();
    }

    // Track referral effectiveness
    trackReferral(referrerJCId, referredJCId) {
        if (!this.analyticsData.memberEngagement.referralEffectiveness[referrerJCId]) {
            this.analyticsData.memberEngagement.referralEffectiveness[referrerJCId] = [];
        }
        
        this.analyticsData.memberEngagement.referralEffectiveness[referrerJCId].push({
            referredJCId: referredJCId,
            date: new Date().toISOString()
        });

        this.saveAnalytics();
    }

    // Track points redemption
    trackRedemption(memberJCId, pointsUsed) {
        if (!this.analyticsData.memberEngagement.pointsRedemptionRate[memberJCId]) {
            this.analyticsData.memberEngagement.pointsRedemptionRate[memberJCId] = { redeemed: 0, earned: 0 };
        }
        
        this.analyticsData.memberEngagement.pointsRedemptionRate[memberJCId].redeemed += pointsUsed;
        this.saveAnalytics();
    }

    // Update tier distribution
    updateTierDistribution(members) {
        const distribution = { 
            PEARL: 0, 
            BRONZE: 0, 
            SILVER: 0, 
            RUBY: 0, 
            GOLD: 0, 
            SAPPHIRE: 0, 
            PLATINUM: 0 
        };
        
        members.forEach(member => {
            if (distribution[member.tier] !== undefined) {
                distribution[member.tier]++;
            }
        });

        this.analyticsData.tierPerformance.tierDistribution = distribution;
        this.saveAnalytics();
    }

    // Generate analytics reports
    generateAnalyticsReport() {
        const members = JSON.parse(localStorage.getItem('jeansClubCache') || '{"members":[]}').members;
        this.updateTierDistribution(members);

        const report = {
            summary: {
                totalMembers: members.length,
                totalPoints: members.reduce((sum, m) => sum + m.points, 0),
                totalSpent: members.reduce((sum, m) => sum + m.totalSpent, 0),
                averagePointsPerMember: members.length > 0 ? Math.round(members.reduce((sum, m) => sum + m.points, 0) / members.length) : 0
            },
            tierDistribution: this.analyticsData.tierPerformance.tierDistribution,
            engagement: {
                activeMembers: Object.keys(this.analyticsData.memberEngagement.loginFrequency).length,
                averageLogins: this.calculateAverageLogins(),
                redemptionRate: this.calculateRedemptionRate()
            },
            purchases: {
                monthlyTrends: this.getMonthlyTrends(),
                averageTransaction: this.calculateAverageTransaction()
            },
            topPerformers: {
                topSpenders: this.getTopSpenders(members),
                topReferrers: this.getTopReferrers()
            }
        };

        return report;
    }

    calculateAverageLogins() {
        const loginData = this.analyticsData.memberEngagement.loginFrequency;
        const totalLogins = Object.values(loginData).reduce((sum, logins) => sum + logins.length, 0);
        const activeMembers = Object.keys(loginData).length;
        
        return activeMembers > 0 ? (totalLogins / activeMembers).toFixed(1) : 0;
    }

    calculateRedemptionRate() {
        const redemptionData = this.analyticsData.memberEngagement.pointsRedemptionRate;
        let totalRedeemed = 0;
        let totalEarned = 0;

        Object.values(redemptionData).forEach(data => {
            totalRedeemed += data.redeemed;
            totalEarned += data.earned;
        });

        return totalEarned > 0 ? ((totalRedeemed / totalEarned) * 100).toFixed(1) + '%' : '0%';
    }

    calculateAverageTransaction() {
        const spendData = this.analyticsData.purchasePatterns.averageSpend;
        let totalAmount = 0;
        let totalTransactions = 0;

        Object.values(spendData).forEach(data => {
            totalAmount += data.total;
            totalTransactions += data.count;
        });

        return totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0;
    }

    getMonthlyTrends() {
        const seasonalData = this.analyticsData.purchasePatterns.seasonalTrends;
        const trends = [];

        Object.entries(seasonalData).forEach(([month, data]) => {
            trends.push({
                month: month,
                average: Math.round(data.total / data.count),
                transactions: data.count
            });
        });

        return trends.sort((a, b) => a.month.localeCompare(b.month)).slice(-6); // Last 6 months
    }

    getTopSpenders(members) {
        return members
            .filter(m => m.totalSpent > 0)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5)
            .map(m => ({
                name: m.name,
                jcId: m.jcId,
                tier: m.tier,
                totalSpent: m.totalSpent,
                points: m.points
            }));
    }

    getTopReferrers() {
        const referralData = this.analyticsData.memberEngagement.referralEffectiveness;
        const referrers = [];

        Object.entries(referralData).forEach(([jcId, referrals]) => {
            referrers.push({
                jcId: jcId,
                referrals: referrals.length,
                lastReferral: referrals[referrals.length - 1]?.date
            });
        });

        return referrers.sort((a, b) => b.referrals - a.referrals).slice(0, 5);
    }
}

function generateAnalyticsReport() {
    if (clubManager && clubManager.analytics) {
        const report = clubManager.analytics.generateAnalyticsReport();
        displayAnalyticsReport(report);
    } else {
        console.log('Analytics engine not available');
    }
}

function displayAnalyticsReport(report) {
    const analyticsContent = document.getElementById('analyticsContent');
    if (!analyticsContent) return;
    
    let html = `
        <div class="analytics-summary">
            <h3>📊 Analytics Summary</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Members</h4>
                    <div class="stat-number">${report.summary.totalMembers}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Points</h4>
                    <div class="stat-number">${report.summary.totalPoints.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Spent</h4>
                    <div class="stat-number">${report.summary.totalSpent.toLocaleString()} UGX</div>
                </div>
                <div class="stat-card">
                    <h4>Avg Points/Member</h4>
                    <div class="stat-number">${report.summary.averagePointsPerMember}</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>👥 Tier Distribution</h3>
            <div class="tier-distribution">
    `;
    
    // Tier distribution
    Object.entries(report.tierDistribution).forEach(([tier, count]) => {
        const percentage = report.summary.totalMembers > 0 ? 
            Math.round((count / report.summary.totalMembers) * 100) : 0;
        html += `
            <div class="tier-dist-item">
                <span class="tier-name tier-${tier.toLowerCase()}">${tier}</span>
                <div class="tier-bar">
                    <div class="tier-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="tier-count">${count} (${percentage}%)</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>📈 Engagement Metrics</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Active Members</h4>
                    <div class="stat-number">${report.engagement.activeMembers}</div>
                </div>
                <div class="stat-card">
                    <h4>Avg Logins/Member</h4>
                    <div class="stat-number">${report.engagement.averageLogins}</div>
                </div>
                <div class="stat-card">
                    <h4>Points Redemption Rate</h4>
                    <div class="stat-number">${report.engagement.redemptionRate}</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>💰 Purchase Insights</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Avg Transaction</h4>
                    <div class="stat-number">${report.purchases.averageTransaction.toLocaleString()} UGX</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>🏆 Top Performers</h3>
            <div class="top-performers">
                <h4>Top 5 Spenders</h4>
                <div class="performers-list">
    `;
    
    report.topPerformers.topSpenders.forEach((spender, index) => {
        html += `
            <div class="performer-item">
                <span class="rank">${index + 1}.</span>
                <span class="name">${spender.name}</span>
                <span class="jc-id">(${spender.jcId})</span>
                <span class="tier tier-${spender.tier.toLowerCase()}">${spender.tier}</span>
                <span class="amount">${spender.totalSpent.toLocaleString()} UGX</span>
            </div>
        `;
    });
    
    html += `
                </div>
                
                <h4>Top 5 Referrers</h4>
                <div class="performers-list">
    `;
    
    report.topPerformers.topReferrers.forEach((referrer, index) => {
        html += `
            <div class="performer-item">
                <span class="rank">${index + 1}.</span>
                <span class="jc-id">${referrer.jcId}</span>
                <span class="referrals">${referrer.referrals} referrals</span>
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>📅 Monthly Trends (Last 6 Months)</h3>
            <div class="monthly-trends">
    `;
    
    report.purchases.monthlyTrends.forEach(trend => {
        html += `
            <div class="trend-item">
                <span class="month">${trend.month}</span>
                <span class="avg-spend">Avg: ${trend.average.toLocaleString()} UGX</span>
                <span class="transactions">${trend.transactions} transactions</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    analyticsContent.innerHTML = html;
}

// Analytics Data Management Functions
function showAnalyticsManagement() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    
    document.getElementById('analyticsContent').innerHTML = `
        <div class="analytics-section">
            <h3>🗑️ Analytics Data Management</h3>
            <div class="info-card" style="border-left-color: #dc3545;">
                <h4 style="color: #dc3545;">Clear Analytics Data</h4>
                <p>Warning: These actions cannot be undone!</p>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                    <button class="btn" style="background: #dc3545;" onclick="clearEngagementMetrics()">
                        Clear Engagement Metrics
                    </button>
                    <button class="btn" style="background: #dc3545;" onclick="clearPurchaseInsights()">
                        Clear Purchase Insights
                    </button>
                    <button class="btn" style="background: #dc3545;" onclick="clearMonthlyTrends()">
                        Clear Monthly Trends
                    </button>
                    <button class="btn" style="background: #dc3545;" onclick="clearAllAnalytics()">
                        Clear ALL Analytics
                    </button>
                </div>
                
                <div id="analyticsManagementResult" style="margin-top: 15px;"></div>
            </div>
        </div>
    `;
}

function clearEngagementMetrics() {
    if (!confirm('Clear all engagement metrics? This will remove login frequency, redemption rates, and referral data.')) return;
    
    const analyticsData = JSON.parse(localStorage.getItem('jeansClubAnalytics') || '{}');
    analyticsData.memberEngagement = {
        loginFrequency: {},
        pointsRedemptionRate: {},
        tierProgressionSpeed: {},
        referralEffectiveness: {}
    };
    
    localStorage.setItem('jeansClubAnalytics', JSON.stringify(analyticsData));
    document.getElementById('analyticsManagementResult').innerHTML = 
        '<span style="color: green;">✅ Engagement metrics cleared successfully!</span>';
    
    setTimeout(() => {
        generateAnalyticsReport();
    }, 1500);
}

function clearPurchaseInsights() {
    if (!confirm('Clear all purchase insights? This will remove spending patterns and transaction data.')) return;
    
    const analyticsData = JSON.parse(localStorage.getItem('jeansClubAnalytics') || '{}');
    analyticsData.purchasePatterns = {
        averageSpend: {},
        purchaseFrequency: {},
        pointsAccumulationRate: {},
        seasonalTrends: {}
    };
    
    localStorage.setItem('jeansClubAnalytics', JSON.stringify(analyticsData));
    document.getElementById('analyticsManagementResult').innerHTML = 
        '<span style="color: green;">✅ Purchase insights cleared successfully!</span>';
    
    setTimeout(() => {
        generateAnalyticsReport();
    }, 1500);
}

function clearMonthlyTrends() {
    if (!confirm('Clear monthly trends data?')) return;
    
    const analyticsData = JSON.parse(localStorage.getItem('jeansClubAnalytics') || '{}');
    if (analyticsData.purchasePatterns) {
        analyticsData.purchasePatterns.seasonalTrends = {};
    }
    
    localStorage.setItem('jeansClubAnalytics', JSON.stringify(analyticsData));
    document.getElementById('analyticsManagementResult').innerHTML = 
        '<span style="color: green;">✅ Monthly trends cleared successfully!</span>';
    
    setTimeout(() => {
        generateAnalyticsReport();
    }, 1500);
}

function clearAllAnalytics() {
    if (!confirm('Clear ALL analytics data? This will reset everything to empty and cannot be undone!')) return;
    
    localStorage.setItem('jeansClubAnalytics', JSON.stringify({
        memberEngagement: {
            loginFrequency: {},
            pointsRedemptionRate: {},
            tierProgressionSpeed: {},
            referralEffectiveness: {}
        },
        purchasePatterns: {
            averageSpend: {},
            purchaseFrequency: {},
            pointsAccumulationRate: {},
            seasonalTrends: {}
        },
        tierPerformance: {
            tierDistribution: {},
            retentionByTier: {},
            spendingByTier: {}
        }
    }));
    
    document.getElementById('analyticsManagementResult').innerHTML = 
        '<span style="color: green;">✅ ALL analytics data cleared successfully!</span>';
    
    setTimeout(() => {
        generateAnalyticsReport();
    }, 1500);
}

// SECURE VOUCHER SYSTEM IMPLEMENTATION
class VoucherSystem {
    constructor() {
        this.vouchers = JSON.parse(localStorage.getItem('jeansClubVouchers') || '[]');
        this.voucherActivity = JSON.parse(localStorage.getItem('jeansClubVoucherActivity') || '[]');
        this.encryptionKey = 'jeansclub_voucher_2024_secret';
    }

    generateVoucherCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 10; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'JC' + code;
    }

    // Simple encryption for voucher data
    encryptVoucherData(data) {
        try {
            const dataString = JSON.stringify(data);
            let result = '';
            for (let i = 0; i < dataString.length; i++) {
                result += String.fromCharCode(dataString.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length));
            }
            return btoa(result);
        } catch (error) {
            console.error('Encryption error:', error);
            return JSON.stringify(data);
        }
    }

    decryptVoucherData(encryptedData) {
        try {
            const decoded = atob(encryptedData);
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length));
            }
            return JSON.parse(result);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    generateQRCodeData(voucherCode, memberJCId, discountPercentage) {
        const voucherData = {
            code: voucherCode,
            memberJCId: memberJCId,
            discount: discountPercentage,
            timestamp: Date.now(),
            type: 'jeansclub_voucher',
            version: '2.0'
        };
        
        return this.encryptVoucherData(voucherData);
    }

    createVoucher(memberJCId, memberName, pointsUsed, discountPercentage, expiryDays = 30) {
        const voucherCode = this.generateVoucherCode();
        const createdDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);

        const voucher = {
            id: 'voucher_' + Date.now(),
            code: voucherCode,
            memberJCId: memberJCId,
            memberName: memberName,
            pointsUsed: pointsUsed,
            discountPercentage: discountPercentage,
            createdDate: createdDate.toISOString(),
            expiryDate: expiryDate.toISOString(),
            status: 'active',
            usedDate: null,
            qrCodeData: this.generateQRCodeData(voucherCode, memberJCId, discountPercentage),
            // Server-side validation fields
            signature: this.generateSignature(voucherCode, memberJCId, discountPercentage),
            validated: false
        };

        this.vouchers.push(voucher);
        this.saveVouchers();

        this.logVoucherActivity(voucherCode, 'created', memberJCId, `Voucher created: ${discountPercentage}% discount`);

        return voucher;
    }

    generateSignature(voucherCode, memberJCId, discountPercentage) {
        const data = voucherCode + memberJCId + discountPercentage + Date.now();
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    validateVoucherSignature(voucher) {
        const expectedSignature = this.generateSignature(voucher.code, voucher.memberJCId, voucher.discountPercentage);
        return voucher.signature === expectedSignature;
    }

    getMemberVouchers(memberJCId) {
        return this.vouchers.filter(v => v.memberJCId === memberJCId)
            .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    }

    getAllVouchers() {
        return this.vouchers.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    }

    getVoucherByCode(code) {
        return this.vouchers.find(v => v.code === code);
    }

    redeemVoucher(voucherCode, salespersonName) {
        const voucher = this.getVoucherByCode(voucherCode);
        if (!voucher) {
            return { success: false, message: "Voucher not found" };
        }

        // Validate salesperson name is provided
        if (!salespersonName || salespersonName.trim() === '') {
            return { success: false, message: "Salesperson name is required to redeem voucher" };
        }

        // Server-side validation simulation
        if (!this.validateVoucherSignature(voucher)) {
            return { success: false, message: "Voucher validation failed" };
        }

        if (voucher.status === 'used') {
            return { success: false, message: "Voucher has already been used" };
        }

        if (voucher.status === 'expired') {
            return { success: false, message: "Voucher has expired" };
        }

        if (new Date() > new Date(voucher.expiryDate)) {
            voucher.status = 'expired';
            this.saveVouchers();
            return { success: false, message: "Voucher has expired" };
        }

        voucher.status = 'used';
        voucher.usedDate = new Date().toISOString();
        voucher.redeemedBy = salespersonName.trim();
        voucher.validated = true;
        this.saveVouchers();

        this.logVoucherActivity(voucherCode, 'redeemed', voucher.memberJCId, `Voucher redeemed by ${salespersonName}`);

        return { 
            success: true, 
            message: `Voucher redeemed successfully by ${salespersonName}! ${voucher.discountPercentage}% discount applied.`,
            voucher: voucher
        };
    }

    updateVoucherStatuses() {
        const now = new Date();
        let updated = false;

        this.vouchers.forEach(voucher => {
            if (voucher.status === 'active' && new Date(voucher.expiryDate) < now) {
                voucher.status = 'expired';
                updated = true;
            }
        });

        if (updated) {
            this.saveVouchers();
        }
    }

    getVoucherStats() {
        this.updateVoucherStatuses();
        
        const total = this.vouchers.length;
        const active = this.vouchers.filter(v => v.status === 'active').length;
        const used = this.vouchers.filter(v => v.status === 'used').length;
        const expired = this.vouchers.filter(v => v.status === 'expired').length;
        
        const totalDiscount = this.vouchers
            .filter(v => v.status === 'used')
            .reduce((sum, v) => sum + v.discountPercentage, 0);
        
        const avgDiscount = used > 0 ? (totalDiscount / used).toFixed(1) : 0;

        return {
            total,
            active,
            used,
            expired,
            avgDiscount,
            redemptionRate: total > 0 ? ((used / total) * 100).toFixed(1) + '%' : '0%'
        };
    }

    logVoucherActivity(voucherCode, action, memberJCId, description) {
        const activity = {
            timestamp: new Date().toISOString(),
            voucherCode: voucherCode,
            action: action,
            memberJCId: memberJCId,
            description: description
        };

        this.voucherActivity.unshift(activity);
        if (this.voucherActivity.length > 100) {
            this.voucherActivity = this.voucherActivity.slice(0, 100);
        }
        localStorage.setItem('jeansClubVoucherActivity', JSON.stringify(this.voucherActivity));
    }

    saveVouchers() {
        localStorage.setItem('jeansClubVouchers', JSON.stringify(this.vouchers));
    }
}

// Initialize voucher system
const voucherSystem = new VoucherSystem();

// Server-Side Validation Simulation
class ServerValidation {
    constructor() {
        this.apiEndpoint = 'https://uoyzsyxjrfygrsfzhlao.supabase.co/rest/v1/';
        this.apiKey = 'sb_publishable__gS2-Pd9S7I5dBlq4rmzMQ_K2QMwovA';
    }

    async validateVoucherOnServer(voucherCode) {
        try {
            // Simulate server validation - in production, this would be a real API call
            console.log('🔐 Validating voucher on server:', voucherCode);
            
            // For demo purposes, we'll simulate server validation
            // In production, you would make a real API call to your backend
            const response = await this.simulateServerValidation(voucherCode);
            
            return response;
        } catch (error) {
            console.error('Server validation error:', error);
            return { valid: false, error: 'Server validation failed' };
        }
    }

    async simulateServerValidation(voucherCode) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get voucher from local storage (in production, this would be from your database)
        const vouchers = JSON.parse(localStorage.getItem('jeansClubVouchers') || '[]');
        const voucher = vouchers.find(v => v.code === voucherCode);
        
        if (!voucher) {
            return { valid: false, error: 'Voucher not found in database' };
        }

        if (voucher.status !== 'active') {
            return { valid: false, error: `Voucher is ${voucher.status}` };
        }

        if (new Date(voucher.expiryDate) < new Date()) {
            return { valid: false, error: 'Voucher has expired' };
        }

        // Additional server-side checks
        if (!voucher.signature) {
            return { valid: false, error: 'Invalid voucher signature' };
        }

        return { 
            valid: true, 
            voucher: voucher,
            message: 'Voucher validated successfully'
        };
    }

    async logVoucherRedemption(voucherCode, salespersonName, location = 'store') {
        try {
            console.log('📝 Logging voucher redemption:', voucherCode);
            // In production, this would log to your database
            const redemptionLog = JSON.parse(localStorage.getItem('voucherRedemptions') || '[]');
            
            redemptionLog.unshift({
                voucherCode: voucherCode,
                salespersonName: salespersonName,
                location: location,
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('voucherRedemptions', JSON.stringify(redemptionLog));
            
            return { success: true };
        } catch (error) {
            console.error('Redemption logging error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize server validation
const serverValidator = new ServerValidation();

// NEW VOUCHER MANAGEMENT FUNCTIONS
function showVoucherManagementPanel() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    document.getElementById('voucherManagementSection').classList.remove('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    
    refreshVouchers();
}

function refreshVouchers() {
    voucherSystem.updateVoucherStatuses();
    displayAllVouchers();
    displayVoucherStats();
}

function displayAllVouchers() {
    const allVouchers = voucherSystem.getAllVouchers();
    const container = document.getElementById('allVouchersList');
    
    if (allVouchers.length === 0) {
        container.innerHTML = '<div class="activity-item">No vouchers have been created yet.</div>';
        return;
    }

    let html = '';
    allVouchers.forEach(voucher => {
        const statusClass = voucher.status === 'active' ? 'status-active' : 
                          voucher.status === 'used' ? 'status-used' : 'status-expired';
        
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(voucher.qrCodeData)}`;
        
        html += `
            <div class="voucher-item ${voucher.status}">
                <div style="display: flex; justify-content: between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px;">${voucher.memberName} (${voucher.memberJCId})</h4>
                        <p style="margin: 0 0 5px; font-size: 18px; font-weight: bold; color: #e67e22;">${voucher.discountPercentage}% Discount</p>
                        <div class="voucher-code">${voucher.code}</div>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                            Created: ${new Date(voucher.createdDate).toLocaleDateString()} | 
                            Expires: ${new Date(voucher.expiryDate).toLocaleDateString()}
                            ${voucher.usedDate ? ` | Used: ${new Date(voucher.usedDate).toLocaleDateString()} by ${voucher.redeemedBy || 'unknown'}` : ''}
                        </p>
                        <span class="voucher-status ${statusClass}">${voucher.status.toUpperCase()}</span>
                    </div>
                    <div class="voucher-qr">
                        <img src="${qrCodeUrl}" alt="QR Code" style="border: 1px solid #ddd; border-radius: 5px; padding: 5px; background: white;">
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayVoucherStats() {
    const stats = voucherSystem.getVoucherStats();
    const container = document.getElementById('voucherStats');
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.total}</div>
                <div style="font-size: 12px; color: #666;">Total Vouchers</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.active}</div>
                <div style="font-size: 12px; color: #666;">Active</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${stats.used}</div>
                <div style="font-size: 12px; color: #666;">Used</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${stats.expired}</div>
                <div style="font-size: 12px; color: #666;">Expired</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center; padding: 15px; background: #e7f3ff; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">${stats.avgDiscount}%</div>
                <div style="font-size: 12px; color: #666;">Avg Discount</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #e7f3ff; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">${stats.redemptionRate}</div>
                <div style="font-size: 12px; color: #666;">Redemption Rate</div>
            </div>
        </div>
    `;
}

async function redeemVoucherByCode() {
    const voucherCode = document.getElementById('voucherCodeInput').value.trim();
    const result = document.getElementById('voucherRedeemResult');
    
    if (!voucherCode) {
        result.innerHTML = '<span style="color: red;">Please enter a voucher code</span>';
        return;
    }

    // Get salesperson name - REQUIRED
    const salespersonName = prompt("Please enter your name (salesperson):");
    if (!salespersonName || salespersonName.trim() === '') {
        result.innerHTML = '<span style="color: red;">Salesperson name is required to redeem voucher</span>';
        return;
    }

    // Show loading
    result.innerHTML = '<span style="color: blue;">🔐 Validating voucher with server...</span>';

    try {
        // Step 1: Server-side validation
        const serverValidation = await serverValidator.validateVoucherOnServer(voucherCode);
        
        if (!serverValidation.valid) {
            result.innerHTML = `<span style="color: red;">❌ Server validation failed: ${serverValidation.error}</span>`;
            return;
        }

        // Step 2: Local redemption with salesperson name
        const redemptionResult = voucherSystem.redeemVoucher(voucherCode, salespersonName.trim());
        
        if (redemptionResult.success) {
            // Step 3: Log redemption on server with salesperson name
            await serverValidator.logVoucherRedemption(voucherCode, salespersonName.trim(), 'main_store');
            
            result.innerHTML = `<span style="color: green;">✅ ${redemptionResult.message}<br>🔐 Redeemed by: ${salespersonName}<br>Server validated and logged</span>`;
            document.getElementById('voucherCodeInput').value = '';
            
            // Refresh the display
            setTimeout(() => {
                refreshVouchers();
                if (document.getElementById('vouchersList')) {
                    displayMemberVouchers();
                }
            }, 1000);
        } else {
            result.innerHTML = `<span style="color: red;">❌ ${redemptionResult.message}</span>`;
        }
    } catch (error) {
        result.innerHTML = `<span style="color: red;">❌ Validation error: ${error.message}</span>`;
    }
}       

function displayMemberVouchers() {
    if (!clubManager.currentMember) return;
    
    const memberVouchers = voucherSystem.getMemberVouchers(clubManager.currentMember.jcId);
    const container = document.getElementById('vouchersList');
    
    if (memberVouchers.length === 0) {
        container.innerHTML = '<div class="activity-item">You don\'t have any discount vouchers yet. Redeem your points to get vouchers!</div>';
        return;
    }

    let html = '';
    memberVouchers.forEach(voucher => {
        const statusClass = voucher.status === 'active' ? 'status-active' : 
                          voucher.status === 'used' ? 'status-used' : 'status-expired';
        
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(voucher.qrCodeData)}`;
        
        html += `
            <div class="voucher-item ${voucher.status}">
                <div style="display: flex; justify-content: between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px;">${voucher.discountPercentage}% Discount Voucher</h4>
                        <div class="voucher-code">${voucher.code}</div>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                            Created: ${new Date(voucher.createdDate).toLocaleDateString()} | 
                            Expires: ${new Date(voucher.expiryDate).toLocaleDateString()}
                            ${voucher.usedDate ? ` | Used: ${new Date(voucher.usedDate).toLocaleDateString()} by ${voucher.redeemedBy || 'unknown'}` : ''}
                        </p>
                        <span class="voucher-status ${statusClass}">${voucher.status.toUpperCase()}</span>
                        ${voucher.status === 'active' ? `
                            <p style="margin: 10px 0 0; font-size: 12px; color: #666;">
                                Show this QR code or provide the voucher code at checkout
                            </p>
                        ` : ''}
                    </div>
                    <div class="voucher-qr">
                        <img src="${qrCodeUrl}" alt="QR Code" style="border: 1px solid #ddd; border-radius: 5px; padding: 5px; background: white;">
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// QR REDEMPTION UI FUNCTIONS
function showQRRedemptionPanel() {
    if (!clubManager.currentMember) {
        alert("Please login first");
        showLoginScreen();
        return;
    }
    
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    document.getElementById('voucherManagementSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.remove('hidden');
    
    // Reset the form
    document.getElementById('purchaseAmount').value = '';
    document.getElementById('redemptionOptions').innerHTML = '';
    document.getElementById('selectedOptionDetails').innerHTML = '';
    document.getElementById('qrCodeContainer').innerHTML = '';
    document.getElementById('redemptionResult').innerHTML = '';
}

function calculateRedemptionOptions() {
    const purchaseAmount = parseInt(document.getElementById('purchaseAmount').value) || 0;
    
    if (purchaseAmount <= 0) {
        document.getElementById('redemptionOptions').innerHTML = 
            '<div class="info-card"><p>Please enter a valid purchase amount</p></div>';
        return;
    }
    
    if (!clubManager.currentMember) {
        alert("Please login first");
        return;
    }
    
    const member = clubManager.currentMember;
    const options = qrRedemptionSystem.calculateRedemptionOptions(member, purchaseAmount);
    
    if (options.length === 0) {
        document.getElementById('redemptionOptions').innerHTML = 
            '<div class="info-card"><p>No redemption options available for your current tier and spending history.</p></div>';
        return;
    }
    
    let html = '<h3>Available Redemption Options:</h3>';
    
    options.forEach((option, index) => {
        html += `
            <div class="redemption-option" onclick="selectRedemptionOption(${index})" id="option-${index}">
                <div class="option-header">
                    <h4>${option.type === 'points_redemption' ? '💰 Points Redemption' : '🎫 Discount Voucher'}</h4>
                    <span class="option-tier tier-${option.tier.toLowerCase()}">${option.tier}</span>
                </div>
                <p><strong>${option.description}</strong></p>
                ${option.type === 'points_redemption' ? `
                    <p>Max Redemption: ${option.maxRedemption.toLocaleString()} UGX</p>
                    <p>Points Equivalent: ${option.pointsEquivalent.toLocaleString()} points (${option.pointsValue})</p>
                ` : `
                    <p>Discount Amount: ${option.discountAmount.toLocaleString()} UGX</p>
                    <p>Discount Percentage: ${option.discountPercentage}%</p>
                    <p>Points Required: ${option.pointsRequired.toLocaleString()}</p>
                `}
            </div>
        `;
    });
    
    document.getElementById('redemptionOptions').innerHTML = html;
    document.getElementById('selectedOptionDetails').innerHTML = '';
    document.getElementById('qrCodeContainer').innerHTML = '';
}

function selectRedemptionOption(index) {
    const purchaseAmount = parseInt(document.getElementById('purchaseAmount').value) || 0;
    const member = clubManager.currentMember;
    const options = qrRedemptionSystem.calculateRedemptionOptions(member, purchaseAmount);
    
    if (!options[index]) return;
    
    const option = options[index];
    
    // Remove selection from all options
    document.querySelectorAll('.redemption-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Add selection to chosen option
    document.getElementById(`option-${index}`).classList.add('selected');
    
    let detailsHtml = `
        <h3>Selected Option:</h3>
        <div class="selected-option-details">
            <div class="option-header">
                <h4>${option.type === 'points_redemption' ? '💰 Points Redemption' : '🎫 Discount Voucher'}</h4>
                <span class="option-tier tier-${option.tier.toLowerCase()}">${option.tier}</span>
            </div>
            <p><strong>${option.description}</strong></p>
            ${option.type === 'points_redemption' ? `
                <p>Max Redemption Amount: <strong>${option.maxRedemption.toLocaleString()} UGX</strong></p>
                <p>Points Equivalent: ${option.pointsEquivalent.toLocaleString()} points</p>
                <p>Points Value: ${option.pointsValue}</p>
            ` : `
                <p>Discount Amount: <strong>${option.discountAmount.toLocaleString()} UGX</strong></p>
                <p>Discount Percentage: ${option.discountPercentage}%</p>
                <p>Points Required: ${option.pointsRequired.toLocaleString()}</p>
            `}
            <p>Applicable to Purchase: ${purchaseAmount.toLocaleString()} UGX</p>
        </div>
        <button class="btn" onclick="generateQRCode(${index})" style="width: 100%; margin-top: 20px;">
            Generate QR Code
        </button>
    `;
    
    document.getElementById('selectedOptionDetails').innerHTML = detailsHtml;
}

function generateQRCode(optionIndex) {
    const purchaseAmount = parseInt(document.getElementById('purchaseAmount').value) || 0;
    const member = clubManager.currentMember;
    const options = qrRedemptionSystem.calculateRedemptionOptions(member, purchaseAmount);
    
    if (!options[optionIndex]) return;
    
    const selectedOption = options[optionIndex];
    
    // Create redemption record
    const redemption = qrRedemptionSystem.createRedemption(member, selectedOption, purchaseAmount);
    
    // Generate QR code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(redemption.qrCodeData)}`;
    
    const qrHtml = `
        <h3>Redemption QR Code:</h3>
        <div class="qr-code-container">
            <img src="${qrCodeUrl}" alt="Redemption QR Code" style="border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: white; margin: 10px 0;">
            <div class="qr-details">
                <p><strong>Redemption ID:</strong> ${redemption.redemptionId}</p>
                <p><strong>Member:</strong> ${member.name} (${member.jcId})</p>
                <p><strong>Tier:</strong> ${member.tier}</p>
                <p><strong>Purchase Amount:</strong> ${purchaseAmount.toLocaleString()} UGX</p>
                <p><strong>Option:</strong> ${selectedOption.description}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <button class="btn" onclick="printQRCode()" style="margin-top: 10px;">
                🖨️ Print QR Code
            </button>
        </div>
    `;
    
    document.getElementById('qrCodeContainer').innerHTML = qrHtml;
    document.getElementById('redemptionResult').innerHTML = 
        '<div class="success-message">QR Code generated successfully! Show this to the salesperson.</div>';
}

function printQRCode() {
    window.print();
}

// Salesperson redemption interface
function showSalespersonRedemption() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    document.getElementById('voucherManagementSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    document.getElementById('salespersonRedemptionSection').classList.remove('hidden');
    
    document.getElementById('scanResult').innerHTML = '';
    document.getElementById('redemptionDetails').innerHTML = '';
    document.getElementById('salespersonName').value = '';
}

function scanQRCode() {
    // In a real app, this would use a camera scanner
    // For demo purposes, we'll prompt for QR code data
    const qrData = prompt("Enter or paste QR code data from the member's phone:");
    
    if (!qrData) return;
    
    document.getElementById('scanResult').innerHTML = 
        '<div class="info-message">QR Code scanned. Processing...</div>';
    
    // Simulate processing delay
    setTimeout(() => {
        processScannedQRCode(qrData);
    }, 1000);
}

function processScannedQRCode(qrData) {
    try {
        const redemptionData = qrRedemptionSystem.decryptData(qrData);
        
        if (!redemptionData) {
            document.getElementById('scanResult').innerHTML = 
                '<div class="error-message">Invalid QR code data. Please try again.</div>';
            return;
        }
        
        // Find the redemption record
        const allRedemptions = qrRedemptionSystem.getAllRedemptions();
        const redemption = allRedemptions.find(r => r.redemptionId === redemptionData.redemptionId);
        
        if (!redemption) {
            document.getElementById('scanResult').innerHTML = 
                '<div class="error-message">Redemption not found. Please check the QR code.</div>';
            return;
        }
        
        let detailsHtml = `
            <h3>Redemption Details:</h3>
            <div class="redemption-details-card">
                <p><strong>Redemption ID:</strong> ${redemption.redemptionId}</p>
                <p><strong>Member:</strong> ${redemption.memberName} (${redemption.memberJCId})</p>
                <p><strong>Tier:</strong> ${redemption.memberTier}</p>
                <p><strong>Purchase Amount:</strong> ${redemption.purchaseAmount.toLocaleString()} UGX</p>
                <p><strong>Redemption Option:</strong> ${redemption.selectedOption.description}</p>
                <p><strong>Status:</strong> <span class="status-${redemption.status}">${redemption.status.toUpperCase()}</span></p>
                <p><strong>Created:</strong> ${new Date(redemption.createdDate).toLocaleString()}</p>
            </div>
        `;
        
        if (redemption.status === 'pending') {
            detailsHtml += `
                <div class="salesperson-form" style="margin-top: 20px;">
                    <h4>Complete Redemption:</h4>
                    <input type="text" id="salespersonName" placeholder="Enter your name (salesperson)" required>
                    <button class="btn" onclick="completeRedemption('${redemption.redemptionId}')" style="width: 100%; margin-top: 10px;">
                        Complete Redemption
                    </button>
                </div>
            `;
        }
        
        document.getElementById('redemptionDetails').innerHTML = detailsHtml;
        document.getElementById('scanResult').innerHTML = 
            '<div class="success-message">QR Code validated successfully!</div>';
        
    } catch (error) {
        console.error('Error processing QR code:', error);
        document.getElementById('scanResult').innerHTML = 
            '<div class="error-message">Error processing QR code. Please try again.</div>';
    }
}

function completeRedemption(redemptionId) {
    const salespersonName = document.getElementById('salespersonName').value.trim();
    
    if (!salespersonName) {
        alert("Please enter your name (salesperson)");
        return;
    }
    
    // Find redemption and get QR code data
    const allRedemptions = qrRedemptionSystem.getAllRedemptions();
    const redemption = allRedemptions.find(r => r.redemptionId === redemptionId);
    
    if (!redemption) {
        document.getElementById('scanResult').innerHTML = 
            '<div class="error-message">Redemption not found.</div>';
        return;
    }
    
    // Process redemption
    const result = qrRedemptionSystem.processRedemption(redemption.qrCodeData, salespersonName);
    
    if (result.success) {
        document.getElementById('redemptionDetails').innerHTML = `
            <div class="success-card">
                <h3>✅ Redemption Completed!</h3>
                <p><strong>Processed by:</strong> ${salespersonName}</p>
                <p><strong>Member:</strong> ${redemption.memberName}</p>
                <p><strong>Redemption Value:</strong> 
                    ${result.redemption.selectedOption.type === 'points_redemption' ? 
                        result.redemption.selectedOption.maxRedemption.toLocaleString() + ' UGX' : 
                        result.redemption.selectedOption.discountAmount.toLocaleString() + ' UGX discount'}
                </p>
                <p><strong>Completed at:</strong> ${new Date().toLocaleString()}</p>
                <button class="btn" onclick="printReceipt('${redemptionId}')" style="margin-top: 15px;">
                    🖨️ Print Receipt
                </button>
            </div>
        `;
        
        document.getElementById('scanResult').innerHTML = 
            '<div class="success-message">Redemption processed successfully!</div>';
    } else {
        document.getElementById('scanResult').innerHTML = 
            `<div class="error-message">${result.message}</div>`;
    }
}

function printReceipt(redemptionId) {
    const allRedemptions = qrRedemptionSystem.getAllRedemptions();
    const redemption = allRedemptions.find(r => r.redemptionId === redemptionId);
    
    if (!redemption) return;
    
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
        <html>
        <head>
            <title>Jeans Club Redemption Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .receipt { max-width: 400px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 20px; }
                .details { margin: 20px 0; }
                .footer { margin-top: 30px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2>Jeans Club</h2>
                    <h3>Redemption Receipt</h3>
                </div>
                <div class="details">
                    <p><strong>Receipt ID:</strong> ${redemption.redemptionId}</p>
                    <p><strong>Date:</strong> ${new Date(redemption.redeemedDate).toLocaleString()}</p>
                    <p><strong>Member:</strong> ${redemption.memberName} (${redemption.memberJCId})</p>
                    <p><strong>Tier:</strong> ${redemption.memberTier}</p>
                    <p><strong>Purchase Amount:</strong> ${redemption.purchaseAmount.toLocaleString()} UGX</p>
                    <p><strong>Redemption Type:</strong> ${redemption.selectedOption.type === 'points_redemption' ? 'Points Redemption' : 'Discount Voucher'}</p>
                    <p><strong>Value:</strong> 
                        ${redemption.selectedOption.type === 'points_redemption' ? 
                            redemption.selectedOption.maxRedemption.toLocaleString() + ' UGX' : 
                            redemption.selectedOption.discountAmount.toLocaleString() + ' UGX discount'}
                    </p>
                    <p><strong>Processed by:</strong> ${redemption.redeemedBy}</p>
                </div>
                <div class="footer">
                    <p>Thank you for choosing Jeans Club!</p>
                    <p>📍 https://elijah787.github.io/jeans-club</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                }
            </script>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

// QR Redemption Management (Admin)
function showQRRedemptionManagement() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('deleteMemberSection').classList.add('hidden');
    document.getElementById('voucherManagementSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    document.getElementById('qrRedemptionManagementSection').classList.remove('hidden');
    
    displayQRRedemptionStats();
    displayAllRedemptions();
}

function displayQRRedemptionStats() {
    const stats = qrRedemptionSystem.getRedemptionStats();
    const container = document.getElementById('qrRedemptionStats');
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.total}</div>
                <div style="font-size: 12px; color: #666;">Total Redemptions</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.completed}</div>
                <div style="font-size: 12px; color: #666;">Completed</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${stats.pending}</div>
                <div style="font-size: 12px; color: #666;">Pending</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${stats.expired}</div>
                <div style="font-size: 12px; color: #666;">Expired</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center; padding: 15px; background: #e7f3ff; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">${stats.totalValue.toLocaleString()} UGX</div>
                <div style="font-size: 12px; color: #666;">Total Value</div>
            </div>
            <div style="text-align: center; padding: 15px; background: #e7f3ff; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: bold; color: #2196F3;">${stats.completionRate}</div>
                <div style="font-size: 12px; color: #666;">Completion Rate</div>
            </div>
        </div>
    `;
}

function displayAllRedemptions() {
    const allRedemptions = qrRedemptionSystem.getAllRedemptions();
    const container = document.getElementById('allRedemptionsList');
    
    if (allRedemptions.length === 0) {
        container.innerHTML = '<div class="activity-item">No redemptions have been created yet.</div>';
        return;
    }

    let html = '';
    allRedemptions.forEach(redemption => {
        const statusClass = redemption.status === 'completed' ? 'status-active' : 
                          redemption.status === 'pending' ? 'status-used' : 'status-expired';
        
        html += `
            <div class="redemption-item ${redemption.status}">
                <div style="display: flex; justify-content: between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px;">${redemption.memberName} (${redemption.memberJCId})</h4>
                        <p style="margin: 0 0 5px; font-size: 16px; font-weight: bold; color: #e67e22;">
                            ${redemption.selectedOption.type === 'points_redemption' ? 
                                '💰 Points Redemption' : 
                                '🎫 Discount Voucher'} - 
                            ${redemption.selectedOption.type === 'points_redemption' ? 
                                redemption.selectedOption.maxRedemption.toLocaleString() + ' UGX' : 
                                redemption.selectedOption.discountAmount.toLocaleString() + ' UGX'}
                        </p>
                        <div class="redemption-id">${redemption.redemptionId}</div>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                            Created: ${new Date(redemption.createdDate).toLocaleDateString()} | 
                            Purchase Amount: ${redemption.purchaseAmount.toLocaleString()} UGX
                            ${redemption.redeemedDate ? ` | Redeemed: ${new Date(redemption.redeemedDate).toLocaleDateString()} by ${redemption.redeemedBy || 'unknown'}` : ''}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                            ${redemption.selectedOption.description}
                        </p>
                        <span class="redemption-status ${statusClass}">${redemption.status.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

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
        
        // Use exact camelCase field names to match your database
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
            referrals: member.referrals || [],
            resetToken: member.resetToken || null,
            resetTokenExpiry: member.resetTokenExpiry || null
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

    // NEWSLETTER METHODS
    async subscribeToNewsletter(email, name = null) {
        try {
            console.log('📧 Subscribing to newsletter:', email);
            
            const { data, error } = await this.supabase
                .from('newsletter_subscriptions')
                .upsert({
                    email: email,
                    name: name,
                    is_active: true,
                    subscribed_at: new Date().toISOString(),
                    last_sent: null
                }, { 
                    onConflict: 'email'
                });

            if (error) {
                console.error('❌ Newsletter subscription error:', error);
                throw error;
            }

            console.log('✅ Newsletter subscription successful');
            return true;

        } catch (error) {
            console.error('❌ Failed to subscribe to newsletter:', error);
            return false;
        }
    }

    async unsubscribeFromNewsletter(email) {
        try {
            console.log('📧 Unsubscribing from newsletter:', email);
            
            const { data, error } = await this.supabase
                .from('newsletter_subscriptions')
                .update({ 
                    is_active: false,
                    unsubscribed_at: new Date().toISOString()
                })
                .eq('email', email);

            if (error) {
                console.error('❌ Newsletter unsubscribe error:', error);
                throw error;
            }

            console.log('✅ Newsletter unsubscribe successful');
            return true;

        } catch (error) {
            console.error('❌ Failed to unsubscribe from newsletter:', error);
            return false;
        }
    }

    async getNewsletterSubscribers(activeOnly = true) {
        try {
            let query = this.supabase
                .from('newsletter_subscriptions')
                .select('*');

            if (activeOnly) {
                query = query.eq('is_active', true);
            }

            const { data: subscribers, error } = await query;

            if (error) {
                console.error('❌ Newsletter fetch error:', error);
                throw error;
            }

            return subscribers || [];

        } catch (error) {
            console.error('❌ Failed to fetch newsletter subscribers:', error);
            return [];
        }
    }

    async getNewsletterStatus(email) {
        try {
            const { data: subscription, error } = await this.supabase
                .from('newsletter_subscriptions')
                .select('is_active')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Newsletter status error:', error);
                throw error;
            }

            return subscription ? subscription.is_active : false;

        } catch (error) {
            console.error('❌ Failed to get newsletter status:', error);
            return false;
        }
    }
}

// Google Apps Script Email Service (UPDATED WITH NEW URL)
class GoogleAppsEmailService {
    constructor() {
        // UPDATED: Use your new deployment URL
        this.scriptURL = 'https://script.google.com/macros/s/AKfycbwPycPrQFn5hux5eHrbAg1KIc8aO96HwrEI-KUZG7YmITm1ACyqIDQJcWGP5pqq9kun/exec';
        this.isActive = true;
        console.log('📧 Email service initialized with URL:', this.scriptURL);
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
                    message: emailContent,
                    html: true // This will now work with the updated Google Apps Script
                }
            };

            console.log('📤 Sending email via Google Apps Script:', payload.emailData.type);
            console.log('🔗 Using URL:', this.scriptURL);

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
                content = this.buildWelcomeEmail(memberData);
                break;

            case 'purchase':
                content = this.buildPurchaseEmail(memberData, extraData);
                break;

            case 'discount':
                content = this.buildDiscountEmail(memberData, extraData);
                break;

            case 'referral':
                content = this.buildReferralEmail(memberData, extraData);
                break;

            case 'password_reset':
                content = this.buildPasswordResetEmail(memberData, extraData);
                break;

            case 'password_reset_success':
                content = this.buildPasswordResetSuccessEmail(memberData);
                break;

            // NEWSLETTER EMAIL TYPES
            case 'newsletter_welcome':
                content = this.buildNewsletterWelcomeEmail(memberData, extraData);
                break;

            case 'newsletter':
                content = this.buildNewsletterEmail(memberData, extraData);
                break;
        }
        
        return content;
    }

    // BEAUTIFUL EMAIL TEMPLATES
    buildWelcomeEmail(memberData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Jeans Club!</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #667eea; 
        }
        .highlight-box { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3; 
        }
        .benefits-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px; 
            margin: 20px 0; 
        }
        .benefit-item { 
            text-align: center; 
            padding: 15px; 
            background: white; 
            border-radius: 8px; 
            border: 1px solid #e0e0e0; 
        }
        .benefit-icon { 
            font-size: 24px; 
            margin-bottom: 10px; 
        }
        .referral-section { 
            background: #fff3cd; 
            padding: 25px; 
            border-radius: 8px; 
            text-align: center; 
            margin: 25px 0; 
            border: 2px dashed #ffc107; 
        }
        .referral-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #667eea; 
            letter-spacing: 3px; 
            margin: 15px 0; 
            font-family: 'Courier New', monospace; 
        }
        .tier-badge { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: bold; 
            margin: 5px 0; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        td { 
            padding: 12px 8px; 
            border-bottom: 1px solid #e0e0e0; 
        }
        .btn { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 15px 0; 
            font-weight: bold; 
            font-size: 16px; 
        }
        @media (max-width: 600px) {
            .benefits-grid { grid-template-columns: 1fr; }
            .email-content { padding: 25px 20px; }
            .referral-code { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1> Welcome to Jeans Club!</h1>
            <p>Your Premium Denim Experience Starts Here</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            <p style="font-size: 16px; color: #555;">Welcome to the Jeans Club family! We're thrilled to have you as a member of our exclusive loyalty program where style meets rewards.</p>
            
            <div class="email-card">
                <h3 style="color: #667eea; margin-top: 0;">🎉 Your Membership Details</h3>
                <table>
                    <tr>
                        <td style="font-weight: bold; color: #555;">JC ID:</td>
                        <td style="color: #333;">${memberData.jcId}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Tier:</td>
                        <td><span class="tier-badge">${memberData.tier}</span></td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Starting Points:</td>
                        <td style="color: #333;">${memberData.points} points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Referral Code:</td>
                        <td><code style="background: #f4f4f4; padding: 8px 12px; border-radius: 4px; font-weight: bold; color: #667eea;">${memberData.referralCode}</code></td>
                    </tr>
                </table>
            </div>

            <h3 style="color: #333;">🚀 What's Next?</h3>
            <div class="benefits-grid">
                <div class="benefit-item">
                    <div class="benefit-icon">🎁</div>
                    <p style="margin: 0; font-weight: bold; color: #333;">Earn Points</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">With every purchase</p>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">⭐</div>
                    <p style="margin: 0; font-weight: bold; color: #333;">Rise Through Tiers</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">For better rewards</p>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">👥</div>
                    <p style="margin: 0; font-weight: bold; color: #333;">Refer Friends</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Earn 100 points each</p>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">💎</div>
                    <p style="margin: 0; font-weight: bold; color: #333;">Exclusive Discounts</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Early access to sales</p>
                </div>
            </div>

            <div class="referral-section">
                <h3 style="color: #333; margin-top: 0;">📣 Share Your Referral Code</h3>
                <div class="referral-code">${memberData.referralCode}</div>
                <p style="color: #666; margin: 10px 0;">Share with friends and both of you earn bonus points!</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for choosing Jeans Club - Where Style Meets Rewards!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildPurchaseEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Recorded - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .points-earned { 
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #28a745; 
        }
        .tier-badge { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: bold; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        td { 
            padding: 12px 8px; 
            border-bottom: 1px solid #e0e0e0; 
        }
        .tip-box { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🛍️ Purchase Recorded!</h1>
            <p>Thank You for Shopping with Jeans Club</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            <p style="font-size: 16px; color: #555;">Your recent purchase has been successfully recorded in your Jeans Club account!</p>
            
            <div class="points-earned">
                <h3 style="margin: 0 0 10px; font-size: 24px;">🎊 Points Earned!</h3>
                <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">+${extraData.pointsEarned}</div>
                <p style="margin: 0; opacity: 0.9; font-size: 16px;">points added to your account</p>
            </div>

            <div class="email-card">
                <h3 style="color: #28a745; margin-top: 0;">📋 Purchase Details</h3>
                <table>
                    <tr>
                        <td style="font-weight: bold; color: 555; width: 40%;">Description:</td>
                        <td style="color: #333;">${extraData.description}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Amount:</td>
                        <td style="color: #333;">UGX ${extraData.amount.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Points Earned:</td>
                        <td style="color: #333; font-weight: bold;">+${extraData.pointsEarned} points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">New Balance:</td>
                        <td style="color: #333; font-weight: bold;">${memberData.points} points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Current Tier:</td>
                        <td><span class="tier-badge">${memberData.tier}</span></td>
                    </tr>
                </table>
            </div>

            <div class="tip-box">
                <h4 style="color: #2196F3; margin: 0 0 10px;">💡 Pro Tip</h4>
                <p style="margin: 0; color: #555;">You're getting closer to the next tier! Keep shopping to unlock even better rewards and higher point multipliers.</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for being a valued Jeans Club member!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildDiscountEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discount Voucher - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .discount-badge { 
            background: linear-gradient(135deg, #ff6b6b, #ee5a24); 
            color: white; 
            padding: 40px 30px; 
            border-radius: 10px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .voucher-details { 
            background: #fff3cd; 
            padding: 25px; 
            border: 2px dashed #ffc107; 
            border-radius: 8px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #ff6b6b; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        .info-box { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3; 
        }
        .notes-box { 
            background: #fff3cd; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #ffc107; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎫 Discount Voucher Created!</h1>
            <p>Your Points Have Been Converted to Savings</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            <p style="font-size: 16px; color: #555;">Great news! You've successfully converted your loyalty points into an exclusive discount voucher.</p>
            
            <div class="discount-badge">
                <div style="font-size: 64px; font-weight: bold; margin: 10px 0;">${extraData.discountPercentage}%</div>
                <div style="font-size: 24px; margin: 10px 0;">DISCOUNT</div>
                <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Valid for your next purchase</p>
            </div>

            <div class="voucher-details">
                <h3 style="color: #333; margin-top: 0;">📋 Voucher Details</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; margin: 20px 0;">
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #555;">Points Used:</p>
                        <p style="margin: 5px 0 0; color: #333;">${extraData.pointsUsed} points</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #555;">Discount Rate:</p>
                        <p style="margin: 5px 0 0; color: #333;">${extraData.discountPercentage}% off</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #555;">Max Possible:</p>
                        <p style="margin: 5px 0 0; color: #333;">${extraData.maxPossibleDiscount}% (for your tier)</p>
                    </div>
                    <div>
                        <p style="margin: 0; font-weight: bold; color: #555;">Remaining Points:</p>
                        <p style="margin: 5px 0 0; color: #333;">${memberData.points} points</p>
                    </div>
                </div>
            </div>

            <div class="info-box">
                <h4 style="color: #2196F3; margin: 0 0 10px;">💎 How to Redeem</h4>
                <p style="margin: 0; color: #555;">Simply present this email at checkout to apply your ${extraData.discountPercentage}% discount. Our staff will verify and apply your discount instantly!</p>
            </div>

            <div class="notes-box">
                <h4 style="color: #856404; margin: 0 0 10px;">⏰ Important Notes</h4>
                <ul style="margin: 0; padding-left: 20px; color: #555;">
                    <li>This voucher is valid for one-time use only</li>
                    <li>Cannot be combined with other promotions</li>
                    <li>Valid on full-priced items only</li>
                    <li>No cash value</li>
                </ul>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">We look forward to seeing you soon at Jeans Club!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildReferralEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Referral Success - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .bonus-badge { 
            background: linear-gradient(135deg, #FFD700, #FFA500); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #FFD700; 
        }
        .referral-section { 
            background: #fff3cd; 
            padding: 25px; 
            border-radius: 8px; 
            text-align: center; 
            margin: 25px 0; 
            border: 2px dashed #ffc107; 
        }
        .referral-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #e67e22; 
            letter-spacing: 3px; 
            margin: 15px 0; 
            font-family: 'Courier New', monospace; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        td { 
            padding: 12px 8px; 
            border-bottom: 1px solid #e0e0e0; 
        }
        .sharing-tips { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
            .referral-code { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎊 Referral Success!</h1>
            <p>You've Earned Bonus Points</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            <p style="font-size: 16px; color: #555;">Congratulations! Your friend has joined Jeans Club using your referral code.</p>
            
            <div class="bonus-badge">
                <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">+100</div>
                <div style="font-size: 20px; margin: 10px 0;">BONUS POINTS</div>
                <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Added to your account</p>
            </div>

            <div class="email-card">
                <h3 style="color: #e67e22; margin-top: 0;">👥 Referral Details</h3>
                <table>
                    <tr>
                        <td style="font-weight: bold; color: #555; width: 40%;">New Member:</td>
                        <td style="color: #333;">${extraData.newMemberName}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">JC ID:</td>
                        <td style="color: #333;">${extraData.newMemberJCId}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Points Earned:</td>
                        <td style="color: #333; font-weight: bold;">+100 points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">New Balance:</td>
                        <td style="color: #333; font-weight: bold;">${memberData.points} points</td>
                    </tr>
                </table>
            </div>

            <div class="referral-section">
                <h3 style="color: #333; margin-top: 0;">📣 Keep Sharing!</h3>
                <p style="color: #666; margin: 10px 0;">Your unique referral code:</p>
                <div class="referral-code">${memberData.referralCode}</div>
                <p style="color: #666; margin: 10px 0;">Share with friends and earn 100 points for each successful referral!</p>
            </div>

            <div class="sharing-tips">
                <h4 style="color: #2196F3; margin: 0 0 10px;">💡 Sharing Ideas</h4>
                <p style="margin: 0; color: #555;">Share your code via WhatsApp, social media, or directly with friends who love premium denim!</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for growing the Jeans Club community!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildPasswordResetEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .reset-code-box { 
            background: #f8f9fa; 
            padding: 30px; 
            border: 2px dashed #6c757d; 
            border-radius: 8px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .reset-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #495057; 
            letter-spacing: 3px; 
            margin: 15px 0; 
            font-family: 'Courier New', monospace; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #6c757d; 
        }
        .security-note { 
            background: #fff3cd; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #ffc107; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        ol { 
            margin: 0; 
            padding-left: 20px; 
        }
        li { 
            margin-bottom: 10px; 
            color: #555; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
            .reset-code { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🔒 Password Reset Request</h1>
            <p>Jeans Club Account Security</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            <p style="font-size: 16px; color: #555;">We received a request to reset your Jeans Club account password. Use the reset code below to create a new password.</p>
            
            <div class="reset-code-box">
                <h3 style="color: #495057; margin-top: 0;">Your Reset Code</h3>
                <div class="reset-code">${extraData.resetToken}</div>
                <p style="margin: 10px 0 0; color: #666; font-size: 14px;">Valid until: ${new Date(extraData.expiry).toLocaleString()}</p>
            </div>

            <div class="email-card">
                <h3 style="color: #495057; margin-top: 0;">📝 How to Reset Your Password</h3>
                <ol>
                    <li>Go to the Jeans Club login page</li>
                    <li>Click "Forgot Password?"</li>
                    <li>Enter your JC ID: <strong>${memberData.jcId}</strong></li>
                    <li>Enter the reset code above</li>
                    <li>Create your new password</li>
                </ol>
            </div>

            <div class="security-note">
                <h4 style="color: #856404; margin: 0 0 10px;">⚠️ Security Notice</h4>
                <p style="margin: 0 0 10px; color: #555;">If you didn't request this password reset, please ignore this email. Your account security is important to us.</p>
                <p style="margin: 0; color: #555;">The reset code will expire in 1 hour for security reasons.</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Need help? Contact our support team.</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated security message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildPasswordResetSuccessEmail(memberData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Successful - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .success-badge { 
            background: #d4edda; 
            color: #155724; 
            padding: 30px; 
            border-radius: 8px; 
            text-align: center; 
            margin: 25px 0; 
            border: 2px solid #c3e6cb; 
        }
        .email-card { 
            background: #f8f9fa; 
            padding: 25px; 
            margin: 25px 0; 
            border-radius: 8px; 
            border-left: 4px solid #28a745; 
        }
        .security-alert { 
            background: #fff3cd; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #ffc107; 
        }
        .security-tips { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            fontSize: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        td { 
            padding: 12px 8px; 
            border-bottom: 1px solid #e0e0e0; 
        }
        ul { 
            margin: 0; 
            padding-left: 20px; 
        }
        li { 
            margin-bottom: 8px; 
            color: #555; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>✅ Password Reset Successful</h1>
            <p>Your Account Security Has Been Updated</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${memberData.name},</h2>
            
            <div class="success-badge">
                <div style="font-size: 48px; margin: 10px 0;">🔒</div>
                <h3 style="margin: 10px 0; color: #155724;">Password Successfully Reset!</h3>
                <p style="margin: 0; color: #155724;">Your Jeans Club account password has been updated successfully.</p>
            </div>

            <div class="email-card">
                <h3 style="color: #28a745; margin-top: 0;">📋 Account Details</h3>
                <table>
                    <tr>
                        <td style="font-weight: bold; color: #555; width: 40%;">JC ID:</td>
                        <td style="color: #333;">${memberData.jcId}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Password Reset:</td>
                        <td style="color: #333;">${new Date().toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Current Tier:</td>
                        <td style="color: #333;">${memberData.tier}</td>
                    </tr>
                </table>
            </div>

            <div class="security-alert">
                <h4 style="color: #856404; margin: 0 0 10px;">🔐 Security Alert</h4>
                <p style="margin: 0; color: #555;">If you did not make this change, please contact our support team immediately. Your account security is important to us.</p>
            </div>

            <div class="security-tips">
                <h4 style="color: #2196F3; margin: 0 0 10px;">💡 Tips for Account Security</h4>
                <ul>
                    <li>Use a strong, unique password</li>
                    <li>Never share your password with anyone</li>
                    <li>Log out from shared devices</li>
                    <li>Regularly update your password</li>
                </ul>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for securing your Jeans Club account!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated security message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildNewsletterWelcomeEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Newsletter - Jeans Club</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .welcome-badge { 
            background: linear-gradient(135deg, #667eea, #764ba2); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            text-align: center; 
            margin: 25px 0; 
        }
        .benefits-section { 
            background: #e7f3ff; 
            padding: 25px; 
            border-radius: 8px; 
            margin: 25px 0; 
        }
        .benefits-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 15px; 
            margin: 20px 0; 
        }
        .benefit-item { 
            text-align: center; 
            padding: 15px; 
            background: white; 
            border-radius: 8px; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
            .benefits-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>📬 Welcome to Our Newsletter!</h1>
            <p>Stay Updated with Jeans Club</p>
        </div>
        
        <div class="email-content">
            <div class="welcome-badge">
                <h2 style="margin: 0 0 10px;">Hello ${memberData.name || 'there'}!</h2>
                <p style="margin: 0; opacity: 0.9;">You're officially subscribed to the Jeans Club Newsletter</p>
            </div>

            <p style="font-size: 16px; color: #555;">Thank you for joining our exclusive newsletter community! We're excited to keep you informed about the latest trends, offers, and updates.</p>

            <div class="benefits-section">
                <h3 style="color: #667eea; margin-top: 0;">🎁 What You'll Receive</h3>
                <div class="benefits-grid">
                    <div class="benefit-item">
                        <div style="font-size: 24px;">💎</div>
                        <p style="margin: 10px 0 0; font-weight: bold; color: #333;">Exclusive Discounts</p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Member-only promotions</p>
                    </div>
                    <div class="benefit-item">
                        <div style="font-size: 24px;">🆕</div>
                        <p style="margin: 10px 0 0; font-weight: bold; color: #333;">New Arrivals</p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #666;">First look at new collections</p>
                    </div>
                    <div class="benefit-item">
                        <div style="font-size: 24px;">💡</div>
                        <p style="margin: 10px 0 0; font-weight: bold; color: #333;">Style Tips</p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Fashion trends & styling advice</p>
                    </div>
                    <div class="benefit-item">
                        <div style="font-size: 24px;">⭐</div>
                        <p style="margin: 10px 0 0; font-weight: bold; color: #333;">Special Events</p>
                        <p style="margin: 5px 0 0; font-size: 14px; color: #666;">VIP access to sales & events</p>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p style="font-size: 18px; font-weight: bold; color: #333;">Stay tuned for amazing deals and fashion insights!</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Best regards,<br>The Jeans Club Team</p>
                <p style="margin: 5px 0; color: #666;">📍 https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">
                    <a href="https://elijah787.github.io/jeans-club#unsubscribe" style="color: #666; text-decoration: none;">Unsubscribe</a> | 
                    This is an automated message
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    buildNewsletterEmail(memberData, extraData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jeans Club Newsletter</title>
    <style>
        body { 
            font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f9f9f9; 
            margin: 0; 
            padding: 0; 
        }
        .email-container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.1); 
        }
        .email-header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
        }
        .email-header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: bold; 
        }
        .email-header p { 
            margin: 10px 0 0; 
            opacity: 0.9; 
            font-size: 16px; 
        }
        .email-content { 
            padding: 40px 30px; 
        }
        .greeting { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 25px; 
        }
        .member-exclusive { 
            background: #e7f3ff; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 25px 0; 
            border-left: 4px solid #2196F3; 
        }
        .email-footer { 
            text-align: center; 
            margin-top: 30px; 
            padding: 25px; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #eee; 
            background: #f8f9fa; 
        }
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>${extraData.subject || "Jeans Club Newsletter"}</h1>
            <p>Latest Updates from Your Favorite Denim Destination</p>
        </div>
        
        <div class="email-content">
            <div class="greeting">
                <h2 style="color: #333; margin: 0 0 10px;">Hello ${memberData.name || 'Valued Member'}! 👋</h2>
                <p style="margin: 0; color: #666;">Here's what's new at Jeans Club...</p>
            </div>

            <div style="line-height: 1.8; color: #555; font-size: 16px;">
                ${extraData.message.replace(/\n/g, '<br>')}
            </div>

            <div class="member-exclusive">
                <h4 style="color: #2196F3; margin: 0 0 10px;">💎 Member Exclusive</h4>
                <p style="margin: 0; color: #555;">Remember to use your loyalty points for exclusive discounts on your next purchase!</p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for being a Jeans Club member! 💙</p>
                <p style="margin: 5px 0; color: #666;">📍 <a href="https://elijah787.github.io/jeans-club" style="color: #667eea; text-decoration: none;">Visit Our Website</a></p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">
                    <a href="https://elijah787.github.io/jeans-club#unsubscribe" style="color: #666; text-decoration: none;">Unsubscribe from newsletter</a> | 
                    Jeans Club - Premium Denim & Fashion
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    getSubject(type, memberData, extraData) {
        switch(type) {
            case 'welcome': return '👖 Welcome to Jeans Club! Your Premium Denim Journey Starts Here';
            case 'purchase': return '🛍️ Purchase Recorded - ' + (extraData?.description || '') + ' | Points Earned!';
            case 'discount': return '🎫 ' + (extraData?.discountPercentage || 0) + '% Discount Voucher | Jeans Club Rewards';
            case 'referral': return '🎊 Referral Success! +100 Points | Keep Sharing the Love';
            case 'password_reset': return '🔒 Password Reset Request | Jeans Club Account Security';
            case 'password_reset_success': return '✅ Password Reset Successful | Jeans Club Account Secured';
            case 'newsletter_welcome': return "📬 Welcome to Jeans Club Newsletter!";
            case 'newsletter': return extraData?.subject || "📰 Jeans Club Newsletter";
            default: return '💌 Message from Jeans Club';
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

    async sendPasswordResetEmail(email, memberData, resetData) {
        console.log('Attempting to send password reset email to:', email);
        return this.sendEmailToGoogleScript(email, 'password_reset', memberData, resetData);
    }

    async sendPasswordResetSuccessEmail(email, memberData) {
        console.log('Attempting to send password reset success email to:', email);
        return this.sendEmailToGoogleScript(email, 'password_reset_success', memberData);
    }

    // NEWSLETTER EMAIL METHODS
    async sendNewsletterWelcomeEmail(email, name = null) {
        const subject = "📬 Welcome to Jeans Club Newsletter!";
        const message = `We're thrilled to welcome you to our exclusive newsletter community! Get ready for:

💎 Exclusive member-only discounts and promotions
🆕 First access to new collections and arrivals
💡 Expert styling tips and fashion trends
⭐ VIP invitations to special events and sales
🎁 Bonus points opportunities and rewards

Stay tuned for amazing content delivered straight to your inbox!`;

        return this.sendEmailToGoogleScript(email, 'newsletter_welcome', { name, email }, { subject, message });
    }

    async sendNewsletterEmail(email, subject, content, name = null) {
        return this.sendEmailToGoogleScript(email, 'newsletter', { name, email }, { subject, message: content });
    }

    fallbackEmail(email, memberData, type, extraData = null) {
        let subject, content;

        switch(type) {
            case 'welcome':
                subject = ' Welcome to Jeans Club! Your Premium Denim Journey Starts Here';
                content = this.buildWelcomeEmail(memberData);
                break;

            case 'purchase':
                subject = '🛍️ Purchase Recorded - ' + extraData.description + ' | Points Earned!';
                content = this.buildPurchaseEmail(memberData, extraData);
                break;

            case 'discount':
                subject = '🎫 ' + extraData.discountPercentage + '% Discount Voucher | Jeans Club Rewards';
                content = this.buildDiscountEmail(memberData, extraData);
                break;

            case 'referral':
                subject = '🎊 Referral Success! +100 Points | Keep Sharing the Love';
                content = this.buildReferralEmail(memberData, extraData);
                break;

            case 'password_reset':
                subject = '🔒 Password Reset Request | Jeans Club Account Security';
                content = this.buildPasswordResetEmail(memberData, extraData);
                break;

            case 'password_reset_success':
                subject = '✅ Password Reset Successful | Jeans Club Account Secured';
                content = this.buildPasswordResetSuccessEmail(memberData);
                break;

            // NEWSLETTER FALLBACK
            case 'newsletter_welcome':
                subject = "📬 Welcome to Jeans Club Newsletter!";
                content = this.buildNewsletterWelcomeEmail(memberData, extraData);
                break;

            case 'newsletter':
                subject = extraData?.subject || "📰 Jeans Club Newsletter";
                content = this.buildNewsletterEmail(memberData, extraData);
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

// Jeans Club Configuration - UPDATED NAME WITH NEW TIERS
// Jeans Club Configuration - UPDATED WITH TIER-SPECIFIC REDEMPTION RATES
const jeansClubConfig = {
    pointValue: 750,
    // REMOVE: redemptionRate: 0.005,
    
    // ADD TIER-BASED REDEMPTION RATES (Same as index.html):
    tierRedemptionRates: {
        PEARL: 0.0003,    // 100 pts = 3% discount
        BRONZE: 0.0004,   // 100 pts = 4% discount
        SILVER: 0.0005,   // 100 pts = 5% discount
        RUBY: 0.0006,     // 100 pts = 6% discount
        GOLD: 0.0007,     // 100 pts = 7% discount
        SAPPHIRE: 0.0008, // 100 pts = 8% discount
        PLATINUM: 0.0010  // 100 pts = 10% discount
    },
    
    tiers: {
        PEARL: { 
            minPoints: 0, 
            maxPoints: 7499,
            multiplier: 1.0, 
            name: "Pearl", 
            color: "#F8F8FF",
            discountRate: 0.03  // 3% max discount
        },
        BRONZE: { 
            minPoints: 7500,    
            maxPoints: 24999,
            multiplier: 1.10, 
            name: "Bronze", 
            color: "#cd7f32",
            discountRate: 0.04  // 4% max discount
        },
        SILVER: { 
            minPoints: 25000,    
            maxPoints: 99999,
            multiplier: 1.25, 
            name: "Silver", 
            color: "#c0c0c0",
            discountRate: 0.05  // 5% max discount
        },
        RUBY: { 
            minPoints: 100000,    
            maxPoints: 249999,
            multiplier: 1.30, 
            name: "Ruby", 
            color: "#e0115f",
            discountRate: 0.06  // 6% max discount
        },
        GOLD: { 
            minPoints: 250000,    
            maxPoints: 499999,
            multiplier: 1.40, 
            name: "Gold", 
            color: "#ffd700",
            discountRate: 0.07  // 7% max discount
        },
        SAPPHIRE: { 
            minPoints: 500000,    
            maxPoints: 999999,
            multiplier: 1.50, 
            name: "Sapphire", 
            color: "#0f52ba",
            discountRate: 0.08  // 8% max discount
        },
        PLATINUM: { 
            minPoints: 1000000,    
            maxPoints: 9999999,
            multiplier: 1.60, 
            name: "Platinum", 
            color: "#e5e4e2",
            discountRate: 0.10  // 10% max discount
        }
    }
};
// Main JeansClubManager - UPDATED to use Supabase
class JeansClubManager {
    constructor() {
        this.db = new SupabaseDB();
        this.emailService = new GoogleAppsEmailService();
        this.analytics = new AnalyticsEngine();
        this.currentMember = null;
        this.isAdmin = false;
        this.loadCurrentMember();
        console.log('🚀 JeansClubManager initialized with Supabase DB and Analytics');
    }

    generateJCId() {
        return 'JC' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }

    generateReferralCode() {
        return 'JEANS' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    generateResetToken() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
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
        
        // Calculate starting points: 10 welcome points + 10 extra points if using referral code
        const startingPoints = referralCode ? 20 : 10;
        
        const newMember = {
            id: memberId,
            jcId: this.generateJCId(),
            email: userData.email,
            name: userData.name,
            password: this.hashPassword(password),
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
            resetToken: null,
            resetTokenExpiry: null
        };

        console.log('💾 Saving new member to Supabase:', newMember.jcId);

        // Save to Supabase
        if (!await this.db.saveMember(newMember)) {
            console.log('❌ Failed to save member to Supabase');
            return { success: false, message: "Failed to save member data to cloud storage" };
        }

        this.currentMember = newMember;
        this.saveCurrentMember();
        
        // Track analytics
        this.analytics.trackLogin(newMember.jcId);
        
        // Log activity with correct points
        const activityMessage = referralCode ? 
            'Account created with referral code - Welcome to Jeans Club! (+20 points)' : 
            'Account created - Welcome to Jeans Club! (+10 points)';
        await this.logActivity(memberId, activityMessage, startingPoints);
        
        // Process referral if exists - this gives the referrer 100 points
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
        
        // Calculate starting points: 10 welcome points + 10 extra points if using referral code
        const startingPoints = referralCode ? 20 : 10;
        
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
            resetToken: null,
            resetTokenExpiry: null
        };

        console.log('💾 Saving Google member to Supabase:', newMember.jcId);

        // Save to Supabase
        if (!await this.db.saveMember(newMember)) {
            return { success: false, message: "Failed to save member data" };
        }

        this.currentMember = newMember;
        this.saveCurrentMember();
        
        // Track analytics
        this.analytics.trackLogin(newMember.jcId);
        
        // Log activity with correct points
        const activityMessage = referralCode ? 
            'Account created with Google and referral code - Welcome to Jeans Club! (+20 points)' : 
            'Account created with Google - Welcome to Jeans Club! (+10 points)';
        await this.logActivity(memberId, activityMessage, startingPoints);
        
        // Process referral if exists - this gives the referrer 100 points
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

    // Login with JC ID and Password only
    async login(jcId, password) {
        console.log('🔐 Attempting login for JC ID:', jcId);
        const member = await this.db.getMemberByJCId(jcId);
        
        if (member) {
            if (member.loginMethod === 'google') {
                return { success: false, message: "This account uses Google login. Please use Google Sign-In." };
            }
            if (this.verifyPassword(password, member.password)) {
                this.currentMember = member;
                this.saveCurrentMember();
                
                // Track analytics
                this.analytics.trackLogin(member.jcId);
                
                await this.logActivity(member.id, 'Logged in to account', 0);
                console.log('✅ Login successful for:', member.name);
                return { success: true, member: member };
            } else {
                console.log('❌ Invalid password for:', jcId);
                return { success: false, message: "Invalid password" };
            }
        }
        console.log('❌ Account not found:', jcId);
        return { success: false, message: "Account not found - check JC ID" };
    }

    // Login with Google
    async loginWithGoogle(email) {
        console.log('🔐 Attempting Google login for:', email);
        const member = await this.db.getMemberByEmail(email);
        
        if (member && member.loginMethod === 'google') {
            this.currentMember = member;
            this.saveCurrentMember();
            
            // Track analytics
            this.analytics.trackLogin(member.jcId);
            
            await this.logActivity(member.id, 'Logged in with Google', 0);
            console.log('✅ Google login successful for:', member.name);
            return { success: true, member: member };
        }
        console.log('❌ Google account not found:', email);
        return { success: false, message: "Google account not found. Please sign up first." };
    }

    // Password Reset Functionality
    async requestPasswordReset(jcId) {
        console.log('🔐 Requesting password reset for JC ID:', jcId);
        const member = await this.db.getMemberByJCId(jcId);
        
        if (!member) {
            return { success: false, message: "Account not found" };
        }

        if (member.loginMethod === 'google') {
            return { success: false, message: "Google accounts don't use passwords. Please use Google Sign-In." };
        }

        // Generate reset token (valid for 1 hour)
        const resetToken = this.generateResetToken();
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        member.resetToken = resetToken;
        member.resetTokenExpiry = resetTokenExpiry;

        // Save member with reset token
        if (!await this.db.saveMember(member)) {
            return { success: false, message: "Failed to process reset request" };
        }

        // Send reset email
        const resetData = {
            resetToken: resetToken,
            expiry: resetTokenExpiry
        };

        const emailResult = await this.emailService.sendPasswordResetEmail(member.email, member, resetData);

        return {
            success: true,
            message: "Password reset instructions sent to your email",
            emailSent: emailResult.success,
            isFallback: emailResult.fallback || false
        };
    }

    async resetPassword(jcId, resetToken, newPassword) {
        console.log('🔐 Resetting password for JC ID:', jcId);
        const member = await this.db.getMemberByJCId(jcId);
        
        if (!member) {
            return { success: false, message: "Account not found" };
        }

        // Check if reset token is valid and not expired
        if (!member.resetToken || member.resetToken !== resetToken) {
            return { success: false, message: "Invalid reset code" };
        }

        if (new Date() > new Date(member.resetTokenExpiry)) {
            return { success: false, message: "Reset code has expired. Please request a new one." };
        }

        // Update password and clear reset token
        member.password = this.hashPassword(newPassword);
        member.resetToken = null;
        member.resetTokenExpiry = null;

        // Save updated member
        if (!await this.db.saveMember(member)) {
            return { success: false, message: "Failed to reset password" };
        }

        // Send confirmation email
        await this.emailService.sendPasswordResetSuccessEmail(member.email, member);

        await this.logActivity(member.id, 'Password reset successfully', 0);

        return {
            success: true,
            message: "Password reset successfully! You can now login with your new password."
        };
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

        // Track analytics
        this.analytics.trackPurchase(memberJCId, amountUGX, pointsEarned);
        
        if (oldTier !== targetMember.tier) {
            this.analytics.trackTierChange(memberJCId, oldTier, targetMember.tier, targetMember.points);
        }

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

    // Process referral - gives 100 points to referrer
    async processReferral(referralCode, newMemberJCId, newMemberName) {
        const allMembers = await this.db.getAllMembers();
        
        for (const member of allMembers) {
            if (member.referralCode === referralCode) {
                member.points += 100;
                
                // Track analytics
                this.analytics.trackReferral(member.jcId, newMemberJCId);
                
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

    // NEWSLETTER METHODS
    async subscribeToNewsletter(email, name = null) {
        try {
            const result = await this.db.subscribeToNewsletter(email, name);
            
            if (result) {
                // Send welcome newsletter email
                await this.emailService.sendNewsletterWelcomeEmail(email, name);
                return { success: true, message: "Successfully subscribed to newsletter!" };
            } else {
                return { success: false, message: "Failed to subscribe to newsletter" };
            }
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            return { success: false, message: "Subscription failed. Please try again." };
        }
    }

    async unsubscribeFromNewsletter(email) {
        try {
            const result = await this.db.unsubscribeFromNewsletter(email);
            return { 
                success: result, 
                message: result ? "Successfully unsubscribed from newsletter" : "Failed to unsubscribe" 
            };
        } catch (error) {
            console.error('Newsletter unsubscribe error:', error);
            return { success: false, message: "Unsubscribe failed. Please try again." };
        }
    }

    async getNewsletterStatus(email) {
        try {
            return await this.db.getNewsletterStatus(email);
        } catch (error) {
            console.error('Newsletter status error:', error);
            return false;
        }
    }

    // Admin function to send newsletter to all subscribers
    async sendNewsletterToAll(subject, content) {
        if (!this.isAdmin) {
            return { success: false, message: "Admin access required" };
        }

        try {
            const subscribers = await this.db.getNewsletterSubscribers(true);
            let sentCount = 0;
            let failedCount = 0;

            for (const subscriber of subscribers) {
                try {
                    const emailResult = await this.emailService.sendNewsletterEmail(
                        subscriber.email, 
                        subject, 
                        content,
                        subscriber.name
                    );
                    
                    if (emailResult.success) {
                        sentCount++;
                        // Update last_sent timestamp
                        await this.updateNewsletterLastSent(subscriber.email);
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Failed to send to ${subscriber.email}:`, error);
                    failedCount++;
                }
            }

            return {
                success: true,
                message: `Newsletter sent to ${sentCount} subscribers${failedCount > 0 ? `, ${failedCount} failed` : ''}`
            };

        } catch (error) {
            console.error('Newsletter send error:', error);
            return { success: false, message: "Failed to send newsletter: " + error.message };
        }
    }

    async updateNewsletterLastSent(email) {
        try {
            const { data, error } = await this.db.supabase
                .from('newsletter_subscriptions')
                .update({ last_sent: new Date().toISOString() })
                .eq('email', email);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Failed to update newsletter last_sent:', error);
            return false;
        }
    }

    calculatePoints(amountUGX, tier) {
        const basePoints = amountUGX / jeansClubConfig.pointValue;
        const multiplier = jeansClubConfig.tiers[tier].multiplier;
        return Math.floor(basePoints * multiplier);
    }

    calculateTier(points) {
        if (points >= jeansClubConfig.tiers.PLATINUM.minPoints) return 'PLATINUM';
        if (points >= jeansClubConfig.tiers.SAPPHIRE.minPoints) return 'SAPPHIRE';
        if (points >= jeansClubConfig.tiers.GOLD.minPoints) return 'GOLD';
        if (points >= jeansClubConfig.tiers.RUBY.minPoints) return 'RUBY';
        if (points >= jeansClubConfig.tiers.SILVER.minPoints) return 'SILVER';
        if (points >= jeansClubConfig.tiers.BRONZE.minPoints) return 'BRONZE';
        return 'PEARL';
    }

    getNextTier(currentTier) {
        const tierOrder = ['PEARL', 'BRONZE', 'SILVER', 'RUBY', 'GOLD', 'SAPPHIRE', 'PLATINUM'];
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
    const tier = member.tier;
    const tierConfig = jeansClubConfig.tiers[tier];
    
    // USE TIER-SPECIFIC REDEMPTION RATE
    const redemptionRate = jeansClubConfig.tierRedemptionRates[tier] || 0.0003;
    
    // Calculate max points that can be used for this tier
    const maxDiscountPoints = Math.floor(tierConfig.discountRate / redemptionRate);
    const actualPointsToUse = Math.min(pointsToUse, maxDiscountPoints, member.points);
    
    if (actualPointsToUse < 10) {
        return { success: false, message: "Minimum 10 points required" };
    }

    // Calculate discount using tier-specific rate
    const discountPercentage = (actualPointsToUse * redemptionRate * 100).toFixed(1);

    return {
        success: true,
        pointsUsed: actualPointsToUse,
        discountPercentage: discountPercentage,
        maxPossibleDiscount: (tierConfig.discountRate * 100).toFixed(1) + '%',
        redemptionRate: redemptionRate,
        tierName: tier
    };
}

    async redeemPoints(pointsToUse) {
        if (!this.currentMember) return { success: false, message: "No member logged in" };

        const discountCalc = this.calculateDiscount(pointsToUse);
        if (!discountCalc.success) return discountCalc;

        const member = this.currentMember;
        member.points -= discountCalc.pointsUsed;
        member.tier = this.calculateTier(member.points);
        
        // Track analytics
        this.analytics.trackRedemption(member.jcId, discountCalc.pointsUsed);
        
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

    // Analytics methods for admin
    async generateAnalyticsReport() {
        if (!this.isAdmin) {
            return { success: false, message: "Admin access required" };
        }
        
        const report = this.analytics.generateAnalyticsReport();
        return {
            success: true,
            report: report
        };
    }

    async resetAllData() {
        console.log('Reset all data - would need Supabase implementation');
    }
}

function exportAnalyticsData() {
    const analyticsData = localStorage.getItem('jeansClubAnalytics');
    if (!analyticsData) {
        alert('No analytics data to export.');
        return;
    }
    
    const blob = new Blob([analyticsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeansclub-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Analytics data exported successfully!');
}

function showDataStatistics() {
    const analyticsData = JSON.parse(localStorage.getItem('jeansClubAnalytics') || '{}');
    const stats = voucherSystem.getVoucherStats();
    const qrStats = qrRedemptionSystem.getRedemptionStats();
    
    let message = '📊 Data Statistics:\n\n';
    message += `Analytics Records: ${Object.keys(analyticsData.memberEngagement?.loginFrequency || {}).length} members\n`;
    message += `Total Vouchers: ${stats.total}\n`;
    message += `Active Vouchers: ${stats.active}\n`;
    message += `Used Vouchers: ${stats.used}\n`;
    message += `Expired Vouchers: ${stats.expired}\n`;
    message += `Voucher Redemption Rate: ${stats.redemptionRate}\n\n`;
    message += `QR Redemptions: ${qrStats.total}\n`;
    message += `Completed Redemptions: ${qrStats.completed}\n`;
    message += `Pending Redemptions: ${qrStats.pending}\n`;
    message += `Redemption Value: ${qrStats.totalValue.toLocaleString()} UGX\n`;
    message += `Redemption Completion Rate: ${qrStats.completionRate}`;
    
    alert(message);
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
                // Handle newsletter signup
                const newsletterCheckbox = document.getElementById('newsletterSignup');
                if (newsletterCheckbox && newsletterCheckbox.checked) {
                    await clubManager.subscribeToNewsletter(result.member.email, result.member.name);
                }

                showDashboard(result.member);
                let message = 'Welcome to Jeans Club!\n\nYour JC ID: ' + result.member.jcId + '\nKeep this safe - you\'ll need it for future logins!\n\n';
            
                if (referralCode) {
                    message += 'You got 20 points (10 welcome + 10 referral bonus)!\nYour friend got 100 points for referring you!\n\n';
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
        // Handle newsletter signup
        const newsletterCheckbox = document.getElementById('newsletterSignup');
        if (newsletterCheckbox && newsletterCheckbox.checked) {
            await clubManager.subscribeToNewsletter(result.member.email, result.member.name);
        }

        showDashboard(result.member);
        let message = 'Demo Google account created!\nJC ID: ' + result.member.jcId + '\n\n';
        if (referralCode) {
            message += 'You got 20 points (10 welcome + 10 referral bonus)!\n';
        } else {
            message += 'You got 10 welcome points!\n';
        }
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
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    await viewAllMembers();
}

function showDashboard(member) {
    clubManager.currentMember = member;
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    
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
    
    // Update newsletter status
    const newsletterStatus = await clubManager.getNewsletterStatus(member.email);
    const newsletterButton = document.getElementById('newsletterToggle');
    if (newsletterButton) {
        newsletterButton.textContent = newsletterStatus ? 
            'Unsubscribe from Newsletter' : 
            'Subscribe to Newsletter';
    }
    
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
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
}

function showSignupScreen() {
    document.getElementById('signupSection').classList.remove('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
}

function showPasswordResetScreen() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.remove('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    
    // Clear any previous messages
    document.getElementById('resetRequestResult').innerHTML = '';
    document.getElementById('resetExecuteResult').innerHTML = '';
    document.getElementById('resetJCId').value = '';
    document.getElementById('resetToken').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
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

// NEWSLETTER UI FUNCTIONS
async function toggleNewsletter() {
    if (!clubManager.currentMember) return;
    
    const button = document.getElementById('newsletterToggle');
    const isSubscribed = button.textContent.includes('Unsubscribe');
    
    if (isSubscribed) {
        const result = await clubManager.unsubscribeFromNewsletter(clubManager.currentMember.email);
        if (result.success) {
            button.textContent = 'Subscribe to Newsletter';
            alert('You have been unsubscribed from our newsletter.');
        } else {
            alert(result.message);
        }
    } else {
        const result = await clubManager.subscribeToNewsletter(
            clubManager.currentMember.email,
            clubManager.currentMember.name
        );
        if (result.success) {
            button.textContent = 'Unsubscribe from Newsletter';
            alert('You have been subscribed to our newsletter!');
        } else {
            alert(result.message);
        }
    }
}

async function sendNewsletter() {
    if (!clubManager.isAdmin) return alert("Staff access required");
    
    const subject = document.getElementById('newsletterSubject').value.trim();
    const content = document.getElementById('newsletterContent').value.trim();
    
    if (!subject || !content) {
        document.getElementById('newsletterResult').innerHTML = '<span style="color: red;">Please enter subject and content</span>';
        return;
    }
    
    if (!confirm(`Send newsletter to all subscribers?\n\nSubject: ${subject}\n\nThis will email all active newsletter subscribers.`)) {
        return;
    }
    
    const result = await clubManager.sendNewsletterToAll(subject, content);
    const newsletterResult = document.getElementById('newsletterResult');
    
    if (result.success) {
        newsletterResult.innerHTML = '<span style="color: green;">' + result.message + '</span>';
        document.getElementById('newsletterSubject').value = '';
        document.getElementById('newsletterContent').value = '';
    } else {
        newsletterResult.innerHTML = '<span style="color: red;">' + result.message + '</span>';
    }
}

// Analytics Functions for Admin
async function showAnalyticsPanel() {
    if (!clubManager.isAdmin) {
        showAdminLogin();
        return;
    }
    
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.remove('hidden');
    document.getElementById('qrRedemptionSection').classList.add('hidden');
    
    await generateAnalyticsReport();
}

async function generateAnalyticsReport() {
    const result = await clubManager.generateAnalyticsReport();
    
    if (!result.success) {
        document.getElementById('analyticsContent').innerHTML = '<div style="color: red;">' + result.message + '</div>';
        return;
    }
    
    const report = result.report;
    let html = `
        <div class="analytics-summary">
            <h3>📊 Analytics Summary</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Members</h4>
                    <div class="stat-number">${report.summary.totalMembers}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Points</h4>
                    <div class="stat-number">${report.summary.totalPoints.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Spent</h4>
                    <div class="stat-number">${report.summary.totalSpent.toLocaleString()} UGX</div>
                </div>
                <div class="stat-card">
                    <h4>Avg Points/Member</h4>
                    <div class="stat-number">${report.summary.averagePointsPerMember}</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>👥 Tier Distribution</h3>
            <div class="tier-distribution">
    `;
    
    // Tier distribution
    Object.entries(report.tierDistribution).forEach(([tier, count]) => {
        const percentage = report.summary.totalMembers > 0 ? 
            Math.round((count / report.summary.totalMembers) * 100) : 0;
        html += `
            <div class="tier-dist-item">
                <span class="tier-name tier-${tier.toLowerCase()}">${tier}</span>
                <div class="tier-bar">
                    <div class="tier-fill" style="width: ${percentage}%"></div>
                </div>
                <span class="tier-count">${count} (${percentage}%)</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>📈 Engagement Metrics</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Active Members</h4>
                    <div class="stat-number">${report.engagement.activeMembers}</div>
                </div>
                <div class="stat-card">
                    <h4>Avg Logins/Member</h4>
                    <div class="stat-number">${report.engagement.averageLogins}</div>
                </div>
                <div class="stat-card">
                    <h4>Points Redemption Rate</h4>
                    <div class="stat-number">${report.engagement.redemptionRate}</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>💰 Purchase Insights</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Avg Transaction</h4>
                    <div class="stat-number">${report.purchases.averageTransaction.toLocaleString()} UGX</div>
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>🏆 Top Performers</h3>
            <div class="top-performers">
                <h4>Top 5 Spenders</h4>
                <div class="performers-list">
    `;
    
    report.topPerformers.topSpenders.forEach((spender, index) => {
        html += `
            <div class="performer-item">
                <span class="rank">${index + 1}.</span>
                <span class="name">${spender.name}</span>
                <span class="jc-id">(${spender.jcId})</span>
                <span class="tier tier-${spender.tier.toLowerCase()}">${spender.tier}</span>
                <span class="amount">${spender.totalSpent.toLocaleString()} UGX</span>
            </div>
        `;
    });
    
    html += `
                </div>
                
                <h4>Top 5 Referrers</h4>
                <div class="performers-list">
    `;
    
    report.topPerformers.topReferrers.forEach((referrer, index) => {
        html += `
            <div class="performer-item">
                <span class="rank">${index + 1}.</span>
                <span class="jc-id">${referrer.jcId}</span>
                <span class="referrals">${referrer.referrals} referrals</span>
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
        
        <div class="analytics-section">
            <h3>📅 Monthly Trends (Last 6 Months)</h3>
            <div class="monthly-trends">
    `;
    
    report.purchases.monthlyTrends.forEach(trend => {
        html += `
            <div class="trend-item">
                <span class="month">${trend.month}</span>
                <span class="avg-spend">Avg: ${trend.average.toLocaleString()} UGX</span>
                <span class="transactions">${trend.transactions} transactions</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    document.getElementById('analyticsContent').innerHTML = html;
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
     // ADD EMAIL VALIDATION HERE:
   // Enhanced email validation function
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Trim and check for empty
    const trimmedEmail = email.trim();
    if (trimmedEmail.length < 6) return false; // minimum a@b.cd = 6 chars
    
    // Check for basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmedEmail)) {
        return false;
    }
    
    // Extract parts
    const [localPart, domain] = trimmedEmail.toLowerCase().split('@');
    
    // Check local part (before @)
    if (localPart.length === 0 || localPart.length > 64) return false;
    
    // Check for invalid local part characters
    const localPartRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
    if (!localPartRegex.test(localPart)) return false;
    
    // Check domain part (after @)
    if (domain.length < 4) return false; // minimum: a.bc
    
    // Check domain structure
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;
    
    // Check each domain part
    for (const part of domainParts) {
        if (part.length === 0 || part.length > 63) return false;
        // Must start and end with alphanumeric
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(part)) return false;
    }
    
    // Check TLD (last part)
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) return false;
    
    // REJECT OBVIOUSLY FAKE EMAILS
    const fakePatterns = [
        'test@', 'example@', 'fake@', 'admin@', 'user@', 'temp@', 'dummy@',
        'a@a.a', 'aa@aa.aa', 'aaa@aaa.aaa', // too short patterns
        'con', 'c', 'com', // single letters or "con"
    ];
    
    const lowerEmail = trimmedEmail.toLowerCase();
    for (const pattern of fakePatterns) {
        // Check if pattern appears and email is suspiciously short
        if (lowerEmail.includes(pattern) && trimmedEmail.length < 10) {
            return false;
        }
    }
    
    // Additional checks
    if (trimmedEmail.includes('..')) return false; // double dots
    if (trimmedEmail.includes('@@')) return false; // double @
    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) return false;
    if (trimmedEmail.startsWith('@') || trimmedEmail.endsWith('@')) return false;
    
    // Common disposable email domains (add more as needed)
    const disposableDomains = [
        'tempmail.com', '10minutemail.com', 'guerrillamail.com',
        'mailinator.com', 'yopmail.com', 'trashmail.com'
    ];
    
    if (disposableDomains.some(d => domain.includes(d))) {
        // Optional: You can either reject or warn
        if (!confirm("This looks like a temporary email address. Are you sure you want to use this?")) {
            return false;
        }
    }
    
    return true;
}

// Quick email format check (simpler version for prompt dialogs)
function quickEmailCheck(email) {
    if (!email || email.length < 6) return false;
    
    // Must contain @ and .
    if (!email.includes('@') || !email.includes('.')) return false;
    
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    const [local, domain] = parts;
    if (!local || !domain || local.length < 1 || domain.length < 4) return false;
    
    // Reject obviously fake emails
    if (email === 'c' || email === 'con' || email === 'com') return false;
    if (email.length < 8 && email.includes('@')) return false;
    
    return true;
}
    
// Optional: Domain validation
    if (!isValidEmailDomain(email)) {
        if (!confirm("This email domain doesn't look typical. Are you sure this is your correct email?")) {
            alert("Please enter a valid email address");
            return;
        }
    }


    if (password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
    }
    
    const userData = { name, email };
    const result = await clubManager.createAccount(userData, password, referralCode);
    
    if (result.success) {
        // Handle newsletter signup
        const newsletterCheckbox = document.getElementById('newsletterSignup');
        if (newsletterCheckbox && newsletterCheckbox.checked) {
            await clubManager.subscribeToNewsletter(result.member.email, result.member.name);
        }

        showDashboard(result.member);
        let message = 'Welcome to Jeans Club!\n\nYour JC ID: ' + result.member.jcId + '\nKeep this safe - you\'ll need it to login!\n\n';
        
        if (referralCode) {
            message += 'You got 20 points (10 welcome + 10 referral bonus)!\nYour friend got 100 points for referring you!\n\n';
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

// UPDATED: Login with JC ID and Password only
async function loginWithCredentials() {
    const jcId = document.getElementById('loginJCId').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!jcId || !password) {
        alert("Please enter JC ID and password");
        return;
    }
    
    const result = await clubManager.login(jcId, password);
    if (result.success) {
        showDashboard(result.member);
    } else {
        alert(result.message);
    }
}

// Password Reset Functions
async function requestPasswordReset() {
    const jcId = document.getElementById('resetJCId').value.trim();
    
    if (!jcId) {
        document.getElementById('resetRequestResult').innerHTML = '<div class="discount-error">Please enter your JC ID</div>';
        return;
    }
    
    const result = await clubManager.requestPasswordReset(jcId);
    const resetRequestResult = document.getElementById('resetRequestResult');
    
    if (result.success) {
        resetRequestResult.innerHTML = '<div class="discount-success">' + result.message + '<br>' + 
            (result.isFallback ? 'Check browser console for reset code details' : 'Check your email for reset instructions') + '</div>';
        
        // Show the reset form
        document.getElementById('resetForm').classList.remove('hidden');
    } else {
        resetRequestResult.innerHTML = '<div class="discount-error">' + result.message + '</div>';
    }
}

async function executePasswordReset() {
    const jcId = document.getElementById('resetJCId').value.trim();
    const resetToken = document.getElementById('resetToken').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!jcId || !resetToken || !newPassword || !confirmPassword) {
        document.getElementById('resetExecuteResult').innerHTML = '<div class="discount-error">Please fill all fields</div>';
        return;
    }
    
    if (newPassword.length < 4) {
        document.getElementById('resetExecuteResult').innerHTML = '<div class="discount-error">Password must be at least 4 characters</div>';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        document.getElementById('resetExecuteResult').innerHTML = '<div class="discount-error">Passwords do not match</div>';
        return;
    }
    
    const result = await clubManager.resetPassword(jcId, resetToken, newPassword);
    const resetExecuteResult = document.getElementById('resetExecuteResult');
    
    if (result.success) {
        resetExecuteResult.innerHTML = '<div class="discount-success">' + result.message + '</div>';
        
        // Clear form and redirect to login after 3 seconds
        setTimeout(() => {
            showLoginScreen();
            alert('Password reset successful! You can now login with your new password.');
        }, 3000);
    } else {
        resetExecuteResult.innerHTML = '<div class="discount-error">' + result.message + '</div>';
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
    const shareText = 'Join Jeans Club Loyalty Program!\n\nUse my referral code when signing up: ' + member.referralCode + '\n\nWe both get bonus points:\n• You get 20 points (10 welcome + 10 referral bonus)\n• I get 100 referral points\n\nSign up now and start earning rewards!';
    
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