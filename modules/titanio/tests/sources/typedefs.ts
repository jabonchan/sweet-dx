import type { TestSource } from "./types.ts";

/**
 * Typedefs that titanio resolves from the clang macros. The prelude defines them from the same macros (the target
 * has no standard library), so the test fails if titanio and clang ever disagree about the target.
 */
export const TYPEDEFS: TestSource = {
    name: "typedefs",
    prelude: String.raw`
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
    `,
    cases: [
        [
            "void td_sizes(size_t, std::size_t, ptrdiff_t, std::ptrdiff_t, intptr_t, uintptr_t)",
            "void td_sizes(size_t, std::size_t, ptrdiff_t, std::ptrdiff_t, intptr_t, uintptr_t) {}",
        ],
        [
            "void td_exact(int8_t, uint8_t, int16_t, uint16_t, int32_t, uint32_t, int64_t, uint64_t)",
            "void td_exact(int8_t, uint8_t, int16_t, uint16_t, int32_t, uint32_t, int64_t, uint64_t) {}",
        ],
        [
            "void td_least_fast(int_least8_t, uint_least16_t, int_fast16_t, uint_fast32_t, int_fast64_t)",
            "void td_least_fast(int_least8_t, uint_least16_t, int_fast16_t, uint_fast32_t, int_fast64_t) {}",
        ],
        [
            "void td_max(intmax_t, uintmax_t, wint_t)",
            "void td_max(intmax_t, uintmax_t, wint_t) {}",
        ],
        [
            "void td_pointers(size_t*, uint8_t const*, int32_t&, Actor*, uint64_t (*)(uint32_t))",
            "void td_pointers(size_t*, uint8_t const*, int32_t&, Actor*, uint64_t (*)(uint32_t)) {}",
        ],
        [
            "void td_va(char const*, va_list)",
            "void td_va(char const*, va_list) {}",
        ],
        [
            "void td_va_pointer(va_list*, va_list&)",
            "void td_va_pointer(va_list*, va_list&) {}",
        ],
        [
            "void td_builtin_va(__builtin_va_list)",
            "void td_builtin_va(__builtin_va_list) {}",
        ],
        [
            "void td_nullptr(std::nullptr_t, decltype(nullptr))",
            "void td_nullptr(std::nullptr_t, decltype(nullptr)) {}",
        ],
        [
            "void td_array(std::array<int, 4>, std::array<char, 16>)",
            "void td_array(std::array<int, 4>, std::array<char, 16>) {}",
        ],
        [
            "void td_bitset(std::bitset<32>)",
            "void td_bitset(std::bitset<32>) {}",
        ],
        [
            "void td_project(u8, u16, u32, u64, s8, s16, s32, s64, f32, f64)",
            "void td_project(u8, u16, u32, u64, s8, s16, s32, s64, f32, f64) {}",
        ],
        [
            "void td_project_compound(u32 const*, s64&, f32 (*)(u8), Box<u16>, Box<s32 const*>)",
            "void td_project_compound(u32 const*, s64&, f32 (*)(u8), Box<u16>, Box<s32 const*>) {}",
        ],
        [
            "uint32_t td_return_ignored(size_t)",
            "uint32_t td_return_ignored(size_t) { return 0; }",
        ],
    ],
};
