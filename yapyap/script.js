// File: script.js

// Di bagian atas script.js, tambahkan:
class SEOManager {
    constructor() {
        this.metaTags = {};
    }
    
    // Update meta tags dynamically
    updateMetaTags(data) {
        // Update page title
        if (data.totalStatuses > 0) {
            document.title = `YapYap - ${data.totalStatuses} Status Anonim Aktif | Platform Curhat Online`;
        }
        
        // Update meta description
        this.updateMetaDescription(data);
        
        // Update structured data
        this.updateStructuredData(data);
    }
    
    updateMetaDescription(data) {
        let description = 'YapYap - Platform status anonim 24 jam. ';
        if (data.totalStatuses > 0) {
            description += `${data.totalStatuses} status aktif, ${data.totalComments} komentar. `;
        }
        description += 'Bergabung dan bagikan ceritamu secara anonim!';
        
        // Update meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = description;
        
        // Update OG description
        let ogDesc = document.querySelector('meta[property="og:description"]');
        if (!ogDesc) {
            ogDesc = document.createElement('meta');
            ogDesc.setAttribute('property', 'og:description');
            document.head.appendChild(ogDesc);
        }
        ogDesc.content = description;
    }
    
    updateStructuredData(data) {
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "YapYap",
            "description": `Platform status anonim dengan ${data.totalStatuses} status aktif dan ${data.totalComments} komentar`,
            "url": window.location.href,
            "applicationCategory": "SocialNetworkingApplication",
            "operatingSystem": "Any",
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": data.totalStatuses || "1000",
                "bestRating": "5",
                "worstRating": "1"
            },
            "interactionStatistic": {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/CommentAction",
                "userInteractionCount": data.totalComments
            }
        };
        
        // Update existing structured data or create new
        let scriptTag = document.querySelector('script[type="application/ld+json"]');
        if (!scriptTag) {
            scriptTag = document.createElement('script');
            scriptTag.type = 'application/ld+json';
            document.head.appendChild(scriptTag);
        }
        scriptTag.textContent = JSON.stringify(structuredData);
    }
    
    // Log page view for analytics
    trackPageView() {
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                'page_title': document.title,
                'page_location': window.location.href,
                'page_path': window.location.pathname
            });
        }
        
        // Send to own analytics
        this.sendAnalytics('page_view', {
            url: window.location.href,
            referrer: document.referrer,
            timestamp: new Date().toISOString()
        });
    }
    
    sendAnalytics(event, data) {
        // Kirim data analytics ke server
        fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event,
                data,
                userAgent: navigator.userAgent
            })
        }).catch(() => {
            // Fallback ke localStorage jika offline
            const key = `analytics_${Date.now()}`;
            localStorage.setItem(key, JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
        });
    }
}

// Inisialisasi SEO Manager
const seoManager = new SEOManager();

// Di DOMContentLoaded, tambahkan:
document.addEventListener('DOMContentLoaded', async function() {
    // Track page view
    seoManager.trackPageView();
    
    // ... kode existing ...
    
    // Di loadStatuses setelah data dimuat:
    seoManager.updateMetaTags({
        totalStatuses: appState.totalStatuses,
        totalComments: appState.totalComments,
        onlineUsers: appState.onlineUsers
    });
});

// Tambahkan history pushState untuk URL yang SEO-friendly
function updateURLForStatus(statusId) {
    const title = `Status Anonim - YapYap`;
    const url = `/status/${statusId}`;
    
    history.pushState({ statusId }, title, url);
    
    // Update meta tags untuk status spesifik
    const status = appState.statuses.find(s => s.id === statusId);
    if (status) {
        const statusDescription = status.content.substring(0, 160) + '...';
        document.title = `"${status.content.substring(0, 50)}..." - Status Anonim YapYap`;
        
        // Update meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.content = `Status anonim: ${statusDescription} Baca dan komentari di YapYap.`;
        }
    }
}

// Di toggleComments, tambahkan:
window.toggleComments = function(statusId) {
    // ... kode existing ...
    
    // Update URL untuk SEO
    updateURLForStatus(statusId);
};

