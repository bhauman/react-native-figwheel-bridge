# React Native Figwheel Bridge

Enables React Native projects written in ClojureScript to use
Figwheel's live reloading and REPL.

## Usage

First you will need to make sure you have ReactNative and its
dependencies installed.

On the https://facebook.github.io/react-native/docs/getting-started
page you will want to click the poorly named `Building Projects with
Native Code` tab, to get instructions on how to set your system up.

Once things are installed you can then follow the instructions below
to get a React Native project setup for Figwheel development.

Initialize a project:

```shell
$ react-native init MyAwesomeProject
```

ensure it works by changing into the `MyAwesomeProject` directory

```shell
$ react-native run-ios  # or react-native run-android
```

Close everything. 

Add `react-native-figwheel-bridge`:

```shell
$ yarn add react-native-figwheel-bridge
```

Now we'll start a basic [figwheel.main](https://figwheel.org) project.

Create a `deps.edn` file in the `MyAwesomeProject` directory:

```clojure
{:deps {org.clojure/clojurescript {:mvn/version "1.10.339"}
        com.bhauman/figwheel-main {:mvn/version "0.2.0"}}}
```

Create a `ios.cljs.edn` file in the `MyAwesomeProject` directory:

```clojure
^{:launch-node false}
{:main awesome.main
 :target :nodejs
 :output-dir "target/ios"
 :output-to "target/ios/main.js"}
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

Edit the `index.js` file in the `MyAwesomeProject` directory:

```javascript
// these requires allow you to use the (:require [react]) ns forms and 
// and use js/require in general. You must supply all your requires for 
// this to work in figwheel

var requires = {};
requires["react"] = require('react');
requires["react-native"] = require('react-native');
requires["create-react-class"] = require('create-react-class');

var figBridge = require("react-native-figwheel-bridge");

figBridge.withModules(requires);
figBridge.start({appName:   "MyAwesomeProject",
                 outputDir: "target/ios",
                 outputTo:  "target/ios/main.js",
                 mainNs:    "awesome.main",
                 devHost:   "localhost"});
```				 

Now we are ready to launch our ClojureScript application:

```shell
$ react-native run-ios
```

When using `figwheel-main` figwheel bridge takes care of auto
refreshing the application for you when figwheel reloads code.

You can see this behavior by editing the `src/awesome/main.cljs`
file. Try changing the `"HELLO"` to `"HELLO THERE"`. You should see
the application change when you save `src/awesome/main.cljs`.

## Configuration options

These are the options that you can pass in the configuration Object to
`start`.

`appName`: (required) the name that you created your React Native
project with.

`outputDir`: (required) the same as the `:output-dir` that is
configured in your CLJS build.

`outputTo`: (required) the same as the `:output-to` that is configured
in your CLJS build.

`mainNs`: (required) the similar to the `:main` that is configured in
your CLJS build, but it must be the JS munged version of the name.

`autoRefresh`: (optional) whether the figwheel bridge root element
should auto refresh when figwheel finishes reloading - defaults to `true`

`renderFn`: (optional) the JS munged name of the function that returns
the React elements for your application - defaults to `figwheel_rn_root`

`devHost`: (optional) where the metro bundler is running - defaults to `"localhost"`

`serverPort`: (optional) the port of the metro bundler - defaults to `8081`

`googBasePath`: (optional) the offset from `outputTo` to the base of the `goog` libs - defaults to `goog/`
``

## Controlling Reload

After everything is loaded a `figwheelBridgeRefresh` function is registered on `goog`. 
You can call this function to force the root element to reload.

So for the above example you could set the `autoRefresh` option to false.

In `index.js` this looks like:

```javascript
figBridge.start({appName:   "MyAwesomeProject",
                 outputDir: "target/ios",
                 outputTo:  "target/ios/main.js",
                 mainNs:    "awesome.main",
                 devHost:   "localhost",
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

## Usage `lein figwheel` and `figwheel.sidecar`

It's very similar to the above except you have to refresh manually as
described in the last section.

So a minimal `project.clj` would look like:

```clojure
(defproject awesome "0.1.0-SNAPSHOT"
  :dependencies [[org.clojure/clojure "1.9.0"]
                 [org.clojure/clojurescript "1.10.339"]]

  :plugins [[lein-figwheel "0.5.16"]]

  :cljsbuild {:builds
              [{:id "dev"
                :source-paths ["src"]
                :figwheel {:on-jsload "awesome.main/on-reload"}
                :compiler {:main awesome.main
                           :target :nodejs
                           :output-dir "target/ios"
                           :output-to "target/ios/main.js"
                           }}]})
```

and your `src/awesome/main.cljs` file would need to define an
`on-reload` function that calls `(goog/figwheelBridgeRefresh)` like so:

```clojure
(defn on-reload [] (goog/figwheelBridgeRefresh))
```

## Based on previous work

This code heavily modified from the `figwheel-bridge.js` file in
`https://github.com/drapanjanas/re-natal` which in turn was taken from
the now non-existant
`https://github.com/decker405/figwheel-react-native`.


