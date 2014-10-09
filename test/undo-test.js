/*global describe, it, beforeEach */
"use strict";
var Atom = require("../src/atom");
var Undo = require("../src/undo");
var should = require("should");

describe("Undo", function() {
	var state;
	var undo;
	beforeEach(function() {
		state = new Atom({
			bar: 123
		});
		undo = new Undo(state, {
			maxStates: 5,
			timeBetweenStates: 19,
		});
	});
	it("should remember 1 state per time between states", function(done) {
		// should be no change or error if there is nothing to undo
		undo.cleanState.should.eql({
			bar: 123,
		});
		undo.undo();
		undo.cleanState.should.eql({
			bar: 123,
		});

		state.set({
			bar: 2,
		});
		var baz = state.focus("baz");
		baz.set("1st set");

		setTimeout(function() {
			baz.set("abc");
			baz.set("def");

			// should always remember the initial state
			undo.undo();
			undo.cleanState.should.eql({
				bar: 2,
				baz: "1st set",
			});
			baz.get().should.eql("1st set");

			// initial state
			undo.undo();
			should(baz.get()).be.empty;
			undo.cleanState.should.eql({
				bar: 123,
			});

			// back to 1st state
			undo.redo();
			undo.cleanState.should.eql({
				bar: 2,
				baz: "1st set",
			});
			baz.get().should.eql("1st set");

			// back to most recent state
			undo.redo();
			undo.cleanState.should.eql({
				bar: 2,
				baz: "def",
			});
			baz.get().should.eql("def");

			// no more states (no error, no change)
			undo.redo();
			undo.cleanState.should.eql({
				bar: 2,
				baz: "def",
			});
			baz.get().should.eql("def");

			done();
		}, 20);
	});

	it("should remember a maximum number of states", function(done) {
		var bar = state.focus("bar");
		bar.set(3);
		var times = 7;

		inc();
		function inc() {
			bar.set(bar.get() + 1);
			if (--times) {
				setTimeout(inc, 20);
			} else {
				verify();
			}
		}
		function verify() {
			bar.get().should.eql(10);

			undo.undo();
			bar.get().should.eql(9);
			undo.undo();
			bar.get().should.eql(8);
			undo.undo();
			bar.get().should.eql(7);
			undo.undo();
			bar.get().should.eql(6);
			undo.undo();
			bar.get().should.eql(5);

			// should be out of (undo) history at this point
			undo.undo();
			bar.get().should.eql(5);

			// make sure we can put them all back
			undo.redo();
			bar.get().should.eql(6);
			undo.redo();
			bar.get().should.eql(7);
			undo.redo();
			bar.get().should.eql(8);
			undo.redo();
			bar.get().should.eql(9);
			undo.redo();
			bar.get().should.eql(10);
			undo.redo();
			bar.get().should.eql(10);

			done();
		}
	});

	it("should be able to clear history", function() {
		var bar = state.focus("bar");
		bar.set(3);
		undo.reset();
		bar.set(5);

		bar.get().should.eql(5);
		undo.undo();
		bar.get().should.eql(3);

		// no more history
		undo.undo();
		bar.get().should.eql(3);
	});
});
