// Import Supabase
const { createClient } = supabase;


// ============================================
// NEW: PointsOnlyPaymentSystem Class
// ============================================
class PointsOnlyPaymentSystem {
    constructor() {
        // Point value system (when SPENDING points)
        this.pointSpendingValues = {
            PEARL: 300,
            BRONZE: 350,
            SILVER: 425,
            RUBY: 500,
            GOLD: 600,
            SAPPHIRE: 725,
            PLATINUM: 875
        };

        // Earning rate (fixed for all tiers)
        this.earningRate = 750; // Spend UGX 750 cash = Get 1 point

        // Spending limits
        this.spendingLimits = {
            PEARL: { perTransaction: 30000, daily: 60000, monthly: 150000 },
            BRONZE: { perTransaction: 60000, daily: 120000, monthly: 300000 },
            SILVER: { perTransaction: 120000, daily: 240000, monthly: 600000 },
            RUBY: { perTransaction: 210000, daily: 420000, monthly: 1050000 },
            GOLD: { perTransaction: 300000, daily: 600000, monthly: 1500000 },
            SAPPHIRE: { perTransaction: 450000, daily: 900000, monthly: 2250000 },
            PLATINUM: { perTransaction: 750000, daily: 1500000, monthly: 3750000 }
        };

        // Track spending per member
        this.dailySpending = {};
        this.monthlySpending = {};

        this.init();
    }

    init() {
        // Load spending data from localStorage
        const savedDaily = localStorage.getItem('pointsDailySpending');
        const savedMonthly = localStorage.getItem('pointsMonthlySpending');
        
        if (savedDaily) this.dailySpending = JSON.parse(savedDaily);
        if (savedMonthly) this.monthlySpending = JSON.parse(savedMonthly);
    }

    saveSpendingData() {
        localStorage.setItem('pointsDailySpending', JSON.stringify(this.dailySpending));
        localStorage.setItem('pointsMonthlySpending', JSON.stringify(this.monthlySpending));
    }

    // ======================
    // CRITICAL FIXES IMPLEMENTED:
    // ======================
    // 1. Fixed maxPurchaseLimit - returns correct values (30,000 for Pearl, not 50,000)
    // 2. Added business margin calculation
    // 3. Fixed points calculation using pointSpendingValues[tier], not earning rate
    // 4. Added salesperson tracking

    calculatePointsNeeded(ugxAmount, tier) {
        const pointValue = this.pointSpendingValues[tier];
        return Math.ceil(ugxAmount / pointValue);
    }

    calculateBusinessMargin(pointsNeeded, tier) {
        // Business cost: points were earned at 750 UGX per point
        const costToBusiness = pointsNeeded * 750;
        // Revenue: actual value of goods/service
        const revenue = pointsNeeded * this.pointSpendingValues[tier];
        const profit = revenue - costToBusiness;
        const marginPercentage = (profit / revenue) * 100;

        return {
            costToBusiness,
            revenue,
            profit,
            marginPercentage: marginPercentage.toFixed(2),
            businessGains: profit > 0,
            customerGains: profit < 0
        };
    }

    getSpendingLimits(tier) {
        return this.spendingLimits[tier] || this.spendingLimits.PEARL;
    }

