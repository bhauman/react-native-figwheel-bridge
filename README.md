# React Native Figwheel Bridge

Enables React Native projects written in ClojureScript to use
Figwheel's live reloading and REPL.

## State of this library

> This library is intended to only replace the functionality
> provided by the `figwheel-bridge.js` file in re-natal

This library is going to change. I'm using it as a base to understand
the issues when integrating ClojureScript tooling with React Native
tooling.

The things discovered here will inform changes to Figwheel-main and
perhaps the ClojureScript compiler.

The ultimate goal is to eliminate the need for this library in the
first place and be able to support React Native directly from
figwheel-main or even the ClojureScript compiler.

Because of this flux, this library is going to primarily be compatible
with `figwheel-main` for now as I'm not going to be make incremental
improvements to both `figwheel-main` and `lein figwheel` during this
period of discovery.

I do advise that you use this library as it represents a very
straightforward way to use React Native along with Figwheel.

## Notes on the React Native build environment

When you run `npx react-native run-ios` it launches the metro bundler
which basically runs a `babel` based watcher/compiler process with
some specific React Native presets. This compiles the `index.js` file
to a bundle that is loaded by React Native framework code that is
written in Objective-C.

You can see the Native code that loads the bundle in
`ios/MyAwesomeProject/AppDelegate.m`.

> The important thing to note about this, is that in terms of relating
> to ClojureScript and its tools, a React Native project is simply
> JavaScript that gets loaded into a React Native host environment.

Our goal is to get our compiled ClojureScript into the RN host
environment and establish a REPL connection so that we can get
reloading, editor integration, etc.

So this is not the hardest problem but there are a few tricky parts
and that's where this library comes in.

One of the tricky parts is the use of `require`. `require` is not just
used to include JavaScript libraries in React Native projects it's
also used to pull in assets like images, data etc. However unlike
node-js `require` doesn't actually exist in the JavaScript Core
runtime environment. The React Native metro bundler process resolves
and handles all `require`s in JavaScript code at compile time.

However, this doesn't work for hot-reloaded compiled ClojureScript
code which doesn't get processed by the Metro bundler. So `(js/require
"images/splash-logo.png")` won't work in hot-reloaded code without
some sort of intervention.

The other tricky part for ClojureScript code is to support the
requiring of of `npm` modules like `react` and `react-native` in
ClojureScript ns forms like this:

```clojure
(ns example.main
  (:require 
    [react :as react]
	[react-native :as rn]))
	
;; now rn/Text is available here	
```

So there will need to be an intervention for this as well.

We need to make `require`s available in a global object in the
`index.js` so that they are available to ClojureScript at
runtime. ClojureScript helps us here with it's new `:bundle`
target. When using the `:bundle` target the CLJS compiler collects all
these npm dependency requires and generates an `npm_deps.js` file which
can be processed by the metro bundler.

The content of the `npm_deps.js` file typically looks like this: 

```
module.exports = {
  npmDeps: {
    "react-native": require('react-native'),
    "react": require('react')  }
};
```

Finally, there is one more sticking point when integrating an
optimizations `:none` ClojureScript build into a React Native tooling
environment.

When React Native loads the Metro Compiled bundle it expects the root
of the React Native component to be registered synchronously when the
bundle initially loads. Unfortunately right now it is faster and simpler to
bootstrap and load the ClojureScript application code
asynchronously. So we have to register a proxy component before the
application code loads. This proxy in turn renders your actual
application when the application code actually loads.

This `react-native-figwheel-bridge` library addresses these problems
and I encourage you to read it and understand it. Reading the code
should eliminate much of the mystery and empower you to make your own
decisions about how you want to load and run your ClojureScript
application.

## Initial setup

First you will need to make sure you have React Native and its
dependencies installed.

On the https://reactnative.dev/docs/environment-setup page you will
want to choose either the `React Native CLI` or the `Expo CLI`.  I
prefer to start with the React Native CLI as there is less tooling to
deal with so its easier to figure out what is going on when you use
it.

Install your CLI of choice according to the instructions on that page.

Once things are installed you can then follow the instructions below
to get an ClojureScript project setup for Figwheel development.

## React Native CLI

Initialize a project:

```shell
$ npx react-native init MyAwesomeProject
```

This will create an initial React Native project. Before you go any
further you will want to ensure that everything is setup so that you can
launch and run your application in a simulator.

Change in into the `MyAwesomeProject` directory and launch a simulator like so:

```shell
$ npx react-native run-ios  # or react-native run-android
```

If everything is set up correctly this should launch a phone simulator
with the RN application defined in `index.js` and `App.js`.

## Expo CLI

Initialize a project:

```shell
$ npx expo init MyAwesomeProject
```

This will create an initial React Native project. Before you go any
further you will want to ensure that everything is setup so that you can
launch and run your application in a simulator.

Change in into the `MyAwesomeProject` directory and launch a simulator like so:

```shell
$ yarn ios # or android
```

If everything is set up correctly this should launch a phone simulator
with the RN application defined in `App.js`.

## Troubleshooting

If you have any problems with setting up an application please consult
the React Native documentation. I really recommend reading all of the
React Native Documentation as it is well written and will more than
likely save you lots of headaches.

If everything is up and running go ahead an close everything so that
we can setup a ClojureScript application that uses `figwheel-main` to
support hot reloading and a REPL.

## Integrating the ClojureScript and Figwheel 

First we need to add the `react-native-figwheel-bridge` to our npm
dependencies:

```shell
$ yarn add react-native-figwheel-bridge
```

Now we'll start setting up a basic
[figwheel.main](https://figwheel.org) project.

Create a `deps.edn` file in the `MyAwesomeProject` directory:

```clojure
{:deps {org.clojure/clojurescript {:mvn/version "1.10.764"}
        com.bhauman/figwheel-main {:mvn/version "0.2.5"}}}
