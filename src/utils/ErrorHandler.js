// ========== 统一错误处理 ==========

(function(window) {
    'use strict';

    /**
     * 错误级别
     */
    var ErrorLevel = {
        INFO: 'info',
        WARNING: 'warning',
        ERROR: 'error',
        FATAL: 'fatal'
    };

    /**
     * 错误类型
     */
    var ErrorType = {
        NETWORK: 'network',
        WEBSOCKET: 'websocket',
        GAME: 'game',
        ROOM: 'room',
        VALIDATION: 'validation',
        AUTH: 'auth',
        STATE: 'state',
        UNKNOWN: 'unknown'
    };

    /**
     * 错误码映射
     */
    var ErrorCodeMap = {
        '房间不存在': { code: 'ROOM_NOT_FOUND', type: ErrorType.ROOM, level: ErrorLevel.WARNING },
        '房间已满': { code: 'ROOM_FULL', type: ErrorType.ROOM, level: ErrorLevel.WARNING },
        '游戏已开始': { code: 'GAME_ALREADY_STARTED', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '游戏进行中': { code: 'GAME_IN_PROGRESS', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '游戏已结束': { code: 'GAME_ENDED', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '只有房主可以': { code: 'NOT_HOST', type: ErrorType.ROOM, level: ErrorLevel.WARNING },
        '密码错误': { code: 'WRONG_PASSWORD', type: ErrorType.AUTH, level: ErrorLevel.WARNING },
        '你已在房间': { code: 'ALREADY_IN_ROOM', type: ErrorType.ROOM, level: ErrorLevel.WARNING },
        '你已被淘汰': { code: 'PLAYER_ELIMINATED', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '不能投自己': { code: 'VOTE_SELF', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '你已经投过票了': { code: 'ALREADY_VOTED', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        '你已经发言过了': { code: 'ALREADY_SPOKEN', type: ErrorType.GAME, level: ErrorLevel.WARNING },
        'WebSocket连接失败': { code: 'WS_CONNECT_FAIL', type: ErrorType.WEBSOCKET, level: ErrorLevel.ERROR },
        '网络连接失败': { code: 'NETWORK_FAIL', type: ErrorType.NETWORK, level: ErrorLevel.ERROR }
    };

    /**
     * 统一错误处理器
     */
    var ErrorHandler = {
        // 错误历史
        _history: [],
        _maxHistory: 50,
        _listeners: [],
        _lastToast: null,

        /**
         * 解析错误
         */
        _parseError: function(error) {
            var result = {
                level: ErrorLevel.ERROR,
                type: ErrorType.UNKNOWN,
                code: 'UNKNOWN',
                message: '未知错误'
            };

            if (typeof error === 'string') {
                result.message = error;
                // 查找匹配的错误码
                for (var key in ErrorCodeMap) {
                    if (error.indexOf(key) !== -1) {
                        var mapped = ErrorCodeMap[key];
                        result.code = mapped.code;
                        result.type = mapped.type;
                        result.level = mapped.level;
                        break;
                    }
                }
                return result;
            }

            if (typeof error === 'object' && error !== null) {
                result.message = error.message || '未知错误';
                result.code = error.code || 'UNKNOWN';
                result.type = error.type || ErrorType.UNKNOWN;
                result.level = error.level || ErrorLevel.ERROR;
                result.details = error.details || null;
                if (error.stack) {
                    result.stack = error.stack;
                }
                return result;
            }

            return result;
        },

        /**
         * 处理错误
         */
        handle: function(error, context) {
            context = context || {};

            // 解析错误
            var parsed = this._parseError(error);
            
            var errorObj = {
                id: Date.now() + '_' + String(Math.random()).substring(2, 6),
                timestamp: new Date().toISOString(),
                level: parsed.level,
                type: parsed.type,
                code: parsed.code,
                message: parsed.message,
                details: parsed.details || context,
                stack: parsed.stack || null,
                context: context
            };

            // 记录到历史
            this._history.push(errorObj);
            if (this._history.length > this._maxHistory) {
                this._history.shift();
            }

            // 控制台输出
            this._logToConsole(errorObj);

            // 通知监听器
            this._notifyListeners(errorObj);

            // 显示用户提示（非静默错误）
            if (!context.silent) {
                this._showUserToast(errorObj);
            }

            return errorObj;
        },

        /**
         * 处理WebSocket错误
         */
        handleWebSocketError: function(message, context) {
            return this.handle({
                level: ErrorLevel.WARNING,
                type: ErrorType.WEBSOCKET,
                code: 'WS_ERROR',
                message: message || 'WebSocket连接异常',
                details: context
            }, context);
        },

        /**
         * 处理网络错误
         */
        handleNetworkError: function(message, context) {
            return this.handle({
                level: ErrorLevel.ERROR,
                type: ErrorType.NETWORK,
                code: 'NETWORK_ERROR',
                message: message || '网络连接失败，请检查服务器是否运行',
                details: context
            }, context);
        },

        /**
         * 处理游戏错误
         */
        handleGameError: function(message, context) {
            return this.handle({
                level: ErrorLevel.WARNING,
                type: ErrorType.GAME,
                code: 'GAME_ERROR',
                message: message || '游戏操作失败',
                details: context
            }, context);
        },

        /**
         * 处理房间错误
         */
        handleRoomError: function(message, context) {
            return this.handle({
                level: ErrorLevel.WARNING,
                type: ErrorType.ROOM,
                code: 'ROOM_ERROR',
                message: message || '房间操作失败',
                details: context
            }, context);
        },

        /**
         * 处理验证错误
         */
        handleValidationError: function(message, context) {
            return this.handle({
                level: ErrorLevel.WARNING,
                type: ErrorType.VALIDATION,
                code: 'VALIDATION_ERROR',
                message: message || '输入验证失败',
                details: context
            }, context);
        },

        /**
         * 处理状态错误
         */
        handleStateError: function(message, context) {
            return this.handle({
                level: ErrorLevel.WARNING,
                type: ErrorType.STATE,
                code: 'STATE_ERROR',
                message: message || '状态异常，请刷新页面',
                details: context
            }, context);
        },

        /**
         * 控制台输出
         */
        _logToConsole: function(error) {
            var prefix = '✕';
            var color = 'color: #ff4444;';
            
            if (error.level === ErrorLevel.WARNING) {
                prefix = '[!]';
                color = 'color: #ffaa00;';
            } else if (error.level === ErrorLevel.INFO) {
                prefix = '[INFO]';
                color = 'color: #4488ff;';
            } else if (error.level === ErrorLevel.FATAL) {
                prefix = '[FATAL]';
                color = 'color: #ff0000; font-weight: bold;';
            }

            var msg = prefix + ' [' + error.type + '] ' + error.message;
            console.log('%c' + msg, color);
            
            if (error.details) {
                console.debug('  详情:', error.details);
            }
            if (error.stack) {
                console.debug('  堆栈:', error.stack);
            }
        },

        /**
         * 通知监听器
         */
        _notifyListeners: function(error) {
            for (var i = 0; i < this._listeners.length; i++) {
                try {
                    this._listeners[i](error);
                } catch (e) {
                    console.error('错误监听器执行失败:', e);
                }
            }
        },

        /**
         * 显示用户提示
         */
        _showUserToast: function(error) {
            var message = error.message;
            
            // 避免重复显示相同错误（2秒内）
            var lastToast = this._lastToast;
            if (lastToast && lastToast.message === message && 
                Date.now() - lastToast.time < 2000) {
                return;
            }

            this._lastToast = { message: message, time: Date.now() };

            // 使用alert作为fallback
            if (typeof window.showToast === 'function') {
                var type = 'warning';
                if (error.level === ErrorLevel.ERROR || error.level === ErrorLevel.FATAL) {
                    type = 'error';
                } else if (error.level === ErrorLevel.INFO) {
                    type = 'info';
                }
                window.showToast(message, type);
            } else {
                // 控制台警告
                console.warn('用户提示:', message);
            }
        },

        /**
         * 添加监听器
         */
        addListener: function(listener) {
            if (typeof listener === 'function') {
                this._listeners.push(listener);
            }
        },

        /**
         * 移除监听器
         */
        removeListener: function(listener) {
            var index = this._listeners.indexOf(listener);
            if (index !== -1) {
                this._listeners.splice(index, 1);
            }
        },

        /**
         * 获取错误历史
         */
        getHistory: function() {
            return this._history.slice();
        },

        /**
         * 清空错误历史
         */
        clearHistory: function() {
            this._history = [];
        },

        /**
         * 服务端错误响应处理
         */
        handleServerResponse: function(response, context) {
            if (!response) return null;

            // 如果响应包含错误
            if (response.code && response.code !== 0) {
                var level = response.code >= 500 ? ErrorLevel.ERROR : ErrorLevel.WARNING;
                return this.handle({
                    level: level,
                    type: ErrorType.GAME,
                    code: String(response.code),
                    message: response.message || '服务器返回错误',
                    details: response
                }, context);
            }

            // 如果响应包含status: error
            if (response.status === 'error') {
                return this.handle({
                    level: ErrorLevel.WARNING,
                    type: ErrorType.GAME,
                    code: response.code || 'SERVER_ERROR',
                    message: response.message || '操作失败',
                    details: response
                }, context);
            }

            return null;
        },

        /**
         * 捕获Promise错误
         */
        capturePromise: function(promise, context) {
            var self = this;
            return promise.catch(function(error) {
                return self.handle(error, context);
            });
        },

        /**
         * 包装异步函数
         */
        wrap: function(fn, context) {
            var self = this;
            return function() {
                try {
                    var result = fn.apply(this, arguments);
                    // 如果返回Promise，自动捕获
                    if (result && typeof result.catch === 'function') {
                        return result.catch(function(error) {
                            self.handle(error, context);
                            throw error;
                        });
                    }
                    return result;
                } catch (error) {
                    self.handle(error, context);
                    throw error;
                }
            };
        },

        /**
         * 静默处理（不显示用户提示）
         */
        silent: function(fn) {
            var self = this;
            return function() {
                try {
                    return fn.apply(this, arguments);
                } catch (error) {
                    self.handle(error, { silent: true });
                    throw error;
                }
            };
        }
    };

    // 导出
    window.ErrorHandler = ErrorHandler;
    window.ErrorLevel = ErrorLevel;
    window.ErrorType = ErrorType;

})(window);