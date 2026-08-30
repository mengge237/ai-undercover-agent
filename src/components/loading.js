// 加载组件
export function showLoading(text) {
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.innerHTML = `<div class="spinner"></div><p>${text}</p>`;
    document.body.appendChild(loading);
}