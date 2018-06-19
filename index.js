import "fabric";
import {
    capitalize,
    uniqueId,
    debounce,
    isEqual,
    each,
    startCase,
    set,
    get
} from "lodash";

const imageCache = {};
const fabric = window.fabric;
export const animate = fabric.util.animate;
export const animateColor = fabric.util.animateColor;
const eventHash = {
    onClick: true,
    onDblClick: true
};
const eventNames = {};
const altEventNames = {
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
`
object:modified
object:moving
object:scaling
object:rotating
object:skewing
object:moved
object:scaled
object:rotated
object:skewed
before:transform
before:selection:cleared
selection:cleared
selection:created
selection:updated
mouse:up
mouse:down
mouse:move
mouse:up:before
mouse:down:before
mouse:move:before
mouse:dblclick
mouse:wheel
mouse:over
mouse:out
drop
dragover
dragenter
dragleave`
    .split(/\s+/)
    .forEach(x => {
        eventNames[x] = "on" + normalizeName(x.replace(/:/g, "-"));
        eventHash[eventNames[x]] = true;
    });

function normalizeName(name) {
    return startCase(name).replace(/\s+/g, "");
}

function shouldCreate(child, key, type, props) {
    return !child || child.__type !== type || child.__key !== key;
}

function shouldUpdate(child, key, type, props) {
    let hasChange = false;
    each(props, (v, k) => {
        if (!isEqual(v, child.__props[k])) {
            hasChange = true;
            return false;
        }
    });

    return hasChange;
}

function updateObject(obj, props) {
    each(props, (v, k) => {
        const setter = "set" + capitalize(k);
        if (setter in obj) {
            obj[setter](v);
        } else {
            obj[k] = v;
        }
    });
}

function render(comp, parent, app, getView) {
    const state = app();

    const list = [];

    function collect(comp, blockProps) {
        if (comp instanceof Function) {
            comp = comp(state);
        }

        if (!comp) return;

        if (comp instanceof Array) {
            comp.forEach(x => collect(x, blockProps));
            return;
        }

        if (comp.type instanceof Function) {
            collect(comp.type(comp.props, ...(comp.children || [])));
            return;
        }

        if (comp.type === "block") {
            collect(comp.children, comp.props);
            return;
        }

        const { type, props, children } = comp;

        list.push({
            type,
            props: {
                ...blockProps,
                ...props
            },
            children
        });
    }

    collect(comp);

    const canvas = parent.canvas || parent;

    const allObjects = parent.getObjects();

    allObjects.forEach(x => (x.__shouldRemove = true));

    list.forEach((comp, index) => {
        let { type, props: { key, ref, ...props } = {} } = comp;

        const selectable =
            props.selectable === false ? false : props.selectable || canvas.selection;
        props = Object.assign(
            {
                selectable: !!selectable,
                controls: !!selectable,
                hoverCursor: selectable ? "move" : "default"
            },
            props
        );

        const typeName = normalizeName(type);

        const constr = fabric[typeName];
        if (!constr) {
            throw new Error(`Element type ${typeName} is not supported`);
        }

        let obj, hasKey;

        if (key !== null && key !== undefined) {
            hasKey = true;
            obj = parent.getObjects().find(x => x.__key === key);
        } else {
            obj = parent.item(index);
        }

        const objEvents = {};
        const objProps = {};
        let calcCoords = false;

        each(props, (v, k) => {
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
            const newObj = Object.assign(
                new constr(
                    type === "group"
                        ? []
                        : type === "text"
                        ? objProps.text
                        : type === "image" ? objProps.src : objProps
                ),
                {
                    __key: key,
                    __props: props,
                    __type: type
                }
            );

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

    const objectsToRemove = allObjects.filter(x => x.__shouldRemove);
    if (objectsToRemove.length) {
        parent.remove(...objectsToRemove);
    }
}

export function component(stateToProps, view) {
    if (arguments.length === 1) {
        view = stateToProps;
        stateToProps = (state, props) => props;
    }
    let lastProps, lastResult;

    const componentType = function(props) {
        return function(state) {
            const newProps = stateToProps(state, props);
            if (isEqual(newProps, lastProps)) {
                return lastResult;
            }
            lastProps = newProps;
            return (lastResult = view(newProps));
        };
    };

    componentType.__id = uniqueId("c_");

    return componentType;
}

/**
 * create vdom
 */
export function element(type, props, ...children) {
    return {
        type,
        props: props || {},
        children
    };
}

/**
 * create app
 */
export function createApp(view, canvas, initialState) {
    const animations = {};
    const app = function(arg = true, value) {
        // app() => get app state
        if (!arguments.length) return state;

        // app(subscriber) => subscribe app state change
        if (arg instanceof Function) {
            subscribers.push(arg);
            let unsubcribed = false;
            return function() {
                if (unsubcribed) return;
                unsubcribed = true;
                subscribers = subscribers.filter(x => x !== arg);
            };
        }

        // app(state)
        if (!arg) {
            return;
        }

        if (typeof arg === "string") {
            state = { ...state };
            set(state, arg, value);
            state = Object.freeze(state);
        } else {
            state = Object.freeze({
                ...state,
                ...arg
            });
        }

        subscribers.forEach(x => x(state));
    };

    app.debounce = debounce((...args) => app(...args), 10);

    let allCanvas;
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
        each(canvas, (v, k) => {
            allCanvas[k] = typeof v === "string" ? document.getElementById(v) : v;
        });
    }

    each(allCanvas, (canvas, configName) => {
        const configs = configName
            ? initialState.configs[configName]
            : initialState.configs;
        const fabricCanvas = new fabric.Canvas(canvas, configs);
        allCanvas[configName] = fabricCanvas;
        fabricCanvas.__configs = configs;
        fabricCanvas.debounceRenderAll = debounce(
            () => fabricCanvas.renderAll(),
            0
        );
    });

    let state = Object.freeze({
            $state: app,
            $anim(
                name,
                { change, complete, duration, easing, ...options } = {},
                stop
            ) {
                if (arguments.length === 1)
                    return animations[name] || { running: false };
                if (!("from" in options)) {
                    options.from = get(app(), name);
                }

                const token = (animations[name] = {
                    from: options.from,
                    to: options.to,
                    running: false
                });

                if (stop) {
                    return;
                }

                animate({
                    startValue: options.from,
                    endValue: options.to,
                    byValue: options.by,
                    duration,
                    easing,
                    onChange(currentValue) {
                        token.running = true;
                        if (animations[name] !== token) return;
                        app.debounce(name, currentValue);
                        if (change) {
                            change(currentValue);
                        }
                    },
                    onComplete() {
                        token.complete = true;
                        token.running = false;
                        if (complete) {
                            complete();
                        }
                    }
                });
            },
            $animColor(
                name,
                { change, complete, duration, easing, ...options } = {},
                stop
            ) {
                if (!("from" in options)) {
                    options.from = get(app(), name);
                }
                const token = (animations[name] = {
                    from: options.from,
                    to: options.to,
                    running: false
                });

                if (stop) {
                    return;
                }

                animateColor(options.from, options.to, duration, {
                    colorEasing: easing,
                    onChange(currentValue) {
                        token.running = true;
                        if (animations[name] !== token) return;
                        app.debounce(name, currentValue);
                        if (change) {
                            change(currentValue);
                        }
                    },
                    onComplete() {
                        token.complete = true;
                        token.running = false;
                        if (complete) {
                            complete();
                        }
                    }
                });
            },
            $load: {
                image: function loadImage(
                    src,
                    left = 0,
                    top = 0,
                    width = 0,
                    height = 0
                ) {
                    const cacheKey = `${src}-${left}-${top}-${width}-${height}`;
                    if (cacheKey in imageCache) {
                        return imageCache[cacheKey];
                    }

                    function load(src) {
                        return new Promise(resolve => {
                            fabric.Image.fromURL(
                                src,
                                i => {
                                    Object.assign(imageCache[cacheKey], {
                                        payload: i._element,
                                        success: true
                                    });

                                    resolve(i);

                                    app({});
                                },
                                {
                                    crossOrigin: "anonymous"
                                }
                            );
                        });
                    }

                    if (width && height) {
                        return (imageCache[cacheKey] = loadImage(src).then(image => {
                            const canvas = document.createElement("CANVAS");
                            const ctx = canvas.getContext("2d");
                            // cannot load
                            if (!image._element) return;
                            const availWidth = Math.min(width, image.width - left);
                            const availHeight = Math.min(height, image.height - top);
                            ctx.drawImage(
                                image._element,
                                left,
                                top,
                                availWidth,
                                availHeight,
                                0,
                                0,
                                availWidth,
                                availHeight
                            );

                            return load(canvas.toDataURL("image/png"));
                        }));
                    }

                    return (imageCache[cacheKey] = load(src));
                }
            },
            ...initialState
        }),
        subscribers = [
            newState => {
                each(allCanvas, (fabricCanvas, configName) => {
                    const currentConfigs = configName
                        ? newState.configs[configName]
                        : newState.configs;

                    if (!isEqual(currentConfigs, fabricCanvas.__configs)) {
                        updateObject((fabricCanvas.__configs = currentConfigs));
                        fabricCanvas.calcOffset();
                    }

                    const objects = fabricCanvas.getObjects();
                    const activeObjects = fabricCanvas.getActiveObjects();
                    let discardActiveObjects;
                    objects.forEach(x => (x.__shouldRemove = true));
                    render(configName ? view[configName] : view, fabricCanvas, app);
                    const objectsToRemove = objects.filter(x => {
                        if (x.__shouldRemove) {
                            if (activeObjects.indexOf(x) !== -1) {
                                discardActiveObjects = true;
                            }
                            return true;
                        }
                        return false;
                    });
                    if (objectsToRemove.length) {
                        fabricCanvas.remove(...objectsToRemove);
                    }
                    if (discardActiveObjects) {
                        fabricCanvas.discardActiveObjects();
                    }
                    fabricCanvas.debounceRenderAll();
                });
            }
        ];

    // observe events
    each(eventNames, (v, k) => {
        each(allCanvas, fabricCanvas => {
            fabricCanvas.on(k, e => {
                if (e.target) {
                    if (e.target[v]) {
                        e.target[v](e);
                    } else {
                        const altEventName = altEventNames[v];
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