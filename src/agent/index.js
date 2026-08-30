// Agent核心类
export class UndercoverAgent {
    constructor() {
        this.llm = null;
        this.gameState = null;
    }
    
    async generateWords(category) {
        // AI生成卧底词逻辑
        return { civilian: '鸡', undercover: '鸭' };
    }
}