```

Create a `ios.cljs.edn` file in the `MyAwesomeProject` directory:

```clojure
^{:open-url false
  :cljs-devtools false}
{:main awesome.main
 :target :bundle}
```

Create a `src/awesome/main.cljs` file in the `MyAwesomeProject` directory:

```clojure
(ns awesome.main
  (:require [react]
            [react-native :as rn]))

(def <> react/createElement)

(defn renderfn [props]
  (<> rn/View
      #js {:style #js {:backgroundColor "#FFFFFF"
                       :flex 1
                       :justifyContent "center"}}
      (<> rn/Text
          #js {:style #js {:color "black"
                           :textAlign "center"}}
          (str "HELLO"))))

;; the function figwheel-rn-root must be provided. It will be called by 
;; react-native-figwheel-bridge to render your application. 
;; You can configure the name of this function with config.renderFn
(defn figwheel-rn-root []
  (renderfn {}))
```

Next we need to create the index file to start our Clojurescript
application this file will be different depending on which CLI tool we
are using.

The index file is the file that will be bundled by React Native
tooling.

## React Native CLI Index.js

Edit the `index.js` file in the `MyAwesomeProject` directory:

```javascript
import {AppRegistry} from 'react-native';
import {name as appName} from './app.json';
import {npmDeps} from "./target/public/cljs-out/ios/npm_deps.js";

// you can add other items to npmDeps here
// npmDeps["./assets/logo.png"]= require("./assets/logo.png");

// this url points to a file generated by the cljs compiler in the output-dir of your app
var options = {optionsUrl: "http://localhost:19001/target/public/cljs-out/ios/cljsc_opts.json"};

var figBridge = require("react-native-figwheel-bridge");
figBridge.shimRequire(npmDeps);
AppRegistry.registerComponent(appName,
                              () => figBridge.createBridgeComponent(options));
```

Now we are ready to launch our ClojureScript application:

First we will start the `figwheel-main` process to watch and compile
and create a Websocket for REPL communication.

```shell
$ clj -m figwheel.main -b ios -r
```

The in another terminal window change into the `MyAwesomeProject`
directory and start `react-native` 

```shell
$ npx react-native run-ios
```

When using `figwheel-main` figwheel bridge will take care of auto
refreshing the application for you when figwheel reloads code.

You can see this behavior by editing the `src/awesome/main.cljs`
file. Try changing the `"HELLO"` to `"HELLO THERE"`. You should see
the application change when you save `src/awesome/main.cljs`.

## Expo CLI Index.js

Create an `index.js` file in the `MyAwesomeProject` directory:

```javascript
import { registerRootComponent } from 'expo';
import {npmDeps} from "./target/public/cljs-out/ios/npm_deps.js";

