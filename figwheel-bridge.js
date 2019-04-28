var React = require('react');
var ReactNative = require('react-native');
var createReactClass = require('create-react-class');
var URI = require("uri-js");
var cljsBootstrap = require("./clojurescript-bootstrap.js");
var expo = require('expo');

function cljsNamespaceToObject(ns) {
    return ns.replace(/\-/, "_").split(/\./).reduce(function (base, arg) {
	return (base ? base[arg] : base)
    }, goog.global);
}

function listenForReload(cb) {
    if(cljsNamespaceToObject("figwheel.core.event_target")) {
	figwheel.core.event_target.addEventListener("figwheel.after-load", cb);
    }
}

var figwheelApp = function (config) {
    return createReactClass({
        getInitialState: function () {
            return {loaded: false}
        },
	
        render: function () {
            if (!this.state.loaded) {
                var plainStyle = {flex: 1, alignItems: 'center', justifyContent: 'center'};
                return (
                    <ReactNative.View style={plainStyle}>
                        <ReactNative.Text>Waiting for Figwheel to load files.</ReactNative.Text>
                    </ReactNative.View>
                );
            }
            return this.state.root();
        },

        componentDidMount: function () {
            var app = this;
	    var refresh = function(e) {
		console.log("Refreshing Figwheel Root Element");
		app.forceUpdate();
	    }
            if (typeof goog === "undefined") {
                loadApp(config, function (appRoot) {
		    goog.figwheelBridgeRefresh = refresh;
                    app.setState({root: appRoot, loaded: true});
		    if (config.autoRefresh) {
			listenForReload(refresh);
		    }
                });
            }
        }
    })
};

function isChrome() {
    return typeof importScripts === "function"
}

// this is an odd bit to support the chrome debugger which is almost always
// local to the server
// this is a double usage of the url, probably better to explicit in the config
// to allow this behavior to be overriden
function correctUrl(url) {
    var u = URI.parse(url);
    if(isChrome()) {
	u.host = "localhost";
    }
    return URI.serialize(u);
}

function assert(predVal, message) {
    if(!predVal) {
	throw new Error(message);
    }
}

function loadApp(config, onLoadCb) {
    var confProm;
    if(config.optionsUrl) {
	confProm = cljsBootstrap.fetchConfig(correctUrl(config.optionsUrl)).then(function (conf) {
	    return Object.assign(conf, config);
	}).catch(function(err){
	    console.error("Unable to fetch optionsUrl " + config.optionsUrl);
	});
    } else {
	confProm = Promise.resolve(config);
    }
    if(confProm) {
	confProm.then(cljsBootstrap.bootstrap)
	    .then(function (conf) {
		var mainNsObject = cljsNamespaceToObject(conf.main);
		assert(mainNsObject, "ClojureScript Namespace " + conf.main + " not found.");
		assert(mainNsObject[config.renderFn], "Render function " + config.renderFn + " not found.");
		onLoadCb(mainNsObject[config.renderFn]);
	    });
    }
}

function assertKeyType(obj, k, type) {
    assert(typeof obj[k] == type, k + " must be a " + type);
}

function validateOptions(options) {
    assert(options.appName, "must provide an appName");
    assertKeyType(options, "appName",        "string");
    assertKeyType(options, "autoRefresh",    "boolean");
    assertKeyType(options, "expo",           "boolean");
    assertKeyType(options, "renderFn",       "string");
    if(options.optionsUrl) {
	assertKeyType(options, "optionsUrl", "string");
    } else {
	assert(options["asset-path"], "must provide an asset-path option when no cljscOptionsUrl is provided");
	assert(options["main"],       "must provide a main option when no cljscOptionsUrl is provided");
	assertKeyType(options, "asset-path",      "string");
	assertKeyType(options, "main",            "string");
	if(options.preloads) {
	    assertKeyType(options, "preloads",        "string");
	}
	if(options["closure-defines"]) {
	    assertKeyType(options, "closure-defines", "string");
	}
    }
}

// helper function to allow require at runtime
function shimRequire(requireMap) {
    // window get's compiled to the global object under React Native compile options
    var oldRequire = window.require;
    window.require = function (id) {
        console.info("Requiring: " + id);
        if (requireMap[id]) {
            return requireMap[id];
        }
	if(oldRequire) {
            return oldRequire(id);
	}
    };
}

function startApp(options){
    var config = Object.assign({renderFn:     'figwheel_rn_root',
			        autoRefresh:  true},
			       options);
    validateOptions(config);
    // The crux of the loading problem for React Native is that the code needs to be loaded synchronously
    // because the way that React Native launches an application. It looks for the registered application to launch
    // after the initial loading of the jsbundle. Since we are accumstomed to use asynchronous loading to load
    // the optimizations none files and setup its useful to establish this fetching as a channel for future reloading.
    // We could compile the files to load into an initial single bundle to be loaded.
    if ( config.expo === true && expo !== undefined) {
        expo.registerRootComponent(figwheelApp(config));
    } else {
        ReactNative.AppRegistry.registerComponent(
            config.appName, () => figwheelApp(config));
    }
}

module.exports = {
    shimRequire: shimRequire,
    start: startApp
};
