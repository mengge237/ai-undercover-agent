const API_URL = 'https://apis.tianapi.com/enmaxim/index';

const apiKeyInput = document.getElementById('apiKey');
const getSingleBtn = document.getElementById('getSingle');
const getListBtn = document.getElementById('getList');
const getBothBtn = document.getElementById('getBoth');
const singleResult = document.getElementById('singleResult');
const listResult = document.getElementById('listResult');

function saveKey(key) {
    if (key) localStorage.setItem('tianapi_key', key);
}

function loadKey() {
    const saved = localStorage.getItem('tianapi_key');
    if (saved) apiKeyInput.value = saved;
}

function buildQuery(params) {
    return Object.keys(params)
        .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
        .join('&');
}

async function request(key, num) {
    const params = { key: key, num: num };
    const url = API_URL + '?' + buildQuery(params);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 200) {
        return data.result;
    } else {
        let errorMsg = data.msg || '请求失败';
        if (data.code === 230) {
            errorMsg = 'API密钥无效，请检查您输入的Key是否正确';
        }
        throw new Error(errorMsg);
    }
}

function renderSingle(data) {
    if (!data) {
        singleResult.innerHTML = '<div class="error">没有获取到数据</div>';
        return;
    }
    const enContent = data.en || '';
    const zhContent = data.zh || '';
    
    singleResult.innerHTML = `
        <div class="quote-item">
            <div class="quote-content">${escapeHtml(enContent)}</div>
            <div class="quote-content" style="color:#666; margin-top:8px;">${escapeHtml(zhContent)}</div>
        </div>
    `;
}

function renderList(data) {
    if (!data) {
        listResult.innerHTML = '<div class="error">没有获取到数据</div>';
        return;
    }
    
    let items = [];
    if (Array.isArray(data)) {
        items = data;
    } else if (data.en || data.zh) {
        items = [data];
    } else {
        listResult.innerHTML = '<div class="error">数据格式错误</div>';
        return;
    }
    
    if (items.length === 0) {
        listResult.innerHTML = '<div class="error">没有获取到数据</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const enContent = item.en || '';
        const zhContent = item.zh || '';
        html += `
            <div class="quote-item">
                <div class="quote-content">${i+1}. ${escapeHtml(enContent)}</div>
                <div class="quote-content" style="color:#666; font-size:13px; margin-top:4px;">${escapeHtml(zhContent)}</div>
            </div>
        `;
    }
    listResult.innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function setSingleLoading() {
    singleResult.innerHTML = '<div class="loading">加载中...</div>';
}
function setListLoading() {
    listResult.innerHTML = '<div class="loading">加载中...</div>';
}
function setSingleError(msg) {
    singleResult.innerHTML = '<div class="error">错误：' + escapeHtml(msg) + '</div>';
}
function setListError(msg) {
    listResult.innerHTML = '<div class="error">错误：' + escapeHtml(msg) + '</div>';
}

async function fetchSingle() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        setSingleError('请输入API Key');
        return;
    }
    saveKey(key);
    setSingleLoading();
    try {
        const result = await request(key, 1);
        renderSingle(result);
    } catch (err) {
        setSingleError(err.message);
    }
}

async function fetchList() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        setListError('请输入API Key');
        return;
    }
    saveKey(key);
    setListLoading();
    try {
        const result = await request(key, 5);
        renderList(result);
    } catch (err) {
        setListError(err.message);
    }
}

async function fetchBoth() {
    const key = apiKeyInput.value.trim();
    if (!key) {
        setSingleError('请输入API Key');
        setListError('请输入API Key');
        return;
    }
    saveKey(key);
    setSingleLoading();
    setListLoading();
    
    const singlePromise = request(key, 1).then(renderSingle).catch(setSingleError);
    const listPromise = request(key, 5).then(renderList).catch(setListError);
    
    await Promise.allSettled([singlePromise, listPromise]);
}

getSingleBtn.addEventListener('click', fetchSingle);
getListBtn.addEventListener('click', fetchList);
getBothBtn.addEventListener('click', fetchBoth);

loadKey();