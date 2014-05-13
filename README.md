## mu

A simple library for working with immutable data in mutable+observable MV* applications.

### Installation

    bower install --save https://github.com/iamnoah/mu.git

### Description

Functional programming makes programs easier to reason about. Add in persistant data structures, and whole classes of errors can be ruled out, and performance can be optimized easily. But at some point, you need to mutate some state. Being able to observe and bind state changes reduces boiler plate and simplifies application logic.

mu tries to give you tools for finding a happy place between pure functional programming and imperative state mutation.  With mu, you create a few persistent data structures, but have observable updates, and can effectively mutate your data without having to manually copy a bunch of objects. You can make your bindings as coarse or as fine grained as you need to, while still getting the benefits of functional, persistent data structures.

### Usage

### Atoms

Atoms are an interface for manipulating persistent data structures and creating new Atoms focused on specific parts of the data. e.g.,

    var atom = new Atom(myData);
    var baz = atom.focus("foo", "array", 2, "bar", "baz");
    baz.get() === myData.foo.array[2].bar.baz
    baz.set(newValue)

    atom.get() === { foo: [..., ..., { bar: { baz: newValue } }] }

### computes

mu does not directly depend on a compute implementation, so you must wrap the state yourself if you want to observe it.

    var dataCompute = compute(myData);
    var atom = new Atom(dataCompute);
    dataCompute.bind("change", function() {...})
    var baz = atom.focus("foo", "array", 2, "bar", "baz");
    baz() === dataCompute().foo.array[2].bar.baz
    baz.set(newValue) // dataCompute is updated and change handler is called

    // you can also create a compute from baz
    var bazCompute = compute(baz);
    bazCompute.bind("change", function() {...});

    atom.set({...}) // triggers an update of bazCompute

### Converting Data

By default, Atoms work on plain objects and arrays. Whenever you use an Atom to set a value, mu makes copies of any objects and arrays in the path and replaces the changes objects with references to the new values.

If you have Classes in your data structure, you can define an Atom Type that will makes copies of your Class instead of using plain objects:

    var convertFoo = Atom.convert(Foo, {
    	bar: {
    		baz: Atom.convert(Baz)
    	}
    });
    var RootAtom = Atom.define(Root, {
    	foo: convertFoo,
    	qux: convertFoo,
    });
    
    // fromJSON will use your converters to create your initial data
    var root = new RootAtom(compute(RootAtom.fromJSON(rawData)));
    root.get() instanceof Root
    root.focus("foo").get() instanceof Foo
    root.focus("foo", "bar", "baz", "qux").set(123)
    root.focus("foo", "bar", "baz").get() instanceof Baz
    root.focus("foo", "bar", "baz").get().qux === 123


### Lenses

Atom uses functional lenses internally to create focused computes. You can pass your own Lenses to focus and they will be inserted into the path.

    TODO example

### mu's compute

A compute implementation is included if you need one.

## mu

So which is better, functional programming or imperative programming? [mu][1]

[1]: http://en.wikipedia.org/wiki/Mu_(negative)#.22Unasking.22_the_question