var options = {optionsUrl: "http://localhost:19001/target/public/cljs-out/ios/cljsc_opts.json"};

var figBridge = require("react-native-figwheel-bridge");
figBridge.shimRequire(npmDeps);
registerRootComponent(figBridge.createBridgeComponent(options));
```

Now we have to **expo** that we want to use this `index.js` as the
entry point to our application.

Edit `package.json` and change `"main": "node_modules/expo/AppEntry.js"` to
`"main": "index.js"`.

Now we are ready to launch our ClojureScript application:

First we will start the `figwheel-main` process to watch and compile
and create a Websocket for REPL communication.

```shell
$ clj -m figwheel.main -b ios -r
```

The in another terminal window change into the `MyAwesomeProject`
directory and start `expo` 

```shell
$ yarn ios
```

When using `figwheel-main` figwheel bridge will take care of auto
refreshing the application for you when figwheel reloads code.

You can see this behavior by editing the `src/awesome/main.cljs`
file. Try changing the `"HELLO"` to `"HELLO THERE"`. You should see
the application change when you save `src/awesome/main.cljs`.

## Configuration options

These are the options that you can pass in the configuration Object to
`start`.

`appName`: (required for react-native) the name that you created your React Native
project with.

`optionsUrl`: (optional) a url that will resolve to a
`cljsc_opts.json` file. I modified figwheel-main to output this file as
a JSON version of the `cljsc_opts.edn` file that the ClojureScript
compiler outputs. This contains all the information needed to
effectively boostrap and load a ClojureScript application. If a
`optionsUrl` is not supplied you will need to supply the `asset-path`,
`main`, `preloads`, and `closure-defines` options directly.

`renderFn`: (optional) the JS munged name of the function that returns
the React elements for your application - defaults to
`figwheel_rn_root`

`asset-path`: (optional) this a url that resolves to the base of the
`:output-dir` in most cases this is
`"http://localhost:8081/target/public/cljs-out/[[build-name]]"` and in
the current example this would be
`"http://localhost:8081/target/public/cljs-out/ios"`

`main`: (optional) the JS munged namespaces string of your root application
namespace ie. `"my_example.core"`

`preloads`: (optional) an array of JS munged namespace strings to load
before the `main` ns is loaded.

`closure-defines`: (optional) a JavaScript Object literal that
provides custom values for your `goog-defines`. Most importantly this
should contain a `figwheel.repl.connect_url` so that `figwheel-main`
knows where to connect.

## Controlling Reload

After everything is loaded a `figwheelBridgeRefresh` function is registered on `goog`. 
You can call this function to force the root element to reload.

So for the above example you could set the `autoRefresh` option to false.

In `index.js` this looks like:

```javascript
figBridge.start({appName:   "MyAwesomeProject",
                 optionsUrl: "http://localhost:8081/target/public/cljs-out/ios/cljsc_opts.json",
				 autoRefresh: false // <-- setting auto refresh to false
				 });
```

and control reloading via `figwheel.main`'s [reload hooks](https://figwheel.org/docs/hot_reloading.html#reload-hooks)

in `src/awesome/main.cljs` this looks like:

```clojure
(ns ^:figwheel-hooks awesome.main
  (:require [react]
            [react-native :as rn]))

(def <> react/createElement)

(defn renderfn [props]
  (<> rn/View
      #js {:style #js {:backgroundColor "#FFFFFF"
                       :flex 1
                       :justifyContent "center"}}
      (<> rn/Text
          #js {:style #js {:color "black"
                           :textAlign "center"}}
          (str "HELLO"))))

(defn figwheel-rn-root []
  (renderfn {}))

;; adding the reload hook here
(defn ^:after-load on-reload [] (goog/figwheelBridgeRefresh))
```

## Based on previous work

This code heavily modified from the `figwheel-bridge.js` file in
`https://github.com/drapanjanas/re-natal` which in turn was taken from
the now non-existent
`https://github.com/decker405/figwheel-react-native`.


