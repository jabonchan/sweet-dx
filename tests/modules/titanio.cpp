// --------------------------------------------------------------------------------------------------------------
// builtins
// --------------------------------------------------------------------------------------------------------------

namespace builtins {



void b_void() {}
void b_void_list(void) {}
void b_chars(char, signed char, unsigned char, wchar_t, char8_t, char16_t, char32_t) {}
void b_ints(short, unsigned short, int, unsigned int, long, unsigned long, long long, unsigned long long) {}
void b_spellings(short int, long int, long long int, unsigned, signed, short unsigned int, long unsigned, signed int) {}
void b_reordered(int unsigned, long long unsigned int, int short, char signed) {}
void b_floats(float, double, long double, bool) {}
int* b_return_type_ignored(int) { return 0; }
void b_pointers(int*, int**, int***, void*, void const*, void const volatile*) {}
void b_cv(int const*, int volatile*, int const volatile*, int* const*, int const* const*, int* volatile*) {}
void b_east_west_const(const int*, int const*, const char* const*) {}
void b_refs(int&, int const&, int&&, int const&&, int*&, int* const&) {}
void b_top_level_cv(int const, int* const, int const* const, int volatile) {}
void b_array_decay(int[8], char[], int[2][3]) {}
void b_array_pointers(int (*)[5], int (&)[5], int const (&)[3], char (*)[2][4]) {}
void b_array_sizes(int (*)[0x10], int (*)[1'000]) {}
void b_functions(void (*)(), int (*)(int, char), void (&)(int), void (*)(int, ...), int (*)(void)) {}
void b_function_values(void (int), int ()) {}
void b_noexcept(void (*)() noexcept, void (&)(int) noexcept) {}
void b_function_pointer_pointers(void (**)(int), void (* const*)(int), void (*&)(char)) {}
void b_returning_function_pointers(void (*(*)(int))(char)) {}
void b_array_of_function_pointers(int (*(*)[3])(long)) {}
void b_same_function_type_twice(void (*)(int), void (*)(int)) {}
void b_variadic(...) {}
int b_printf_like(char const*, ...) { return 0; }

} // namespace builtins

// --------------------------------------------------------------------------------------------------------------
// names
// --------------------------------------------------------------------------------------------------------------

struct Global {};
enum Plain { PlainA };
enum class Scoped : unsigned char { A };
union Bits { int i; float f; };

namespace a {
    struct X {};
    namespace b {
        struct X {};
        namespace c {
            struct X {};
            struct Deep { struct Inner { struct Innermost {}; void method(X, Innermost*); }; };
        }
    }
}

namespace sweetdx { namespace game { namespace actors {
    struct ActorBase {};
    struct PlayerController {};
    enum class State : int { Idle };
} } }

namespace n { struct T0 {}; struct T1 {}; struct T2 {}; struct T3 {}; struct T4 {}; struct T5 {}; struct T6 {}; struct T7 {}; struct T8 {}; struct T9 {}; struct T10 {}; struct T11 {}; struct T12 {}; }
namespace ns { struct ns {}; }

void n_global(Global, Plain, Scoped, Bits) {}
void n_same_names(a::X, a::b::X, a::b::c::X, a::X, a::b::c::X) {}
void n_deep(a::b::c::Deep::Inner::Innermost*, a::b::c::Deep::Inner&) {}
void a::b::c::Deep::Inner::method(X, Innermost*) {}
namespace sweetdx { namespace game { namespace actors { void n_in_namespace(ActorBase*, PlayerController const&, State) {} } } }
void n_ns_ns(ns::ns, ns::ns*, ns::ns const&) {}
void n_many_substitutions(n::T0, n::T1, n::T2, n::T3, n::T4, n::T5, n::T6, n::T7, n::T8, n::T9, n::T10, n::T11, n::T12, n::T12, n::T0, n::T10, n::T11) {}
void n_pointer_substitutions(a::X*, a::X**, a::X const*, a::X* const*, a::X&) {}
void n_name_longer_than_ten_characters(sweetdx::game::actors::ActorBase) {}
void _n_underscores_and_digits_2x(int) {}
void n_leading_scope(::Global, ::a::X) {}

// --------------------------------------------------------------------------------------------------------------
// members
// --------------------------------------------------------------------------------------------------------------

namespace members {

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
}

void M::plain() {}
void M::c() const {}
void M::v() volatile {}
void M::cv() const volatile {}
int M::s_count(int) { return 0; }
void M::v_method() const {}
M* M::self(M*, M const&) { return this; }
void R::f() & {}
void R::f() && {}
void R::f() const & {}
void R::f() const volatile && {}
M M::operator+() const { return *this; }
M M::operator+(M const&) const { return *this; }
M M::operator-() const { return *this; }
M M::operator-(int) const { return *this; }
M M::operator*(M const&) const { return *this; }
int& M::operator*() { static int x; return x; }
M* M::operator&() { return this; }
M M::operator&(M const&) const { return *this; }
M M::operator/(M const&) const { return *this; }
M M::operator%(M const&) const { return *this; }
M M::operator^(M const&) const { return *this; }
M M::operator|(M const&) const { return *this; }
M M::operator~() const { return *this; }
bool M::operator!() const { return 0; }
M M::operator<<(int) const { return *this; }
M M::operator>>(int) const { return *this; }
bool M::operator&&(M const&) const { return 0; }
bool M::operator||(M const&) const { return 0; }
M& M::operator=(M const&) { return *this; }
M& M::operator=(M&&) { return *this; }
M& M::operator+=(M const&) { return *this; }
M& M::operator-=(M const&) { return *this; }
M& M::operator*=(M const&) { return *this; }
M& M::operator/=(M const&) { return *this; }
M& M::operator%=(M const&) { return *this; }
M& M::operator^=(M const&) { return *this; }
M& M::operator&=(M const&) { return *this; }
M& M::operator|=(M const&) { return *this; }
M& M::operator<<=(int) { return *this; }
M& M::operator>>=(int) { return *this; }
bool M::operator==(M const&) const { return 0; }
bool M::operator!=(M const&) const { return 0; }
bool M::operator<(M const&) const { return 0; }
bool M::operator>(M const&) const { return 0; }
bool M::operator<=(M const&) const { return 0; }
bool M::operator>=(M const&) const { return 0; }
int M::operator<=>(M const&) const { return 0; }
M& M::operator++() { return *this; }
M M::operator++(int) { return *this; }
M& M::operator--() { return *this; }
M M::operator--(int) { return *this; }
M* M::operator->() { return this; }
int M::operator->*(int) { return 0; }
int& M::operator[](unsigned int) { static int x; return x; }
int M::operator()(int, char const*, ...) { return 0; }
M& M::operator,(M const&) { return *this; }
void* M::operator new(__SIZE_TYPE__) { return 0; }
void* M::operator new[](__SIZE_TYPE__) { return 0; }
void* M::operator new(__SIZE_TYPE__, void* p) { return p; }
void M::operator delete(void*) {}
void M::operator delete[](void*) {}
void M::operator delete(void*, __SIZE_TYPE__) {}
M::operator int() const { return 0; }
M::operator bool() const { return 0; }
M::operator M*() { return this; }
M::operator M const&() const { return *this; }
M::operator int&() { static int x; return x; }
M::operator ns::Tag const*() const { return 0; }
M::operator void*() const volatile { return 0; }
M::operator Box<int>() const { return {}; }
M::operator unsigned long long() const { return 0; }
M ops::operator+(M const&, M const&) { return M(); }
bool ops::operator==(M const&, int) { return 0; }
M operator*(M const&, M const&) { return M(); }
bool operator!(M const&) { return 0; }
unsigned long long operator""_mib(unsigned long long v) { return v << 20; }
long double operator""_deg(long double v) { return v; }
char operator""_ch(char c) { return c; }
int operator""_len(char const*, __SIZE_TYPE__) { return 0; }

} // namespace members

// --------------------------------------------------------------------------------------------------------------
// special
// --------------------------------------------------------------------------------------------------------------

namespace special {

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

C::C() {}
C::C(C const&) {}
C::C(C&&) {}
C::C(int, char const*, ...) {}
C::C(a::X*, C const&, void (*)(C&)) {}
C::~C() {}
E::E(int) {}
E::E(a::X const&, bool) {}
V::~V() {} void V::f() {}
Base::Base() {} Base::~Base() {}
Derived::Derived(int) {}
Derived::~Derived() {}
sweetdx::game::Profile::Profile() {}
sweetdx::game::Profile::Profile(int, Profile const&) {}
sweetdx::game::Profile::~Profile() {}
sweetdx::game::Profile::Entry::Entry(Profile*) {}
sweetdx::game::Profile::Entry::~Entry() {}
Outer::Inner::Inner() {}
Outer::Inner::Inner(Outer&, Inner const&) {}
Outer::Inner::~Inner() {}
template <class T> Box<T>::Box() {}
template <class T> Box<T>::Box(T const&) {}
template <class T> Box<T>::Box(Box const&) {}
template <class T> Box<T>::Box(T*, int) {}
template <class T> Box<T>::~Box() {} template struct Box<int>;
template struct Box<a::X>;

template struct Box<Box<char>>;
template <class K, class V> Pair<K, V>::Pair() {} template <class K, class V> Pair<K, V>::Pair(K, V) {}
template <class K, class V> Pair<K, V>::~Pair() {} template struct Pair<int, a::X>; template struct Pair<a::X, a::X>;


} // namespace special

// --------------------------------------------------------------------------------------------------------------
// templates
// --------------------------------------------------------------------------------------------------------------

namespace templates {

namespace a { struct X {}; }
template <class T> struct Box { template <class U> void convert(U); template <class U> static U cast(T const&); };
template <class K, class V> struct Pair {};
template <class T, int N> struct Arr {};
template <bool B> struct Flag {};
template <unsigned N> struct UArr {};
template <class T, class U = int> struct Defaulted {};
template <auto N> struct Auto {};

void t_params(Box<int>, Box<Box<int>>, Pair<int, Box<int>>, Pair<a::X, a::X>) {}
void t_nontype_args(Arr<int, 4>, Arr<char, -1>, Flag<true>, Flag<false>) {}
void t_literal_suffixes(UArr<3u>, UArr<0x10u>) {}
void t_literal_types(Auto<42>, Auto<3000000000>, Auto<0x80000000>, Auto<0x100000000>, Auto<-2147483648>) {}
void t_literal_suffix_types(Auto<5000000000u>, Auto<0xFFFFFFFFl>, Auto<4294967295ul>, Auto<7ll>) {}
void t_defaults_written(Defaulted<char>, Defaulted<int>) {}
void t_template_args_cv(Box<int const*>, Box<int (*)(char)>, Box<int&>) {}
void t_template_substitutions(Box<a::X>, Box<a::X>*, Pair<Box<a::X>, a::X>) {}
template <class T> void t_one(T) {} template void t_one<int>(int);
template <class T> T t_return(T a, T) { return a; } template long t_return<long>(long, long);
template <class T, class U> U t_two(T*, U const& u, T) { return u; } template a::X t_two<char, a::X>(char*, a::X const&, char);
template <class T> void t_dependent_compound(T*, T const&, Box<T>, T (*)(T)) {} template void t_dependent_compound<a::X>(a::X*, a::X const&, Box<a::X>, a::X (*)(a::X));
template <class T> Box<T> t_make(T const&) { return {}; } template Box<a::X> t_make<a::X>(a::X const&);
template <class T> void t_box_arg(T) {} template void t_box_arg<Box<int>>(Box<int>);
template <class T> void t_pointer_arg(T) {} template void t_pointer_arg<char const*>(char const*);
namespace sweetdx { namespace util { template <class T> void t_in_namespace(T*) {} template void t_in_namespace<float>(float*); } }
template <int N> void t_int() {} template void t_int<42>();
template <int N> void t_negative() {} template void t_negative<-7>();
template <bool B> void t_bool() {} template void t_bool<false>();
template <unsigned N> void t_unsigned() {} template void t_unsigned<7u>();
template <long long N> void t_long_long() {} template void t_long_long<5ll>();
template <class T> void t_fixed_bound(T (&)[8]) {} template void t_fixed_bound<a::X>(a::X (&)[8]);
template <class T> template <class U> void Box<T>::convert(U) {} template void Box<int>::convert<a::X>(a::X);
template <class T> template <class U> U Box<T>::cast(T const&) { return U(); } template int Box<a::X>::cast<int>(a::X const&);

} // namespace templates

// --------------------------------------------------------------------------------------------------------------
// typedefs
// --------------------------------------------------------------------------------------------------------------

namespace std {
    typedef __SIZE_TYPE__ size_t;
    typedef __PTRDIFF_TYPE__ ptrdiff_t;
    typedef decltype(nullptr) nullptr_t;

