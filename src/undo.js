(function() {
	"use strict";

	var Lens = require("./lens");
	var _ = require("./_");

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
