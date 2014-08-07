(function() {
	"use strict";

	var Lens = require("./lens"),
		_ = require("./_");

	var deepFreeze = function(obj) {
		if (process.env.NODE_ENV !== "production") {
			// don't freeze in production mode
			if (typeof obj !== "object" || obj == null) {
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
			if (arguments.length) {
				var result = lens.set(computed(), newValue);
				if (interceptors.length) {
					var newVal = lens.get(result);
					var oldVal = lens.get(computed());
					result = lens.set(result, interceptors.reduce(function(newVal, fn) {
						return fn(newVal, oldVal);
					}, newVal));
				}
				deepFreeze(result);
				computed(result);
				return;
			}
			return lens.get(computed());
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