// ===== GLOBAL VARIABLE CHECK =====
// Cek dan inisialisasi semua variabel global dengan cara yang aman
if (typeof window._yapyapInitialized === 'undefined') {
    // ===== APP STATE =====
    window.appState = {
        statuses: [],
        comments: {}, // { statusId: [comments] }
        isLoading: false,
        page: 0,
        pageSize: 10,
        hasMore: true,
        totalStatuses: 0,
        totalComments: 0,
        onlineUsers: 1,
        expiredCheckInterval: null,
        autoCleanupInterval: null
    };
    
    // Tandai bahwa sudah diinisialisasi
    window._yapyapInitialized = true;
    console.log('🔄 YapYap app state initialized');
}

// Ambil referensi ke appState
const appState = window.appState;

// ===== SUPABASE CHECK =====
function checkSupabaseClient() {
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not initialized');
        return false;
    }
    return true;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 YapYap Online initialized');
    
    // Check if Supabase is available
    if (!checkSupabaseClient()) {
        showToast('⚠️ Database connection failed', 'error');
        document.getElementById('onlineIndicator').textContent = 'Offline';
        document.getElementById('onlineIndicator').classList.add('text-red-500');
        return;
    }
    
    // Initialize dark mode
    initDarkMode();
    
    // Setup event listeners
    setupEventListeners();
    
    // Test Supabase connection
    await testConnection();
    
    // Load initial statuses
    await loadStatuses(true);
    
    // Setup realtime subscription
    setupRealtimeSubscription();
    
    // Setup auto cleanup
    setupAutoCleanup();
    
    // Start expired status check
    startExpiredStatusCheck();
    
    // Update online users periodically
    setInterval(updateOnlineUsers, 15000);
    
    console.log('✅ App initialized successfully');
});

// ===== DARK MODE =====
function initDarkMode() {
    const toggleBtn = document.getElementById('darkModeToggle');
    const icon = document.getElementById('darkModeIcon');
    
    if (!toggleBtn || !icon) return;
    
    // Check saved preference
    const saved = localStorage.getItem('yapyap_darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (saved === 'true' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        icon.classList.replace('fa-moon', 'fa-sun');
    }
    
    // Toggle event
    toggleBtn.addEventListener('click', function() {
        document.documentElement.classList.toggle('dark');
        
        if (document.documentElement.classList.contains('dark')) {
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('yapyap_darkMode', 'true');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('yapyap_darkMode', 'false');
        }
    });
}

// ===== SUPABASE CONNECTION =====
async function testConnection() {
    if (!checkSupabaseClient()) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('statuses')
            .select('id')
            .limit(1);
            
        if (error) throw error;
        
        showToast('✅ Connected to database', 'success', 2000);
        document.getElementById('onlineIndicator').textContent = 'Online';
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        document.getElementById('onlineIndicator').textContent = 'Offline';
        document.getElementById('onlineIndicator').classList.add('text-red-500');
        showToast('⚠️ Database connection failed', 'error');
    }
}

// ===== STATUS FUNCTIONS =====
async function loadStatuses(reset = true) {
    if (!checkSupabaseClient()) return;
    if (appState.isLoading) return;
    
    appState.isLoading = true;
    showLoading(true);
    
    try {
        const from = reset ? 0 : appState.page * appState.pageSize;
        const to = from + appState.pageSize - 1;
        
        // Hanya ambil status yang belum expired (created_at > 24 jam lalu)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: statusData, error: statusError, count } = await window.supabaseClient
            .from('statuses')
            .select('*', { count: 'exact' })
            .gt('created_at', twentyFourHoursAgo) // Hanya status < 24 jam
            .order('created_at', { ascending: false })
            .range(from, to);
        
        if (statusError) throw statusError;
        
        if (reset) {
            appState.statuses = statusData || [];
            appState.page = 1;
        } else {
            appState.statuses = [...appState.statuses, ...(statusData || [])];
            appState.page++;
        }
        
        appState.hasMore = statusData.length === appState.pageSize;
        appState.totalStatuses = count || 0;
        
        // Load comments for each status
        await loadCommentsForStatuses(appState.statuses);
        
        renderStatusFeed();
        updateStats();
        
        if (reset) {
            showToast('Status terbaru dimuat', 'info', 1500);
        }
        
    } catch (error) {
        console.error('Error loading statuses:', error);
        showToast('Gagal memuat status', 'error');
    } finally {
        appState.isLoading = false;
        showLoading(false);
        updateLoadMoreButton();
    }
}

