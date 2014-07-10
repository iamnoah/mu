## mu

A simple library for working with immutable data in mutable+observable MV* applications.

### Installation

    bower install --save https://github.com/iamnoah/mu.git

### Description

Functional programming makes programs easier to reason about. Add in persistent data structures and whole classes of errors can be ruled out, and performance can be optimized easily. But at some point, you need to mutate some state (even in Haskell.) Being able to observe and bind state changes reduces boilerplate and simplifies application logic.

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

### Supported Environments

mu should hapilly run in any ES5 environement. i.e., IE9+, or node.

### Converting Data

By default, Atoms work on plain objects and arrays. Whenever you use an Atom to set a value, mu makes copies of any objects and arrays in the path and replaces the changed objects with references to the new values.

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

#### Caveat

Anytime an object is updated, mu will shallow copy all the enumerable properties into a plain object, make changes to it, and then call the function you pass it as a constructor. e.g., `new YourClass(newData)`.

That means:

 * If your class has non-enumerable state, it will be lost. Keep it simple.
 * If your class has state that you do not want copied (e.g., bound functions,) make it non-enumerable.
 * `Object.defineProperty` is your friend. getters and setters are recommended.

### Helper Methods

`focus` with `get` and `set` should be able to handle 90% of what you need to do with atoms in a very DRY way. There are additional helper methods for the other 10%:


    // Delete a Key
    var dataCompute = compute({
        foo: 123,
        bar: "delete me"
    });
    var atom = new Atom(dataCompute);
    atom.focus("bar").del();
    atom() === { foo: 123 }

    // Append to an array:
    var dataCompute = compute({
        qux: ["hi"]
    });
    var atom = new Atom(dataCompute);
    atom.focus("qux").push("mom");
    atom() === { qux: ["hi", "mom!"] }

    // Remove from an array:
    var dataCompute = compute({
        qux: ["hi", "there", "mom"]
    });
    var atom = new Atom(dataCompute);
    atom.focus("qux", 1).del();
    atom() === { qux: ["hi", "mom"] }


#### Atomic Updates

Sometimes you may need to change several values at once in order for the atom to remain consistent. e.g., suppose you have an atom that stores the user's cursor position in a text editor and the current text. When the user types a character, if you update the text first, the cursor position will be wrong, but if you update the cursor posiition first, that is also wrong because the cursor would be after a character that doesn't yet exist in the text. You need to set both at the same time.

If you need to atomically change more than 1 value within the atom, use update:

    atom.update(function(newAtom) { // must use the passed in atom
        newAtom.focus("foo").set(123);
        newAtom.focus("bar", "baz").set("abc");
    });

Note that the update function receives a new atom. Only the new atom should be used to get/set values. The original atom will not show any changes until the update function returns. e.g.,

    atom.update(function(newAtom) { // only use newAtom, not the out atom!
        newAtom.focus("foo").set(123);
        atom.focus("foo").get() !== 123 // BUG
        atom.focus("foo").set(456) // BUG! this change will fire immediately, but be lost after this function returns!
        newAtom.focus("bar", "baz").set("abc");
    });

Atomic updates are recommended whenever you need to change more than one property at the same time.

### Lenses

Atom uses functional lenses internally to create focused computes. You can pass your own Lenses to focus and they will be inserted into the path.

    TODO example

### mu's compute

A compute implementation is included if you need one.

## mu

So which is better, functional programming or imperative programming? [mu][1]

[1]: http://en.wikipedia.org/wiki/Mu_(negative)#.22Unasking.22_the_question
