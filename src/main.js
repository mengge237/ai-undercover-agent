/**
 * MPOSTOR - 主入口
 * AI 谁是卧底游戏平台 - 完整版
 */

console.log('[GAME] MPOSTOR v2.1 已加载');

// ========== 全局状态 ==========
window.GameState = {
    currentRoom: null,
    players: [],
    isConnected: false,
    currentPage: 'game-setup',
    agentList: []
};

// ========== 配置 ==========
const CONFIG = {
    BACKEND_URL: 'http://localhost:8080',
    API_TIMEOUT: 5000,
    MAX_RETRIES: 3,
};

// ========== 页面路由 ==========
const ROUTES = {
    '/': 'game-setup',
    '/game-setup': 'game-setup',
    '/game-play': 'game-play',
    '/game-result': 'game-result',
    '/agent-chat': 'agent-chat',
    '/platform-home': 'platform-home',
};

// ========== 工具函数 ==========
function getCurrentPage() {
    const path = window.location.pathname;
    const pageName = path.split('/').pop().replace('.html', '') || 'game-setup';
    return pageName;
}

function getBackendUrl() {
    return CONFIG.BACKEND_URL;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 后端连接检测 ==========
async function checkBackendConnection(retries = 3) {
    const url = `${getBackendUrl()}/api/game/undercover/room/test`;
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(CONFIG.API_TIMEOUT),
            });
            
            if (response.ok) {
                window.GameState.isConnected = true;
                console.log('✓ 后端服务已连接:', getBackendUrl());
                updateConnectionStatus(true);
                return true;
            }
        } catch (error) {
            console.warn(`[!] 后端连接尝试 ${i + 1}/${retries} 失败:`, error.message);
            await sleep(1000);
        }
    }
    
    window.GameState.isConnected = false;
    console.log('[!] 后端服务未连接，将使用本地模式');
    updateConnectionStatus(false);
    return false;
}

// ========== UI更新 ==========
function updateConnectionStatus(connected) {
    // 查找或创建状态指示器
    let indicator = document.getElementById('connectionIndicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connectionIndicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 16px;
            right: 16px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 9999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            transition: all 0.3s;
            cursor: default;
        `;
        document.body.appendChild(indicator);
    }
    
    if (connected) {
        indicator.textContent = '[ONLINE] 后端已连接';
        indicator.style.background = 'rgba(76, 175, 80, 0.2)';
        indicator.style.color = '#4caf50';
        indicator.style.borderColor = 'rgba(76, 175, 80, 0.3)';
    } else {
        indicator.textContent = '[OFFLINE] 本地模式';
        indicator.style.background = 'rgba(255, 107, 107, 0.15)';
        indicator.style.color = '#ff6b6b';
        indicator.style.borderColor = 'rgba(255, 107, 107, 0.2)';
    }
}

// ========== 获取Agent列表 ==========
async function fetchAgentList() {
    try {
        const response = await fetch(`${getBackendUrl()}/api/agent/list`, {
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.code === 0 && result.data) {
                window.GameState.agentList = result.data;
                console.log('✓ Agent列表已加载:', result.data.length, '个');
                return result.data;
            }
        }
        return [];
    } catch (error) {
        console.warn('[!] 获取Agent列表失败:', error);
        return [];
    }
}

// ========== 平台初始化 ==========
async function initPlatform() {
    console.log('[BOOT] 初始化平台...');
    
    // 检测后端连接
    await checkBackendConnection();
    
    // 加载Agent列表
    await fetchAgentList();
    
    // 显示平台信息
    showPlatformInfo();
    
    // 监听页面切换
    setupNavigation();
    
    console.log('✓ 平台初始化完成');
    console.log(`[STAT] 状态: ${window.GameState.isConnected ? '在线' : '本地'}`);
}

// ========== 平台信息 ==========
function showPlatformInfo() {
    console.log('=================================');
    console.log('  [AI] MPOSTOR 智能体游戏平台');
    console.log('  [DATA] 版本: 2.0.0');
    console.log('  [LINK] 后端: ' + (window.GameState.isConnected ? '已连接' : '本地模式'));
    console.log('  [GAME] 功能: 谁是卧底 · 猜词 · AI对话 · 智能体管理');
    console.log('=================================');
}

// ========== 导航设置 ==========
function setupNavigation() {
    // 检测页面中的导航链接
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-nav]');
        if (link) {
            e.preventDefault();
            const target = link.dataset.nav;
            navigateTo(target);
        }
    });
}

function navigateTo(page) {
    const pageMap = {
        'home': '../game-setup/index.html',
        'setup': '../game-setup/index.html',
        'play': '../game-play/index.html',
        'result': '../game-result/index.html',
        'chat': '../agent-chat/index.html',
    };
    
    const url = pageMap[page] || pageMap.home;
    window.location.href = url;
}

// ========== 全局API ==========
window.MultiAgentPlatform = {
    getState: () => window.GameState,
    checkConnection: checkBackendConnection,
    getAgents: fetchAgentList,
    navigate: navigateTo,
    config: CONFIG,
};

// ========== 页面加载完成 ==========
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保页面其他脚本已加载
    setTimeout(initPlatform, 100);
});

// ========== 导出（ES Module兼容） ==========
export {
    CONFIG,
    checkBackendConnection,
    fetchAgentList,
    navigateTo,
    getCurrentPage,
};