import type { TestSource } from "./types.ts";

/**
 * Function templates (explicitly instantiated) and class templates as parameters. The template headers in the
 * signatures tell titanio which parameters depend on a template parameter (T_, T0_...).
 */
export const TEMPLATES: TestSource = {
    name: "templates",
    prelude: String.raw`
        namespace a { struct X {}; }
        template <class T> struct Box { template <class U> void convert(U); template <class U> static U cast(T const&); };
        template <class K, class V> struct Pair {};
        template <class T, int N> struct Arr {};
        template <bool B> struct Flag {};
        template <unsigned N> struct UArr {};
        template <char C> struct Letter {};
        template <class T, class U = int> struct Defaulted {};
        template <auto N> struct Auto {};
    `,
    cases: [
        // Class templates as parameter types
        [
            "void t_params(Box<int>, Box<Box<int>>, Pair<int, Box<int>>, Pair<a::X, a::X>)",
            "void t_params(Box<int>, Box<Box<int>>, Pair<int, Box<int>>, Pair<a::X, a::X>) {}",
        ],
        [
            "void t_nontype_args(Arr<int, 4>, Arr<char, -1>, Flag<true>, Flag<false>)",
            "void t_nontype_args(Arr<int, 4>, Arr<char, -1>, Flag<true>, Flag<false>) {}",
        ],
        [
            "void t_literal_suffixes(UArr<3u>, UArr<0x10u>, Letter<'a'>)",
            "void t_literal_suffixes(UArr<3u>, UArr<0x10u>, Letter<'a'>) {}",
        ],
        // An auto parameter takes the type of the literal, which depends on its base, suffix and size (long is 32-bit)
        [
            "void t_literal_types(Auto<42>, Auto<3000000000>, Auto<0x80000000>, Auto<0x100000000>, Auto<-2147483648>)",
            "void t_literal_types(Auto<42>, Auto<3000000000>, Auto<0x80000000>, Auto<0x100000000>, Auto<-2147483648>) {}",
        ],
        [
            "void t_literal_suffix_types(Auto<5000000000u>, Auto<0xFFFFFFFFl>, Auto<4294967295ul>, Auto<7ll>)",
            "void t_literal_suffix_types(Auto<5000000000u>, Auto<0xFFFFFFFFl>, Auto<4294967295ul>, Auto<7ll>) {}",
        ],
        [
            "void t_defaults_written(Defaulted<char, int>, Defaulted<int, int>)",
            "void t_defaults_written(Defaulted<char>, Defaulted<int>) {}",
        ],
        [
            "void t_template_args_cv(Box<int const*>, Box<int (*)(char)>, Box<int&>)",
            "void t_template_args_cv(Box<int const*>, Box<int (*)(char)>, Box<int&>) {}",
        ],
        [
            "void t_template_substitutions(Box<a::X>, Box<a::X>*, Pair<Box<a::X>, a::X>)",
            "void t_template_substitutions(Box<a::X>, Box<a::X>*, Pair<Box<a::X>, a::X>) {}",
        ],

        // Function templates
        [
            "template <typename T> void t_one<int>(T)",
            "template <class T> void t_one(T) {} template void t_one<int>(int);",
        ],
        [
            "template <typename T> T t_return<long>(T, T)",
            "template <class T> T t_return(T a, T) { return a; } template long t_return<long>(long, long);",
        ],
        [
            "template <typename T, typename U> U t_two<char, a::X>(T*, U const&, T)",
            "template <class T, class U> U t_two(T*, U const& u, T) { return u; } template a::X t_two<char, a::X>(char*, a::X const&, char);",
        ],
        [
            "template <typename T> void t_not_dependent<int>(int, T)",
            "template <class T> void t_not_dependent(int, T) {} template void t_not_dependent<int>(int, int);",
        ],
        [
            "template <typename T, typename U> void t_same_args<int, int>(T, U)",
            "template <class T, class U> void t_same_args(T, U) {} template void t_same_args<int, int>(int, int);",
        ],
        [
            "template <typename T> void t_dependent_compound<a::X>(T*, T const&, Box<T>, T (*)(T))",
            "template <class T> void t_dependent_compound(T*, T const&, Box<T>, T (*)(T)) {} template void t_dependent_compound<a::X>(a::X*, a::X const&, Box<a::X>, a::X (*)(a::X));",
        ],
        [
            "template <typename T> Box<T> t_make<a::X>(T const&)",
            "template <class T> Box<T> t_make(T const&) { return {}; } template Box<a::X> t_make<a::X>(a::X const&);",
        ],
        [
            "template <typename T> void t_box_arg<Box<int>>(T)",
            "template <class T> void t_box_arg(T) {} template void t_box_arg<Box<int>>(Box<int>);",
        ],
        [
            "template <typename T> void t_pointer_arg<char const*>(T)",
            "template <class T> void t_pointer_arg(T) {} template void t_pointer_arg<char const*>(char const*);",
        ],
        [
            "template <typename T> void sweetdx::util::t_in_namespace<float>(T*)",
            "namespace sweetdx { namespace util { template <class T> void t_in_namespace(T*) {} template void t_in_namespace<float>(float*); } }",
        ],

        // Non-type template parameters
        [
            "template <int N> void t_int<42>()",
            "template <int N> void t_int() {} template void t_int<42>();",
        ],
        [
            "template <int N> void t_negative<-7>()",
            "template <int N> void t_negative() {} template void t_negative<-7>();",
        ],
        [
            "template <bool B> void t_bool<false>()",
            "template <bool B> void t_bool() {} template void t_bool<false>();",
        ],
        [
            "template <char C> void t_char<'z'>()",
            "template <char C> void t_char() {} template void t_char<'z'>();",
        ],
        [
            "template <unsigned N> void t_unsigned<7u>()",
            "template <unsigned N> void t_unsigned() {} template void t_unsigned<7u>();",
        ],
        [
            "template <long long N> void t_long_long<5ll>()",
            "template <long long N> void t_long_long() {} template void t_long_long<5ll>();",
        ],
        // A dependent array bound is encoded as a template parameter too (RAT0__T_), titanio warns about it
        [
            "template <typename T, int N> void t_dependent_bound<a::X, 3>(T (&)[N])",
            "template <class T, int N> void t_dependent_bound(T (&)[N]) {} template void t_dependent_bound<a::X, 3>(a::X (&)[3]);",
            {
                knownMismatch:
                    "array bounds that depend on a template parameter are not supported",
            },
        ],
        [
            "template <typename T, int N> void t_dependent_bound_literal<a::X, 4>(T (&)[4])",
            "template <class T, int N> void t_dependent_bound_literal(T (&)[N]) {} template void t_dependent_bound_literal<a::X, 4>(a::X (&)[4]);",
            {
                knownMismatch:
                    "the bound 4 comes from N, clang encodes it as T0_",
            },
        ],
        // A bound that doesn't come from a template parameter is a plain number (no warning)
        [
            "template <typename T> void t_fixed_bound<a::X>(T (&)[8])",
            "template <class T> void t_fixed_bound(T (&)[8]) {} template void t_fixed_bound<a::X>(a::X (&)[8]);",
        ],

        // Member templates
        [
            "template <typename U> void Box<int>::convert<a::X>(U)",
            "template <class T> template <class U> void Box<T>::convert(U) {} template void Box<int>::convert<a::X>(a::X);",
        ],
        [
            "template <typename U> U Box<a::X>::cast<int>(a::X const&)",
            "template <class T> template <class U> U Box<T>::cast(T const&) { return U(); } template int Box<a::X>::cast<int>(a::X const&);",
        ],
    ],
};
