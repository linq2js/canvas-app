"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.animateColor = exports.animate = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.component = component;
exports.element = element;
exports.createApp = createApp;

require("fabric");

var _lodash = require("lodash");

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var imageCache = {};
var fabric = window.fabric;
var animate = exports.animate = fabric.util.animate;
var animateColor = exports.animateColor = fabric.util.animateColor;
var eventHash = {
    onClick: true,
    onDblClick: true
};
var eventNames = {};
var altEventNames = {
    onObjectMoved: "onMoved",
    onObjectMoving: "onMoving",
    onObjectScaling: "onScaling",
    onObjectRotating: "onRotating",
    onObjectSkewing: "onSkewing",
    onObjectScaled: "onScaled",
    onObjectRotated: "onRotated",
    onObjectSkewed: "onSkewed",
    onMouseUp: "onClick",
    onMouseDblclick: "onDblClick"
};
"\nobject:modified\nobject:moving\nobject:scaling\nobject:rotating\nobject:skewing\nobject:moved\nobject:scaled\nobject:rotated\nobject:skewed\nbefore:transform\nbefore:selection:cleared\nselection:cleared\nselection:created\nselection:updated\nmouse:up\nmouse:down\nmouse:move\nmouse:up:before\nmouse:down:before\nmouse:move:before\nmouse:dblclick\nmouse:wheel\nmouse:over\nmouse:out\ndrop\ndragover\ndragenter\ndragleave".split(/\s+/).forEach(function (x) {
    eventNames[x] = "on" + normalizeName(x.replace(/:/g, "-"));
    eventHash[eventNames[x]] = true;
});

function normalizeName(name) {
    return (0, _lodash.startCase)(name).replace(/\s+/g, "");
}

function shouldCreate(child, key, type, props) {
    return !child || child.__type !== type || child.__key !== key;
}

function shouldUpdate(child, key, type, props) {
    var hasChange = false;
    (0, _lodash.each)(props, function (v, k) {
        if (!(0, _lodash.isEqual)(v, child.__props[k])) {
            hasChange = true;
            return false;
        }
    });

    return hasChange;
}

function updateObject(obj, props) {
    (0, _lodash.each)(props, function (v, k) {
        var setter = "set" + (0, _lodash.capitalize)(k);
        if (setter in obj) {
            obj[setter](v);
        } else {
            obj[k] = v;
        }
    });
}

function render(comp, parent, app, getView) {
    var state = app();

    var list = [];

    function collect(comp, blockProps) {
        if (comp instanceof Function) {
            comp = comp(state);
        }

        if (!comp) return;

        if (comp instanceof Array) {
            comp.forEach(function (x) {
                return collect(x, blockProps);
            });
            return;
        }

        if (comp.type instanceof Function) {
            var _comp;

            collect((_comp = comp).type.apply(_comp, [comp.props].concat(_toConsumableArray(comp.children || []))));
            return;
        }

        if (comp.type === "block") {
            collect(comp.children, comp.props);
            return;
        }

        var _comp2 = comp,
            type = _comp2.type,
            props = _comp2.props,
            children = _comp2.children;


        list.push({
            type: type,
            props: _extends({}, blockProps, props),
            children: children
        });
    }

    collect(comp);

    var canvas = parent.canvas || parent;

    var allObjects = parent.getObjects();

    allObjects.forEach(function (x) {
        return x.__shouldRemove = true;
    });

    list.forEach(function (comp, index) {
        var type = comp.type,
            _comp$props = comp.props;
        _comp$props = _comp$props === undefined ? {} : _comp$props;

        var key = _comp$props.key,
            ref = _comp$props.ref,
            props = _objectWithoutProperties(_comp$props, ["key", "ref"]);

        var selectable = props.selectable === false ? false : props.selectable || canvas.selection;
        props = Object.assign({
            selectable: !!selectable,
            controls: !!selectable,
            hoverCursor: selectable ? "move" : "default"
        }, props);

        var typeName = normalizeName(type);

        var constr = fabric[typeName];
        if (!constr) {
            throw new Error("Element type " + typeName + " is not supported");
        }

        var obj = void 0,
            hasKey = void 0;

        if (key !== null && key !== undefined) {
            hasKey = true;
            obj = parent.getObjects().find(function (x) {
                return x.__key === key;
            });
        } else {
            obj = parent.item(index);
        }

        var objEvents = {};
        var objProps = {};
        var calcCoords = false;

        (0, _lodash.each)(props, function (v, k) {
            if (k in eventHash) {
                objEvents[k] = v;
            } else {
                if (k === "left" || k === "top" || k === "width" || k === "height") {
                    calcCoords = true;
                }

                objProps[k] = v;
            }
        });

        function update() {
            if (obj.set) {
                obj.set(objProps);
            } else {
                Object.assign(obj, objProps);
            }
            Object.assign(obj, objEvents);
        }

        if (!hasKey) {
            key = index;
        }

        if (shouldCreate(obj, key, type, props)) {
            var newObj = Object.assign(new constr(type === "group" ? [] : type === "text" ? objProps.text : type === "image" ? objProps.src : objProps), {
                __key: key,
                __props: props,
                __type: type
            });

            parent.insertAt(newObj, index);

            if (parent.__type === "group") {
                parent.__childAdded = true;
            }

            if (obj) {
                parent.remove(obj);
            }

            obj = newObj;

            update();

            calcCoords = true;
        } else if (shouldUpdate(obj, key, type, props)) {
            update();
        }

        delete obj.__shouldRemove;

        if (calcCoords) {
            obj.setCoords();
        }

        if (ref) {
            ref(obj);
        }
    });

    var objectsToRemove = allObjects.filter(function (x) {
        return x.__shouldRemove;
    });
    if (objectsToRemove.length) {
        parent.remove.apply(parent, _toConsumableArray(objectsToRemove));
    }
}

