/*global describe, it*/
"use strict";
var Atom = require("../src/atom");
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

	it("should allow values to be deleted", function() {
		state.del("bar");
		should("bar" in state()).be.false;
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
	var mockVal;
	function mockCompute(val) {
		if (arguments.length) {
			mockVal = val;
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
});
