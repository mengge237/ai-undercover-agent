// 表单校验工具
export function validatePlayers(players) {
    return players.every(p => p.trim() !== '');
}

export function validateWords(civilian, undercover) {
    return civilian && undercover && civilian !== undercover;
}