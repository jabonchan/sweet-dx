import type { TestSource } from "./types.ts";

/** Member functions, cv and ref qualifiers, static/virtual members, every operator and conversion operators. */
export const MEMBERS: TestSource = {
    name: "members",
    prelude: String.raw`
        namespace ns { struct Tag {}; }
        template <class T> struct Box {};

        struct M {
            // The move assignment below would delete the implicit copy constructor
            M() = default;
            M(M const&) = default;

            void plain();
            void c() const;
            void v() volatile;
            void cv() const volatile;
            static int s_count(int);
            virtual void v_method() const;
            M* self(M*, M const&);

            // Arithmetic and bitwise, unary and binary
            M operator+() const;        M operator+(M const&) const;
            M operator-() const;        M operator-(int) const;
            M operator*(M const&) const; int& operator*();
            M* operator&();             M operator&(M const&) const;
            M operator/(M const&) const; M operator%(M const&) const;
            M operator^(M const&) const; M operator|(M const&) const;
            M operator~() const;        bool operator!() const;
            M operator<<(int) const;    M operator>>(int) const;
            bool operator&&(M const&) const; bool operator||(M const&) const;

            // Assignment
            M& operator=(M const&);     M& operator=(M&&);
            M& operator+=(M const&);    M& operator-=(M const&);
            M& operator*=(M const&);    M& operator/=(M const&);
            M& operator%=(M const&);    M& operator^=(M const&);
            M& operator&=(M const&);    M& operator|=(M const&);
            M& operator<<=(int);        M& operator>>=(int);

            // Comparison
            bool operator==(M const&) const; bool operator!=(M const&) const;
            bool operator<(M const&) const;  bool operator>(M const&) const;
            bool operator<=(M const&) const; bool operator>=(M const&) const;
            int operator<=>(M const&) const;

            // Increment, access, calls
            M& operator++();            M operator++(int);
            M& operator--();            M operator--(int);
            M* operator->();            int operator->*(int);
            int& operator[](unsigned int);
            int operator()(int, char const*, ...);
            M& operator,(M const&);

            // Allocation
            static void* operator new(__SIZE_TYPE__);
            static void* operator new[](__SIZE_TYPE__);
            static void* operator new(__SIZE_TYPE__, void*);
            static void operator delete(void*);
            static void operator delete[](void*);
            static void operator delete(void*, __SIZE_TYPE__);

            // Conversions
            operator int() const;
            explicit operator bool() const;
            operator M*();
            operator M const&() const;
            operator int&();
            operator ns::Tag const*() const;
            operator void*() const volatile;
            operator Box<int>() const;
            operator unsigned long long() const;
        };

        struct R {
            void f() &;
            void f() &&;
            void f() const &;
            void f() const volatile &&;
        };

        namespace ops {
            M operator+(M const&, M const&);
            bool operator==(M const&, int);
            M operator-(M const&);
        }
    `,
    cases: [
        ["void M::plain()", "void M::plain() {}"],
        ["void M::c() const", "void M::c() const {}"],
        ["void M::v() volatile", "void M::v() volatile {}"],
        ["void M::cv() const volatile", "void M::cv() const volatile {}"],
        ["static int M::s_count(int)", "int M::s_count(int) { return 0; }"],
        ["virtual void M::v_method() const", "void M::v_method() const {}"],
        [
            "M* M::self(M*, M const&)",
            "M* M::self(M*, M const&) { return this; }",
        ],

        ["void R::f() &", "void R::f() & {}"],
        ["void R::f() &&", "void R::f() && {}"],
        ["void R::f() const &", "void R::f() const & {}"],
        ["void R::f() const volatile &&", "void R::f() const volatile && {}"],

        ["M M::operator+() const", "M M::operator+() const { return *this; }"],
        [
            "M M::operator+(M const&) const",
            "M M::operator+(M const&) const { return *this; }",
        ],
        ["M M::operator-() const", "M M::operator-() const { return *this; }"],
        [
            "M M::operator-(int) const",
            "M M::operator-(int) const { return *this; }",
        ],
        [
            "M M::operator*(M const&) const",
            "M M::operator*(M const&) const { return *this; }",
        ],
        [
            "int& M::operator*()",
            "int& M::operator*() { static int x; return x; }",
        ],
        ["M* M::operator&()", "M* M::operator&() { return this; }"],
        [
            "M M::operator&(M const&) const",
            "M M::operator&(M const&) const { return *this; }",
        ],
        [
            "M M::operator/(M const&) const",
            "M M::operator/(M const&) const { return *this; }",
        ],
        [
            "M M::operator%(M const&) const",
            "M M::operator%(M const&) const { return *this; }",
        ],
        [
            "M M::operator^(M const&) const",
            "M M::operator^(M const&) const { return *this; }",
        ],
        [
            "M M::operator|(M const&) const",
            "M M::operator|(M const&) const { return *this; }",
        ],
        ["M M::operator~() const", "M M::operator~() const { return *this; }"],
        [
            "bool M::operator!() const",
            "bool M::operator!() const { return 0; }",
        ],
        [
            "M M::operator<<(int) const",
            "M M::operator<<(int) const { return *this; }",
        ],
        [
            "M M::operator>>(int) const",
            "M M::operator>>(int) const { return *this; }",
        ],
        [
            "bool M::operator&&(M const&) const",
            "bool M::operator&&(M const&) const { return 0; }",
        ],
        [
            "bool M::operator||(M const&) const",
            "bool M::operator||(M const&) const { return 0; }",
        ],

        [
            "M& M::operator=(M const&)",
            "M& M::operator=(M const&) { return *this; }",
        ],
        ["M& M::operator=(M&&)", "M& M::operator=(M&&) { return *this; }"],
        [
            "M& M::operator+=(M const&)",
            "M& M::operator+=(M const&) { return *this; }",
        ],
        [
            "M& M::operator-=(M const&)",
            "M& M::operator-=(M const&) { return *this; }",
        ],
        [
            "M& M::operator*=(M const&)",
            "M& M::operator*=(M const&) { return *this; }",
        ],
        [
            "M& M::operator/=(M const&)",
            "M& M::operator/=(M const&) { return *this; }",
        ],
        [
            "M& M::operator%=(M const&)",
            "M& M::operator%=(M const&) { return *this; }",
        ],
        [
            "M& M::operator^=(M const&)",
            "M& M::operator^=(M const&) { return *this; }",
        ],
        [
            "M& M::operator&=(M const&)",
            "M& M::operator&=(M const&) { return *this; }",
        ],
        [
            "M& M::operator|=(M const&)",
            "M& M::operator|=(M const&) { return *this; }",
        ],
        ["M& M::operator<<=(int)", "M& M::operator<<=(int) { return *this; }"],
        ["M& M::operator>>=(int)", "M& M::operator>>=(int) { return *this; }"],

        [
            "bool M::operator==(M const&) const",
            "bool M::operator==(M const&) const { return 0; }",
        ],
        [
            "bool M::operator!=(M const&) const",
            "bool M::operator!=(M const&) const { return 0; }",
        ],
        [
            "bool M::operator<(M const&) const",
            "bool M::operator<(M const&) const { return 0; }",
        ],
        [
            "bool M::operator>(M const&) const",
            "bool M::operator>(M const&) const { return 0; }",
        ],
        [
            "bool M::operator<=(M const&) const",
            "bool M::operator<=(M const&) const { return 0; }",
        ],
        [
            "bool M::operator>=(M const&) const",
            "bool M::operator>=(M const&) const { return 0; }",
        ],
        [
            "int M::operator<=>(M const&) const",
            "int M::operator<=>(M const&) const { return 0; }",
        ],

        ["M& M::operator++()", "M& M::operator++() { return *this; }"],
        ["M M::operator++(int)", "M M::operator++(int) { return *this; }"],
        ["M& M::operator--()", "M& M::operator--() { return *this; }"],
        ["M M::operator--(int)", "M M::operator--(int) { return *this; }"],
        ["M* M::operator->()", "M* M::operator->() { return this; }"],
        ["int M::operator->*(int)", "int M::operator->*(int) { return 0; }"],
        [
            "int& M::operator[](unsigned int)",
            "int& M::operator[](unsigned int) { static int x; return x; }",
        ],
        [
            "int M::operator()(int, char const*, ...)",
            "int M::operator()(int, char const*, ...) { return 0; }",
        ],
        [
            "M& M::operator,(M const&)",
            "M& M::operator,(M const&) { return *this; }",
        ],

        [
            "void* M::operator new(size_t)",
            "void* M::operator new(__SIZE_TYPE__) { return 0; }",
        ],
        [
            "void* M::operator new[](size_t)",
            "void* M::operator new[](__SIZE_TYPE__) { return 0; }",
        ],
        [
            "void* M::operator new(size_t, void*)",
            "void* M::operator new(__SIZE_TYPE__, void* p) { return p; }",
        ],
        ["void M::operator delete(void*)", "void M::operator delete(void*) {}"],
        [
            "void M::operator delete[](void*)",
            "void M::operator delete[](void*) {}",
        ],
        [
            "void M::operator delete(void*, size_t)",
            "void M::operator delete(void*, __SIZE_TYPE__) {}",
        ],

        ["M::operator int() const", "M::operator int() const { return 0; }"],
        ["M::operator bool() const", "M::operator bool() const { return 0; }"],
        ["M::operator M*()", "M::operator M*() { return this; }"],
        [
            "M::operator M const&() const",
            "M::operator M const&() const { return *this; }",
        ],
        [
            "M::operator int&()",
            "M::operator int&() { static int x; return x; }",
        ],
        [
            "M::operator ns::Tag const*() const",
            "M::operator ns::Tag const*() const { return 0; }",
        ],
        [
            "M::operator void*() const volatile",
            "M::operator void*() const volatile { return 0; }",
        ],
        [
            "M::operator Box<int>() const",
            "M::operator Box<int>() const { return {}; }",
        ],
        [
            "M::operator unsigned long long() const",
            "M::operator unsigned long long() const { return 0; }",
        ],

        // Non-member operators
        [
            "M ops::operator+(M const&, M const&)",
            "M ops::operator+(M const&, M const&) { return M(); }",
        ],
        [
            "bool ops::operator==(M const&, int)",
            "bool ops::operator==(M const&, int) { return 0; }",
        ],
        [
            "M ops::operator-(M const&)",
            "M ops::operator-(M const&) { return M(); }",
            {
                knownMismatch:
                    "a unary operator in a namespace is mangled as a binary member operator (titanio warns about it)",
            },
        ],
        [
            "M operator*(M const&, M const&)",
            "M operator*(M const&, M const&) { return M(); }",
        ],
        ["M* operator&(M const&)", "M* operator&(M const&) { return 0; }"],
        ["bool operator!(M const&)", "bool operator!(M const&) { return 0; }"],

        // User-defined literals
        [
            'unsigned long long operator""_mib(unsigned long long)',
            'unsigned long long operator""_mib(unsigned long long v) { return v << 20; }',
        ],
        [
            'long double operator""_deg(long double)',
            'long double operator""_deg(long double v) { return v; }',
        ],
        [
            'char operator""_ch(char)',
            'char operator""_ch(char c) { return c; }',
        ],
        [
            'int operator""_len(char const*, size_t)',
            'int operator""_len(char const*, __SIZE_TYPE__) { return 0; }',
        ],
    ],
};