function component(stateToProps, view) {
    if (arguments.length === 1) {
        view = stateToProps;
        stateToProps = function stateToProps(state, props) {
            return props;
        };
    }
    var lastProps = void 0,
        lastResult = void 0;

    var componentType = function componentType(props) {
        return function (state) {
            var newProps = stateToProps(state, props);
            if ((0, _lodash.isEqual)(newProps, lastProps)) {
                return lastResult;
            }
            lastProps = newProps;
            return lastResult = view(newProps);
        };
    };

    componentType.__id = (0, _lodash.uniqueId)("c_");

    return componentType;
}

/**
 * create vdom
 */
function element(type, props) {
    for (var _len = arguments.length, children = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        children[_key - 2] = arguments[_key];
    }

    return {
        type: type,
        props: props || {},
        children: children
    };
}

/**
 * create app
 */
function createApp(view, canvas, initialState) {
    var animations = {};
    var app = function app() {
        var arg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
        var value = arguments[1];

        // app() => get app state
        if (!arguments.length) return state;

        // app(subscriber) => subscribe app state change
        if (arg instanceof Function) {
            subscribers.push(arg);
            var unsubcribed = false;
            return function () {
                if (unsubcribed) return;
                unsubcribed = true;
                subscribers = subscribers.filter(function (x) {
                    return x !== arg;
                });
            };
        }

        // app(state)
        if (!arg) {
            return;
        }

        if (typeof arg === "string") {
            state = _extends({}, state);
            (0, _lodash.set)(state, arg, value);
            state = Object.freeze(state);
        } else {
            state = Object.freeze(_extends({}, state, arg));
        }

        subscribers.forEach(function (x) {
            return x(state);
        });
    };

    app.debounce = (0, _lodash.debounce)(function () {
        return app.apply(undefined, arguments);
    }, 10);

    var allCanvas = void 0;
    if (typeof canvas === "string") {
        allCanvas = {
            "": document.getElementById(canvas)
        };
    } else if (canvas.toDataURL) {
        allCanvas = {
            "": canvas
        };
    } else {
        allCanvas = {};
        (0, _lodash.each)(canvas, function (v, k) {
            allCanvas[k] = typeof v === "string" ? document.getElementById(v) : v;
        });
    }

    (0, _lodash.each)(allCanvas, function (canvas, configName) {
        var configs = configName ? initialState.configs[configName] : initialState.configs;
        var fabricCanvas = new fabric.Canvas(canvas, configs);
        allCanvas[configName] = fabricCanvas;
        fabricCanvas.__configs = configs;
        fabricCanvas.debounceRenderAll = (0, _lodash.debounce)(function () {
            return fabricCanvas.renderAll();
        }, 0);
    });

    var state = Object.freeze(_extends({
        $state: app,
        $anim: function $anim(name) {
            var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
                change = _ref.change,
                complete = _ref.complete,
                duration = _ref.duration,
                easing = _ref.easing,
                options = _objectWithoutProperties(_ref, ["change", "complete", "duration", "easing"]);

            var stop = arguments[2];

            if (arguments.length === 1) return animations[name] || { running: false };
            if (!("from" in options)) {
                options.from = (0, _lodash.get)(app(), name);
            }

            var token = animations[name] = {
                from: options.from,
                to: options.to,
                running: false
            };

            if (stop) {
                return;
            }

            animate({
                startValue: options.from,
                endValue: options.to,
                byValue: options.by,
                duration: duration,
                easing: easing,
                onChange: function onChange(currentValue) {
                    token.running = true;
                    if (animations[name] !== token) return;
                    app.debounce(name, currentValue);
                    if (change) {
                        change(currentValue);
                    }
                },
                onComplete: function onComplete() {
                    token.complete = true;
                    token.running = false;
                    if (complete) {
                        complete();
                    }
                }
            });
        },
        $animColor: function $animColor(name) {
            var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
                change = _ref2.change,
                complete = _ref2.complete,
                duration = _ref2.duration,
                easing = _ref2.easing,
                options = _objectWithoutProperties(_ref2, ["change", "complete", "duration", "easing"]);

            var stop = arguments[2];

            if (!("from" in options)) {
                options.from = (0, _lodash.get)(app(), name);
            }
            var token = animations[name] = {
                from: options.from,
                to: options.to,
                running: false
            };

            if (stop) {
                return;
            }

            animateColor(options.from, options.to, duration, {
                colorEasing: easing,
                onChange: function onChange(currentValue) {
                    token.running = true;
                    if (animations[name] !== token) return;
                    app.debounce(name, currentValue);
                    if (change) {
                        change(currentValue);
                    }
                },
                onComplete: function onComplete() {
                    token.complete = true;
                    token.running = false;
                    if (complete) {
                        complete();
                    }
                }
            });
        },

        $load: {
            image: function loadImage(src) {
                var left = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
                var top = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
                var width = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
                var height = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

                var cacheKey = src + "-" + left + "-" + top + "-" + width + "-" + height;
                if (cacheKey in imageCache) {
                    return imageCache[cacheKey];
                }

                function load(src) {
                    return new Promise(function (resolve) {
                        fabric.Image.fromURL(src, function (i) {
                            Object.assign(imageCache[cacheKey], {
                                payload: i._element,
                                success: true
                            });

                            resolve(i);

                            app({});
                        }, {
                            crossOrigin: "anonymous"
                        });
                    });
                }

                if (width && height) {
                    return imageCache[cacheKey] = loadImage(src).then(function (image) {
                        var canvas = document.createElement("CANVAS");
                        var ctx = canvas.getContext("2d");
                        // cannot load
                        if (!image._element) return;
                        var availWidth = Math.min(width, image.width - left);
                        var availHeight = Math.min(height, image.height - top);
                        ctx.drawImage(image._element, left, top, availWidth, availHeight, 0, 0, availWidth, availHeight);

                        return load(canvas.toDataURL("image/png"));
                    });
                }

                return imageCache[cacheKey] = load(src);
            }
        }
    }, initialState)),
        subscribers = [function (newState) {
        (0, _lodash.each)(allCanvas, function (fabricCanvas, configName) {
            var currentConfigs = configName ? newState.configs[configName] : newState.configs;

            if (!(0, _lodash.isEqual)(currentConfigs, fabricCanvas.__configs)) {
                updateObject(fabricCanvas.__configs = currentConfigs);
                fabricCanvas.calcOffset();
            }

            var objects = fabricCanvas.getObjects();
            var activeObjects = fabricCanvas.getActiveObjects();
            var discardActiveObjects = void 0;
            objects.forEach(function (x) {
                return x.__shouldRemove = true;
            });
            render(configName ? view[configName] : view, fabricCanvas, app);
            var objectsToRemove = objects.filter(function (x) {
                if (x.__shouldRemove) {
                    if (activeObjects.indexOf(x) !== -1) {
                        discardActiveObjects = true;
                    }
                    return true;
                }
                return false;
            });
            if (objectsToRemove.length) {
                fabricCanvas.remove.apply(fabricCanvas, _toConsumableArray(objectsToRemove));
            }
            if (discardActiveObjects) {
                fabricCanvas.discardActiveObjects();
            }
            fabricCanvas.debounceRenderAll();
        });
    }];

    // observe events
    (0, _lodash.each)(eventNames, function (v, k) {
        (0, _lodash.each)(allCanvas, function (fabricCanvas) {
            fabricCanvas.on(k, function (e) {
                if (e.target) {
                    if (e.target[v]) {
                        e.target[v](e);
                    } else {
                        var altEventName = altEventNames[v];
                        if (altEventName && e.target[altEventName]) {
                            e.target[altEventName](e);
                        }
                    }
                }
            });
        });
    });

    app(true);

    return app;
}
//# sourceMappingURL=index.js.map