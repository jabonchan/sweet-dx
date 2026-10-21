import type { TestSource } from "./types.ts";

/** Constructors and destructors: C1 and D1 are emitted by clang as aliases of C2 / D2 (or separately). */
export const SPECIAL: TestSource = {
    name: "special",
    prelude: String.raw`
        namespace a { struct X {}; }

        struct C {
            C();
            C(C const&);
            C(C&&);
            C(int, char const*, ...);
            C(a::X*, C const&, void (*)(C&));
            ~C();
        };

        struct E { explicit E(int); explicit E(a::X const&, bool); };

        struct V { virtual ~V(); virtual void f(); };

        struct Base { Base(); virtual ~Base(); };
        struct Derived : virtual Base { Derived(int); ~Derived(); };

        namespace sweetdx { namespace game {
            struct Profile {
                Profile();
                Profile(int, Profile const&);
                ~Profile();
                struct Entry { Entry(Profile*); ~Entry(); };
            };
        } }

        struct Outer { struct Inner { Inner(); Inner(Outer&, Inner const&); ~Inner(); }; };

        template <class T> struct Box {
            Box();
            Box(T const&);
            Box(Box const&);
            Box(T*, int);
            ~Box();
        };

        template <class K, class V> struct Pair { Pair(); Pair(K, V); ~Pair(); };
    `,
    cases: [
        ["C::C()", "C::C() {}"],
        ["C::C(C const&)", "C::C(C const&) {}"],
        ["C::C(C&&)", "C::C(C&&) {}"],
        ["C::C(int, char const*, ...)", "C::C(int, char const*, ...) {}"],
        [
            "C::C(a::X*, C const&, void (*)(C&))",
            "C::C(a::X*, C const&, void (*)(C&)) {}",
        ],
        ["C::~C()", "C::~C() {}"],

        ["explicit E::E(int)", "E::E(int) {}"],
        ["explicit E::E(a::X const&, bool)", "E::E(a::X const&, bool) {}"],

        // Virtual destructors also get a deleting destructor (D0), D1 is still there
        ["V::~V()", "V::~V() {} void V::f() {}"],

        // Virtual bases: C1/C2 and D1/D2 are different functions
        ["Base::Base()", "Base::Base() {} Base::~Base() {}"],
        ["Derived::Derived(int)", "Derived::Derived(int) {}"],
        ["Derived::~Derived()", "Derived::~Derived() {}"],

        [
            "sweetdx::game::Profile::Profile()",
            "sweetdx::game::Profile::Profile() {}",
        ],
        [
            "sweetdx::game::Profile::Profile(int, sweetdx::game::Profile const&)",
            "sweetdx::game::Profile::Profile(int, Profile const&) {}",
        ],
        [
            "sweetdx::game::Profile::~Profile()",
            "sweetdx::game::Profile::~Profile() {}",
        ],
        [
            "sweetdx::game::Profile::Entry::Entry(sweetdx::game::Profile*)",
            "sweetdx::game::Profile::Entry::Entry(Profile*) {}",
        ],
        [
            "sweetdx::game::Profile::Entry::~Entry()",
            "sweetdx::game::Profile::Entry::~Entry() {}",
        ],

        ["Outer::Inner::Inner()", "Outer::Inner::Inner() {}"],
        [
            "Outer::Inner::Inner(Outer&, Outer::Inner const&)",
            "Outer::Inner::Inner(Outer&, Inner const&) {}",
        ],
        ["Outer::Inner::~Inner()", "Outer::Inner::~Inner() {}"],

        // Members of class templates use the real types, not T_
        ["Box<int>::Box()", "template <class T> Box<T>::Box() {}"],
        [
            "Box<int>::Box(int const&)",
            "template <class T> Box<T>::Box(T const&) {}",
        ],
        [
            "Box<int>::Box(Box<int> const&)",
            "template <class T> Box<T>::Box(Box const&) {}",
        ],
        [
            "Box<int>::Box(int*, int)",
            "template <class T> Box<T>::Box(T*, int) {}",
        ],
        [
            "Box<int>::~Box()",
            "template <class T> Box<T>::~Box() {} template struct Box<int>;",
        ],
        ["Box<a::X>::Box(a::X const&)", "template struct Box<a::X>;"],
        ["Box<a::X>::~Box()", ""],
        [
            "Box<Box<char>>::Box(Box<char> const&)",
            "template struct Box<Box<char>>;",
        ],

        [
            "Pair<int, a::X>::Pair(int, a::X)",
            "template <class K, class V> Pair<K, V>::Pair() {} template <class K, class V> Pair<K, V>::Pair(K, V) {}",
        ],
        [
            "Pair<a::X, a::X>::Pair()",
            "template <class K, class V> Pair<K, V>::~Pair() {} template struct Pair<int, a::X>; template struct Pair<a::X, a::X>;",
        ],
        ["Pair<a::X, a::X>::~Pair()", ""],
    ],
};