async function postStatus(content) {
    if (!checkSupabaseClient()) return;
    
    const postButton = document.getElementById('postButton');
    const originalText = postButton.innerHTML;
    
    postButton.disabled = true;
    postButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Posting...';
    
    try {
        const { data, error } = await window.supabaseClient
            .from('statuses')
            .insert([
                {
                    content: content,
                    is_anonymous: true,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        // TAMBAHKAN: Tambahkan langsung ke state lokal untuk feedback instan
        appState.statuses.unshift(data);
        appState.totalStatuses++;
        
        // Update UI langsung
        renderStatusFeed();
        updateStats();
        
        showToast('Status berhasil diposting!', 'success', 3000);
        
        // Clear input
        document.getElementById('statusInput').value = '';
        document.getElementById('charCount').textContent = '0/500';
        
        // Scroll ke status yang baru diposting
        const firstStatus = document.querySelector('.status-card');
        if (firstStatus) {
            firstStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
    } catch (error) {
        console.error('Error posting status:', error);
        showToast('Gagal memposting status: ' + error.message, 'error');
    } finally {
        postButton.disabled = false;
        postButton.innerHTML = originalText;
    }
}

// ===== COMMENTS FUNCTIONS =====
async function loadCommentsForStatuses(statuses) {
    if (!checkSupabaseClient()) return;
    
    const statusIds = statuses.map(s => s.id);
    
    if (statusIds.length === 0) return;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .in('status_id', statusIds)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Group comments by status_id
        const commentsByStatus = {};
        data.forEach(comment => {
            if (!commentsByStatus[comment.status_id]) {
                commentsByStatus[comment.status_id] = [];
            }
            commentsByStatus[comment.status_id].push(comment);
        });
        
        appState.comments = commentsByStatus;
        appState.totalComments = data.length;
        
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function postComment(statusId, content) {
    if (!checkSupabaseClient()) return;
    if (!content.trim()) return;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('comments')
            .insert([
                {
                    status_id: statusId,
                    content: content,
                    is_anonymous: true
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        // Add to local state
        if (!appState.comments[statusId]) {
            appState.comments[statusId] = [];
        }
        appState.comments[statusId].push(data);
        appState.totalComments++;
        
        // Update UI
        renderStatusFeed();
        updateStats();
        
        showToast('Komentar ditambahkan', 'success', 1500);
        
        return data;
        
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Gagal menambahkan komentar', 'error');
    }
}

// ===== REALTIME SUBSCRIPTION =====
function setupRealtimeSubscription() {
    if (!checkSupabaseClient()) return null;
    
    // Subscribe to new statuses
    const statusSubscription = window.supabaseClient
        .channel('statuses')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'statuses' 
            }, 
            (payload) => {
                console.log('📨 New status received:', payload.new);
                
                // Tambahkan ke state lokal jika belum ada
                const exists = appState.statuses.some(s => s.id === payload.new.id);
                if (!exists) {
                    appState.statuses.unshift(payload.new);
                    appState.totalStatuses++;
                    
                    // Update UI
                    renderStatusFeed();
                    updateStats();
                    
                    // Show notification
                    if (payload.new.content.length < 100) {
                        showToast(`📝 Status baru: "${payload.new.content.substring(0, 50)}..."`, 'info', 3000);
                    }
                }
            }
        )
        .on('postgres_changes',
            { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'statuses' 
            },
            (payload) => {
                console.log('🗑️ Status deleted:', payload.old.id);
                
                // Remove from local state
                appState.statuses = appState.statuses.filter(s => s.id !== payload.old.id);
                appState.totalStatuses = Math.max(0, appState.totalStatuses - 1);
                
                // Delete related comments
                if (appState.comments[payload.old.id]) {
                    delete appState.comments[payload.old.id];
                }
                
                // Update UI
                renderStatusFeed();
                updateStats();
            }
        )
        .subscribe();
    
    // Subscribe to new comments
    const commentSubscription = window.supabaseClient
        .channel('comments')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'comments'
            },
            (payload) => {
                console.log('💬 New comment received:', payload.new);
                
                const statusId = payload.new.status_id;
                
                // Add to local state
                if (!appState.comments[statusId]) {
                    appState.comments[statusId] = [];
                }
                
                // Cek apakah komentar sudah ada
                const exists = appState.comments[statusId].some(c => c.id === payload.new.id);
                if (!exists) {
                    appState.comments[statusId].push(payload.new);
                    appState.totalComments++;
                    
                    // Update UI for that specific status
                    updateCommentsUI(statusId);
                    updateStats();
                }
            }
        )
        .subscribe();
    
    console.log('🔔 Realtime subscriptions started');
    return { statusSubscription, commentSubscription };
}

// ===== AUTO CLEANUP =====
function setupAutoCleanup() {
    // Cleanup expired statuses every hour
    appState.autoCleanupInterval = setInterval(async () => {
        await cleanupExpiredStatuses();
    }, 60 * 60 * 1000); // Every hour
}

async function cleanupExpiredStatuses() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { error } = await window.supabaseClient
            .from('statuses')
            .delete()
            .lt('created_at', twentyFourHoursAgo);
        
        if (error) throw error;
        
        console.log('🧹 Auto cleanup completed');
        
    } catch (error) {
        console.error('Error during auto cleanup:', error);
    }
}

function startExpiredStatusCheck() {
    appState.expiredCheckInterval = setInterval(() => {
        renderStatusFeed(); // This will update time indicators
    }, 60000); // Every minute
}

function renderStatusFeed() {
    const feed = document.getElementById('statusFeed');
    const count = document.getElementById('statusCount');
    const emptyState = document.getElementById('emptyState');
    
    if (!feed || !count || !emptyState) return;
    
    // Filter out expired statuses from local state
    const now = new Date();
    const activeStatuses = appState.statuses.filter(status => {
        const createdAt = new Date(status.created_at);
        const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        return expiresAt > now;
    });
    
    if (activeStatuses.length === 0) {
        feed.classList.add('hidden');
        emptyState.classList.remove('hidden');
        count.textContent = '0';
        return;
    }
    
    feed.classList.remove('hidden');
    emptyState.classList.add('hidden');
    count.textContent = activeStatuses.length;
    
    feed.innerHTML = activeStatuses.map((status, index) => {
        const timeAgo = formatTimeAgo(status.created_at);
        const remainingTime = getRemainingTime(status.created_at);
        const isExpiring = remainingTime.hours < 3;
        const isNew = index < 3 && remainingTime.hours > 20;
        const statusComments = appState.comments[status.id] || [];
        
        return `
            <div class="status-card animate-fade-in ${isExpiring ? 'expiring' : ''} mb-4 p-4 border-b border-gray-100 dark:border-gray-800">
                <!-- Status Header - Minimalis -->
                <div class="flex items-start mb-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mr-3 flex-shrink-0">
                        <i class="fas fa-user text-xs text-gray-500 dark:text-gray-400"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <span class="font-medium text-gray-700 dark:text-gray-300">Anonim</span>
                            <div class="flex items-center">
                                ${isNew ? `
                                    <span class="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-500 dark:text-primary-400 rounded mr-2">
                                        Baru
                                    </span>
                                ` : ''}
                                <span class="text-xs ${isExpiring ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}">
                                    <i class="fas fa-clock mr-1"></i>
                                    ${remainingTime.hours}j ${remainingTime.minutes}m
                                </span>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400 dark:text-gray-500">
                            ${timeAgo}
                        </div>
                    </div>
                </div>
                
                <!-- Status Content -->
                <div class="mb-3">
                    <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">${escapeHtml(status.content)}</p>
                </div>
                
                <!-- Status Actions - Minimalis hanya komentar -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <button class="text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 text-sm flex items-center" 
                                onclick="toggleComments(${status.id})"
                                title="Komentar">
                            <i class="fas fa-comment mr-1.5"></i>
                            <span>${statusComments.length}</span>
                        </button>
                    </div>
                </div>
                
                <!-- Comments Section (Hidden by default) - Diperbaiki -->
                <div id="comments-${status.id}" class="comments-section hidden mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div class="mb-3">
                        <h4 class="font-medium mb-2 text-gray-700 dark:text-gray-300 text-sm">
                            Komentar (${statusComments.length})
                        </h4>
                        
                        <!-- Comments List dengan style yang lebih natural -->
                        <div class="space-y-2 comments-list max-h-60 overflow-y-auto pr-1">
                            ${statusComments.length > 0 ? 
                                statusComments.map(comment => `
                                    <div class="comment-item">
                                        <div class="flex">
                                            <!-- Avatar komentator -->
                                            <div class="flex-shrink-0 mr-2">
                                                <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                    <i class="fas fa-user text-xs text-gray-400"></i>
                                                </div>
                                            </div>
                                            
                                            <!-- Konten komentar -->
                                            <div class="flex-1">
                                                <div class="inline-block bg-gray-50 dark:bg-gray-800/60 rounded-2xl rounded-tl-none px-3 py-2">
                                                    <div class="flex items-center mb-1">
                                                        <span class="font-medium text-xs text-gray-600 dark:text-gray-300 mr-2">Anonim</span>
                                                        <span class="text-xs text-gray-400">${formatTimeAgo(comment.created_at)}</span>
                                                    </div>
                                                    <p class="text-gray-700 dark:text-gray-300 text-sm">${escapeHtml(comment.content)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('') : 
                                `<div class="text-center py-4 text-gray-400 dark:text-gray-500">
                                    <i class="fas fa-comment-slash text-lg mb-2"></i>
                                    <p class="text-sm">Belum ada komentar</p>
                                </div>`
                            }
                        </div>
                    </div>
                    
                    <!-- Comment Input - Diperbaiki -->
                    <div class="mt-4">
                        <div class="relative">
                            <input 
                                type="text" 
                                id="comment-input-${status.id}"
                                placeholder="Tulis komentar anonim..."
                                class="w-full px-4 py-2 pr-12 text-sm rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                maxlength="200"
                                autocomplete="off"
                            >
                            <button 
                                onclick="postCommentHandler(${status.id})"
                                class="absolute right-2 top-1/2 transform -translate-y-1/2 bg-primary-500 hover:bg-primary-600 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                                title="Kirim komentar"
                            >
                                <i class="fas fa-paper-plane text-xs"></i>
                            </button>
                        </div>
                        <div class="flex justify-between mt-2 px-1">
                            <p class="text-xs text-gray-400 dark:text-gray-500">
                                Tekan Enter untuk kirim
                            </p>
                            <p class="text-xs text-gray-400 dark:text-gray-500" id="comment-char-${status.id}">
                                0/200
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    attachEventListeners();
}

function updateCommentsUI(statusId) {
    const commentsSection = document.getElementById(`comments-${statusId}`);
    if (!commentsSection) return;
    
    const statusComments = appState.comments[statusId] || [];
    const commentsList = commentsSection.querySelector('.comments-list');
    const commentCount = commentsSection.querySelector('button span');
    
    if (commentsList) {
        if (statusComments.length > 0) {
            commentsList.innerHTML = statusComments.map(comment => `
                <div class="comment-item">
                    <div class="flex">
                        <!-- Avatar komentator -->
                        <div class="flex-shrink-0 mr-2">
                            <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <i class="fas fa-user text-xs text-gray-400"></i>
                            </div>
                        </div>
                        
                        <!-- Konten komentar -->
                        <div class="flex-1">
                            <div class="inline-block bg-gray-50 dark:bg-gray-800/60 rounded-2xl rounded-tl-none px-3 py-2">
                                <div class="flex items-center mb-1">
                                    <span class="font-medium text-xs text-gray-600 dark:text-gray-300 mr-2">Anonim</span>
                                    <span class="text-xs text-gray-400">${formatTimeAgo(comment.created_at)}</span>
                                </div>
                                <p class="text-gray-700 dark:text-gray-300 text-sm">${escapeHtml(comment.content)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
    
    if (commentCount) {
        commentCount.textContent = statusComments.length;
    }
}

// ===== HELPER FUNCTIONS =====
function formatTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}j lalu`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}h lalu`;
    return date.toLocaleDateString('id-ID');
}

function getRemainingTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const expiresAt = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
        return { hours: 0, minutes: 0, expired: true };
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes, expired: false };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateStats() {
    // Fungsi kosong karena stats dihapus
}

function updateOnlineUsers() {
    const onlineElement = document.getElementById('onlineUsers');
    if (!onlineElement) return;
    
    // Simulate random online users
    const baseUsers = Math.max(1, Math.floor(appState.totalStatuses / 5));
    const randomUsers = Math.floor(Math.random() * 10);
    appState.onlineUsers = baseUsers + randomUsers;
    onlineElement.textContent = appState.onlineUsers;
}

function updateLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    if (appState.hasMore && appState.statuses.length > 0) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
}

// ===== EVENT HANDLERS =====
function setupEventListeners() {
    const statusInput = document.getElementById('statusInput');
    const postButton = document.getElementById('postButton');
    const refreshBtn = document.getElementById('refreshBtn');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    // Character counter
    if (statusInput) {
        statusInput.addEventListener('input', function() {
            const charCount = document.getElementById('charCount');
            if (charCount) {
                const length = this.value.length;
                charCount.textContent = `${length}/500`;
                charCount.classList.toggle('text-red-500', length > 450);
                charCount.classList.toggle('text-amber-500', length > 400 && length <= 450);
            }
        });
        
        // Post on Enter (with Shift for new line)
        statusInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                postButton.click();
            }
        });
    }
    
    // Post button
    if (postButton) {
        postButton.addEventListener('click', async () => {
            const content = statusInput.value.trim();
            
            if (!content) {
                showToast('Masukkan teks status terlebih dahulu', 'error');
                statusInput.focus();
                return;
            }
            
            if (content.length > 500) {
                showToast('Status maksimal 500 karakter', 'error');
                return;
            }
            
            await postStatus(content);
        });
    }
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadStatuses(true);
        });
    }
    
    // Load more button
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadStatuses(false);
        });
    }
}

function attachEventListeners() {
    // Comment input handlers dan karakter counter
    document.querySelectorAll('[id^="comment-input-"]').forEach(input => {
        const statusId = parseInt(input.id.split('-')[2]);
        const charCounter = document.getElementById(`comment-char-${statusId}`);
        
        // Karakter counter
        if (charCounter) {
            input.addEventListener('input', function() {
                const length = this.value.length;
                charCounter.textContent = `${length}/200`;
                charCounter.classList.toggle('text-red-500', length > 180);
                charCounter.classList.toggle('text-amber-500', length > 150 && length <= 180);
            });
        }
        
        // Enter to submit
        input.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const content = this.value.trim();
                if (content) {
                    await postComment(statusId, content);
                    this.value = '';
                    if (charCounter) {
                        charCounter.textContent = '0/200';
                        charCounter.classList.remove('text-red-500', 'text-amber-500');
                    }
                }
            }
        });
    });
}

// ===== UI FUNCTIONS (Exposed globally) =====
window.toggleComments = function(statusId) {
    const commentsSection = document.getElementById(`comments-${statusId}`);
    if (commentsSection) {
        commentsSection.classList.toggle('hidden');
        
        // Scroll into view if opening
        if (!commentsSection.classList.contains('hidden')) {
            commentsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};

window.postCommentHandler = async function(statusId) {
    const input = document.getElementById(`comment-input-${statusId}`);
    const charCounter = document.getElementById(`comment-char-${statusId}`);
    
    if (!input) return;
    
    const content = input.value.trim();
    if (content) {
        await postComment(statusId, content);
        input.value = '';
        input.focus();
        
        // Reset karakter counter
        if (charCounter) {
            charCounter.textContent = '0/200';
            charCounter.classList.remove('text-red-500', 'text-amber-500');
        }
    }
};

// ===== TOAST SYSTEM =====
function showToast(message, type = 'info', duration = 4000) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    // Remove existing toasts if too many
    if (toastContainer.children.length > 3) {
        Array.from(toastContainer.children).slice(0, -3).forEach(child => child.remove());
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} animate-slide-up`;
    
    // Icon based on type
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${icon} text-lg"></i>
        <span class="flex-1">${message}</span>
        <button class="toast-close ml-2 opacity-70 hover:opacity-100">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Auto remove
    const autoRemove = setTimeout(() => {
        removeToast(toast);
    }, duration);
    
    // Function to remove toast
    function removeToast(toastElement) {
        clearTimeout(autoRemove);
        toastElement.classList.add('fade-out');
        setTimeout(() => {
            if (toastElement.parentNode === toastContainer) {
                toastContainer.removeChild(toastElement);
            }
        }, 300);
    }
}

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', function() {
    if (appState.expiredCheckInterval) {
        clearInterval(appState.expiredCheckInterval);
    }
    if (appState.autoCleanupInterval) {
        clearInterval(appState.autoCleanupInterval);
    }
});
