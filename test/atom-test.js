/*global describe, it*/
"use strict";
var Atom = require("../src/atom");
var Lens = require("../src/lens");
var _ = require("lodash");
var should = require("should");

describe("Atom", function() {
	var state;
	beforeEach(function() {
		state = new Atom({
			bar: 123
		});
	});
	it("should create a non-observable compute function if a non-function is given", function() {
		state().should.eql({ bar: 123 });
	});
	it("should reflect changes to the compute", function() {
		state.get().should.eql({ bar: 123 });
		var bar = state.focus("bar");
		bar.get().should.eql(123);

		// now change it and see
		state({
			bar: "hi"
		});
		bar.get().should.eql("hi");
	});

	it("should change the compute when a property is set", function() {
		state.set({
			bar: 123
		});
		state.focus("baz").set("hi!");
		state().should.eql({
			bar: 123,
			baz: "hi!"
		});
	});

	it("should allow the compute to be set to null", function() {
		state.set(null);
		should(state()).be.empty;
	});

	it("should allow the compute to be set to a non-object", function() {
		state.set("hi");
		state().should.be.eql("hi");
		state.set(123);
		state().should.be.eql(123);
		var d = new Date();
		state.set(d);
		state().should.be.eql(d);
	});

	it("should prevent modifications to the data", function() {
		state.set({
			foo: 123,
			bar: {
				baz: 456
			}
		});
		(function() {
			state.get().foo = 456;
		}).should.throw();
		(function() {
			state.get().bar.baz = false;
		}).should.throw();
	});

	it("should allow values to be deleted", function() {
		state.focus("bar").del();
		should("bar" in state()).be.false;
		// should work for arrays too
		state.focus("array").push(123);
		state.focus("array").push(456);
		state.focus("array").push(789);
		state.focus("array", 1).del();
		state().array.should.eql([123, 789]);

		state.del();
		should(state()).be.null;
	});

	it("should allow keys to be deleted", function() {
		state.del("bar");
		("bar" in state()).should.be.false;

		// should work for arrays too
		state.focus("array").push(123);		
		state.focus("array").push(456);
		state.focus("array").push(789);
		state.focus("array").del(1);
		state().array.should.eql([123, 789]);
	});

	it("should allow assign/extend on objects", function() {
		state.assign({
			array: [1,2,3],
		});
		state().should.eql({
			bar: 123,
			array: [1,2,3],
		});

		(function() {
			state.extend([]);
		}).should.throw();
		(function() {
			state.focus("array").extend({});
		}).should.throw();
	});


	it("should allow defaults on objects", function() {
		state.defaults({
			bar: 456,
			baz: 456,
		});
		state().should.eql({
			bar: 123,
			baz: 456,
		});

		(function() {
			state.defaults([]);
		}).should.throw();
		(function() {
			state.focus("array").defaults({});
		}).should.throw();
	});

	it("should support array ops on arrays", function() {
		state.focus("array").push("hi");
		state().should.eql({
			bar: 123,
			array: ["hi"]
		});
		state.focus("array").push("there");

		state().should.eql({
			bar: 123,
			array: ["hi", "there"]
		});
		state.focus("array").pop().should.eql("there");
		state.focus("array").unshift("say");
		state().should.eql({
			bar: 123,
			array: ["say", "hi"]
		});
		state.focus("array").shift().should.eql("say");
	});

	it("should support merging arrays by identity", function() {
		var a = state.focus("array");
		a.set([1,2,3]);
		a.merge([1,2,3]);
		a.get().should.eql([1,2,3]);

		a.merge([1,3,5]);
		a.get().should.eql([1,2,3,5]);

		a.set([{id:1},{id:3}]);
		a.merge([{id:1},{id:5}], "id");
		a.get().should.eql([{id:1},{id:3},{id:5}]);

		a.merge([{id:6},{id:7}], function(obj) {
			return obj.id % 2;
		});
		a.get().should.eql([{id:1},{id:3},{id:5},{id:6}]);
	});


	it("should allow removing by identity", function() {
		var a = state.focus("array");
		a.set([1,2,3]);
		a.remove([2]);
		a.get().should.eql([1,3]);

		a.remove([5]);
		a.get().should.eql([1,3]);

		a.set([{id:1},{id:3}]);
		a.remove([{id:1},{id:5}], "id");
		a.get().should.eql([{id:3}]);

		a.remove([{id:6},{id:7}], function(obj) {
			return obj.id % 2;
		});
		a.get().should.eql([]);
	});


	it("should allow set/assoc semantics", function() {
		state.set("baz", 123);

		state().should.eql({
			bar: 123,
			baz: 123,
		});
		state.focus("array").set(1, "foo");
		state().should.eql({
			bar: 123,
			baz: 123,
			array: [, "foo"],
		});
	});

	it("should support atomic updates", function() {
		var mockVal = {
			data: {
				name: "Bob",
			},
			state: {
				named: {
					count: 123,
				},
			},
		};
		var setCount = 0;
		state = new Atom(function (val) {
			if (arguments.length) {
				mockVal = val;
				setCount++;
			}
			return mockVal;
		});

		state.update(function(state) {
			state.focus("data", "name").set("Barry");
			var count = state.focus("state", "named", "count");
			count.set(count.get() + 1);
		});
		state().should.eql({
			data: {
				name: "Barry",
			},
			state: {
				named: {
					count: 124,
				},
			},			
		});
		setCount.should.eql(1);
	});

	it("should allow changes to be intercepted", function() {
		var count = Lens.path("counts", "even");
		state.beforeChange(function(newState, oldState) {
			if ((oldState.bar % 2) && (newState.bar % 2) === 0) {
				return count.set(newState, (count.get(oldState) || 0) + 1);
			}
			return newState;
		});

		state.focus("bar").set(122);
		should((state.get().counts || {}).even).eql(1);
		state.focus("bar").set(124);
		should((state.get().counts || {}).even).eql(1);
		state.focus("bar").set(125);
		should((state.get().counts || {}).even).eql(1);
		state.focus("bar").set(126);
		should((state.get().counts || {}).even).eql(2);
	});

	it("should allow changes to be intercepted on focused atoms", function() {
		var bar = state.focus("bar");
		bar.beforeChange(function(bar) {
			if (bar % 2) {
				return bar + 1;
			}
			return bar;
		});

		bar.set(1);
		state.get().bar.should.eql(2);

		bar.set(4);
		state.get().bar.should.eql(4);

		bar.set(11);
		state.get().bar.should.eql(12);
	});
});