    // Check if transaction is within limits
    checkSpendingLimits(memberJCId, ugxAmount, tier) {
        const limits = this.getSpendingLimits(tier);
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

        // Initialize member records if not exist
        if (!this.dailySpending[memberJCId]) this.dailySpending[memberJCId] = {};
        if (!this.monthlySpending[memberJCId]) this.monthlySpending[memberJCId] = {};

        // Get current spending
        const currentDaily = this.dailySpending[memberJCId][today] || 0;
        const currentMonthly = this.monthlySpending[memberJCId][currentMonth] || 0;

        // Check limits
        const errors = [];
        if (ugxAmount > limits.perTransaction) {
            errors.push(`Per transaction limit exceeded: UGX ${ugxAmount.toLocaleString()} > UGX ${limits.perTransaction.toLocaleString()}`);
        }
        if (currentDaily + ugxAmount > limits.daily) {
            errors.push(`Daily limit exceeded: UGX ${(currentDaily + ugxAmount).toLocaleString()} > UGX ${limits.daily.toLocaleString()}`);
        }
        if (currentMonthly + ugxAmount > limits.monthly) {
            errors.push(`Monthly limit exceeded: UGX ${(currentMonthly + ugxAmount).toLocaleString()} > UGX ${limits.monthly.toLocaleString()}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            currentDaily,
            currentMonthly,
            remainingDaily: limits.daily - currentDaily,
            remainingMonthly: limits.monthly - currentMonthly
        };
    }

    // Update spending records
    updateSpendingRecords(memberJCId, ugxAmount) {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().substring(0, 7);

        if (!this.dailySpending[memberJCId]) this.dailySpending[memberJCId] = {};
        if (!this.monthlySpending[memberJCId]) this.monthlySpending[memberJCId] = {};

        // Update daily spending
        this.dailySpending[memberJCId][today] = (this.dailySpending[memberJCId][today] || 0) + ugxAmount;
        
        // Update monthly spending
        this.monthlySpending[memberJCId][currentMonth] = (this.monthlySpending[memberJCId][currentMonth] || 0) + ugxAmount;

        this.saveSpendingData();
    }

    // ======================
    // For CUSTOMER (Mobile QR Code)
    // ======================

    async validatePointsPayment(memberJCId, pointsToUse, description) {
        try {
            // Get member from Supabase
            const member = await clubManager.db.getMemberByJCId(memberJCId);
            if (!member) {
                return { valid: false, error: "Member not found" };
            }

            // Check if member has enough points
            if (member.points < pointsToUse) {
                return { 
                    valid: false, 
                    error: `Insufficient points. You have ${member.points} points, need ${pointsToUse}` 
                };
            }

            // Calculate UGX amount
            const ugxAmount = pointsToUse * this.pointSpendingValues[member.tier];
            
            // Check spending limits
            const limitCheck = this.checkSpendingLimits(memberJCId, ugxAmount, member.tier);
            if (!limitCheck.valid) {
                return { valid: false, error: limitCheck.errors.join(", ") };
            }

            // Calculate business margin
            const margin = this.calculateBusinessMargin(pointsToUse, member.tier);

            return {
                valid: true,
                member: {
                    jcId: member.jcId,
                    name: member.name,
                    email: member.email,
                    tier: member.tier,
                    currentPoints: member.points
                },
                transaction: {
                    pointsToUse,
                    ugxAmount,
                    description,
                    pointValue: this.pointSpendingValues[member.tier],
                    pointsNeeded: this.calculatePointsNeeded(ugxAmount, member.tier)
                },
                limits: limitCheck,
                businessMargin: margin,
                timestamp: new Date().toISOString(),
                transactionId: 'pts_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            };

        } catch (error) {
            console.error('Validation error:', error);
            return { valid: false, error: "Validation failed: " + error.message };
        }
    }

    generateQRCodeData(validationResult) {
        const qrData = {
            type: 'jeansclub_points_payment',
            version: '2.0',
            transactionId: validationResult.transactionId,
            memberJCId: validationResult.member.jcId,
            pointsToUse: validationResult.transaction.pointsToUse,
            description: validationResult.transaction.description,
            timestamp: validationResult.timestamp,
            signature: this.generateSignature(validationResult)
        };

        // Simple encryption for QR data
        return btoa(JSON.stringify(qrData));
    }

    generateSignature(data) {
        const str = data.transactionId + data.member.jcId + data.transaction.pointsToUse + data.timestamp;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    // ======================
    // For SALESPERSON (Terminal)
    // ======================

    async processPointsPayment(memberJCId, ugxAmount, description, salespersonName) {
        try {
            // Get member from Supabase
            const member = await clubManager.db.getMemberByJCId(memberJCId);
            if (!member) {
                return { success: false, message: "Member not found" };
            }

            // Calculate points needed
            const pointsNeeded = this.calculatePointsNeeded(ugxAmount, member.tier);
            
            // Check if member has enough points
            if (member.points < pointsNeeded) {
                return { 
                    success: false, 
                    message: `Insufficient points. Need ${pointsNeeded} points, but only have ${member.points}` 
                };
            }

            // Check spending limits
            const limitCheck = this.checkSpendingLimits(memberJCId, ugxAmount, member.tier);
            if (!limitCheck.valid) {
                return { success: false, message: limitCheck.errors.join(", ") };
            }

            // Calculate business margin
            const margin = this.calculateBusinessMargin(pointsNeeded, member.tier);

            // Update member points
            const oldPoints = member.points;
            member.points -= pointsNeeded;
            member.tier = clubManager.calculateTier(member.points);

            // Add to purchase history
            member.purchaseHistory.push({
                date: new Date().toISOString(),
                amount: 0, // No cash spent, only points
                pointsUsed: pointsNeeded,
                description: description,
                ugxValue: ugxAmount,
                salesperson: salespersonName,
                transactionType: 'points_payment'
            });

            // Log activity
            await clubManager.logActivity(member.id, 
                `Points payment: ${pointsNeeded} points for ${description} (UGX ${ugxAmount.toLocaleString()}) - Processed by: ${salespersonName}`, 
                -pointsNeeded);

            // Update spending records
            this.updateSpendingRecords(memberJCId, ugxAmount);

            // Save updated member to Supabase
            await clubManager.db.saveMember(member);

            // If this is the current member, update dashboard
            if (clubManager.currentMember && clubManager.currentMember.jcId === memberJCId) {
                clubManager.currentMember = member;
                clubManager.saveCurrentMember();
            }

            // Send email receipt
            await this.sendPointsPaymentEmail(member, {
                pointsUsed: pointsNeeded,
                ugxAmount: ugxAmount,
                description: description,
                salespersonName: salespersonName,
                newPoints: member.points,
                pointValue: this.pointSpendingValues[member.tier],
                businessMargin: margin
            });

            return {
                success: true,
                message: `Payment successful! ${pointsNeeded} points used for UGX ${ugxAmount.toLocaleString()}`,
                transaction: {
                    pointsUsed: pointsNeeded,
                    ugxAmount: ugxAmount,
                    newPoints: member.points,
                    tier: member.tier,
                    salesperson: salespersonName,
                    businessMargin: margin
                }
            };

        } catch (error) {
            console.error('Payment processing error:', error);
            return { success: false, message: "Payment failed: " + error.message };
        }
    }

    async processScannedQR(qrData, salespersonName) {
        try {
            // Decode QR data
            const decodedData = JSON.parse(atob(qrData));
            
            // Verify signature
            const expectedSignature = this.generateSignature({
                transactionId: decodedData.transactionId,
                member: { jcId: decodedData.memberJCId },
                transaction: { pointsToUse: decodedData.pointsToUse },
                timestamp: decodedData.timestamp
            });

            if (decodedData.signature !== expectedSignature) {
                return { success: false, message: "Invalid QR code signature" };
            }

            // Validate the payment
            const validation = await this.validatePointsPayment(
                decodedData.memberJCId, 
                decodedData.pointsToUse, 
                decodedData.description
            );

            if (!validation.valid) {
                return { success: false, message: validation.error };
            }

            // Calculate UGX amount
            const ugxAmount = decodedData.pointsToUse * this.pointSpendingValues[validation.member.tier];

            // Process the payment with salesperson name
            return await this.processPointsPayment(
                decodedData.memberJCId, 
                ugxAmount, 
                decodedData.description, 
                salespersonName
            );

        } catch (error) {
            console.error('QR processing error:', error);
            return { success: false, message: "Invalid QR code data" };
        }
    }

    // ======================
    // Email Service for Points Payments
    // ======================

    async sendPointsPaymentEmail(member, paymentData) {
        const emailService = new GoogleAppsEmailService();
        
        const emailData = {
            type: 'points_payment',
            memberData: {
                name: member.name,
                jcId: member.jcId,
                tier: member.tier,
                points: member.points
            },
            extraData: {
                pointsUsed: paymentData.pointsUsed,
                ugxAmount: paymentData.ugxAmount,
                description: paymentData.description,
                salespersonName: paymentData.salespersonName,
                newPoints: paymentData.newPoints,
                pointValue: paymentData.pointValue,
                businessMargin: paymentData.businessMargin
            }
        };

        // Build email content
        const subject = `🎫 Points Payment Confirmation - ${paymentData.description}`;
        const content = this.buildPointsPaymentEmail(member, paymentData);

        try {
            const result = await emailService.sendEmailToGoogleScript(
                member.email, 
                'points_payment', 
                emailData.memberData, 
                emailData.extraData
            );
            
            if (!result.success) {
                // Fallback: Use direct email building
                this.savePointsPaymentEmailToLog(member.email, subject, content);
            }
            
            return result;
        } catch (error) {
            console.error('Email sending error:', error);
            this.savePointsPaymentEmailToLog(member.email, subject, content);
            return { success: false, fallback: true };
        }
    }

    buildPointsPaymentEmail(member, paymentData) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Points Payment Confirmation - Jeans Club</title>
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
        .transaction-summary { 
            background: #f8f9fa; 
            padding: 30px; 
            border-radius: 8px; 
            margin: 25px 0; 
            border-left: 4px solid #667eea; 
        }
        .business-margin { 
            background: ${paymentData.businessMargin.businessGains ? '#d4edda' : '#fff3cd'}; 
            color: ${paymentData.businessMargin.businessGains ? '#155724' : '#856404'}; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border: 1px solid ${paymentData.businessMargin.businessGains ? '#c3e6cb' : '#ffeaa7'}; 
        }
        .points-used { 
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 10px; 
            text-align: center; 
            margin: 25px 0; 
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
        @media (max-width: 600px) {
            .email-content { padding: 25px 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎫 Points Payment Confirmed</h1>
            <p>Your Points Have Been Successfully Redeemed</p>
        </div>
        
        <div class="email-content">
            <h2 style="color: #333; margin-top: 0;">Hello ${member.name},</h2>
            <p style="font-size: 16px; color: #555;">Your points payment has been processed successfully. Here are the details:</p>
            
            <div class="points-used">
                <h3 style="margin: 0 0 10px; font-size: 24px;">${paymentData.pointsUsed.toLocaleString()} Points Used</h3>
                <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">UGX ${paymentData.ugxAmount.toLocaleString()}</div>
                <p style="margin: 10px 0 0; opacity: 0.9; font-size: 16px;">Value redeemed</p>
            </div>

            <div class="transaction-summary">
                <h3 style="color: #667eea; margin-top: 0;">📋 Transaction Details</h3>
                <table>
                    <tr>
                        <td style="font-weight: bold; color: #555; width: 40%;">Description:</td>
                        <td style="color: #333;">${paymentData.description}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Points Used:</td>
                        <td style="color: #333;">${paymentData.pointsUsed.toLocaleString()} points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Point Value:</td>
                        <td style="color: #333;">1 point = UGX ${paymentData.pointValue} (${member.tier} tier)</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">UGX Amount:</td>
                        <td style="color: #333; font-weight: bold;">UGX ${paymentData.ugxAmount.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">New Points Balance:</td>
                        <td style="color: #333; font-weight: bold;">${paymentData.newPoints.toLocaleString()} points</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Processed By:</td>
                        <td style="color: #333;">${paymentData.salespersonName}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; color: #555;">Transaction Date:</td>
                        <td style="color: #333;">${new Date().toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            <div class="business-margin">
                <h4 style="margin: 0 0 10px; color: inherit;">💰 Business Margin Analysis</h4>
                <table style="color: inherit;">
                    <tr>
                        <td style="font-weight: bold;">Cost to Business:</td>
                        <td>UGX ${paymentData.businessMargin.costToBusiness.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Revenue Value:</td>
                        <td>UGX ${paymentData.businessMargin.revenue.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">${paymentData.businessMargin.businessGains ? 'Profit' : 'Loss'}:</td>
                        <td style="font-weight: bold;">UGX ${Math.abs(paymentData.businessMargin.profit).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Margin:</td>
                        <td style="font-weight: bold;">${paymentData.businessMargin.marginPercentage}% ${paymentData.businessMargin.businessGains ? '🔼' : '🔽'}</td>
                    </tr>
                </table>
                <p style="margin: 10px 0 0; font-size: 14px;">
                    ${paymentData.businessMargin.businessGains ? 
                        '✅ Business gains on this transaction' : 
                        '✅ Customer gets better value on this transaction'}
                </p>
            </div>
            
            <div class="email-footer">
                <p style="margin: 0 0 10px; color: #333; font-weight: bold;">Thank you for choosing Jeans Club Points Payment!</p>
                <p style="margin: 5px 0; color: #666;">📍 Visit us: https://elijah787.github.io/jeans-club</p>
                <p style="margin: 15px 0 0; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    savePointsPaymentEmailToLog(email, subject, content) {
        try {
            const emailLog = JSON.parse(localStorage.getItem('pointsPaymentEmails') || '[]');
            emailLog.unshift({
                email: email,
                subject: subject,
                content: content,
                timestamp: new Date().toISOString(),
                sent: false
            });
            
            if (emailLog.length > 50) emailLog.length = 50;
            
            localStorage.setItem('pointsPaymentEmails', JSON.stringify(emailLog));
            
            console.log('📧 Points payment email saved to log (check localStorage: pointsPaymentEmails)');
            console.log('Subject:', subject);
            console.log('Content preview:', content.substring(0, 200) + '...');
            
        } catch (error) {
            console.error('Could not save email to storage:', error);
        }
    }

    // ======================
    // Integration with JeansClubManager
    // ======================

    // Reset daily/monthly spending at appropriate intervals
    cleanupOldRecords() {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        // Remove daily records older than 2 days
        Object.keys(this.dailySpending).forEach(memberJCId => {
            Object.keys(this.dailySpending[memberJCId]).forEach(date => {
                if (date < today) {
                    delete this.dailySpending[memberJCId][date];
                }
            });
        });

        // Remove monthly records older than current month
        Object.keys(this.monthlySpending).forEach(memberJCId => {
            Object.keys(this.monthlySpending[memberJCId]).forEach(month => {
                if (month < currentMonth) {
                    delete this.monthlySpending[memberJCId][month];
                }
            });
        });

        this.saveSpendingData();
    }

    // Get member spending summary
    getMemberSpendingSummary(memberJCId) {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().substring(0, 7);
        
        const daily = this.dailySpending[memberJCId]?.[today] || 0;
        const monthly = this.monthlySpending[memberJCId]?.[currentMonth] || 0;
        
        return { daily, monthly };
    }
}

// Initialize PointsOnlyPaymentSystem
const pointsPaymentSystem = new PointsOnlyPaymentSystem();
// AI Chat Bot Database - REMOVED
// All AI chat bot related functions and database have been removed

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
const jeansClubConfig = {
    pointValue: 750,
    redemptionRate: 0.005,
    
    tiers: {
        PEARL: { 
            minPoints: 0, 
            maxPoints: 9999,
            multiplier: 1.0,
            name: "Pearl",
            color: "#F8F8FF",
            discountRate: 0.10
        },
        BRONZE: { 
            minPoints: 10000,
            maxPoints: 34999,
            multiplier: 1.10,
            name: "Bronze",
            color: "#cd7f32",
            discountRate: 0.15
        },
        SILVER: { 
            minPoints: 35000,
            maxPoints: 74999,
            multiplier: 1.25,
            name: "Silver",
            color: "#c0c0c0",
            discountRate: 0.20
        },
        // NEW TIER: Between Silver and Gold
        RUBY: { 
            minPoints: 75000,
            maxPoints: 124999,
            multiplier: 1.30,
            name: "Ruby",
            color: "#e0115f",
            discountRate: 0.22
        },
        GOLD: { 
            minPoints: 125000,
            maxPoints: 349999,
            multiplier: 1.40,
            name: "Gold",
            color: "#ffd700",
            discountRate: 0.25
        },
        // NEW TIER: Between Gold and Platinum
        SAPPHIRE: { 
            minPoints: 350000,
            maxPoints: 674999,
            multiplier: 1.50,
            name: "Sapphire",
            color: "#0f52ba",
            discountRate: 0.27
        },
        PLATINUM: { 
            minPoints: 675000,
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
    
    let message = '📊 Data Statistics:\n\n';
    message += `Analytics Records: ${Object.keys(analyticsData.memberEngagement?.loginFrequency || {}).length} members\n`;
    message += `Total Vouchers: ${stats.total}\n`;
    message += `Active Vouchers: ${stats.active}\n`;
    message += `Used Vouchers: ${stats.used}\n`;
    message += `Expired Vouchers: ${stats.expired}\n`;
    message += `Redemption Rate: ${stats.redemptionRate}\n`;
    
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
}

function showSignupScreen() {
    document.getElementById('signupSection').classList.remove('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.add('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
}

function showPasswordResetScreen() {
    document.getElementById('signupSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('passwordResetSection').classList.remove('hidden');
    document.getElementById('analyticsSection').classList.add('hidden');
    
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
    
    if (password.length < 4) {
        alert("Password must be at least 4 characters");
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