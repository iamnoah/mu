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

	it("should support appending", function() {
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
});

describe("Atom#define", function() {
	function Root(data) { _.extend(this, data); }
	function Foo(data) { _.extend(this, data); }
	function Baz(data) { _.extend(this, data); }
	var convertFoo = Atom.convert(Foo, {
		bar: {
			baz: Atom.convert(Baz)
		}
	});
	var RootAtom = Atom.define(Root, {
		foo: convertFoo,
		qux: convertFoo,
	});
	var mockVal, setCount;
	function mockCompute(val) {
		if (arguments.length) {
			mockVal = val;
			setCount++;
		}
		return mockVal;
	}
	mockCompute(RootAtom.fromJSON({
		foo: {
			bar: {
				baz: {
					abc: 123
				}
			}
		},
		qux: [{
			bar: {
				baz: {
					abc: 456
				}
			}
		}, {
			bar: {
				baz: {
					abc: 789
				}
			}
		}]
	}));
	var state = new RootAtom(mockCompute);

	it("should provide fromJSON to convert raw data", function() {
		state.get().should.be.an.instanceOf(Root);
		state.focus("qux", 1, "bar", "baz").get().should.be.an.instanceOf(Baz);
	});
	
	it("should convert nested objects to the correct types", function() {
		state.focus("qux", 1, "bar", "baz", "abc").set(111);
		mockCompute().qux[1].bar.baz.should.be.an.instanceOf(Baz);
		mockCompute().qux[1].should.be.an.instanceOf(Foo);
		mockCompute().foo.should.be.an.instanceOf(Foo);
		mockCompute().should.be.an.instanceOf(Root);
	});

	it("should work with atomic updates", function() {
		setCount = 0;
		state.update(function(state) {
			state.focus("qux", 1, "bar", "baz", "abc").set(111);
			state.focus("foo", "bar", "baz", "abc").set(222);			
		});
		setCount.should.eql(1);
		mockCompute().qux[1].should.be.an.instanceOf(Foo);
		mockCompute().foo.should.be.an.instanceOf(Foo);

		state.focus("foo").update(function(foo) {
			foo.focus("hello").set("world");
		});
		mockCompute().foo.should.be.an.instanceOf(Foo);
		mockCompute().foo.hello.should.eql("world");
	});
});
