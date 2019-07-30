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

## Initial setup

First you will need to make sure you have React Native and its
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

This will create an initial React Native project. Before you go any
further you will want to ensure that everything is setup so that you can
launch and run your application in a simulator.

Change in into the `MyAwesomeProject` directory and launch a simulator like so:

```shell
$ react-native run-ios  # or react-native run-android
```

If everything is set up correctly this should launch a phone simulator
with the RN application defined in `index.js` and `App.js`.

If you have any problems please consult the React Native
documentation. Actually, I really recommend reading all of the React
Native Documentation as it is well written and will more than likely
save you lots of headaches.

If everything is up and running go ahead an close everything so that
we can setup a ClojureScript application that uses `figwheel-main` to
support hot reloading and a REPL.

## Notes on the React Native build environment

When you run `react-native run-ios` it launches the metro bundler
which basically runs a `babel` based watcher/compiler process with
some specific React Native presets on the `index.js` file. This
compiles the `index.js` file to a bundle that is loaded by React
Native framework code that is written in Objective-C.

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
`index.js` so that they are available to ClojureScript at runtime and
we need to inform the ClojureScript compiler which namespaces are to
supplied by this global map so that it can bind them properly in the
`ns` forms.

Finally, there is one more sticking point when integrating an
optimizations `:none` ClojureScript build into a React Native tooling
environment.

When React Native loads the Metro Compiled bundle it expects the root
of the React Native component to be registered synchronously when the
bundle initially loads. Unfortunately right now it is simplest to
bootstrap and load the ClojureScript application code
asynchronously. So we have to register a proxy component before the
application code loads. This proxy in turn renders your actual
application when the application code actually loads.

So these problems are addresses by the `react-native-figwheel-bridge`
code. I encourage you to read it and understand it. I believe that
along with this explanation it will eliminate all the mystery and
empower you to make your own decisions about how you want to load and
run your ClojureScript application.

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
{:deps {org.clojure/clojurescript {:mvn/version "1.10.439"}
        com.bhauman/figwheel-main {:mvn/version "0.2.1-SNAPSHOT"}}}
```

Create a `ios.cljs.edn` file in the `MyAwesomeProject` directory:

```clojure
^{:open-url false
  :npm {:bundles {"dummy.js" "index.js"}}}
{:main awesome.main}
```

> If you have done React Native from ClojureScript before, then you
> will notice that I am not specifying a `:target :nodejs` in the
> compile options. This is intentional because we are not actually
> targeting Nodejs.

Make an empty `./dummy.js` file so that we can use `:global-exports`:

```shell
$ touch ./dummy.js
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
cljsExports = {};
cljsExports["react"] = require('react');
cljsExports["react-native"] = require('react-native');
cljsExports["create-react-class"] = require('create-react-class');

var figBridge = require("react-native-figwheel-bridge");

figBridge.shimRequire(cljsExports);
figBridge.start({appName:   "MyAwesomeProject",
                 optionsUrl: "http://localhost:8081/target/public/cljs-out/ios/cljsc_opts.json"});
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
$ react-native run-ios
```

When using `figwheel-main` figwheel bridge will take care of auto
refreshing the application for you when figwheel reloads code.

You can see this behavior by editing the `src/awesome/main.cljs`
file. Try changing the `"HELLO"` to `"HELLO THERE"`. You should see
the application change when you save `src/awesome/main.cljs`.

## Further explaination

The magic line above is in the `ios.cljs.edn` file.

```
:npm {:bundles {"dummy.js" "index.js"}}
```

This line causes figwheel-main to read the `cljsExports` statements
`index.js` file and adds the following to your compile options (The
specific `cljsExports` name is parsed by figwheel):

```
{:main awesome.main
 :foreign-libs [{:file "dummy.js"
                 :provides ["react" "react-native" "create-react-class"]
				 :global-exports {react              cljsExports.react
				                  react-native       cljsExports.react-native
								  create-react-class cljsExports.create-react-class}}]}
```

The `:global-exports` config option allows us to reference these
exports via the `:requires` in our `ns` forms.

```clojure
(ns awesome.main
  (:require [react-native :as rn]))
  
;; global exports allows us to refer to ReactNative.Text like this
(rn/Text #js {:style ...} "Hello world")
```

The `:global-exports` that we need are already provided by top level
bundle compiled by Metro. We pretend that the empty `dummy.js` file is
providing them so we can utilize the Global Exports feature. Hopefully
the ClojureScript compiler will add top-level `:global-exports` option
to the compiler options so that this hack isn't necessary in the
future.

## Configuration options

These are the options that you can pass in the configuration Object to
`start`.

`appName`: (required) the name that you created your React Native
project with.

`optionsUrl`: (optional) a url that will resolve to a
`cljsc_opts.json` file. I modifed figwheel-main to output this file as
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
the now non-existant
`https://github.com/decker405/figwheel-react-native`.


