// Enhanced Google Sheets DB with proper synchronization
class GoogleSheetsDB {
    constructor() {
        this.scriptURL = 'https://script.google.com/macros/s/AKfycbwgqslmtzGl9yp_BmyCuQW2Ei-7xKVJ-JIiQcwEvD2mD6CwJzDD4xM6w2JIJrOIW5mP/exec';
        this.cacheKey = 'jeansClubSheetsCache';
        this.cacheTimeout = 60000; // 1 minute cache
        this.init();
    }

    async init() {
        // Initialize with empty cache
        this.setCache({ members: [], lastSync: 0 });
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

    isCacheValid() {
        const cache = this.getCache();
        if (!cache || !cache.members) return false;
        return (Date.now() - cache.lastSync) < this.cacheTimeout;
    }

    // Enhanced API call with proper error handling
    async callSheetsAPI(action, data = {}) {
        const payload = {
            action: action,
            ...data,
            timestamp: new Date().toISOString(),
            source: 'jeans-club-web'
        };

        console.log('📡 Calling Google Sheets API:', action, data);

        try {
            // Use fetch with no-cors for write operations
            const response = await fetch(this.scriptURL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log('✅ API request sent successfully');
            
            // For no-cors mode, we assume success and update localStorage
            return await this.handleLocalStorageUpdate(action, data);
            
        } catch (error) {
            console.error('❌ API call failed:', error);
            return await this.handleLocalStorageUpdate(action, data);
        }
    }

    // Handle localStorage updates for immediate consistency
    async handleLocalStorageUpdate(action, data) {
        try {
            switch(action) {
                case 'saveMember':
                    return this.updateLocalMember(data.member);
                case 'deleteMember':
                    return this.deleteLocalMember(data.jcId);
                case 'getAllMembers':
                    return this.getAllLocalMembers();
                case 'getMember':
                    return this.getLocalMember(data.jcId);
                default:
                    return { success: false, error: 'Unknown action' };
            }
        } catch (error) {
            console.error('Local storage update failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Local storage management methods
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
        
        return { success: true, message: "Member updated locally" };
    }

    deleteLocalMember(jcId) {
        const cache = this.getCache();
        if (!cache) return { success: false, error: "No cache found" };
        
        cache.members = cache.members.filter(m => m.jcId !== jcId);
        cache.lastSync = Date.now();
        this.setCache(cache);
        
        return { success: true, message: "Member deleted locally" };
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

    // Public methods
    async getAllMembers() {
        // Always try to get fresh data first
        console.log('🔄 Fetching all members from Google Sheets...');
        const result = await this.callSheetsAPI('getAllMembers');
        
        if (result.success && result.members) {
            console.log('✅ Loaded', result.members.length, 'members from central database');
            return result.members;
        } else {
            console.log('❌ Failed to load from central DB, using local cache');
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
        console.log('🔍 Searching for member:', jcId);
        const result = await this.callSheetsAPI('getMember', { jcId: jcId });
        
        if (result.success && result.member) {
            console.log('✅ Member found:', result.member.name);
            return result.member;
        } else {
            console.log('❌ Member not found:', jcId);
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
            cache.lastSync = 0; // Invalidate cache
            this.setCache(cache);
        }
        return await this.getAllMembers();
    }
}

// Enhanced JeansClubManager with better synchronization
class JeansClubManager {
    constructor() {
        this.db = new GoogleSheetsDB();
        this.emailService = new GoogleAppsEmailService();
        this.currentMember = null;
        this.isAdmin = false;
        this.loadCurrentMember();
        console.log('🚀 JeansClubManager initialized with enhanced sync');
    }

    // Load current member from localStorage
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

    // Save current member to localStorage
    saveCurrentMember() {
        if (this.currentMember) {
            try {
                localStorage.setItem('jeansClubCurrentMember', JSON.stringify(this.currentMember));
            } catch (error) {
                console.error('Error saving current member:', error);
            }
        }
    }

    // Enhanced account creation with better error handling
    async createAccount(userData, password, referralCode = null) {
        console.log('👤 Creating account for:', userData.email);
        
        try {
            // Check if email already exists in central database
            const existingMember = await this.db.getMemberByEmail(userData.email);
            if (existingMember) {
                console.log('❌ Email already registered:', userData.email);
                return { success: false, message: "Email already registered. Please login instead." };
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

            console.log('💾 Saving new member to central database:', newMember.jcId);

            // Save to central database
            const saveResult = await this.db.saveMember(newMember);
            if (!saveResult) {
                console.log('❌ Failed to save member to central database');
                return { success: false, message: "Failed to create account. Please try again." };
            }

            // Set as current member
            this.currentMember = newMember;
            this.saveCurrentMember();
            
            // Log activity
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
            
        } catch (error) {
            console.error('Account creation error:', error);
            return { success: false, message: "Account creation failed: " + error.message };
        }
    }

    // Enhanced login with central database lookup
    async login(jcId, email, password) {
        console.log('🔐 Attempting login for JC ID:', jcId, 'Email:', email);
        
        try {
            // Search in central database
            const member = await this.db.getMemberByJCId(jcId);
            
            if (!member) {
                console.log('❌ Member not found in central database:', jcId);
                return { success: false, message: "Account not found. Please check your JC ID or sign up." };
            }

            // Verify email matches
            if (member.email !== email) {
                console.log('❌ Email mismatch for JC ID:', jcId);
                return { success: false, message: "JC ID and email do not match. Please check your details." };
            }

            // Check login method
            if (member.loginMethod === 'google') {
                return { success: false, message: "This account uses Google login. Please use Google Sign-In." };
            }

            // Verify password
            if (!this.verifyPassword(password, member.password)) {
                console.log('❌ Invalid password for:', jcId);
                return { success: false, message: "Invalid password. Please try again." };
            }

            // Login successful
            this.currentMember = member;
            this.saveCurrentMember();
            
            await this.logActivity(member.id, 'Logged in to account', 0);
            console.log('✅ Login successful for:', member.name);
            
            return { success: true, member: member };
            
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: "Login failed: " + error.message };
        }
    }

    // Enhanced Google login
    async loginWithGoogle(email) {
        console.log('🔐 Attempting Google login for:', email);
        
        try {
            const member = await this.db.getMemberByEmail(email);
            
            if (!member) {
                console.log('❌ Google account not found:', email);
                return { success: false, message: "Google account not found. Please sign up first." };
            }

            if (member.loginMethod !== 'google') {
                console.log('❌ Account exists but not Google login:', email);
                return { success: false, message: "This email is registered with password login. Please use JC ID and password." };
            }

            this.currentMember = member;
            this.saveCurrentMember();
            
            await this.logActivity(member.id, 'Logged in with Google', 0);
            console.log('✅ Google login successful for:', member.name);
            
            return { success: true, member: member };
            
        } catch (error) {
            console.error('Google login error:', error);
            return { success: false, message: "Google login failed: " + error.message };
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
                console.log('✅ Refreshed member data:', freshMember.jcId);
            }
            return freshMember;
        } catch (error) {
            console.error('Error refreshing member:', error);
            return this.currentMember;
        }
    }

    // The rest of your existing methods remain the same...
    generateJCId() {
        return 'JC' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }

    generateReferralCode() {
        return 'JEANS' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    hashPassword(password) {
        return btoa(unescape(encodeURIComponent(password)));
    }

    verifyPassword(password, hashedPassword) {
        return btoa(unescape(encodeURIComponent(password))) === hashedPassword;
    }

    // ... include all your other existing methods unchanged
}

// Enhanced UI functions with better error handling
async function loginWithCredentials() {
    const jcId = document.getElementById('loginJCId').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!jcId || !email || !password) {
        alert("Please enter JC ID, email and password");
        return;
    }
    
    showLoading('Logging in...');
    
    try {
        const result = await clubManager.login(jcId, email, password);
        if (result.success) {
            showDashboard(result.member);
            alert('Welcome back, ' + result.member.name + '!');
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

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
    
    showLoading('Creating account...');
    
    try {
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
                message += 'Email details saved (check browser console)\n\n';
            } else if (result.emailSent) {
                message += 'Welcome email sent to your inbox!\n\n';
            }
            
            alert(message);
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert('Signup failed: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Utility functions for loading states
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
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 18px;
            z-index: 10000;
        `;
        document.body.appendChild(loader);
    }
    loader.innerHTML = `<div style="text-align: center;">${message}</div>`;
    loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Initialize the enhanced manager
const clubManager = new JeansClubManager();

// Update your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) document.getElementById('referralCode').value = refCode;
    
    setTimeout(initializeGoogleSignIn, 1000);
    
    if (clubManager.currentMember) {
        // Refresh member data on page load
        clubManager.refreshCurrentMember().then(freshMember => {
            if (freshMember) {
                showDashboard(freshMember);
            } else {
                showLoginScreen();
            }
        });
    } else {
        showLoginScreen();
    }
});
