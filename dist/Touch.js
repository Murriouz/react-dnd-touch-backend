/**
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.TouchBackend = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = createTouchBackend;

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function getEventClientTouchOffset(e) {
    if (e.targetTouches.length === 1) {
        return getEventClientOffset(e.targetTouches[0]);
    }
}

function getEventClientOffset(e) {
    if (e.targetTouches) {
        return getEventClientTouchOffset(e);
    } else {
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
}

var ELEMENT_NODE = 1;
function getNodeClientOffset(node) {
    var el = node.nodeType === ELEMENT_NODE ? node : node.parentElement;

    if (!el) {
        return null;
    }

    var _el$getBoundingClient = el.getBoundingClientRect();

    var top = _el$getBoundingClient.top;
    var left = _el$getBoundingClient.left;

    return { x: left, y: top };
}

var eventNames = {
    mouse: {
        start: 'mousedown',
        move: 'mousemove',
        end: 'mouseup'
    },
    touch: {
        start: 'touchstart',
        move: 'touchmove',
        end: 'touchend'
    }
};

var TouchBackend = exports.TouchBackend = function () {
    function TouchBackend(manager) {
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        _classCallCheck(this, TouchBackend);

        options.delayTouchStart = options.delayTouchStart || options.delay;

        options = _extends({
            enableTouchEvents: true,
            enableMouseEvents: false,
            delayTouchStart: 0,
            delayMouseStart: 0
        }, options);

        this.actions = manager.getActions();
        this.monitor = manager.getMonitor();
        this.registry = manager.getRegistry();

        this.delayTouchStart = options.delayTouchStart;
        this.delayMouseStart = options.delayMouseStart;
        this.sourceNodes = {};
        this.sourceNodeOptions = {};
        this.sourcePreviewNodes = {};
        this.sourcePreviewNodeOptions = {};
        this.targetNodeOptions = {};
        this.listenerTypes = [];
        this._mouseClientOffset = {};

        if (options.enableMouseEvents) {
            this.listenerTypes.push('mouse');
        }

        if (options.enableTouchEvents) {
            this.listenerTypes.push('touch');
        }

        this.getSourceClientOffset = this.getSourceClientOffset.bind(this);
        this.handleTopMoveStart = this.handleTopMoveStart.bind(this);
        this.handleTopMoveStartDelay = this.handleTopMoveStartDelay.bind(this);
        this.handleTopMoveStartCapture = this.handleTopMoveStartCapture.bind(this);
        this.handleTopMoveCapture = this.handleTopMoveCapture.bind(this);
        this.handleTopMove = this.handleTopMove.bind(this);
        this.handleTopMoveEndCapture = this.handleTopMoveEndCapture.bind(this);
    }

    _createClass(TouchBackend, [{
        key: 'setup',
        value: function setup() {
            if (typeof window === 'undefined') {
                return;
            }

            (0, _invariant2.default)(!this.constructor.isSetUp, 'Cannot have two Touch backends at the same time.');
            this.constructor.isSetUp = true;

            this.addEventListener(window, 'start', this.getTopMoveStartHandler());
            this.addEventListener(window, 'start', this.handleTopMoveStartCapture, true);
            this.addEventListener(window, 'move', this.handleTopMove);
            this.addEventListener(window, 'move', this.handleTopMoveCapture, true);
            this.addEventListener(window, 'end', this.handleTopMoveEndCapture, true);
        }
    }, {
        key: 'teardown',
        value: function teardown() {
            if (typeof window === 'undefined') {
                return;
            }

            this.constructor.isSetUp = false;
            this._mouseClientOffset = {};

            this.removeEventListener(window, 'start', this.handleTopMoveStartCapture, true);
            this.removeEventListener(window, 'start', this.handleTopMoveStart);
            this.removeEventListener(window, 'move', this.handleTopMoveCapture, true);
            this.removeEventListener(window, 'move', this.handleTopMove);
            this.removeEventListener(window, 'end', this.handleTopMoveEndCapture, true);

            this.uninstallSourceNodeRemovalObserver();
        }
    }, {
        key: 'addEventListener',
        value: function addEventListener(subject, event, handler, capture) {
            this.listenerTypes.forEach(function (listenerType) {
                subject.addEventListener(eventNames[listenerType][event], handler, capture);
            });
        }
    }, {
        key: 'removeEventListener',
        value: function removeEventListener(subject, event, handler, capture) {
            this.listenerTypes.forEach(function (listenerType) {
                subject.removeEventListener(eventNames[listenerType][event], handler, capture);
            });
        }
    }, {
        key: 'connectDragSource',
        value: function connectDragSource(sourceId, node, options) {
            var _this = this;

            var handleMoveStart = this.handleMoveStart.bind(this, sourceId);
            this.sourceNodes[sourceId] = node;

            this.addEventListener(node, 'start', handleMoveStart);

            return function () {
                delete _this.sourceNodes[sourceId];
                _this.removeEventListener(node, 'start', handleMoveStart);
            };
        }
    }, {
        key: 'connectDragPreview',
        value: function connectDragPreview(sourceId, node, options) {
            var _this2 = this;

            this.sourcePreviewNodeOptions[sourceId] = options;
            this.sourcePreviewNodes[sourceId] = node;

            return function () {
                delete _this2.sourcePreviewNodes[sourceId];
                delete _this2.sourcePreviewNodeOptions[sourceId];
            };
        }
    }, {
        key: 'connectDropTarget',
        value: function connectDropTarget(targetId, node) {
            var _this3 = this;

            var handleMove = function handleMove(e) {
                var coords = void 0;

                /**
                 * Grab the coordinates for the current mouse/touch position
                 */
                switch (e.type) {
                    case eventNames.mouse.move:
                        coords = { x: e.clientX, y: e.clientY };
                        break;

                    case eventNames.touch.move:
                        coords = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                        break;
                }

                /**
                 * Use the coordinates to grab the element the drag ended on.
                 * If the element is the same as the target node (or any of it's children) then we have hit a drop target and can handle the move.
                 */
                var droppedOn = document.elementFromPoint(coords.x, coords.y);
                var childMatch = node.contains(droppedOn);

                if (droppedOn === node || childMatch) {
                    return _this3.handleMove(e, targetId);
                }
            };

            /**
             * Attaching the event listener to the body so that touchmove will work while dragging over multiple target elements.
             */
            this.addEventListener(document.querySelector('body'), 'move', handleMove);

            return function () {
                _this3.removeEventListener(document.querySelector('body'), 'move', handleMove);
            };
        }
    }, {
        key: 'getSourceClientOffset',
        value: function getSourceClientOffset(sourceId) {
            return getNodeClientOffset(this.sourceNodes[sourceId]);
        }
    }, {
        key: 'handleTopMoveStartCapture',
        value: function handleTopMoveStartCapture(e) {
            this.moveStartSourceIds = [];
        }
    }, {
        key: 'handleMoveStart',
        value: function handleMoveStart(sourceId) {
            this.moveStartSourceIds.unshift(sourceId);
        }
    }, {
        key: 'getTopMoveStartHandler',
        value: function getTopMoveStartHandler() {
            if (!this.delayTouchStart && !this.delayMouseStart) {
                return this.handleTopMoveStart;
            }

            return this.handleTopMoveStartDelay;
        }
    }, {
        key: 'handleTopMoveStart',
        value: function handleTopMoveStart(e) {
            // Don't prematurely preventDefault() here since it might:
            // 1. Mess up scrolling
            // 2. Mess up long tap (which brings up context menu)
            // 3. If there's an anchor link as a child, tap won't be triggered on link

            var clientOffset = getEventClientOffset(e);
            if (clientOffset) {
                this._mouseClientOffset = clientOffset;
            }
        }
    }, {
        key: 'handleTopMoveStartDelay',
        value: function handleTopMoveStartDelay(e) {
            var delay = e.type === eventNames.touch.start ? this.delayTouchStart : this.delayMouseStart;
            this.timeout = setTimeout(this.handleTopMoveStart.bind(this, e), delay);
        }
    }, {
        key: 'handleTopMoveCapture',
        value: function handleTopMoveCapture(e) {
            this.dragOverTargetIds = [];
        }
    }, {
        key: 'handleMove',
        value: function handleMove(e, targetId) {
            this.dragOverTargetIds.unshift(targetId);
        }
    }, {
        key: 'handleTopMove',
        value: function handleTopMove(e) {
            clearTimeout(this.timeout);

            var moveStartSourceIds = this.moveStartSourceIds;
            var dragOverTargetIds = this.dragOverTargetIds;

            var clientOffset = getEventClientOffset(e);

            if (!clientOffset) {
                return;
            }

            // If we're not dragging and we've moved a little, that counts as a drag start
            if (!this.monitor.isDragging() && this._mouseClientOffset.hasOwnProperty('x') && moveStartSourceIds && (this._mouseClientOffset.x !== clientOffset.x || this._mouseClientOffset.y !== clientOffset.y)) {
                this.moveStartSourceIds = null;
                this.actions.beginDrag(moveStartSourceIds, {
                    clientOffset: this._mouseClientOffset,
                    getSourceClientOffset: this.getSourceClientOffset,
                    publishSource: false
                });
            }

            if (!this.monitor.isDragging()) {
                return;
            }

            var sourceNode = this.sourceNodes[this.monitor.getSourceId()];
            this.installSourceNodeRemovalObserver(sourceNode);
            this.actions.publishDragSource();

            e.preventDefault();

            /*const matchingTargetIds = Object.keys(this.targetNodes)
                .filter((targetId) => {
                    const boundingRect = this.targetNodes[targetId].getBoundingClientRect();
                    return clientOffset.x >= boundingRect.left &&
                    clientOffset.x <= boundingRect.right &&
                    clientOffset.y >= boundingRect.top &&
                    clientOffset.y <= boundingRect.bottom;
                });
            */

            this.actions.hover(dragOverTargetIds, {
                clientOffset: clientOffset
            });
        }
    }, {
        key: 'handleTopMoveEndCapture',
        value: function handleTopMoveEndCapture(e) {
            if (!this.monitor.isDragging() || this.monitor.didDrop()) {
                this.moveStartSourceIds = null;
                return;
            }

            e.preventDefault();

            this._mouseClientOffset = {};

            this.uninstallSourceNodeRemovalObserver();
            this.actions.drop();
            this.actions.endDrag();
        }
    }, {
        key: 'installSourceNodeRemovalObserver',
        value: function installSourceNodeRemovalObserver(node) {
            var _this4 = this;

            this.uninstallSourceNodeRemovalObserver();

            this.draggedSourceNode = node;
            this.draggedSourceNodeRemovalObserver = new window.MutationObserver(function () {
                if (!node.parentElement) {
                    _this4.resurrectSourceNode();
                    _this4.uninstallSourceNodeRemovalObserver();
                }
            });

            if (!node || !node.parentElement) {
                return;
            }

            this.draggedSourceNodeRemovalObserver.observe(node.parentElement, { childList: true });
        }
    }, {
        key: 'resurrectSourceNode',
        value: function resurrectSourceNode() {
            this.draggedSourceNode.style.display = 'none';
            this.draggedSourceNode.removeAttribute('data-reactid');
            document.body.appendChild(this.draggedSourceNode);
        }
    }, {
        key: 'uninstallSourceNodeRemovalObserver',
        value: function uninstallSourceNodeRemovalObserver() {
            if (this.draggedSourceNodeRemovalObserver) {
                this.draggedSourceNodeRemovalObserver.disconnect();
            }

            this.draggedSourceNodeRemovalObserver = null;
            this.draggedSourceNode = null;
        }
    }]);

    return TouchBackend;
}();

function createTouchBackend() {
    var optionsOrManager = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var touchBackendFactory = function touchBackendFactory(manager) {
        return new TouchBackend(manager, optionsOrManager);
    };

    if (optionsOrManager.getMonitor) {
        return touchBackendFactory(optionsOrManager);
    } else {
        return touchBackendFactory;
    }
}