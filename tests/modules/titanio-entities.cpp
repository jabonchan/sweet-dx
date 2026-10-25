// --------------------------------------------------------------------------------------------------------------
// variables
// --------------------------------------------------------------------------------------------------------------

namespace entities {

int n_int = 1;
int* n_pointer = nullptr;
void (*n_callback)(int) = nullptr;
char n_array[4] = {};

namespace deep { namespace deeper { long n_nested = 2; } }

struct Holder {
    static int s_count;
    static Holder* s_instance;
    static float s_table[3];
    struct Inner { static bool s_flag; };
};

int Holder::s_count = 0;
Holder* Holder::s_instance = nullptr;
float Holder::s_table[3] = {};
bool Holder::Inner::s_flag = false;

// Only instantiations of a template static member have a symbol
template <class T> struct Box { static T s_value; };
template <class T> T Box<T>::s_value = T();
template struct Box<int>;
template struct Box<Holder*>;
template struct Box<Box<int>*>;

template <class T, int N> struct Array { static int s_size; };
template <class T, int N> int Array<T, N>::s_size = N;
template struct Array<char, 8>;

} // namespace entities

// libc++ (the Nintendo SDK's standard library) declares everything in an inline namespace
namespace std { inline namespace __1 { int std_counter = 0; } }

// --------------------------------------------------------------------------------------------------------------
// guard variables
// --------------------------------------------------------------------------------------------------------------

namespace entities {

int compute();

// A dynamically initialized template static member needs a guard, since every TU may initialize it
template <class T> struct Lazy { static int s_value; };
template <class T> int Lazy<T>::s_value = compute();
template struct Lazy<long>;
template struct Lazy<Holder>;

} // namespace entities

// --------------------------------------------------------------------------------------------------------------
// vtables, VTTs and typeinfo
// --------------------------------------------------------------------------------------------------------------

namespace entities {

// The key function is defined here, so the vtable and typeinfo are emitted here
struct Polymorphic { virtual ~Polymorphic(); virtual void f(); };
Polymorphic::~Polymorphic() {}
void Polymorphic::f() {}

namespace deep { struct Nested { virtual void g(); }; void Nested::g() {} }

template <class T> struct Generic { virtual void h() {} };
template struct Generic<char>;
template struct Generic<deep::Nested*>;
template struct Generic<Box<unsigned int> const*>;

// A virtual base adds a VTT
struct VirtualBase { virtual ~VirtualBase(); };
VirtualBase::~VirtualBase() {}
struct VirtualDerived : virtual VirtualBase { VirtualDerived(); virtual void k(); };
VirtualDerived::VirtualDerived() {}
void VirtualDerived::k() {}

} // namespace entities
