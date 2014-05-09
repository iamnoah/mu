(function() {
	"use strict";

	var Lens = require("./lens"),
	// TODO implement the lodash funcs we use to get file size down
		_ = require("lodash");
	/**
	 * Creates a getter-setter combining the given Lens with the given compute.
	 *
	 * @param {Lens} lens
	 * @param {compute} computed
	 * @return a function like that returned by atom(...) suitable for 
	 * creating a compute.
	 */
	function compose(lens, computed) {
		function getterSetter(newValue) {
			if (arguments.length) {
				computed(Object.freeze(lens.set(computed(), newValue)));
				return;
			}
			return lens.get(computed());
		}
		getterSetter.get = function() {
			return getterSetter();
		};
		getterSetter.set = function(newValue) {
			getterSetter(newValue);
		};
		return getterSetter;
	}

	/**
	 * Wraps a computed function. computed is presumably an observable
	 * that has the following semantics:
		computed() => return the current value
		computed(newValue) => sets the current value
	 * 
	 * Atom provides the following semantics:

		var state = Atom(stateCompute);
		var baz = state("foo", "bar", 3, "baz");
		baz.get() => stateCompute().foo.bar[3].baz
		baz() => shorthand for get
		baz.set(123) => sets stateCompute().foo.bar[3].baz to 123,
			stateCompute will be updated
		baz(123) => shorthand for set
	 *
	 * The property function returned by Atom#get is suitable for creating a CanJS compute.
	 * KnockoutJS users can do a simple translation:
		ko.computed({ read: baz.get, write: baz.set })
	 *
	 * Recommendation: Object.freeze the initial value your compute/observed
	 * contains to prevent non-atomic modifications.
	 *
	 * Any modifications to objects or arrays will use simple copy operations. 
	 * If you are using something other than plain objects and arrays, your 
	 * data will end up converted to plain objects.
	 */
	function Atom(computed) {
		return function() {
			return compose(Lens.path.apply(Lens, arguments), computed);
		};
	}

	/**
	 * Creates a converter lens
	 *
	 * @param {function(JSON): T} fromJSON
	 * @param {?function(T): JSON} toJSON
	 */
	// function convert(fromJSON, toJSON) {
	// 	toJSON = toJSON || function(value) {
	// 		return value && value.toJSON && value.toJSON() ||
	// 			_.clone(value, true);
	// 	};

	// 	return new Lens(toJSON, function(oldData, newData) {
	// 		return fromJSON(newData);
	// 	});
	// }

	/**
	 * Convenience for wrapping an instance of a serializable class.
	 * Assumptions:
	 *
	 * 1. Class will be invoked by calling new Class(rawData)
	 * 2. If toJSON is not specified and the class does not have a toJSON method,
	 *    it will be deep cloned via _.clone(instance, true)
	 * 3. If Class is not specified, computed() will be invoked to discover the class.
	 *   If computed initially returns null, this will blow up.
	 *
	 * @param {compute} computed
	 * @param {?function(): *} Class the constructor for creating new 
	 * instances of the  class.
	 * @param {?function(T): JSON} toJSON function to serialize the class 
	 * instances.
	 * @return {Atom} a new atom.
	 */
	// Atom.wrapClass = function(computed, Class, toJSON) {
	// 	if (!Class) {
	// 		Class = computed().constructor;
	// 	}

	// 	return new Atom(compose(convert(function(data) {
	// 		return new Class(data);
	// 	}, toJSON), computed));
	// };

	module.exports = Atom;
})();
