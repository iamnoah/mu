!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),(f.mu||(f.mu={})).compute=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var _ = _dereq_("lodash");

	var uid = 0;
	// Standard Observer pattern.
	function Listeners() {
		this.NS = "__mu_compute_" + (++uid);
		this._keyToId = {};
		this._listeners = {};
		this._ordered = [];
	}

	/**
	 * @param {function()} listener
	 * @param {?String} key optional key. Must be unique.
	 * Can be used to remove the listener without a reference to the 
	 * original function.
	 */
	Listeners.prototype.add = function(listener, key) {
		if (listener[this.NS]) {
			throw new Error("Function is already bound to this compute! " + (key || ""));
		}
		var id = "L" + (++uid);
		if (key) {
			if (this._keyToId[key]) {
				throw new Error("Listener key already in use: " + key);
			}
			this._keyToId[key] = id;
		}
		listener[this.NS] = id;
		this._listeners[id] = listener;
		this._ordered.push(listener);
	};
	Listeners.prototype.remove = function(listener) {
		var id;
		if (typeof listener === "string") {
			id = this._keyToId[listener];
			delete this._keyToId[listener];
		} else {
			id = listener[this.NS];
		}

		if (!id) {
			throw new Error("Tried to remove a non-listener: " + listener);
		}

		var fn = this._listeners[id];
		delete this._listeners[id];
		delete fn[this.NS];
		var index = _.indexOf(this._ordered, fn);
		if (~index) {
			this._ordered.splice(index, 1);
		}
	};
	Listeners.prototype.notify = function() {
		var args = arguments;
		this._ordered.forEach(function(fn) {
			fn.apply(null, args);
		});
	};
	Object.defineProperties(Listeners.prototype, {
		length: {
			get: function() {
				return this._ordered.length;
			}
		}
	});

	// Helper for monitoring the values getValue requires to compute.
	function Monitor(getValue, record, onWrite) {
		this.id = "M" + (++uid);
		this.get = function() {
			this.value = getValue();
		}.bind(this);
		this.record = record;
		this.onWrite = onWrite;

		this.onChange = this.onChange.bind(this);
	}
	Monitor.prototype.bind = function() {
		// record what was accessed
		var oldWatches = this._toWatch || {
			order: [],
			computes: {}
		};
		this._toWatch = this.record(this.get);

		// update what we are watching
		var oldIds = _.uniq(oldWatches.order);
		var newIds = _.uniq(this._toWatch.order);
		var newWatches = _.difference(newIds, oldIds);
		var rmWatches = _.difference(oldIds, newIds);

		_.each(rmWatches, function(id) {
			oldWatches.computes[id].offChange(this.onChange);
		}, this);
		_.each(newWatches, function(id) {
			this._toWatch.computes[id].onChange(this.onChange);
		}, this);
	};
	Monitor.prototype.onChange = function() {
		var oldVal = this.value;
		this.bind();
		this.onWrite(oldVal, this.value);
	};
	Monitor.prototype.unbind = function() {
		_.each(_.uniq(this._toWatch.order), function(id) {
			this._toWatch.computes[id].offChange(this.onChange);
		}, this);
		this._toWatch = false;
	};
	Object.defineProperties(Monitor.prototype, {
		bound: {
			get: function() {
				return !!this._toWatch;
			}
		}
	});

	// batch of compute updates
	function Batch() {
		this.order = [];
		this.notifications = {};
	}
	Batch.prototype.addChange = function(listeners, oldVal, newVal) {
		var id = listeners.NS;
		this.order.push(id);

		// the first time we see the listeners, save the old value
		var state = this.notifications[id] = this.notifications[id] || {
			listeners: listeners,
			oldVal: oldVal
		};
		// always update the new value
		state.newVal = newVal;
	};
	Batch.prototype.send = function() {
		_.uniq(this.order).forEach(function(id) {
			var state = this.notifications[id];
			if (state.oldVal !== state.newVal) {
				state.listeners.notify(state.oldVal, state.newVal);
			}
		}, this);
	};

	function Computes() {
		var accessed = function() {};
		var batch, batchDepth;
		function afterBatch(listeners, oldVal, newVal) {
			if (batch) {
				batch.addChange(listeners, oldVal, newVal);
			} else {
				var b = new Batch();
				b.addChange(listeners, oldVal, newVal);
				b.send();
			}
		}
		function record(fn) {
			// record what computes were accessed while the function ran
			// so we know what to bind to
			var records = {
				// need to record the access order so we can consistently bind/unbind
				order: [],
				computes: {}
			};
			var oldAccessed = accessed;
			accessed = function(compute, id) {
				records.order.push(id);
				records.computes[id] = compute;
			};
			fn();
			accessed = oldAccessed;
			return records;
		}
		// Simple observable wrapper around a value.
		function valueCompute(value) {
			var listeners = new Listeners();
			var id = "V" + (++uid);
			function holder(v) {
				if (arguments.length) {
					return holder.set(v);
				}
				return holder.get();
			}
			holder.get = function() {
				accessed(holder, id);
				return value;
			};
			holder.set = function(newVal) {
				var oldVal = value;
				value = newVal;
				afterBatch(listeners, oldVal, newVal);
			};
			holder.onChange = function(listener, key) {
				listeners.add(listener, key);
			};
			holder.offChange = function(listener) {
				listeners.remove(listener);
			};
			holder.__listeners = listeners;

			return holder;
		}
		// Wraps a computation of value computes.
		function compute(fn, ctx) {
			var listeners = new Listeners();
			var id = "c" + (++uid);
			function wrapper(newVal) {
				if (arguments.length) {
					return wrapper.set(newVal);
				}
				return wrapper.get();
			}
			var getter = fn.get || fn;
			wrapper.get = function() {
				accessed(wrapper, id);
				// if currently bound, use the cached value
				return !batch && monitor.bound ? monitor.value :
					getter.call(ctx);
			};

			var setter = fn.set || fn;
			wrapper.set = function(newValue) {
				return setter.call(ctx, newValue);
			};

			wrapper.onChange = function(listener, key) {
				// once we have listeners, we need to monitor any computes
				// our value depends on
				listeners.add(listener, key);
				if (!monitor.bound) {
					monitor.bind();
				}
			};
			wrapper.offChange = function(listener) {
				listeners.remove(listener);
				if (!listeners.length) {
					monitor.unbind();
				}
			};

			// the monitor is responsible for watching all the computes we use
			// and notifying us when we recompute
			var monitor = new Monitor(getter, record, function(oldVal, newVal) {
				afterBatch(listeners, oldVal, newVal);
			});


			wrapper.__listeners = listeners;
			wrapper.__monitor = monitor;

			return wrapper;
		}
		function make(c) {
			return typeof c === "function" ?
				compute(c) : valueCompute(c);
		}
		make.value = valueCompute;
		make.startBatch = function() {
			batchDepth++;
			batch = batch || new Batch();
		};
		make.endBatch = function() {
			batchDepth--;
			if (batchDepth < 0) {
				throw new Error("No current batch");
			}
			if (!batchDepth) {
				var b = batch;
				// XXX null out batch before sending so computes will notify
				batch = null;
				b.send();
			}
		};
		return make;
	}

	var defaultSpace = new Computes();
	// Can't think of why you would want a separate compute space, but
	// knock yourself out creating them if you like.
	defaultSpace.constructor = Computes;
	module.exports = defaultSpace;
})(this);

},{}]},{},[1])
(1)
});