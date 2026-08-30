const BACKEND_URL = 'http://localhost:8080';

async function request(endpoint, options = {}) {
    const url = `${BACKEND_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (data.code !== undefined && data.code !== 0) {
                throw new Error(data.message || `业务错误: ${data.code}`);
            }
            return data;
        } else {
            const text = await response.text();
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${text}`);
            }
            return text;
        }
    } catch (error) {
        console.error('API请求失败:', endpoint, error);
        throw error;
    }
}

export const gameAPI = {
    createRoom: (players, category, wordSource = 'ai', customWords = null) => {
        const payload = { players, category, wordSource };
        if (customWords) {
            payload.customWords = customWords;
        }
        return request('/api/game/undercover/create', {
            method: 'POST',
            body: payload,
        });
    },

    getRoom: (roomId) =>
        request(`/api/game/undercover/room/${roomId}`, {
            method: 'GET',
        }),

    generateDescription: (roomId, playerId) =>
        request('/api/game/undercover/describe', {
            method: 'POST',
            body: { roomId, playerId },
        }),

    vote: (roomId, playerId, discussion) =>
        request('/api/game/undercover/vote', {
            method: 'POST',
            body: { roomId, playerId, discussion },
        }),

    test: () =>
        request('/api/game/undercover/room/test', {
            method: 'GET',
        }),
};

export const agentAPI = {
    list: () =>
        request('/api/agent/list', {
            method: 'GET',
        }),

    getStatus: (agentId) =>
        request(`/api/agent/status/${agentId}`, {
            method: 'GET',
        }),

    chat: (agentId, message, context = '') =>
        request(`/api/agent/chat/${agentId}`, {
            method: 'POST',
            body: { message, context },
        }),

    getByName: (name) =>
        request(`/api/agent/by-name/${name}`, {
            method: 'GET',
        }),

    getByType: (type) =>
        request(`/api/agent/by-type/${type}`, {
            method: 'GET',
        }),
};

export default {
    game: gameAPI,
    agent: agentAPI,
    request,
    BACKEND_URL,
};
