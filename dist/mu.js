!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.mu=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var slice = [].slice;
	var has = Object.prototype.hasOwnProperty;

	module.exports = {
		extend: Object.assign || function(obj) {
			slice.call(arguments, 1).forEach(function(source) {
				if (source) {
					for (var prop in source) {
						obj[prop] = source[prop];
					}
				}
			});
			return obj;
		},
		last: function(array) {
			return array && array[array.length - 1];
		},
		isArray: function(thing) {
			return Array.isArray(thing);
		},
		has: function(o, p) {
			return has.call(o, p);
		},
		toArray: function(thing) {
			return slice.call(thing);
		}
	};
})();

},{}],2:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var Lens = _dereq_("./lens"),
		_ = _dereq_("./_");

	var deepFreeze = function(obj) {
		// don't freeze in production mode
		if ("development" !== "production") {
			// don't freeze non-objects, null, or already frozen stuff
			if (typeof obj !== "object" || obj == null || Object.isFrozen(obj)) {
				return;
			}
			Object.freeze(obj);
			for(var p in obj) {
				if (_.has(obj, p)) {
					deepFreeze(obj[p]);
				}
			}
		}
	};

	function ensure(actual, expected, message, /*private*/_stack) {
		if(actual !== expected) {
			var e = new Error(message);
			e.framesToPop = (_stack || 1) + 1;
			throw e;
		}
	}

	function ensureArgs(args, expectedCount) {
		ensure(args.length, expectedCount,
			"Expected " + expectedCount +
			" arguments but got " + args.length);
	}
	function ensureType(value, types, name, _stack) {
		var actual = _.isArray(value) ? "array" : typeof value;
		types = _.isArray(types) ? types : [types];
		ensure(true, !!~types.indexOf(actual),
			"Expected " + name +
			" to be " + types.join(" or ") +
			" but was " + actual + ": " + value, _stack || 1);
	}

	function makeAccessor(lens, computed) {
		function getterSetter(newValue) {
			var target = computed();
			if (arguments.length) {
				var result = lens.set(target, newValue);
				if (interceptors.length && result !== target) {
					var newVal = lens.get(result);
					var oldVal = lens.get(target);
					result = lens.set(result, interceptors.reduce(function(newVal, fn) {
						return fn(newVal, oldVal);
					}, newVal));
				}
				deepFreeze(result);
				computed(result);
				return;
			}
			return lens.get(target);
		}
		getterSetter.get = function() {
			return getterSetter();
		};
		getterSetter.set = function(newValue, setValue) {
			if (arguments.length > 1) {
				ensureArgs(arguments, 2);
				return getterSetter.focus(newValue).set(setValue);
			}
			getterSetter(newValue);
		};
		var interceptors = [];
		/**
		 * Usage:
		 	// your interceptor will be called before any change is applied
			atom.beforeChange(function(newData, oldData) {
				// remember that newData is immutable so you will need to 
				// copy it
				// mu.Lens can be very helpful
				return modifiedData;
			});
		 */	
		getterSetter.beforeChange = function(interceptor) {
			interceptors.push(interceptor);
		};		
		return getterSetter;
	}

	/**
	 * Creates a getter-setter combining the given Lens with the given compute.
	 *
	 * @param {Lens} lens
	 * @param {compute} computed
	 * @return a function like that returned by atom(...) suitable for 
	 * creating a compute.
	 */
	function compose(lens, computed, options) {
		var getterSetter = makeAccessor(lens, computed);
		addHelpers(getterSetter, options);
		getterSetter.focus = focuser(getterSetter, options);
		return getterSetter;
	}

	function addHelpers(getterSetter, options) {
		function assigner(a, b, index) {
			ensureType(b, ["object"], 
				(index ? "arg " + index + " to": "target of") +
				" extend/assign[" +
				(options.parentKey || "<root>") + "]", 5);
			return _.extend(a, b);
		}
		function makeAssign(method) {
			return function() {				
				var objs = _.toArray(arguments)
				getterSetter.set([getterSetter.get()].
					concat(objs)[method](assigner, {}));
			};
		}
		getterSetter.assign = getterSetter.extend = makeAssign("reduce");
		getterSetter.defaults = makeAssign("reduceRight");

		// delete is a special case since it changes the parent
		getterSetter.del = getterSetter.splice = function(inKey) {
			if (arguments.length > 0) {
				ensureArgs(arguments, 1);
				return getterSetter.focus(inKey).del();
			}
			var value = options.parent.get();
			var result = value;
			var key = options.parentKey;
			ensureType(key, ["string", "number"], "key");			
			if (typeof key === "number") {
				ensureType(value, ["array"], key);
				result = value.slice(0);
				result.splice(key, 1);
			} else if(value) {
				result = _.extend({}, value);
				delete result[key];
			}
			options.parent.set(result);
		};

		// add the standard array operations
		function asArray() {
			var result = getterSetter.get();
			if (result) {
				ensureType(result, ["array"], options.parentKey);
			}
			return (result || []).slice(0);			
		}
		function arrayOp(method, returnValue) {
			return function() {
				var result = asArray();
				var out = result[method].apply(result, arguments);
				getterSetter.set(result);
				if (returnValue) {
					return out;
				}
			};
		}
		getterSetter.push = arrayOp("push");
		getterSetter.pop = arrayOp("pop", true);
		getterSetter.shift = arrayOp("shift", true);
		getterSetter.unshift = arrayOp("unshift");

		// using an array as a set is common enough we should implement
		// the basic operations
		function makeIterator(iterator) {
			if (typeof iterator === "string") {
				var prop = iterator;
				iterator = function(item) {
					return item && item[prop];
				};
			}
			return iterator || function(a) { return a; };
		}

		getterSetter.merge = function(other, iterator, context) {
			iterator = makeIterator(iterator);
			ensureType(iterator, "function", "iterator to merge");
			var result = asArray();
			var identities = result.map(iterator, context);
			getterSetter.set(result.concat(other.filter(function(item) {
				if (!~identities.indexOf(iterator.call(this, item))) {
					identities.push(item);
					return true;
				}
				return false;
			}, context)));
		};

		getterSetter.remove = function(other, iterator, context) {
			iterator = makeIterator(iterator);
			ensureType(iterator, "function", "iterator to remove");
			var result = asArray();
			var identities = other.map(iterator, context);
			getterSetter.set(result.filter(function(item) {
				return !~identities.indexOf(iterator.call(this, item));
			}, context));
		};

		getterSetter.update = function(updater) {
			// create a new atom that holds a copy of the current state to be 
			// modified, pass it to the updater, and update ourselves with the 
			// result
			var atom = new Atom(getterSetter.get(), options.convert);
			updater(atom);
			getterSetter.set(atom());
		};
	}

	function focuser(computed, options) {
		return function() {
			// insert converters along the path so that our lens correctly sets values
			var definition = _.toArray(arguments).reduce(function(state, prop) {
				var convert = state.convert || {};
				// array, so the converter applies to each item
				// pass it along as is so it will be applied next
				if (typeof prop === "number") {
					return {
						convert: convert,
						path: state.path.concat([prop]),
					};
				// convert the current object, then get the prop and its converters
				} else if (convert.$this) {
					return {
						convert: convert[prop],
						path: state.path.concat([Lens.typed(convert.$this), prop]),
					};
				// no converter for the current object, but keep descending
				} else {
					return {
						convert: convert[prop],
						path: state.path.concat([prop]),
					};
				}
			}, {
				convert: options.convert,
				path: [],
			});

			return compose(Lens.path.apply(Lens, definition.path), computed, {
				convert: definition.convert,
				parent: makeAccessor(
					Lens.path.apply(Lens, definition.path.slice(
						0, definition.path.length  - 1)), computed),
				parentKey: _.last(definition.path.filter(function(path) {
					return typeof path === "number" ||
						typeof path === "string";
				}))
			});
		};
	}

	/**
	 * Wraps a computed function. computed is presumably an observable
	 * that has the following semantics:
		computed() => return the current value
		computed(newValue) => sets the current value
	 * 
	 * Atom provides the following semantics:

		var state = Atom(stateCompute);
		var baz = state.focus("foo", "bar", 3, "baz");
		baz.get() => stateCompute().foo.bar[3].baz
		baz() => shorthand for get
		baz.set(123) => sets stateCompute().foo.bar[3].baz to 123,
			stateCompute will be updated
		baz(123) => shorthand for set

		baz.focus("futher", "refinement")
	 *
	 * The get/set function returned by Atom is suitable for creating a CanJS compute.
	 * KnockoutJS users can do a simple translation:
		ko.computed({ read: baz.get, write: baz.set })
	 *
	 * Recommendation: Object.freeze the initial value your compute/observed
	 * contains to prevent non-atomic modifications.
	 */
	function Atom(computed, convert) {
		if (typeof computed !== "function") {
			var val = computed;
			computed = function(newVal) {
				if (arguments.length) {
					val = newVal;
				}
				return val;
			};
		}
		deepFreeze(computed());
		var root = compose(Lens.I, computed, {
			convert: convert,
		});
		// deleting the root is a little weird but we can manage it by setting
		// the computed to null
		// some computed implementations will not understand setting it to 
		// undefined
		var realDelete = root.del;
		root.del = function() {
			if (arguments.length) {
				return realDelete.apply(root, arguments);
			}
			computed(null);
		};
		return root;
	}

	Atom.convert = function(Class, props) {
		return _.extend({
			"$this": Class
		}, props);
	};

	Atom.convert.scalar = Lens.typed.scalar;

	function from(obj, convert) {
		if (!convert) {
			return obj;
		}
		if (_.isArray(obj)) {
			return obj.map(function(data) {
				return from(data, convert);
			});
		}
		var result = {};
		for (var prop in obj) {
			if (_.has(obj, prop)) {
				result[prop] = from(obj[prop], convert[prop]);
			}
		}
		return convert.$this ? new convert.$this(result) : result;
	}


	Atom.define = function() {
		var convert = Atom.convert.apply(Atom, arguments);
		function AtomType(computed) {
			return new Atom(computed, convert);
		}
		AtomType.fromJSON = function(data) {
			return from(data, convert);
		};
		return AtomType;
	};

	module.exports = Atom;
})();

},{"./_":1,"./lens":3}],3:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var _ = _dereq_("./_");

	/**
	 * Lens Laws:
	 *
	 * 1. You get back what you put in.
		l.get(l.set(o, v)) === v
	 * Any custom lens probably does this by default, but you can screw it up, 
	 * so be careful.
	 * 2. Putting back what you got doesn't change anything:		
		l.set(o, l.get(o)) === o
	 * This is enforced by Lens, but if you violated #1, it could break it.
	 * 3. Setting twice is the same as setting once:
		l.set(l.set(o, v) v2) === l.set(o, v2)
	 * To violate this one, your lens would probably need to have some sort of 
	 * state, or impure input or something like that. So just don't do that.
	 *
	 * To summarize: Make sure your lenses are pure functions, and don't
	 * transform what gets put in by set in a way that isn't fully reversible.
	 */
	function Lens(get, set) {
		this.get = get;
		this.set = function(target, newValue) {
			// 2nd lens law: putting back what you got doesn't change anything
			// so we should preserve object references whenever possible.
			if (get.call(this, target) === newValue) {
				return target;
			}
			return set.call(this, target, newValue);
		};
	}

	Lens.prototype.mod = function(a, f) {
		return this.set(a, f(this.get(a)));
	};
	Lens.prototype.andThen = function(lensB) {
		return Lens.compose(this, lensB);
	};

	Lens.compose = function(a, b) {
		return new Lens(function(o) {
			return b.get(a.get(o));
		}, function(o, val) {
			return a.mod(o, function(o2) {
				return b.set(o2, val);
			});
		});
	};

	Lens.I = new Lens(function(a) {
		return a;
	}, function(a, b) {
		return b;
	});

	Lens.nth = function(n) {
		var index = n < 0 ? function(array) {
			return (array && array.length + n) || 0;
		} : function() {
			return n;
		};
		return new Lens(function(array) {
			return array && array[index(array)];
		}, function(array, val) {
			var copy = (array || []).slice(0);
			copy[index(array)] = val;
			return copy;
		});
	};

	Lens.Last = Lens.nth(-1);

	function copyObj(obj) {
		var copy = {};
		for(var p in obj) {
			if (_.has(obj, p)) {
				copy[p] = obj[p];
			}
		}
		return copy;
	}

	Lens.prop = function(property) {
		return new Lens(function(obj) {
			return obj && obj[property];
		}, function(obj, val) {
			// shallow copy and write
			var copy = copyObj(obj || {});
			copy[property] = val;
			return copy;
		});
	};

	// XXX this isn't really so bad. a shallow copy will be made of the 
	// enumerable properties of the class, then a new instance will be 
	// constructed from that.
	/**
	 * Create a lens that ensures that the value set is of the given type (by
	 * instantiating a new instance of the Type.)
	 * This violates the first lens law and is probably not a good idea.
	 */
	Lens.typed = function(Class) {
		return new Lens(function(instance) {
			return instance;
		}, function(oldInstance, newData) {
			var result = new Class(newData);
			return result instanceof Scalar ? result.value : result;
		});
	};

	function Scalar(value) {
		this.value = value;
	}

	/**
	 * Lens.typed creates a new instance via new Class(newData). If you need a
	 * scalar value (string, number, etc.) you cannot return it from a 
	 * constructor. So return Lens.typed.scalar(value) instead.
	 */
	Lens.typed.scalar = function(value) {
		return new Scalar(value);
	};

	Lens.path = function() {
		return _.toArray(arguments).reduce(function(lens, prop) {
			return lens.andThen(prop instanceof Lens ? prop :
				typeof prop === "number" ?
					Lens.nth(prop) : Lens.prop(prop));
		}, Lens.I);
	};

	module.exports = Lens;
})();

},{"./_":1}],4:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var Lens = _dereq_("./lens"),
		Undo = _dereq_("./undo"),
		Atom = _dereq_("./atom");

	module.exports = {
		Atom: Atom,
		Lens: Lens,
		Undo: Undo,
	};
})();
},{"./atom":2,"./lens":3,"./undo":5}],5:[function(_dereq_,module,exports){
(function() {
	"use strict";

	var Lens = _dereq_("./lens");
	var _ = _dereq_("./_");

	/**
	 * Warning: Undo should be attached to an atom before any other 
	 * interceptors, otherwise those interceptors may see transient undo/redo
	 * states that will not actually be persisted.
	 */
	function Undo(atom, options) {
		options = _.extend({
			maxStates: Number.POSITIVE_INFINITY,
			namespace: "__mu-undo-redo-history__",
			timeBetweenStates: 0,
		}, options);

		var root = Lens.path(options.namespace);
		var undos = Lens.path(root, "undos");
		var undoing = Lens.path(root, "undoing");
		var redoing = Lens.path(root, "redoing");
		var lastUndo = Lens.path(undos, 0, "state");
		var lastRedo = Lens.path(root, "lastRedo");
		function lastChange(data) {
			return ((undos.get(data) || [])[0] || {}).time || 0;
		}

		// remember the undos
		atom.beforeChange(function(root, lastRoot) {
			// if the last change was > 2 seconds ago, remember the current
			// state (unless we are currently undoing or redoing)
			if ((Date.now() - options.timeBetweenStates) >= lastChange(root) &&
					!undoing.get(root) && !redoing.get(root)) {
				return lastRedo.set(undos.mod(root, function(data) {
					return [{
						// XXX store without the undos, so we can limit the size
						state: undos.set(lastRoot, null),
						time: Date.now(),
					}].concat((data || [])).slice(0, options.maxStates);
				}), null);
			}
			return root;
		});

		// undo/redo funciton by setting the appropriate flag on the state
		// which these handlers will see, and rewind/ff as appropriate
		// the flag will never actually be set, because we return either the
		// undo/redo state or the previous state if there isn't one

		function setUndos(root, prev) {
			return undos.set(prev, (undos.get(root) || []).slice(1, options.maxStates));			
		}

		// if undoing, return the last state, with current state added to redo
		atom.beforeChange(function(root, lastRoot) {
			if (undoing.get(root)) {
				var prev = lastUndo.get(root);
				return prev ? lastRedo.set(setUndos(root, prev), {
					state: lastRoot,
					time: Date.now(),
				}) : lastRoot;
			}
			return root;
		});

		// if redoing, return the last redo state
		atom.beforeChange(function(root, lastRoot) {
			if (redoing.get(root)) {
				return (lastRedo.get(root) || {}).state || lastRoot;
			}
			return root;
		});


		return Object.defineProperties({
			/**
			 * Peek at the previous state. Not sure how this is useful.
			 * Returns:
				{
					previousState: {}, // the value that undo() would restore
					undoneState: {}, // the value (if any) that redo() would restore
				}
			 */
			peek: function() {
				var data = atom.get();
				return {
					previousState: lastUndo.get(data),
					undoneState: lastRedo.get(data),
				};
			},
			undo: function() {
				atom.set(undoing.set(atom.get(), true));
			},
			redo: function() {
				atom.set(redoing.set(atom.get(), true));
			},
			reset: function() {
				atom.set(root.set(atom.get(), null));
			},
		}, {
			// not sure why you might need this except for testing
			cleanState: {
				get: function() {
					var copy = _.extend({}, atom.get());
					delete copy[options.namespace];
					return copy;
				}
			},
		});
	}

	module.exports = Undo;
})();

},{"./_":1,"./lens":3}]},{},[4])
(4)
});