    // libc++ (the Nintendo SDK's standard library) declares its templates in an inline namespace
    inline namespace __1 {
        template <class T, size_t N> struct array {};
        template <size_t N> class bitset {};
    }
}

typedef __SIZE_TYPE__ size_t;
typedef __PTRDIFF_TYPE__ ptrdiff_t;
typedef __INTPTR_TYPE__ intptr_t;
typedef __UINTPTR_TYPE__ uintptr_t;
typedef __INTMAX_TYPE__ intmax_t;
typedef __UINTMAX_TYPE__ uintmax_t;
typedef __WINT_TYPE__ wint_t;
typedef __INT8_TYPE__ int8_t;
typedef __UINT8_TYPE__ uint8_t;
typedef __INT16_TYPE__ int16_t;
typedef __UINT16_TYPE__ uint16_t;
typedef __INT32_TYPE__ int32_t;
typedef __UINT32_TYPE__ uint32_t;
typedef __INT64_TYPE__ int64_t;
typedef __UINT64_TYPE__ uint64_t;
typedef __INT_LEAST8_TYPE__ int_least8_t;
typedef __UINT_LEAST16_TYPE__ uint_least16_t;
typedef __INT_FAST16_TYPE__ int_fast16_t;
typedef __UINT_FAST32_TYPE__ uint_fast32_t;
typedef __INT_FAST64_TYPE__ int_fast64_t;
typedef __builtin_va_list va_list;

// source/include/types.h
typedef unsigned char       u8;
typedef unsigned short      u16;
typedef unsigned int        u32;
typedef unsigned long long  u64;
typedef signed char         s8;
typedef signed short        s16;
typedef signed int          s32;
typedef signed long long    s64;
typedef float               f32;
typedef double              f64;

struct Actor;
template <class T> struct Box {};

void td_sizes(size_t, std::size_t, ptrdiff_t, std::ptrdiff_t, intptr_t, uintptr_t) {}
void td_exact(int8_t, uint8_t, int16_t, uint16_t, int32_t, uint32_t, int64_t, uint64_t) {}
void td_least_fast(int_least8_t, uint_least16_t, int_fast16_t, uint_fast32_t, int_fast64_t) {}
void td_max(intmax_t, uintmax_t, wint_t) {}
void td_pointers(size_t*, uint8_t const*, int32_t&, Actor*, uint64_t (*)(uint32_t)) {}
void td_va(char const*, va_list) {}
void td_va_pointer(va_list*, va_list&) {}
void td_builtin_va(__builtin_va_list) {}
void td_nullptr(std::nullptr_t, decltype(nullptr)) {}
void td_array(std::array<int, 4>, std::array<char, 16>) {}
void td_bitset(std::bitset<32>) {}
void td_project(u8, u16, u32, u64, s8, s16, s32, s64, f32, f64) {}
void td_project_compound(u32 const*, s64&, f32 (*)(u8), Box<u16>, Box<s32 const*>) {}
uint32_t td_return_ignored(size_t) { return 0; }
